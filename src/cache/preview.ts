import flatCache from 'flat-cache';

import { isObject } from '../utils';
import {
    buf2json,
    BufferJSONInterface,
    isBufferJSON,
    json2buf,
} from '../utils/buf-json';
import PKG_NAME from '../utils/pkg-name';

export interface CachedPreviewResponseInterface {
    body: Buffer;
    published: string;
}

export type CachedPreviewResponseJSONInterface = Omit<
    CachedPreviewResponseInterface,
    'body'
> & { body: BufferJSONInterface };

export default class PreviewCache {
    private _store:
        | flatCache.Cache
        | Map<string, CachedPreviewResponseInterface>;

    public constructor(cacheDir?: string | null) {
        this._store = cacheDir
            ? flatCache.create(`${PKG_NAME}/preview`, cacheDir)
            : new Map();
    }

    public get(url: string): CachedPreviewResponseInterface | void {
        if (this._store instanceof Map) {
            return this._store.get(url);
        } else {
            return this.json2response(this._store.getKey(url));
        }
    }

    public has(url: string): boolean {
        if (this._store instanceof Map) {
            return this._store.has(url);
        } else {
            return this.isCachedPreviewResponseJSON(this._store.all().url);
        }
    }

    public set(url: string, response: CachedPreviewResponseInterface): void {
        if (this._store instanceof Map) {
            this._store.set(url, response);
        } else {
            this._store.setKey(url, this.response2json(response));
        }
    }

    public delete(url: string): void {
        if (this._store instanceof Map) {
            this._store.delete(url);
        } else {
            this._store.removeKey(url);
        }
    }

    public clear(): void {
        if (this._store instanceof Map) {
            this._store.clear();
        } else {
            const store = this._store;
            store.keys().forEach(key => store.removeKey(key));
        }
    }

    public save(): void {
        if (!(this._store instanceof Map)) {
            this._store.save();
        }
    }

    private isCachedPreviewResponseJSON(
        value: unknown,
    ): value is CachedPreviewResponseJSONInterface {
        return (
            isObject(value) &&
            (typeof value.published === 'string' && isBufferJSON(value.body))
        );
    }

    private response2json(
        response: CachedPreviewResponseInterface,
    ): CachedPreviewResponseJSONInterface {
        return {
            ...response,
            body: buf2json(response.body),
        };
    }

    private json2response(
        value: unknown,
    ): CachedPreviewResponseInterface | void {
        if (this.isCachedPreviewResponseJSON(value)) {
            const body = json2buf(value.body);
            if (body) {
                return {
                    ...value,
                    body,
                };
            }
        }
    }
}
