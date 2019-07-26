import { OptionsInterface } from '../plugin';
import { hasProp, isObject, isStringArray, requireByCWD } from '../utils';
import { strReturnFunc } from './utils';

const CWD = process.cwd();
const PROP = 'filename2urlPath';
type ReturnFuncType = OptionsInterface[typeof PROP];

/**
 * @example
 * {
 *   "filename2urlPath": "./get-page-url.js"
 * }
 */
export function convertStr(filepath: string): ReturnFuncType {
    const func = requireByCWD(CWD, filepath, () => {
        throw new TypeError(
            `Failed to import module "${filepath}" specified in option "${PROP}"`,
        );
    });
    if (typeof func !== 'function') {
        throw new TypeError(
            `Module "${filepath}" specified in option "${PROP}" did not export the function: ${typeof func}`,
        );
    }

    return strReturnFunc(
        func,
        `The function exported by module "${filepath}" specified in option "${PROP}" did not return a string`,
    );
}

/**
 * @example
 * {
 *   "filename2urlPath": {
 *     "metadata": "canonicalURLPath"
 *   }
 * }
 * @example
 * {
 *   "filename2urlPath": {
 *     "metadata": [
 *       "canonical",
 *       "canonicalURLPath"
 *     ]
 *   }
 * }
 */
export function convertMetadata({
    metadata: schema,
}: {
    metadata: unknown;
}): ReturnFuncType {
    const propList: unknown[] = Array.isArray(schema) ? schema : [schema];
    if (isStringArray(propList)) {
        const propNameList = propList.join(', ');
        return (filename, { fileData }) => {
            for (const prop of propList) {
                const value = fileData[prop];
                if (typeof value === 'string') {
                    return value;
                }
            }
            throw new Error(
                `The following fields that stored string values in the metadata of file "${filename}" were not found: ${propNameList}`,
            );
        };
    } else {
        if (!Array.isArray(schema)) {
            throw new TypeError(
                `The value of the "metadata" field specified in option "${PROP}" is neither a string nor an array: ${typeof schema}`,
            );
        } else {
            const propListType =
                '[' + propList.map(prop => typeof prop).join(', ') + ']';
            throw new TypeError(
                `The value of the "metadata" field specified in option "${PROP}" is not an array of strings: ${propListType}`,
            );
        }
    }
}

/**
 * @example
 * {
 *   "filename2urlPath": {
 *     "replace": {
 *       "fromRegExp": "\\.[^\\\\/.]+$",
 *       "to": ".html"
 *     }
 *   }
 * }
 * @example
 * {
 *   "filename2urlPath": {
 *     "replace": {
 *       "fromStr": "/index.html",
 *       "to": "/"
 *     }
 *   }
 * }
 */
export function convertReplace({
    replace: schema,
}: {
    replace: unknown;
}): ReturnFuncType {
    if (!isObject(schema)) {
        throw new TypeError(
            `The value of the "replace" field specified in option "${PROP}" is not a object: ${typeof schema}`,
        );
    }

    if (!hasProp(schema, 'to')) {
        throw new TypeError(
            `The "to" property must exist for an object in the "replace" field specified by the option "${PROP}"`,
        );
    }
    const to = schema.to;
    if (typeof to !== 'string') {
        throw new TypeError(
            `The "to" property of the object in the "replace" field specified in the option "${PROP}" is not a string value: ${typeof to}`,
        );
    }

    if (hasProp(schema, 'fromRegExp')) {
        const from = schema.fromRegExp;
        if (typeof from === 'string') {
            const fromPattern = new RegExp(from);
            return filename => filename.replace(fromPattern, to);
        } else {
            throw new TypeError(
                `The "fromRegExp" property of the object in the "replace" field specified in the option "${PROP}" is not a string value: ${typeof from}`,
            );
        }
    } else if (hasProp(schema, 'fromStr')) {
        const from = schema.fromStr;
        if (typeof from === 'string') {
            return filename => filename.replace(from, to);
        } else {
            throw new TypeError(
                `The "fromStr" property of the object in the "replace" field specified in the option "${PROP}" is not a string value: ${typeof from}`,
            );
        }
    } else {
        throw new TypeError(
            `Object of "replace" field specified by option "${PROP}" must contain "fromRegExp" property or "fromStr" property`,
        );
    }
}

export function normalize(value: unknown): ReturnFuncType {
    if (typeof value === 'function') {
        return strReturnFunc(
            value,
            `The function set to option "${PROP}" did not return a string`,
        );
    } else if (typeof value === 'string') {
        return convertStr(value);
    } else if (isObject(value)) {
        if (hasProp(value, 'metadata')) {
            return convertMetadata(value);
        } else if (hasProp(value, 'replace')) {
            return convertReplace(value);
        } else {
            throw new TypeError(
                `Object of option "${PROP}" must contain "metadata" property or "replace" property`,
            );
        }
    } else {
        throw new TypeError(
            `The value of option "${PROP}" must be either a function, a string, or an object`,
        );
    }
}
