import test from 'ava';
import cloneDeep from 'lodash.clonedeep';

import createState from '../../src/utils/obj-restore';

test('should restore object', t => {
    const sym = Symbol('sym');
    const obj = {
        num: 42,
        abc: {
            arr: [1, 2, 3],
            def: {
                bool: 42,
            },
            date: new Date(),
        },
        reg: /(?:)/,
        get getter() {
            return 12;
        },
        circular: {},
    };
    Object.assign(obj, {
        circular: obj,
    });
    Object.assign(obj.abc.date, {
        [sym]: 'sym',
        xxx: 42,
    });
    Object.assign(obj.reg, {
        yyy: 99,
    });

    const obj2 = cloneDeep(obj);
    t.deepEqual(obj, obj2);

    const state = createState(obj);
    t.deepEqual(obj, obj2);

    /*
     * Add property
     */
    Object.assign(obj, { f: 58 });
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    Object.assign(obj.abc.date, { p: null });
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    Object.assign(obj.reg, { p: null });
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    /*
     * Add symbol property
     */
    Object.assign(obj, { [Symbol('')]: 53 });
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    Object.assign(obj.abc.date, { [Symbol('')]: null });
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    Object.assign(obj.reg, { [Symbol('')]: null });
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    /*
     * Remove property
     */
    delete obj.num;
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore: TS7053 - Element implicitly has an 'any' type because expression of type 'unique symbol' can't be used to index type 'Date'.
    delete obj.abc.date[sym];
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore: TS2704 - The operand of a delete operator cannot be a read-only property.
    delete obj.getter;
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    /*
     * Replace property
     */
    obj.abc.arr = [];
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);

    Object.defineProperty(obj, 'getter', {
        get() {
            return true;
        },
        enumerable: true,
        configurable: true,
    });
    t.notDeepEqual(obj, obj2);
    state.restore();
    t.deepEqual(obj, obj2);
});

test('diff() method should return difference of value', t => {
    const obj = {
        'abc.html': {
            mode: '0644',
            contents: Buffer.from('42'),
        },
        '123.html': {
            mode: '0644',
            contents: Buffer.from('aiueo'),
        },
    };
    Object.assign(obj, {
        circular: obj,
    });

    const state = createState(obj);

    t.deepEqual(
        state.diff(),
        null,
        'should return null if there is no difference',
    );

    const addProps = {
        published: new Date(0),
        modified: new Date(),
    };
    Object.assign(obj['abc.html'], addProps);
    Object.assign(obj['123.html'], addProps);
    t.deepEqual(
        state.diff(),
        { addedOrUpdated: { 'abc.html': addProps, '123.html': addProps } },
        'should return the added properties',
    );
    state.restore();
    t.deepEqual(state.diff(), null);

    obj['abc.html'].contents = Buffer.from(obj['abc.html'].contents);
    obj['123.html'].mode = '999';
    t.deepEqual(
        state.diff(),
        {
            addedOrUpdated: {
                'abc.html': { contents: obj['abc.html'].contents },
                '123.html': { mode: '999' },
            },
        },
        'should return the updated properties',
    );
    state.restore();
    t.deepEqual(state.diff(), null);

    delete obj['abc.html'].mode;
    delete obj['123.html'];
    t.deepEqual(
        state.diff(),
        null,
        'properties deletions should not be included in the difference',
    );
    state.restore();
    t.deepEqual(state.diff(), null);
});
