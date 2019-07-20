export type ArrayItemType<T> = T extends ArrayLike<infer P> ? P : never;
