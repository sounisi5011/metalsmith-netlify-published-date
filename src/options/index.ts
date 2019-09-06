import { OptionsInterface } from '../plugin';
import { isObject } from '../utils';
import normalizeContentsConverter from './contentsConverter';
import { normalize as normalizeFilename2urlPath } from './filename2urlPath';
import normalizeMetadataUpdater from './metadataUpdater';
import { normalize as normalizePlugins } from './plugins';

export function normalizeOptions(
    options: unknown,
    defaultOptions: OptionsInterface,
): OptionsInterface {
    if (!isObject(options)) {
        return defaultOptions;
    }

    const opts = {
        ...defaultOptions,
        ...options,
    };

    return {
        ...opts,
        plugins: normalizePlugins(opts.plugins),
        filename2urlPath: normalizeFilename2urlPath(opts.filename2urlPath),
        metadataUpdater: normalizeMetadataUpdater(opts.metadataUpdater),
        contentsConverter: normalizeContentsConverter(opts.contentsConverter),
    };
}
