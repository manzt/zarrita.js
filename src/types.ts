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

export interface SyncStore<GetOptions = any> {
	get(key: AbsolutePath, opts?: GetOptions): Uint8Array | undefined;
	has(key: AbsolutePath): boolean;
	// Need overide Map to return SyncStore
	set(key: AbsolutePath, value: Uint8Array): void;
	delete(key: AbsolutePath): boolean;
	list_prefix(key: RootPath | PrefixPath): string[];
	list_dir(key?: RootPath | PrefixPath): { contents: string[]; prefixes: string[] };
}

export interface AsyncStore<GetOptions = any> {
	get(key: AbsolutePath, opts?: GetOptions): Promise<Uint8Array | undefined>;
	has(key: AbsolutePath): Promise<boolean>;
	set(key: AbsolutePath, value: Uint8Array): Promise<void>;
	delete(key: AbsolutePath): Promise<boolean>;
	list_prefix(key: RootPath | PrefixPath): Promise<string[]>;
	list_dir(
		key?: RootPath | PrefixPath,
	): Promise<{ contents: string[]; prefixes: string[] }>;
}

export type Store = SyncStore | AsyncStore;
export type Attrs = Record<string, any>;

export type ArraySelection = null | (number | null | Slice)[];

export interface Hierarchy<Store extends SyncStore | AsyncStore> {
	// read-only
	has(path: string): Promise<boolean>;
	get(path: AbsolutePath): Promise<
		| ZarrArray<DataType, Store>
		| ExplicitGroup<Store, Hierarchy<Store>>
		| ImplicitGroup<Store, Hierarchy<Store>>
	>;
	get_array(
		path: AbsolutePath,
	): Promise<ZarrArray<DataType, Store>>;
	get_group(
		path: AbsolutePath,
	): Promise<ExplicitGroup<Store, Hierarchy<Store>>>;
	get_implicit_group(
		path: AbsolutePath,
	): Promise<ImplicitGroup<Store, Hierarchy<Store>>>;
	get_children(path?: AbsolutePath): Promise<Map<string, string>>;

	// write
	create_group(
		path: AbsolutePath,
		props?: { attrs?: Attrs },
	): Promise<ExplicitGroup<Store, Hierarchy<Store>>>;
	create_array<
		Dtype extends DataType,
	>(
		path: AbsolutePath,
		props: CreateArrayProps<Dtype>,
	): Promise<ZarrArray<Dtype, Store>>;
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
