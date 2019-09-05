import isPlainObject from 'is-plain-obj';

import {
    equalsMap,
    equalsSet,
    getAllProps,
    getPropertyDescriptor,
    getPropertyDescriptorEntries,
    getPropertyNames,
    hasProp,
    initObject,
    map2obj,
} from './';

export interface StateInterface<T> {
    restore(): T;
    diff(): { addedOrUpdated: Partial<T> } | null;
}

class UnknownState<T> implements StateInterface<T> {
    private _ref: T;

    public constructor(value: T) {
        this._ref = value;
    }

    public restore(): T {
        return this._ref;
    }

    public diff(): { addedOrUpdated: Partial<T> } | null {
        return null;
    }

    public getOrigValue(): T {
        return this._ref;
    }
}

const createProcessingWeakMap = new WeakMap();
const restoreProcessingWeakSet = new WeakSet();

class PlainObjectState<T extends object> extends UnknownState<T> {
    private _propMap: Map<
        keyof T,
        Omit<TypedPropertyDescriptor<T[keyof T]>, 'value'> & {
            value?: StateInterface<T[keyof T]>;
        }
    >;

    public constructor(origObj: T, props: readonly (keyof T)[] = []) {
        super(origObj);
        const createProcessingMap: WeakMap<
            T,
            StateInterface<T>
        > = createProcessingWeakMap;

        const state = createProcessingMap.get(origObj);
        if (state instanceof PlainObjectState) {
            this._propMap = new Map();
            return state;
        }

        createProcessingMap.set(origObj, this);
        this._propMap = new Map(
            getPropertyDescriptorEntries(origObj)
                .filter(
                    ([prop, desc]) => desc.enumerable || props.includes(prop),
                )
                .map(([prop, desc]) => [
                    prop,
                    hasProp(desc, 'value')
                        ? {
                              ...desc,
                              // eslint-disable-next-line @typescript-eslint/no-use-before-define
                              value: createState(desc.value as T[keyof T]),
                          }
                        : (desc as Omit<typeof desc, 'value'>),
                ]),
        );
        createProcessingMap.delete(origObj);
    }

    public restore(): T {
        const restoreProcessingSet: WeakSet<T> = restoreProcessingWeakSet;
        const origObj = super.restore();

        if (restoreProcessingSet.has(origObj)) {
            return origObj;
        }

        restoreProcessingSet.add(origObj);

        getAllProps(origObj).forEach(propName => {
            if (!this._propMap.has(propName)) {
                delete origObj[propName];
            }
        });

        this._propMap.forEach((desc, propName) => {
            const origDesc = desc.value
                ? { ...desc, value: desc.value.restore() }
                : desc;
            Object.defineProperty(origObj, propName, origDesc);
        });

        restoreProcessingSet.delete(origObj);

        return origObj;
    }

    public diff(): { addedOrUpdated: Partial<T> } | null {
        const diffProcessingSet: WeakSet<T> = restoreProcessingWeakSet;
        const origObj = super.getOrigValue();
        const addedOrUpdatedDescs = new Map<keyof T, PropertyDescriptor>();

        if (diffProcessingSet.has(origObj)) {
            return null;
        }

        diffProcessingSet.add(origObj);

        // Define added props
        getPropertyDescriptorEntries(origObj).forEach(([prop, desc]) => {
            if (!this._propMap.has(prop) && desc.enumerable) {
                addedOrUpdatedDescs.set(prop, desc);
            }
        });

        // Define updated or removed props
        this._propMap.forEach((origDesc, propName) => {
            if (origDesc) {
                const currentDesc = getPropertyDescriptor(origObj, propName);

                if (currentDesc) {
                    const descProps = getPropertyNames(
                        ...[origDesc, currentDesc],
                    );
                    const equalsDesc = descProps.every(descProp => {
                        const currentValue = currentDesc[descProp];
                        if (descProp === 'value') {
                            const state = origDesc[descProp];
                            return state instanceof UnknownState
                                ? state.getOrigValue() === currentValue
                                : state === currentValue;
                        }
                        return origDesc[descProp] === currentValue;
                    });

                    if (!equalsDesc) {
                        addedOrUpdatedDescs.set(propName, currentDesc);
                    } else if (origDesc.value) {
                        const diff = origDesc.value.diff();
                        if (diff) {
                            addedOrUpdatedDescs.set(propName, {
                                ...origDesc,
                                value: diff.addedOrUpdated,
                            });
                        }
                    }
                } else {
                    // TODO: removed prop
                }
            }
        });

        diffProcessingSet.delete(origObj);

        if (addedOrUpdatedDescs.size > 0) {
            let addedOrUpdated: T;
            const descs = map2obj(addedOrUpdatedDescs);
            try {
                addedOrUpdated = Object.create(
                    Object.getPrototypeOf(origObj),
                    descs,
                );
            } catch (err) {
                addedOrUpdated = Object.defineProperties({}, descs);
            }
            return { addedOrUpdated };
        }
        return null;
    }
}

class RegExpState<T extends RegExp> extends PlainObjectState<T> {
    public constructor(origRegExp: T) {
        super(origRegExp, ['lastIndex']);
    }

    public diff(): { addedOrUpdated: Partial<T> } | null {
        const diff = super.diff();
        if (diff) {
            const origRegExp = super.getOrigValue();
            const newRegExp = new RegExp(origRegExp.source, origRegExp.flags);
            initObject(newRegExp, origRegExp, diff.addedOrUpdated);
            return { addedOrUpdated: newRegExp as T };
        }
        return null;
    }
}

class DateState<T extends Date> extends PlainObjectState<T> {
    private _unixtime: number;

    public constructor(origDate: T) {
        super(origDate);
        this._unixtime = origDate.getTime();
    }

    public restore(): T {
        const origDate = super.restore();
        origDate.setTime(this._unixtime);
        return origDate;
    }

    public diff(): { addedOrUpdated: Partial<T> } | null {
        const origDate = super.getOrigValue();
        const diff = super.diff();

        if (this._unixtime !== origDate.getTime() || diff) {
            const newDate = new Date(origDate.getTime());
            initObject(newDate, origDate, diff && diff.addedOrUpdated);
            return { addedOrUpdated: newDate as T };
        }

        return null;
    }
}

class BufferState<T extends Buffer> extends PlainObjectState<T> {
    public diff(): { addedOrUpdated: Partial<T> } | null {
        const diff = super.diff();
        if (diff) {
            const origBuffer = super.getOrigValue();
            const newBuffer = Buffer.from(origBuffer);
            initObject(newBuffer, origBuffer, diff.addedOrUpdated);
            return { addedOrUpdated: newBuffer as T };
        }
        return null;
    }
}

class MapState<
    T extends Map<K, V>,
    K = unknown,
    V = unknown
> extends PlainObjectState<T> {
    private _entries: readonly (readonly [K, V])[];

    public constructor(origMap: T) {
        super(origMap);
        this._entries = [...origMap.entries()];
    }

    public restore(): T {
        const origMap = super.restore();

        origMap.clear();

        this._entries.forEach(([key, value]) => {
            origMap.set(key, value);
        });

        return origMap;
    }

    public diff(): { addedOrUpdated: Partial<T> } | null {
        const origMap = super.getOrigValue();
        const diff = super.diff();

        if (!equalsMap(this._entries, origMap) || diff) {
            const newMap = new Map(origMap);
            initObject(newMap, origMap, diff && diff.addedOrUpdated);
            return { addedOrUpdated: newMap as T };
        }

        return null;
    }
}

class SetState<T extends Set<V>, V = unknown> extends PlainObjectState<T> {
    private _values: readonly V[];

    public constructor(origSet: T) {
        super(origSet);
        this._values = [...origSet.values()];
    }

    public restore(): T {
        const origSet = super.restore();

        origSet.clear();

        this._values.forEach(value => {
            origSet.add(value);
        });

        return origSet;
    }

    public diff(): { addedOrUpdated: Partial<T> } | null {
        const origSet = super.getOrigValue();
        const diff = super.diff();

        if (!equalsSet(this._values, origSet) || diff) {
            const newSet = new Set(origSet);
            initObject(newSet, origSet, diff && diff.addedOrUpdated);
            return { addedOrUpdated: newSet as T };
        }

        return null;
    }
}

class ErrorState<T extends Error> extends PlainObjectState<T> {
    public constructor(origError: T) {
        super(origError, ['name', 'message', 'stack']);
    }

    public diff(): { addedOrUpdated: Partial<T> } | null {
        const diff = super.diff();
        if (diff) {
            const origError = super.getOrigValue();
            const newError = new Error(origError.message);
            initObject(newError, origError, diff.addedOrUpdated);
            return { addedOrUpdated: newError as T };
        }
        return null;
    }
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
 */
export default function createState<T>(value: T): StateInterface<T> {
    if (
        isPlainObject(value) ||
        Array.isArray(value) ||
        value instanceof Boolean ||
        value instanceof String
    ) {
        return new PlainObjectState<typeof value>(value);
    }
    if (value instanceof RegExp) {
        return new RegExpState<typeof value>(value);
    }
    if (value instanceof Date) {
        return new DateState<typeof value>(value);
    }
    // TODO: TypedArray support
    if (Buffer.isBuffer(value)) {
        return new BufferState<typeof value>(value);
    }
    if (value instanceof Map) {
        return new MapState<typeof value>(value);
    }
    if (value instanceof Set) {
        return new SetState<typeof value>(value);
    }
    if (value instanceof Error) {
        return new ErrorState<typeof value>(value);
    }
    return new UnknownState(value);
}
