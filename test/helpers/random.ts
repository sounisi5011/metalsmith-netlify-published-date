export function randomChoice<T>(list: readonly T[]): T | undefined {
    const length = list.length;
    return length >= 1 ? list[Math.floor(Math.random() * length)] : undefined;
}

export function randomChoiceList<T>(list: readonly T[], length: number): T[] {
    const listLen = list.length;

    if (length < listLen) {
        const indexSet = new Set<number>();

        while (indexSet.size < length) {
            indexSet.add(Math.floor(Math.random() * listLen));
        }

        return list.filter((_, index) => indexSet.has(index));
    }

    return [...list];
}

export function generateRandStr(length: number, radix?: number): string {
    let str = '';
    do {
        str += Math.random()
            .toString(radix)
            .substring(2);
    } while (str.length < length);
    return str.substring(0, length);
}

/**
 * @see https://github.com/jsbin/jsbin/blob/31f5ebb26e3b41b03ac33ea3fe712923be986352/lib/utils.js#L142-L157
 */
export function generatePronounceableRandStr(length: number): string {
    const vowels = 'aeiou';
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    return [...Array(length).keys()]
        .map(index =>
            randomChoice([...(index % 2 === 0 ? consonants : vowels)]),
        )
        .join('');
}
