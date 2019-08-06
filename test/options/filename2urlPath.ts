import test from 'ava';
import Metalsmith from 'metalsmith';

import netlifyPublishedDate from '../../src';
import { normalizeOptions } from '../../src/options';
import { appendValueReportPattern, chdir } from '../helpers/utils';

test('should import external script file', async t => {
    const metadata = {
        files: {},
        fileData: { contents: Buffer.from([]) },
        metalsmith: Metalsmith(__dirname),
    };

    await chdir([__dirname, 'fixtures'], async () => {
        {
            const options = normalizeOptions(
                { filename2urlPath: '.' },
                netlifyPublishedDate.defaultOptions,
            );
            t.is(
                await options.filename2urlPath('', metadata),
                '/',
                'should to import index.js file',
            );
        }

        {
            const options = normalizeOptions(
                { filename2urlPath: './mod.js' },
                netlifyPublishedDate.defaultOptions,
            );
            t.is(
                await options.filename2urlPath('', metadata),
                '/mod',
                'should to import script file',
            );
        }

        {
            const options = normalizeOptions(
                { filename2urlPath: './mod' },
                netlifyPublishedDate.defaultOptions,
            );
            t.is(
                await options.filename2urlPath('', metadata),
                '/mod',
                'should to import script file without .js extension',
            );
        }

        t.throws(
            () => {
                normalizeOptions(
                    { filename2urlPath: './not-found-mod' },
                    netlifyPublishedDate.defaultOptions,
                );
            },
            {
                instanceOf: TypeError,
                message: /[Ff]ailed to import module "\.\/not-found-mod" .* option "filename2urlPath"/,
            },
            'import of non-existent script file should fail',
        );

        t.throws(
            () => {
                normalizeOptions(
                    { filename2urlPath: './no-func' },
                    netlifyPublishedDate.defaultOptions,
                );
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /[Mm]odule "\.\/no-func" .* option "filename2urlPath" .* not export the function/,
                    require('./fixtures/no-func'),
                ),
            },
            'import of script files that do not export functions should fail',
        );

        t.throwsAsync(
            async () => {
                const options = normalizeOptions(
                    { filename2urlPath: './invalid-func' },
                    netlifyPublishedDate.defaultOptions,
                );
                await options.filename2urlPath('', metadata);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /[Mm]odule "\.\/invalid-func" .* option "filename2urlPath" .* not return a string/,
                    require('./fixtures/invalid-func')(),
                ),
            },
            'import of script files exporting functions that do not return strings should fail',
        );

        t.throws(
            () => {
                normalizeOptions(
                    { filename2urlPath: '@sounisi5011/example' },
                    netlifyPublishedDate.defaultOptions,
                );
            },
            {
                instanceOf: TypeError,
                message: /[Ff]ailed to import module "@sounisi5011\/example" .* option "filename2urlPath"/,
            },
            'If the module name does not start with "." and "/", should to import it like require() function',
        );
    });
});

test('should read url path from metadata', t => {
    const metadata = {
        files: {},
        fileData: {
            contents: Buffer.from([]),
            prop1: 42,
            prop2: 'about.html',
            prop3: 'about',
        },
        metalsmith: Metalsmith(__dirname),
    };

    for (const metadataProps of [
        'prop2',
        ['prop1', 'prop2'],
        ['prop2', 'prop1'],
        ['prop2', 'prop3'],
    ]) {
        const options = normalizeOptions(
            { filename2urlPath: { metadata: metadataProps } },
            netlifyPublishedDate.defaultOptions,
        );
        t.is(options.filename2urlPath('', metadata), 'about.html');
    }

    {
        const options = normalizeOptions(
            { filename2urlPath: { metadata: ['prop3', 'prop2'] } },
            netlifyPublishedDate.defaultOptions,
        );
        t.is(
            options.filename2urlPath('', metadata),
            'about',
            'metadata properties should be read from the beginning of the array',
        );
    }

    t.throws(
        () => {
            const options = normalizeOptions(
                { filename2urlPath: { metadata: 'prop4' } },
                netlifyPublishedDate.defaultOptions,
            );
            return options.filename2urlPath('', metadata);
        },
        {
            instanceOf: Error,
            message: appendValueReportPattern(
                /"prop4" (?:property|field) does not exist/,
                metadata.fileData,
                { depth: 0 },
            ),
        },
        'reading of properties not present in metadata should fail',
    );

    t.throws(
        () => {
            const options = normalizeOptions(
                { filename2urlPath: { metadata: 'prop1' } },
                netlifyPublishedDate.defaultOptions,
            );
            return options.filename2urlPath('', metadata);
        },
        {
            instanceOf: Error,
            message: appendValueReportPattern(
                /"prop1" (?:property|field) .* is not a string/,
                metadata.fileData.prop1,
                { depth: 0 },
            ),
        },
        'reading of non-string value in metadata should fail',
    );

    t.throws(
        () => {
            const options = normalizeOptions(
                { filename2urlPath: { metadata: ['prop6', 'prop1', 'prop4'] } },
                netlifyPublishedDate.defaultOptions,
            );
            return options.filename2urlPath('', metadata);
        },
        {
            instanceOf: Error,
            message: /following fields .* not found: prop6, prop1, prop4/,
        },
        'should fail if all metadata properties are invalid',
    );
});

test('should to replace filename with regular expression', t => {
    const metadata = {
        files: {},
        fileData: { contents: Buffer.from([]) },
        metalsmith: Metalsmith(__dirname),
    };
    const opt = {
        filename2urlPath: {
            replace: {
                fromRegExp: '\\.pug$',
                to: '.html',
            },
        },
    };
    const options = normalizeOptions(opt, netlifyPublishedDate.defaultOptions);

    [
        'test.pug',
        'test.ext',
        'test.pug.ext',
        'test.ext.pug',
        'test.pug.ext.pug',
        'test.ext.pug.ext',
    ].forEach(filename => {
        const expected = filename.replace(
            new RegExp(opt.filename2urlPath.replace.fromRegExp),
            opt.filename2urlPath.replace.to,
        );
        t.is(
            options.filename2urlPath(filename, metadata),
            expected,
            `filename2urlPath("${filename}") === "${expected}"`,
        );
    });
});

test('should to replace filenames with sub string', t => {
    const metadata = {
        files: {},
        fileData: { contents: Buffer.from([]) },
        metalsmith: Metalsmith(__dirname),
    };
    const opt = {
        filename2urlPath: {
            replace: {
                fromStr: '.pug',
                to: '.html',
            },
        },
    };
    const options = normalizeOptions(opt, netlifyPublishedDate.defaultOptions);

    [
        'test.pug',
        'test.ext',
        'test.pug.ext',
        'test.ext.pug',
        'test.pug.ext.pug',
        'test.ext.pug.ext',
    ].forEach(filename => {
        const expected = filename.replace(
            opt.filename2urlPath.replace.fromStr,
            opt.filename2urlPath.replace.to,
        );
        t.is(
            options.filename2urlPath(filename, metadata),
            expected,
            `filename2urlPath("${filename}") === "${expected}"`,
        );
    });
});

test('should throw an error if the invalid option is specified', t => {
    {
        const options = {
            filename2urlPath: 42,
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /option "filename2urlPath" .* a function, a string, or an object/,
                    options.filename2urlPath,
                ),
            },
            'The value of "filename2urlPath" should be a valid value',
        );
    }

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: '',
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"filename2urlPath" option must be a non-empty string/,
        },
        'The value of "filename2urlPath" should be a non-empty string',
    );

    {
        const options = {
            filename2urlPath: {},
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /option "filename2urlPath" must contain .* (?:properties|property)/,
                    options.filename2urlPath,
                    { depth: 0 },
                ),
            },
            'The value of "filename2urlPath" should be a non-empty object',
        );
    }

    {
        const options = {
            filename2urlPath: {
                xxxx: true,
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /option "filename2urlPath" must contain .* (?:properties|property)/,
                    options.filename2urlPath,
                    { depth: 0 },
                ),
            },
            'The value of "filename2urlPath" should be an object that also has valid property',
        );
    }

    {
        const options = {
            filename2urlPath: {
                metadata: 'canonical',
                replace: {
                    fromRegExp: '\\.pug$',
                    to: '.html',
                },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /option "filename2urlPath" .* not contain both .* "replace" .* and "metadata"/,
                    options.filename2urlPath,
                    { depth: 0 },
                ),
            },
            'The object value of "filename2urlPath" should not contain more than one valid property',
        );
    }

    {
        const options = {
            filename2urlPath: {
                metadata: null,
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"metadata" (?:property|field) .* option "filename2urlPath" .* neither a string nor an array/,
                    options.filename2urlPath.metadata,
                ),
            },
            'The "metadata" property should be a valid value',
        );
    }

    {
        const options = {
            filename2urlPath: {
                metadata: ['x', 42],
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"metadata" (?:property|field) .* option "filename2urlPath" .* not an array of strings/,
                    options.filename2urlPath.metadata,
                ),
            },
            'The "metadata" property should be an array of valid values',
        );
    }

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        metadata: [],
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"metadata" (?:property|field) .* option "filename2urlPath" .* empty array/,
        },
        'The "metadata" property should not accept empty array',
    );

    {
        const options = {
            filename2urlPath: {
                replace: null,
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"replace" (?:property|field) .* option "filename2urlPath" .* not a object/,
                    options.filename2urlPath.replace,
                ),
            },
            'The "replace" property should be a valid value',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: {},
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"replace" (?:property|field) .* "filename2urlPath" option .* "fromRegExp"(?: .+)? or(?: .+)? "fromStr" .* and(?: .+)? "to"/,
                    options.filename2urlPath.replace,
                    { depth: 0 },
                ),
            },
            'The "replace" property should not accept empty objects',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: { xxxx: 42 },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"replace" (?:property|field) .* "filename2urlPath" option .* "fromRegExp"(?: .+)? or(?: .+)? "fromStr" .* and(?: .+)? "to"/,
                    options.filename2urlPath.replace,
                    { depth: 0 },
                ),
            },
            'The object value of the "replace" property should contain the "fromRegExp" or "fromStr" property and the "to" property',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: { fromRegExp: '\\.pug$' },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"replace" (?:property|field) .* "filename2urlPath" option .* "to"/,
                    options.filename2urlPath.replace,
                    { depth: 0 },
                ),
            },
            'The object value of the "replace" property should contain the "to" property',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: { fromStr: '.pug' },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"replace" (?:property|field) .* "filename2urlPath" option .* "to"/,
                    options.filename2urlPath.replace,
                    { depth: 0 },
                ),
            },
            'The object value of the "replace" property should contain the "to" property',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: { to: '.html' },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"replace" (?:property|field) .* "filename2urlPath" option .* "fromRegExp"(?: .+)? or(?: .+)? "fromStr"/,
                    options.filename2urlPath.replace,
                    { depth: 0 },
                ),
            },
            'The object value of the "replace" property should contain the "fromRegExp" property or the "fromStr" property',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: { fromStr: '.ext', to: 42 },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"to" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath" .* not a string/,
                    options.filename2urlPath.replace.to,
                ),
            },
            'The "to" property of the "replace" property of "filename2urlPath" should be a valid value',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: {
                    fromRegExp: '\\.pug$',
                    fromStr: '.pug',
                    to: '42',
                },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"replace" (?:property|field) .* "filename2urlPath" option .* not contain both .* "fromRegExp"(?: .+)? and(?: .+)? "fromStr"/,
                    options.filename2urlPath.replace,
                    { depth: 0 },
                ),
            },
            'The "replace" property should only accept objects that have either the "fromRegExp" property or the "fromStr" property',
        );
    }

    {
        const options = {
            filename2urlPath: {
                replace: { fromRegExp: true, to: '42' },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"fromRegExp" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath" .* not a string/,
                    options.filename2urlPath.replace.fromRegExp,
                ),
            },
            'The "fromRegExp" property of the "replace" property should be a valid value',
        );
    }

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        replace: { fromRegExp: '(?:', to: '42' },
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: SyntaxError,
            message: /"fromRegExp" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath" .* invalid regular expression/,
        },
        'The "fromRegExp" property of the "replace" property of "filename2urlPath" should be a valid regular expression',
    );

    {
        const options = {
            filename2urlPath: {
                replace: { fromStr: true, to: '42' },
            },
        };
        t.throws(
            () => {
                normalizeOptions(options, netlifyPublishedDate.defaultOptions);
            },
            {
                instanceOf: TypeError,
                message: appendValueReportPattern(
                    /"fromStr" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath" .* not a string/,
                    options.filename2urlPath.replace.fromStr,
                ),
            },
            'The "fromStr" property of the "replace" property of "filename2urlPath" should be a valid value',
        );
    }
});
