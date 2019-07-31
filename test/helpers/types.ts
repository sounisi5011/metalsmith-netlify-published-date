export type ArrayItemType<T> = T extends ArrayLike<infer P> ? P : never;

export type ArrayType<T> = T extends ArrayLike<infer P> ? P[] : never;
