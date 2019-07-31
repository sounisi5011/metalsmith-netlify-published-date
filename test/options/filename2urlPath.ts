import test from 'ava';
import Metalsmith from 'metalsmith';

import netlifyPublishedDate from '../../src';
import { normalizeOptions } from '../../src/options';
import { chdir } from '../helpers/utils';

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
                message: /[Mm]odule "\.\/not-found-mod" .* option "filename2urlPath"/,
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
                message: /[Mm]odule "\.\/no-func" .* option "filename2urlPath"/,
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
                message: /[Mm]odule "\.\/invalid-func" .* option "filename2urlPath"/,
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
                message: /[Mm]odule "@sounisi5011\/example" .* option "filename2urlPath"/,
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
        { instanceOf: Error, message: /"prop4" (?:property|field)/ },
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
        { instanceOf: Error, message: /"prop1" (?:property|field)/ },
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
        { instanceOf: Error, message: /prop6, prop1, prop4/ },
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
    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: 42,
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        { instanceOf: TypeError, message: /option "filename2urlPath"/ },
        'The value of "filename2urlPath" should be a valid value',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {},
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        { instanceOf: TypeError, message: /option "filename2urlPath"/ },
        'The value of "filename2urlPath" should be a non-empty object',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        xxxx: true,
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        { instanceOf: TypeError, message: /option "filename2urlPath"/ },
        'The value of "filename2urlPath" should be an object that also has valid property',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        metadata: 'canonical',
                        replace: {
                            fromRegExp: '\\.pug$',
                            to: '.html',
                        },
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /option "filename2urlPath"/,
        },
        'The object value of "filename2urlPath" should not contain more than one valid property',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        metadata: null,
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"metadata" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "metadata" property of "filename2urlPath" should be a valid value',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        metadata: ['x', 42],
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"metadata" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "metadata" property of "filename2urlPath" should be an array of valid values',
    );

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
            message: /"metadata" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "metadata" property of "filename2urlPath" should not accept empty arrays',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        replace: null,
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"replace" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "replace" property of "filename2urlPath" should be a valid value',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        replace: {},
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"replace" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "replace" property of "filename2urlPath" should not accept empty objects',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        replace: { to: 42 },
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"to" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "to" property of the "replace" property of "filename2urlPath" should be a valid value',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        replace: { to: '42' },
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"replace" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "replace" property of "filename2urlPath" should only accept objects with "fromRegExp" or "fromStr" properties',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        replace: { fromRegExp: true, to: '42' },
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"fromRegExp" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "fromRegExp" property of the "replace" property of "filename2urlPath" should be a valid value',
    );

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
            message: /"fromRegExp" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "fromRegExp" property of the "replace" property of "filename2urlPath" should be a valid regular expression',
    );

    t.throws(
        () => {
            normalizeOptions(
                {
                    filename2urlPath: {
                        replace: { fromStr: true, to: '42' },
                    },
                },
                netlifyPublishedDate.defaultOptions,
            );
        },
        {
            instanceOf: TypeError,
            message: /"fromStr" (?:property|field) .* "replace" (?:property|field) .* option "filename2urlPath"/,
        },
        'The "fromStr" property of the "replace" property of "filename2urlPath" should be a valid value',
    );
});
