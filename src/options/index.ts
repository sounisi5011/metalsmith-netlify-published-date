import { OptionsInterface } from '../plugin';
import { isObject } from '../utils';
import { normalize as normalizeFilename2urlPath } from './filename2urlPath';

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
        filename2urlPath: normalizeFilename2urlPath(opts.filename2urlPath),
    };
}
