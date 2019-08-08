interface SymbolConstructor {
    readonly asyncIterator: symbol;
}

if (!Symbol.asyncIterator) {
    Object.defineProperty(Symbol, 'asyncIterator', {
        value: Symbol('Symbol.asyncIterator'),
    });
}
