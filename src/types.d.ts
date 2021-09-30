export type DataType =
  | '|i1'
  | '|u1'
  | '<i2'
  | '<i4'
  | '>i2'
  | '>i4'
  | '<u2'
  | '<u4'
  | '>u2'
  | '>u4'
  | '<f4'
  | '<f8'
  | '>f4'
  | '>f8';

type DataTypeMapping = import('./lib/util').DataTypeMapping;
export type Endianness<Dtype extends DataType> = Dtype extends `${infer E}${infer _}` ? E
  : never;
export type DataTypeMappingKey<Dtype extends DataType> = Dtype extends
  `${infer _}${infer Key}` ? Key
  : never;

export type TypedArrayConstructor<Dtype extends DataType> =
  DataTypeMapping[DataTypeMappingKey<Dtype>];
export type TypedArray<Dtype extends DataType> = InstanceType<
  TypedArrayConstructor<Dtype>
>;
export type Scalar<Dtype extends DataType> = TypedArray<Dtype>[0];
export type NDArray<
  Dtype extends DataType,
  Shape extends number[] = number[],
  Stride extends number[] = number[],
> = {
  data: TypedArray<Dtype>;
  shape: Shape;
  stride: Stride;
};

export type ParsedDataType<Dtype extends DataType> = {
  endianness: Endianness<Dtype>;
  ctr: TypedArrayConstructor<Dtype>;
  // should be able to use constructor, but built-in types aren't very precise.
  create: (x: ArrayBuffer | number) => TypedArray<Dtype>;
};

export type Indices = [start: number, stop: number, step: number];
export interface Slice {
  kind: 'slice';
  start: number | null;
  stop: number | null;
  step: number | null;
  indices: (length: number) => Indices;
}

interface SyncStore extends Pick<Map<string, Uint8Array>, 'get' | 'delete' | 'has'> {
  // Need overide Map to return SyncStore
  set(key: string, value: Uint8Array): SyncStore;
  list_prefix(key: string): string[];
  list_dir(key: string): { contents: string[]; prefixes: string[] };
}

// Promisify return type of every function in SyncStore, override 'set' to return Promise<AsyncStore>
type AsyncStore = {
  [Key in keyof SyncStore]: (
    ...args: Parameters<SyncStore[Key]>
  ) => Key extends 'set' ? Promise<AsyncStore>
    : Promise<ReturnType<SyncStore[Key]>>;
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
  compressor?: import('numcodecs').Codec;
}

export type CreateArrayProps<Dtype extends DataType = DataType> =
  & {
    shape: number | number[];
    chunk_shape: number | number[];
    dtype: Dtype;
    chunk_separator?: '.' | '/';
  }
  & Partial<
    Omit<
      ArrayAttributes,
      'store' | 'path' | 'dtype' | 'shape' | 'chunk_shape' | 'chunk_key'
    >
  >;

type ZarrArray<D extends DataType, S extends Store> = import('./hierarchy').ZarrArray<
  D,
  S
>;
type ExplicitGroup<S extends Store, H extends Hierarchy<S>> =
  import('./hierarchy').ExplicitGroup<
    S,
    H
  >;
type ImplicitGroup<S extends Store, H extends Hierarchy<S>> =
  import('./hierarchy').ImplicitGroup<
    S,
    H
  >;

export interface Hierarchy<Store extends SyncStore | AsyncStore> {
  // read-only
  has(path: string): Promise<boolean>;
  get(path: string): Promise<
    | ZarrArray<DataType, Store>
    | ExplicitGroup<Store, Hierarchy<Store>>
    | ImplicitGroup<Store, Hierarchy<Store>>
  >;
  get_array(path: string): Promise<ZarrArray<DataType, Store>>;
  get_group(path: string): Promise<ExplicitGroup<Store, Hierarchy<Store>>>;
  get_implicit_group(path: string): Promise<ImplicitGroup<Store, Hierarchy<Store>>>;
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
    props: Omit<ArrayAttributes<Dtype>, 'path' | 'store'>,
  ): Promise<ZarrArray<Dtype, Store>>;
}
