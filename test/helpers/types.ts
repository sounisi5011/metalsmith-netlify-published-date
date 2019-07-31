/**
 * @see https://stackoverflow.com/a/43001581/4907315
 */
export type Writeable<T> = {
    -readonly [P in keyof T]: T[P];
};

export type ArrayItemType<T> = T extends ArrayLike<infer P> ? P : never;

export type ArrayType<T> = T extends ArrayLike<infer P> ? P[] : never;
