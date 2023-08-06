import type { DataType, Scalar, TypedArray } from "./dtypes.js";
export type { Array, Group } from "./lib/hierarchy.js";

// hoist useful types here
export type { DataType, Scalar, TypedArray, TypedArrayConstructor } from "./dtypes.js";

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

export type AbsolutePath<Rest extends string = string> = `/${Rest}`;
export type RootPath = AbsolutePath<"">;
export type PrefixPath = AbsolutePath<`${string}/`>;

export type Deref<Path extends string, NodePath extends AbsolutePath> = Path extends
	AbsolutePath ? Path : NodePath extends "/" ? `/${Path}` : `${NodePath}/${Path}`;

export interface ListDirResult {
	contents: string[];
	prefixes: string[];
}

export type Async<T extends Record<string, any>> = {
	[Key in keyof T]: (...args: Parameters<T[Key]>) => Promise<ReturnType<T[Key]>>;
};

export interface Readable<Opts = any> {
	get(key: AbsolutePath, opts?: Opts): Uint8Array | undefined;
}

export interface Writeable {
	set(key: AbsolutePath, value: Uint8Array): void;
}

export interface ExtendedReadable extends Readable {
	list_prefix(key: RootPath | PrefixPath): string[];
	list_dir(key?: RootPath | PrefixPath): ListDirResult;
}

export type Attrs = Record<string, any>;

type RequiredArrayProps<D extends DataType> = {
	shape: number[];
	chunk_shape: number[];
	dtype: D;
};

export interface CreateArrayProps<D extends DataType> extends RequiredArrayProps<D> {
	compressor?: import("numcodecs").Codec;
	chunk_separator?: "." | "/";
	fill_value?: Scalar<D>;
	filters?: import("numcodecs").Codec[];
	attrs?: Attrs;
	order?: "C" | "F";
}

export type Projection = { from: null; to: number } | { from: number; to: null } | {
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
> = (target: NdArray, selection: (Indices | number)[], value: Scalar<D>) => void;
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
