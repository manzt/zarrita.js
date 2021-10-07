export type DataType =
  | NumericDataType
  | BigIntDataType
  | BinaryDataType
  | StringDataType;

export type NumericDataType =
  | '|i1'
  | '<i2'
  | '>i2'
  | '<i4'
  | '>i4'
  | '|u1'
  | '<u2'
  | '>u2'
  | '<u4'
  | '>u4'
  | '<f4'
  | '<f8'
  | '>f4'
  | '>f8';
export type BinaryDataType = '|b1';
export type BigIntDataType = '<u8' | '>u8' | '<i8' | '>i8';
export type StringDataType =
  | `<U${number}`
  | `>U${number}`
  | `|S${number}`;

// TODO: Using this for sanity check, but really should move to formal compilation tests.
type Parts<D extends DataType> = {
  [Key in D]: [TypedArrayConstructor<Key>, TypedArray<Key>, Scalar<Key>];
};

type DataTypeMapping = import('./lib/util').DataTypeMapping;

export type Endianness<Dtype extends DataType> = Dtype extends `${infer E}${infer _}` ? E
  : never;

interface ByteStringArrayConstructor<Chars extends number> {
  new (x: number): import('./lib/custom-arrays').ByteStringArray<Chars>;
  new (x: ArrayBuffer): import('./lib/custom-arrays').ByteStringArray<Chars>;
}

interface UnicodeStringArrayConstructor<Chars extends number> {
  new (x: number): import('./lib/custom-arrays').UnicodeStringArray<Chars>;
  new (x: ArrayBuffer): import('./lib/custom-arrays').UnicodeStringArray<Chars>;
}

// deno-fmt-ignore
type BMap = {
  [I in
    1  |  2 |  3 |  4 |  5 |  6 |  7 |  8 |  9 | 10 |
    11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
    21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
    31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 |
    41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 |
    51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60
  as `${I}`]: I
}

type Bytes<BString extends string> = BString extends keyof BMap ? BMap[BString] : number;

export type TypedArrayConstructor<D extends DataType> = D extends `${infer _}${infer Key}${infer B}`
  ? Key extends 'S' ? ByteStringArrayConstructor<Bytes<B>>
  : Key extends 'U' ? UnicodeStringArrayConstructor<Bytes<B>>
  : `${Key}${B}` extends keyof DataTypeMapping ? DataTypeMapping[`${Key}${B}`]
  : never
  : never;

export type TypedArray<D extends DataType> = InstanceType<TypedArrayConstructor<D>>;

// Hack to get scalar type since is not defined on any typed arrays.
export type Scalar<Dtype extends DataType> = Parameters<TypedArray<Dtype>['fill']>[0];

export type NdArrayLike<Dtype extends DataType> = {
  data: TypedArray<Dtype>;
  shape: number[];
};

export type ParsedDataType<Dtype extends DataType> = {
  endianness: Endianness<Dtype>;
  // Should be able to use constructor, but built-in types aren't very precise.
  create: (x: ArrayBuffer | number) => TypedArray<Dtype>;
  // Should be able to use TypedArray<Dtype>['fill'], but type inference isn't strong enough.
  fill: (arr: TypedArray<Dtype>, value: Scalar<Dtype>) => void;
};

export type Indices = [start: number, stop: number, step: number];
export interface Slice {
  kind: 'slice';
  start: number | null;
  stop: number | null;
  step: number | null;
  indices: (length: number) => Indices;
}

interface SyncStore<O extends unknown = unknown> {
  get(key: string, opts?: O): Uint8Array | undefined;
  has(key: string): boolean;
  // Need overide Map to return SyncStore
  set(key: string, value: Uint8Array): void;
  delete(key: string): boolean;
  list_prefix(key: string): string[];
  list_dir(key: string): { contents: string[]; prefixes: string[] };
}

// Promisify return type of every function in SyncStore, override 'set' to return Promise<AsyncStore>
type AsyncStore<O extends unknown = unknown> = {
  [Key in keyof SyncStore<O>]: (
    ...args: Parameters<SyncStore<O>[Key]>
  ) => Promise<ReturnType<SyncStore<O>[Key]>>;
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
      ArrayAttributes<Dtype>,
      'store' | 'path' | 'dtype' | 'shape' | 'chunk_shape' | 'chunk_key'
    >
  >;

export type ArraySelection = null | (number | null | Slice)[];

export interface Hierarchy<Store extends SyncStore | AsyncStore> {
  // read-only
  has(path: string): Promise<boolean>;
  get(path: string): Promise<
    | import('./lib/hierarchy').ZarrArray<DataType, Store>
    | import('./lib/hierarchy').ExplicitGroup<Store, Hierarchy<Store>>
    | import('./lib/hierarchy').ImplicitGroup<Store, Hierarchy<Store>>
  >;
  get_array(path: string): Promise<import('./lib/hierarchy').ZarrArray<DataType, Store>>;
  get_group(
    path: string,
  ): Promise<import('./lib/hierarchy').ExplicitGroup<Store, Hierarchy<Store>>>;
  get_implicit_group(
    path: string,
  ): Promise<import('./lib/hierarchy').ImplicitGroup<Store, Hierarchy<Store>>>;
  get_children(path?: string): Promise<Map<string, string>>;

  // write
  create_group(
    path: string,
    props?: { attrs?: Attrs },
  ): Promise<import('./lib/hierarchy').ExplicitGroup<Store, Hierarchy<Store>>>;
  create_array<
    Dtype extends DataType,
  >(
    path: string,
    props: Omit<ArrayAttributes<Dtype>, 'path' | 'store'>,
  ): Promise<import('./lib/hierarchy').ZarrArray<Dtype, Store>>;
}

export type Setter<Dtype extends DataType, NdArray extends NdArrayLike<Dtype>> = {
  prepare(data: TypedArray<Dtype>, shape: number[]): NdArray;
  set_scalar(target: NdArray, selection: (Indices | number)[], value: Scalar<Dtype>): void;
  set_from_chunk(
    target: NdArray,
    target_selection: (Indices | number)[],
    chunk: NdArray,
    chunk_selection: (Indices | number)[],
  ): void;
};

// Compatible with https://github.com/sindresorhus/p-queue
export type ChunkQueue = {
  add(fn: () => Promise<void>): void;
  onIdle(): Promise<void[]>;
};

export type Options = { create_queue?: () => ChunkQueue };
export type GetOptions = Options;
export type SetOptions = Options;
