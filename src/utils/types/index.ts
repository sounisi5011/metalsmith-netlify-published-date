/*
 * Modify the Array.isArray function so that it can correctly Type Guard the ReadonlyArray type.
 * @example
 *   (Array.isArray as isReadonlyOrWritableArray)(value)
 *   (<isReadonlyOrWritableArray>Array.isArray)(value)
 */
export type isReadonlyOrWritableArray = (
    value: unknown,
) => value is unknown[] | readonly unknown[];

export type PromiseValueType<T> = T extends PromiseLike<infer U> ? U : never;

export * from './deep-readonly';
