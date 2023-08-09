import type {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";

import type {
	BigintDataType,
	Bool,
	DataType,
	Float32,
	Float64,
	Int16,
	Int32,
	Int64,
	Int8,
	NumberDataType,
	Raw,
	Scalar,
	Uint16,
	Uint32,
	Uint64,
	Uint8,
} from "./metadata.js";

export type TypedArray<D extends DataType> = D extends Int8 ? Int8Array
	: D extends Int16 ? Int16Array
	: D extends Int32 ? Int32Array
	: D extends Int64 ? BigInt64Array
	: D extends Uint8 ? Uint8Array
	: D extends Uint16 ? Uint16Array
	: D extends Uint32 ? Uint32Array
	: D extends Uint64 ? BigUint64Array
	: D extends Float32 ? Float32Array
	: D extends Float64 ? Float64Array
	: D extends Bool ? BoolArray
	: D extends Raw ? ByteStringArray | UnicodeStringArray
	: never;

export type TypedArrayConstructor<D extends DataType> = {
	new (length: number): TypedArray<D>;
	new (array: ArrayLike<Scalar<D>> | ArrayBufferLike): TypedArray<D>;
	// TODO: implement for Bool/Unicode arrays
	// new(buffer: ArrayBufferLike, byteOffset?: number, length?: number): TypedArray<D>
	// new(elements: Iterable<Scalar<D>>): TypedArray<D>
};

type DataTypeWithoutEndianness = DataType extends `${infer _}${infer Rest}`
	? Rest
	: never;

export type DataTypeQuery =
	| DataType
	| DataTypeWithoutEndianness
	| "number"
	| "bigint"
	| "string";

export type NarrowDataType<
	Dtype extends DataType,
	Query extends DataTypeQuery,
> = Query extends "number" ? NumberDataType
	: Query extends "bigint" ? BigintDataType
	: Query extends "string" ? Raw
	: Extract<Query | `${"<" | ">" | "|"}${Query}`, Dtype>;

export type Chunk<Dtype extends DataType> = {
	data: TypedArray<Dtype>;
	shape: number[];
	stride: number[];
};

export type Indices = [start: number, stop: number, step: number];
export interface Slice {
	start: number | null;
	stop: number | null;
	step: number | null;
	indices: (length: number) => Indices;
}

export type Attrs = Record<string, any>;

type RequiredArrayProps<D extends DataType> = {
	shape: number[];
	chunk_shape: number[];
	dtype: D;
};

export interface CreateArrayProps<D extends DataType>
	extends RequiredArrayProps<D> {
	compressor?: import("numcodecs").Codec;
	chunk_separator?: "." | "/";
	fill_value?: Scalar<D>;
	filters?: import("numcodecs").Codec[];
	attrs?: Attrs;
	order?: "C" | "F";
}

export type Projection =
	| { from: null; to: number }
	| { from: number; to: null }
	| {
		from: Indices;
		to: Indices;
	};

export type Prepare<D extends DataType, NdArray extends Chunk<D>> = (
	data: TypedArray<D>,
	shape: number[],
	stride: number[],
) => NdArray;

export type SetScalar<
	D extends DataType,
	NdArray extends Chunk<D>,
> = (
	target: NdArray,
	selection: (Indices | number)[],
	value: Scalar<D>,
) => void;

export type SetFromChunk<
	D extends DataType,
	NdArray extends Chunk<D>,
> = (
	a: NdArray,
	b: NdArray,
	proj: Projection[],
) => void;

export type Setter<D extends DataType, Arr extends Chunk<D>> = {
	prepare: Prepare<D, Arr>;
	set_from_chunk: SetFromChunk<D, Arr>;
	set_scalar: SetScalar<D, Arr>;
};

// Compatible with https://github.com/sindresorhus/p-queue
export type ChunkQueue = {
	add(fn: () => Promise<void>): void;
	onIdle(): Promise<void[]>;
};

export type Options = {
	create_queue?: () => ChunkQueue;
};

export type GetOptions<O> = Options & { opts?: O; order?: "C" | "F" };

export type SetOptions = Options;
