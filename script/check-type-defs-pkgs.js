/* @see https://github.com/sounisi5011/metalsmith-pug-extra/blob/v1.1.2/script/check-type-defs-pkgs.js */

const spawn = require('cross-spawn');
const fs = require('fs');
const path = require('path');
const util = require('util');

const parser = require('@typescript-eslint/typescript-estree');
const recursive = require('recursive-readdir');

const PKG = require(path.resolve(process.cwd(), 'package.json'));
const AST_IMPORT_TYPES = Object.entries(parser.AST_NODE_TYPES)
  .filter(([key]) => /import/i.test(key))
  .map(([, value]) => value);

const readFileAsync = util.promisify(fs.readFile);

function spawnAsync(...args) {
  return new Promise((resolve, reject) => {
    const process = spawn(...args);
    const stdoutList = [];
    const stderrList = [];

    if (process.stdout) {
      process.stdout.on('data', data => {
        stdoutList.push(data);
      });
    }

    if (process.stderr) {
      process.stderr.on('data', data => {
        stderrList.push(data);
      });
    }

    process.on('close', (code, signal) => {
      const data = {
        stdout: stdoutList.join(''),
        stderr: stderrList.join(''),
      };

      if (code === 0) {
        resolve(data);
      } else {
        reject(
          Object.assign(
            new Error(`command failed with exit code ${code}`),
            data,
          ),
        );
      }
    });

    process.on('error', err => {
      reject(err);
    });
  });
}

async function main(distDir, buildTask) {
  const distDirpath = path.resolve(process.cwd(), distDir);

  if (buildTask) {
    await spawnAsync('npm', ['run', buildTask], { stdio: 'inherit' });
  }

  const tsFilepathList = (await recursive(distDirpath)).filter(path =>
    /\.ts$/.test(path),
  );

  if (tsFilepathList.length < 1) {
    throw new Error(`".ts" file does not exist in "${distDir}" directory`);
  }

  const importSet = new Set(
    (
      await Promise.all(
        tsFilepathList
          .map(filepath => readFileAsync(filepath, 'utf8'))
          .map(async code => parser.parse(await code))
          .map(async ast => getImportNames(await ast)),
      )
    ).reduce((a, b) => a.concat(b)),
  );

  const typePkgNames = {
    deps: Object.keys(PKG.dependencies)
      .filter(pkgName => /^@types\//.test(pkgName))
      .filter(
        typePkgName => !importSet.has(typePkgName.replace(/^@types\//, '')),
      ),
    devDeps: [],
  };
  importSet.forEach(name => {
    const typePkgName = `@types/${name}`;
    if (typePkgName in PKG.devDependencies) {
      typePkgNames.devDeps.push(typePkgName);
    }
  });

  if (0 < typePkgNames.deps.length) {
    const pkgNamesStr = typePkgNames.deps
      .map(pkgName => `* ${pkgName}`)
      .join('\n');
    console.log(
      `Some packages do not need to be listed in the "dependencies" field:\n${pkgNamesStr}`,
    );
  }

  if (0 < typePkgNames.devDeps.length) {
    const pkgNamesStr = typePkgNames.devDeps
      .map(pkgName => `* ${pkgName}`)
      .join('\n');
    throw new Error(
      `Some packages need to be listed in the "dependencies" field:\n${pkgNamesStr}`,
    );
  }
}

function getImportNames(ast) {
  if (Array.isArray(ast)) {
    return [].concat(...ast.map(getImportNames));
  } else if (typeof ast === 'object' && ast) {
    if (ast.type && AST_IMPORT_TYPES.includes(ast.type)) {
      if (ast.type === 'ImportDeclaration') {
        if (ast.source.type === 'Literal') {
          return [ast.source.value];
        }
        throw new TypeError(
          `AST type "${ast.type}" / Source AST type "${ast.source.type}" not supported`,
        );
      }

      if (ast.type === 'TSImportType') {
        if (ast.parameter.type === 'TSLiteralType') {
          if (ast.parameter.literal.type === 'Literal') {
            return [ast.parameter.literal.value];
          }
          throw new TypeError(
            `AST type "${ast.type}" / Parameter AST type "${ast.parameter.type}" / Literal AST type "${ast.parameter.literal.type}" not supported`,
          );
        }
        throw new TypeError(
          `AST type "${ast.type}" / Parameter AST type "${ast.parameter.type}" not supported`,
        );
      }

      throw new TypeError(`AST type "${ast.type}" not supported`);
    } else {
      return [].concat(...Object.values(ast).map(getImportNames));
    }
  }

  return [];
}

(async () => {
  try {
    await main(process.argv[2], process.argv[3]);
  } catch (err) {
    process.exitCode = 1;
    console.error(err);
  }
})();
