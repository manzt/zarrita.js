export declare class NotImplementedError extends Error {
    constructor(msg: string);
}
export declare class NodeNotFoundError extends Error {
    constructor(msg: string);
}
export declare class IndexError extends Error {
    constructor(msg: string);
}
export declare class KeyError extends Error {
    constructor(msg: string);
}
export declare class ZarrAssertionError extends Error {
    constructor(msg: string);
}
export declare function assert(condition: boolean, msg?: string): void;
