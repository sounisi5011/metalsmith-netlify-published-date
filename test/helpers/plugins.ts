import cloneDeep from 'lodash.clonedeep';
import Metalsmith from 'metalsmith';
import Mustache from 'mustache';

import { isFile } from '../../src/utils/metalsmith';

export function processCountPlugin(
    list: ({ clone: Metalsmith.Files; ref: Metalsmith.Files })[],
): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        list.push({
            clone: cloneDeep(files),
            ref: files,
        });
        done(null, files, metalsmith);
    };
}

export function convertMustachePlugin(): Metalsmith.Plugin {
    return (files, metalsmith, done) => {
        Object.entries(files).forEach(([filename, filedata]) => {
            const newFilename = filename.replace(/\.mustache$/, '.html');
            if (newFilename !== filename && isFile(filedata)) {
                try {
                    const output = Mustache.render(
                        filedata.contents.toString(),
                        filedata,
                    );
                    const newFiledata: typeof filedata = {
                        ...filedata,
                        contents: Buffer.from(output),
                    };

                    delete files[filename];
                    files[newFilename] = newFiledata;
                } catch (err) {
                    //
                }
            }
        });
        done(null, files, metalsmith);
    };
}
