import importCwd from 'import-cwd';

import { OptionsInterface } from '../plugin';
import { value2str } from '../utils';
import { voidReturnFunc } from './utils';

const PROP = 'metadataUpdater';
type ReturnFuncType = OptionsInterface[typeof PROP];

export function importModule(filepath: string): ReturnFuncType {
    /**
     * @see https://github.com/nodejs/node/blob/v12.7.0/lib/internal/modules/cjs/loader.js#L677-L680
     */
    if (filepath === '') {
        throw new TypeError(`"${PROP}" option must be a non-empty string`);
    }

    let func: unknown;
    try {
        func = importCwd(filepath);
    } catch (err) {
        throw new TypeError(
            `Failed to import module "${filepath}" specified in option "${PROP}"`,
        );
    }

    if (typeof func !== 'function') {
        throw new TypeError(
            `Module "${filepath}" specified in option "${PROP}" did not export the function: ${value2str(
                func,
            )}`,
        );
    }

    return voidReturnFunc(func);
}

export default function(value: unknown): ReturnFuncType {
    if (typeof value === 'function') {
        return voidReturnFunc(value);
    } else if (typeof value === 'string') {
        return importModule(value);
    } else {
        throw new TypeError(
            `The value of option "${PROP}" must be either a function, or a string: ${value2str(
                value,
            )}`,
        );
    }
}
