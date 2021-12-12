import type { DataType, Scalar, TypedArray } from "./dtypes";
import type { ExplicitGroup, ImplicitGroup, ZarrArray } from "./lib/hierarchy";
import type ndarray from "ndarray";

// hoist useful types here
export type { DataType, Scalar, TypedArray, TypedArrayConstructor } from "./dtypes";

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

export type AbsolutePath<Rest extends string = string> = `/${Rest}`;
export type RootPath = AbsolutePath<"">;
export type PrefixPath = AbsolutePath<`${string}/`>;
export type ChunkKey = (chunk_coord: number[]) => AbsolutePath;

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

export type ArraySelection = null | (number | null | Slice)[];

export interface Hierarchy<Store extends Readable | Async<Readable>> {
	// read-only
	has(path: AbsolutePath): Promise<boolean>;
	get<Path extends AbsolutePath>(path: Path): Promise<
		| ZarrArray<DataType, Store, Path>
		| ExplicitGroup<Store, Hierarchy<Store>, Path>
		| ImplicitGroup<Store, Hierarchy<Store>, Path>
	>;
	get_array<Path extends AbsolutePath>(
		path: Path,
	): Promise<ZarrArray<DataType, Store, Path>>;
	get_group<Path extends AbsolutePath>(
		path: Path,
	): Promise<ExplicitGroup<Store, Hierarchy<Store>, Path>>;
	get_implicit_group<Path extends AbsolutePath>(
		path: Path,
	): Store extends (ExtendedReadable | Async<ExtendedReadable>)
		? Promise<ImplicitGroup<Store, Hierarchy<Store>, Path>>
		: never;
	get_children(
		path?: AbsolutePath,
	): Store extends (ExtendedReadable | Async<ExtendedReadable>)
		? Promise<Map<string, string>>
		: never;

	// write
	create_group<Path extends AbsolutePath>(
		path: Path,
		props?: { attrs?: Attrs },
	): Store extends (Writeable | Async<Writeable>)
		? Promise<ExplicitGroup<Store, Hierarchy<Store>, Path>>
		: never;
	create_array<
		Path extends AbsolutePath,
		Dtype extends DataType,
	>(
		path: Path,
		props: CreateArrayProps<Dtype>,
	): Store extends (Writeable | Async<Writeable>) ? Promise<ZarrArray<Dtype, Store, Path>>
		: never;
}

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
}

export type Prepare<D extends DataType, NdArray extends NdArrayLike<D>> = (
	data: TypedArray<D>,
	shape: number[],
) => NdArray;
export type SetScalar<
	D extends DataType,
	NdArray extends NdArrayLike<D>,
> = (target: NdArray, selection: (Indices | number)[], value: Scalar<D>) => void;
export type SetFromChunk<
	D extends DataType,
	NdArray extends NdArrayLike<D>,
> = (
	target: NdArray,
	target_selection: (Indices | number)[],
	chunk: NdArray,
	chunk_selection: (Indices | number)[],
) => void;

// Compatible with https://github.com/sindresorhus/p-queue
export type ChunkQueue = {
	add(fn: () => Promise<void>): void;
	onIdle(): Promise<void[]>;
};

export type Options = { create_queue?: () => ChunkQueue };
export type GetOptions = Options;
export type SetOptions = Options;
