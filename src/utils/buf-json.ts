import { isObject } from './';

export interface BufferJSONInterface {
    type: 'Buffer';
    data: string;
    encoding: BufferEncoding;
}

export function isBufferJSON(value: unknown): value is BufferJSONInterface {
    if (isObject(value)) {
        return (
            value.type === 'Buffer' &&
            typeof value.data === 'string' &&
            typeof value.encoding === 'string' &&
            [
                'ascii',
                'utf8',
                'utf-8',
                'utf16le',
                'ucs2',
                'ucs-2',
                'base64',
                'latin1',
                'binary',
                'hex',
            ].includes(value.encoding)
        );
    }
    return false;
}

export function buf2json(value: Buffer): BufferJSONInterface {
    // @see https://nodejs.org/docs/latest/api/buffer.html#buffer_buffers_and_character_encodings
    // @see https://nodejs.org/docs/latest-v8.x/api/buffer.html#buffer_buffers_and_character_encodings
    const encodingList: BufferEncoding[] = ['utf8'];

    for (const encoding of encodingList) {
        try {
            const data = value.toString(encoding);

            if (value.equals(Buffer.from(data, encoding))) {
                return {
                    type: 'Buffer',
                    data,
                    encoding,
                };
            }
        } catch (err) {
            continue;
        }
    }

    return {
        type: 'Buffer',
        data: value.toString('base64'),
        encoding: 'base64',
    };
}

export function json2buf(value: unknown): Buffer | null {
    if (value instanceof Buffer) {
        return value;
    } else if (isBufferJSON(value)) {
        try {
            return Buffer.from(value.data, value.encoding);
        } catch (err) {
            //
        }
    }
    return null;
}
