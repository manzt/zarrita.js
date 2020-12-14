export interface Codec {
    id: string;
    encode(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
    decode(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
    fromConfig(config: {
        id: string;
    }): Codec;
}
export declare type Indices = [start: number, stop: number, step: number];
export interface Slice {
    start: number | null;
    stop: number | null;
    step: number | null;
    indices: (length: number) => Indices;
    _slice: true;
}
export interface NDArray {
    data: TypedArray;
    shape: number[];
    stride: number[];
}
export declare const registry: Map<String, () => Codec | Promise<Codec>>;
export declare function create_hierarchy(store?: Store): Promise<Hierarchy>;
export declare function get_hierarchy(store: Store): Promise<Hierarchy>;
export declare const DTYPE_STRS: Set<string>;
interface CreateArrayProps {
    shape: number | number[];
    dtype: string;
    chunk_shape: number | number[];
    chunk_separator?: string;
    compressor?: Codec;
    fill_value?: number;
    attrs?: any;
}
export declare class Hierarchy {
    store: Store;
    meta_key_suffix: string;
    constructor({ store, meta_key_suffix }: {
        store: Store;
        meta_key_suffix: string;
    });
    get root(): Promise<ZarrArray | ExplicitGroup | ImplicitGroup>;
    get array_suffix(): string;
    get group_suffix(): string;
    create_group(path: string, props?: any): Promise<ExplicitGroup>;
    create_array(path: string, props: CreateArrayProps): Promise<ZarrArray>;
    get_array(path: string): Promise<ZarrArray>;
    get_explicit_group(path: string): Promise<ExplicitGroup>;
    get_implicit_group(path: string): Promise<ImplicitGroup>;
    get(path: string): Promise<ZarrArray | ExplicitGroup | ImplicitGroup>;
    has(path: string): Promise<boolean>;
    length(): Promise<number>;
    keys(): Promise<IterableIterator<string>>;
    repr(): string;
    get_nodes(): Promise<Map<string, string>>;
    get_children(path?: string): Promise<Map<string, string>>;
}
interface NodeProps {
    store: Store;
    path: string;
    owner: Hierarchy;
}
declare class Node {
    store: Store;
    path: string;
    owner: Hierarchy;
    constructor({ store, path, owner }: NodeProps);
    get name(): string;
}
export declare class Group extends Node {
    length(): Promise<number>;
    keys(): Promise<IterableIterator<string>>;
    get_children(): Promise<Map<string, string>>;
    private dereference_path;
    get(path: string): Promise<ZarrArray | ExplicitGroup | ImplicitGroup>;
    has(path: string): Promise<boolean>;
    create_group(path: string, props: any): Promise<ExplicitGroup>;
    create_array(path: string, props: CreateArrayProps): Promise<ZarrArray>;
    get_array(path: string): Promise<ZarrArray>;
    get_explicit_group(path: string): Promise<ExplicitGroup>;
    get_implicit_group(path: string): Promise<ImplicitGroup>;
}
export declare class ExplicitGroup extends Group {
    attrs: any;
    constructor(props: NodeProps & {
        attrs?: any;
    });
    repr(): string;
}
declare class ImplicitGroup extends Group {
    repr(): string;
}
export declare type TypedArray = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;
interface ArrayProps {
    shape: number[];
    dtype: string;
    chunk_shape: number[];
    chunk_separator: string;
    compressor?: Codec;
    fill_value: number | null;
    attrs?: any;
}
export declare class ZarrArray extends Node {
    shape: number[];
    dtype: string;
    chunk_shape: number[];
    chunk_separator: string;
    compressor?: Codec;
    fill_value: number | null;
    attrs: any;
    TypedArray: TypedArray;
    private should_byte_swap;
    constructor(props: NodeProps & ArrayProps);
    get ndim(): number;
    get(selection: null | (null | number | Slice)[]): Promise<number | NDArray>;
    set(selection: null | (null | number | Slice)[]): Promise<void>;
    _chunk_key(chunk_coords: number[]): string;
    _decode_chunk(buffer: Uint8Array): Promise<TypedArray>;
    _encode_chunk(data: TypedArray): Promise<Uint8Array>;
    get_chunk(chunk_coords: number[]): Promise<{
        data: TypedArray;
        shape: number[];
    }>;
    repr(): string;
}
export interface ListDirResult {
    contents: string[];
    prefixes: string[];
}
export interface Store {
    get(key: string, _default?: Uint8Array): Uint8Array | Promise<Uint8Array>;
    set(key: string, value: Uint8Array): void | Promise<void>;
    delete(key: string): boolean | Promise<boolean>;
    keys(): IterableIterator<string> | Generator<string> | AsyncGenerator<string>;
    list_prefix(prefix: string): string[] | Promise<string[]>;
    list_dir(prefix: string): ListDirResult | Promise<ListDirResult>;
    repr?: () => string;
}
export declare class MemoryStore implements Store {
    map: Map<string, Uint8Array>;
    constructor();
    get(key: string, _default?: Uint8Array): Uint8Array;
    set(key: string, value: Uint8Array): void;
    delete(key: string): boolean;
    list_prefix(prefix: string): string[];
    list_dir(prefix?: string): {
        contents: string[];
        prefixes: string[];
    };
    keys(): IterableIterator<string>;
    repr(): string;
}
export {};
