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

export type KeyPrefix = `${any}/`;

export interface SyncStore<GetOptions = any> {
	get(key: string, opts?: GetOptions): Uint8Array | undefined;
	has(key: string): boolean;
	// Need overide Map to return SyncStore
	set(key: string, value: Uint8Array): void;
	delete(key: string): boolean;
	list_prefix<Prefix extends KeyPrefix>(key: Prefix): string[];
	list_dir<Prefix extends KeyPrefix>(
		key?: Prefix,
	): { contents: string[]; prefixes: string[] };
}

export interface AsyncStore<GetOptions = any> {
	get(key: string, opts?: GetOptions): Promise<Uint8Array | undefined>;
	has(key: string): Promise<boolean>;
	set(key: string, value: Uint8Array): Promise<void>;
	delete(key: string): Promise<boolean>;
	list_prefix<Prefix extends KeyPrefix>(key: Prefix): Promise<string[]>;
	list_dir<Prefix extends KeyPrefix>(
		key?: Prefix,
	): Promise<{ contents: string[]; prefixes: string[] }>;
}

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
