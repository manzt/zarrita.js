import type { ExplicitGroup, ImplicitGroup, ZarrArray } from "./lib/hierarchy";
import type { BoolArray, ByteStringArray, UnicodeStringArray } from "./lib/custom-arrays";
import type ndarray from "ndarray";

export type DataType =
	| NumericDataType
	| BigIntDataType
	| BinaryDataType
	| StringDataType;

export type NumericDataType =
	| "|i1"
	| "<i2"
	| ">i2"
	| "<i4"
	| ">i4"
	| "|u1"
	| "<u2"
	| ">u2"
	| "<u4"
	| ">u4"
	| "<f4"
	| "<f8"
	| ">f4"
	| ">f8";

export type BinaryDataType = "|b1";
export type BigIntDataType = "<u8" | ">u8" | "<i8" | ">i8";
export type StringDataType =
	| `<U${number}`
	| `>U${number}`
	| `|S${number}`;

export type WithoutEndianness = DataType extends `${infer _}${infer Rest}` ? Rest : never;

// deno-fmt-ignore
type BMap = {
  [I in
    1  |  2 |  3 |  4 |  5 |  6 |  7 |  8 |  9 | 10 |
    11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
    21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
    31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 |
    41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 |
    51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 |
    64 | 128 | 256
  as `${I}`]: I
}

export type Bytes<BString extends string> = BString extends keyof BMap ? BMap[BString]
	: number;

export type TypedArray<D extends DataType> = D extends "|i1" ? Int8Array
	: D extends "<i2" | ">i2" ? Int16Array
	: D extends "<i4" | ">i4" ? Int32Array
	: D extends "<i8" | ">i8" ? BigInt64Array
	: D extends "|u1" ? Uint8Array
	: D extends "<u2" | ">u2" ? Uint16Array
	: D extends "<u4" | ">u4" ? Uint32Array
	: D extends "<u8" | ">u8" ? BigUint64Array
	: D extends "<f4" | ">f4" ? Float32Array
	: D extends "<f8" | ">f8" ? Float64Array
	: D extends "|b1" ? BoolArray
	: D extends `|S${infer B}` ? ByteStringArray<Bytes<B>>
	: D extends `>U${infer B}` ? UnicodeStringArray<Bytes<B>>
	: D extends `<U${infer B}` ? UnicodeStringArray<Bytes<B>>
	: never;

export type TypedArrayConstructor<D extends DataType> = {
	new (length: number): TypedArray<D>;
	new (array: ArrayLike<Scalar<D>> | ArrayBufferLike): TypedArray<D>;
	// TODO: implement for Bool/Unicode arrays
	// new(buffer: ArrayBufferLike, byteOffset?: number, length?: number): TypedArray<D>
	// new(elements: Iterable<Scalar<D>>): TypedArray<D>
};

// Hack to get scalar type since is not defined on any typed arrays.
export type Scalar<D extends DataType> = D extends "|b1" ? boolean
	: D extends `${infer _}${"U" | "S"}${infer _}` ? string
	: D extends `${"<" | ">"}${"u" | "i"}8` ? bigint
	: number;

// TODO: Using this for sanity check, but really should move to formal compilation tests.
type Parts<D extends DataType> = {
	[Key in D]: [TypedArrayConstructor<Key>, TypedArray<Key>, Scalar<Key>];
};

export type NdArrayLike<Dtype extends DataType> = {
	data: TypedArray<Dtype>;
	shape: number[];
};

export type Indices = [start: number, stop: number, step: number];
export interface Slice {
	kind: "slice";
	start: number | null;
	stop: number | null;
	step: number | null;
	indices: (length: number) => Indices;
}

export interface SyncStore<GetOptions = any> {
	get(key: string, opts?: GetOptions): Uint8Array | undefined;
	has(key: string): boolean;
	// Need overide Map to return SyncStore
	set(key: string, value: Uint8Array): void;
	delete(key: string): boolean;
	list_prefix(key: string): string[];
	list_dir(key: string): { contents: string[]; prefixes: string[] };
}

// Promisify return type of every function in SyncStore, override 'set' to return Promise<AsyncStore>
export type AsyncStore<GetOptions = any> = {
	[Key in keyof SyncStore<GetOptions>]: (
		...args: Parameters<SyncStore<GetOptions>[Key]>
	) => Promise<ReturnType<SyncStore<GetOptions>[Key]>>;
};

export type Store = SyncStore | AsyncStore;
export type Attrs = Record<string, any>;

export interface ArrayAttributes<
	Dtype extends DataType = DataType,
	Store extends SyncStore | AsyncStore = SyncStore | AsyncStore,
> {
	store: Store;
	shape: number[];
	path: string;
	chunk_shape: number[];
	dtype: Dtype;
	fill_value: Scalar<Dtype> | null;
	attrs: Attrs | (() => Promise<Attrs>);
	chunk_key: (chunk_coords: number[]) => string;
	compressor?: import("numcodecs").Codec;
}

export type CreateArrayProps<Dtype extends DataType = DataType> =
	& {
		shape: number | number[];
		chunk_shape: number | number[];
		dtype: Dtype;
		chunk_separator?: "." | "/";
	}
	& Partial<
		Omit<
			ArrayAttributes<Dtype>,
			"store" | "path" | "dtype" | "shape" | "chunk_shape" | "chunk_key"
		>
	>;

export type ArraySelection = null | (number | null | Slice)[];

export interface Hierarchy<Store extends SyncStore | AsyncStore> {
	// read-only
	has(path: string): Promise<boolean>;
	get(path: string): Promise<
		| ZarrArray<DataType, Store>
		| ExplicitGroup<Store, Hierarchy<Store>>
		| ImplicitGroup<Store, Hierarchy<Store>>
	>;
	get_array(
		path: string,
	): Promise<ZarrArray<DataType, Store>>;
	get_group(
		path: string,
	): Promise<ExplicitGroup<Store, Hierarchy<Store>>>;
	get_implicit_group(
		path: string,
	): Promise<ImplicitGroup<Store, Hierarchy<Store>>>;
	get_children(path?: string): Promise<Map<string, string>>;

	// write
	create_group(
		path: string,
		props?: { attrs?: Attrs },
	): Promise<ExplicitGroup<Store, Hierarchy<Store>>>;
	create_array<
		Dtype extends DataType,
	>(
		path: string,
		props: Omit<ArrayAttributes<Dtype>, "path" | "store">,
	): Promise<ZarrArray<Dtype, Store>>;
}

export type Setter<D extends DataType, A extends NdArrayLike<D>> = {
	prepare(data: TypedArray<D>, shape: number[]): A;
	set_scalar(target: A, selection: (Indices | number)[], value: Scalar<D>): void;
	set_from_chunk(
		target: A,
		target_selection: (Indices | number)[],
		chunk: A,
		chunk_selection: (Indices | number)[],
	): void;
};

export type BasicSetter<D extends DataType> = Setter<
	D,
	{ data: TypedArray<D>; shape: number[]; stride?: number[] }
>;

export type NdArraySetter<D extends DataType> = Setter<D, ndarray.NdArray<TypedArray<D>>>;

// Compatible with https://github.com/sindresorhus/p-queue
export type ChunkQueue = {
	add(fn: () => Promise<void>): void;
	onIdle(): Promise<void[]>;
};

export type Options = { create_queue?: () => ChunkQueue };
export type GetOptions = Options;
export type SetOptions = Options;
