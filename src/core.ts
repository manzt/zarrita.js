import { KeyError, NodeNotFoundError, NotImplementedError, assert } from './lib/errors.js';

interface RootMetadata {
  zarr_format: string;
  metadata_encoding: string;
  metadata_key_suffix: string;
  extensions: any[];
}

interface ArrayMetadata {
  shape: number[];
  data_type: string;
  chunk_grid: {
    type: 'regular';
    separator: string;
    chunk_shape: number[];
  };
  chunk_memory_layout: 'C';
  fill_value: null | number;
  extensions: any[];
  attributes: any;
  compressor?: CodecMeta;
}

interface GroupMetadata {
  attributes: any;
  extensions: any[];
}

interface Codec {
  id: string;
  encode(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
  decode(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
  fromConfig(config: { id: string }): Codec;
}

interface CodecMeta {
  codec: string;
  configuration: any;
}

function _json_encode_object(o: RootMetadata | ArrayMetadata | GroupMetadata): Uint8Array {
  const str = JSON.stringify(o, null, 2);
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function _json_decode_object(buffer: Uint8Array): unknown {
  const decoder = new TextDecoder();
  const str = decoder.decode(buffer);
  return JSON.parse(str);
}

export const registry: Map<String, () => Codec | Promise<Codec>> = new Map();

export async function create_hierarchy(store: Store = new MemoryStore()) {
  // create entry point metadata document
  const meta_key_suffix = '.json';
  const meta: RootMetadata = {
    zarr_format: 'https://purl.org/zarr/spec/protocol/core/3.0',
    metadata_encoding: 'https://purl.org/zarr/spec/protocol/core/3.0',
    metadata_key_suffix: meta_key_suffix,
    extensions: [],
  };

  // serialise and store metadata document
  const entry_meta_doc = _json_encode_object(meta);
  const entry_meta_key = 'zarr.json';
  await store.set(entry_meta_key, entry_meta_doc);

  // instantiate a hierarchy
  const hierarchy = new Hierarchy({ store, meta_key_suffix });
  return hierarchy;
}

export async function get_hierarchy(store: Store) {
  // retrieve and parse entry point metadata document
  const meta_key = 'zarr.json';
  const meta_doc = await store.get(meta_key);
  const meta = _json_decode_object(meta_doc) as RootMetadata;

  // check protocol version
  const segments = meta.zarr_format.split('/');
  const protocol_version = segments.pop() || '';
  const protocol_uri = segments.join('/');
  if (protocol_uri !== 'https://purl.org/zarr/spec/protocol/core') {
    throw new NotImplementedError(`No support for Protocol URI, got ${protocol_uri}.`);
  }
  const protocol_major_version = protocol_version.split('.')[0];
  if (protocol_major_version !== '3') {
    throw new NotImplementedError(`No support for protocol version, got ${protocol_major_version}.`);
  }

  // check metadata encoding
  if (meta.metadata_encoding !== 'https://purl.org/zarr/spec/protocol/core/3.0') {
    throw new NotImplementedError(`No support for metadata encoding, got ${meta.metadata_encoding}.`);
  }

  // check extensions
  for (const spec of meta.extensions) {
    if (spec.must_understand) {
      throw new NotImplementedError(`No support for required extensions, got ${JSON.stringify(spec)}.`);
    }
  }

  // instantiate hierarchy
  const meta_key_suffix = meta.metadata_key_suffix;
  const hierarchy = new Hierarchy({ store, meta_key_suffix });
  return hierarchy;
}

const ALLOWED_NODE_NAME_CHARS = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ._-');

function _check_path(path: string): string {
  if (path.length === 0) {
    throw new TypeError('Path cannot be empty string.');
  }

  if (path[0] !== '/') {
    // handle relative paths, treat as relative to the root, for user convenience
    path = '/' + path;
  }

  if (path.length > 1) {
    const segments = path.slice(1).split('/');
    for (const segment of segments) {
      if (segment.length === 0) {
        throw new TypeError('Path segment cannot be empty string.');
      }
      for (const c of segment) {
        if (!ALLOWED_NODE_NAME_CHARS.has(c)) {
          throw new TypeError(`Invalid Zarr path character: ${c}.`);
        }
      }
      if (segment.split('').every(c => c === '.')) {
        throw new TypeError('Path cannot be empty.');
      }
    }
  }

  return path;
}

function _check_attrs(attrs = {}): any {
  // assert attrs is None or isinstance(attrs, Mapping)
  return attrs;
}

function _check_shape(shape: number | number[]): number[] {
  if (typeof shape === 'number') {
    shape = [shape];
  }
  assert(
    shape.every(i => Number.isInteger(i)),
    `Invalid array shape, got: ${shape}`
  );
  return shape;
}

// no support for >u8, <u8, |b1, <f2, >f2
// prettier-ignore
const DTYPE_STRS = new Set([
   'i1',  'u1',
  '<i2', '<i4',
  '<i8', '>i8',
  '>i2', '>i4',
  '<u2', '<u4',
  '>u2', '>u4',
  '<f4', '<f8',
  '>f4', '>f8',
]);

function _check_dtype(dtype: string): string {
  assert(DTYPE_STRS.has(dtype), `Invalid dtype, got: ${dtype}`);
  return dtype;
}

function _check_chunk_shape(chunk_shape: number | number[], shape: number[]): number[] {
  if (typeof chunk_shape === 'number') {
    chunk_shape = [chunk_shape];
  }
  assert(chunk_shape.length === shape.length, 'chunk_shape and shape have different dim sizes.');
  return chunk_shape;
}

function _check_compressor(compressor?: Codec) {
  // TODO: Beter validattion for compressor
  if (compressor) {
    assert(
      typeof compressor.encode === 'function' && typeof compressor.decode === 'function',
      "compressor doesn't not have required decode and enode methods."
    );
  }
}

function _encode_codec_metadata(codec: Codec): CodecMeta {
  // only support gzip for now
  const supported_codecs = new Set('gzip');
  // TODO: better support for numcodecs;
  const codec_id = (codec.constructor as any).codecId as string;
  assert(!supported_codecs.has(codec_id), `codec not supported for metadata, got: ${codec_id}.`);
  const config = { level: (codec as any).level };
  const meta = {
    codec: 'https://purl.org/zarr/spec/codec/gzip/1.0',
    configuration: config,
  };
  return meta;
}

async function _decode_codec_metadata(meta?: CodecMeta) {
  if (!meta) return;
  // only support gzip for now
  if (meta.codec !== 'https://purl.org/zarr/spec/codec/gzip/1.0') {
    throw new NotImplementedError(`No support for codec, got ${meta.codec}.`);
  }
  const importer = registry.get('gzip');
  assert(importer !== undefined, 'Codec not in registry.');
  const GZip = await (importer as () => Promise<Codec>)();
  const codec = GZip.fromConfig(meta.configuration);
  return codec;
}

function _array_meta_key(path: string, suffix: string): string {
  if (path === '/') {
    // special case root path
    return 'meta/root.array' + suffix;
  }
  return `meta/root${path}.array` + suffix;
}

function _group_meta_key(path: string, suffix: string): string {
  if (path === '/') {
    // special case root path
    return 'meta/root.group' + suffix;
  }
  return `meta/root${path}.group` + suffix;
}

interface CreateArrayProps {
  shape: number | number[];
  dtype: string;
  chunk_shape: number | number[];
  chunk_separator?: string;
  compressor?: Codec;
  fill_value?: number;
  attrs?: any;
}

export class Hierarchy {
  store: Store;
  meta_key_suffix: string;

  constructor({ store, meta_key_suffix }: { store: Store; meta_key_suffix: string }) {
    this.store = store;
    this.meta_key_suffix = meta_key_suffix;
  }

  get root() {
    return this.get('/');
  }

  get array_suffix() {
    return '.array' + this.meta_key_suffix;
  }

  get group_suffix() {
    return '.group' + this.meta_key_suffix;
  }

  async create_group(path: string, props: any = {}) {
    const { attrs = {} } = props;
    // sanity checks
    path = _check_path(path);
    _check_attrs(attrs);

    // create group metadata
    const meta: GroupMetadata = { extensions: [], attributes: attrs };

    // serialise and store metadata document
    const meta_doc = _json_encode_object(meta);
    const meta_key = _group_meta_key(path, this.meta_key_suffix);
    await this.store.set(meta_key, meta_doc);

    // instantiate group
    const group = new ExplicitGroup({ store: this.store, owner: this, path, attrs });
    return group;
  }

  async create_array(path: string, props: CreateArrayProps): Promise<ZarrArray> {
    let { shape, dtype, chunk_shape, compressor, fill_value = null, chunk_separator = '/', attrs = {} } = props;

    // sanity checks
    path = _check_path(path);
    shape = _check_shape(shape);
    dtype = _check_dtype(dtype);
    chunk_shape = _check_chunk_shape(chunk_shape, shape);
    _check_compressor(compressor);
    attrs = _check_attrs(attrs);

    // create array metadata
    const meta: ArrayMetadata = {
      shape,
      data_type: dtype,
      chunk_grid: {
        type: 'regular',
        separator: chunk_separator,
        chunk_shape,
      },
      chunk_memory_layout: 'C',
      fill_value: fill_value,
      extensions: [],
      attributes: attrs,
    };

    if (compressor) {
      meta.compressor = _encode_codec_metadata(compressor);
    }

    // serialise and store metadata document
    const meta_doc = _json_encode_object(meta);
    const meta_key = _array_meta_key(path, this.meta_key_suffix);
    await this.store.set(meta_key, meta_doc);

    // instantiate array
    return new ZarrArray({
      store: this.store,
      path,
      owner: this,
      shape,
      dtype,
      chunk_shape,
      chunk_separator,
      compressor,
      fill_value,
      attrs,
    });
  }

  async get_array(path: string): Promise<ZarrArray> {
    path = _check_path(path);
    // retrieve and parse array metadata document
    const meta_key = _array_meta_key(path, this.meta_key_suffix);
    let meta_doc: Uint8Array;
    try {
      meta_doc = await this.store.get(meta_key);
    } catch (err) {
      if (err instanceof KeyError) {
        throw new NodeNotFoundError(path);
      }
      throw err;
    }
    const meta = _json_decode_object(meta_doc) as ArrayMetadata;

    // decode and check metadata
    const {
      shape,
      data_type: dtype,
      chunk_grid,
      fill_value,
      chunk_memory_layout,
      extensions,
      attributes: attrs,
    } = meta;

    _check_shape(chunk_grid.chunk_shape);
    if (chunk_grid.type !== 'regular') {
      throw new NotImplementedError(`Only support for "regular" chunk_grids, got ${chunk_grid.type}.`);
    }
    _check_chunk_shape(chunk_grid.chunk_shape, shape);
    if (chunk_memory_layout !== 'C') {
      throw new NotImplementedError(`Only support for "C" order chunk_memory_layout, got ${chunk_memory_layout}.`);
    }
    for (const spec of extensions) {
      if (spec.must_understand) {
        throw new NotImplementedError(`No support for required extensions found, ${JSON.stringify(spec)}.`);
      }
    }

    const compressor = await _decode_codec_metadata(meta.compressor);

    // instantiate array
    return new ZarrArray({
      store: this.store,
      path,
      owner: this,
      shape,
      dtype,
      chunk_shape: chunk_grid.chunk_shape,
      chunk_separator: chunk_grid.separator,
      compressor,
      fill_value,
      attrs,
    });
  }

  async get_explicit_group(path: string): Promise<ExplicitGroup> {
    path = _check_path(path);

    // retrieve and parse group metadata document
    const meta_key = _group_meta_key(path, this.meta_key_suffix);
    let meta_doc: Uint8Array;
    try {
      meta_doc = await this.store.get(meta_key);
    } catch (err) {
      if (err instanceof KeyError) {
        throw new NodeNotFoundError(path);
      }
      throw err;
    }
    const meta = _json_decode_object(meta_doc) as GroupMetadata;

    // check metadata
    const { attributes: attrs } = meta;

    // instantiate explicit group
    return new ExplicitGroup({ store: this.store, path, owner: this, attrs });
  }

  async get_implicit_group(path: string): Promise<ImplicitGroup> {
    path = _check_path(path);

    // attempt to list directory
    const key_prefix = path === '/' ? 'meta/root/' : `meta/root${path}/`;
    const result = await this.store.list_dir(key_prefix);

    const { contents, prefixes } = result;
    if (contents.length === 0 && prefixes.length === 0) {
      throw new NodeNotFoundError(path);
    }

    // instantiate implicit group
    return new ImplicitGroup({ store: this.store, path, owner: this });
  }

  async get(path: string): Promise<ZarrArray | ExplicitGroup | ImplicitGroup> {
    assert(typeof path === 'string', 'path must be string.');
    // try array
    try {
      return await this.get_array(path);
    } catch (err) {
      if (!(err instanceof NodeNotFoundError)) {
        throw err;
      }
    }
    // try explicit group
    try {
      return await this.get_explicit_group(path);
    } catch (err) {
      if (!(err instanceof NodeNotFoundError)) {
        throw err;
      }
    }

    // try implicit group
    try {
      return this.get_implicit_group(path);
    } catch (err) {
      if (!(err instanceof NodeNotFoundError)) {
        throw err;
      }
      throw new KeyError(path);
    }
  }

  async has(path: string): Promise<boolean> {
    try {
      await this.get(path);
      return true;
    } catch (err) {
      if (err instanceof NodeNotFoundError) {
        return false;
      }
      throw err;
    }
  }

  async length(): Promise<number> {
    const key_iter = await this.keys();
    return [...key_iter].length;
  }

  async keys(): Promise<IterableIterator<string>> {
    const nodes = await this.get_nodes();
    return nodes.keys();
  }

  repr() {
    return `<Hierarchy at ${this.store.repr?.()}>`;
  }

  async get_nodes(): Promise<Map<string, string>> {
    const nodes: Map<string, string> = new Map();
    const result = await this.store.list_prefix('meta/');

    const lookup = (key: string) => {
      if (key.endsWith(this.array_suffix)) {
        return { suffix: this.array_suffix, type: 'array' };
      } else if (key.endsWith(this.group_suffix)) {
        return { suffix: this.group_suffix, type: 'explicit_group' };
      }
    };

    for (const key of result) {
      if (key === 'root.array' + this.meta_key_suffix) {
        nodes.set('/', 'array');
      } else if (key == 'root.group') {
        nodes.set('/', 'explicit_group');
      } else if (key.startsWith('root/')) {
        const m = lookup(key);
        if (m) {
          const path = key.slice('root'.length, -m.suffix.length);
          nodes.set(path, m.type);
          const segments = path.split('/');
          segments.pop();
          while (segments.length > 1) {
            const parent = segments.join('/');
            nodes.set(parent, nodes.get(parent) || 'implicit_group');
            segments.pop();
          }
          nodes.set('/', nodes.get('/') || 'implicit_group');
        }
      }
    }
    return nodes;
  }

  async get_children(path = '/'): Promise<Map<string, string>> {
    path = _check_path(path);
    const children: Map<string, string> = new Map();

    // attempt to list directory
    const key_prefix = path === '/' ? 'meta/root/' : `meta/root${path}/`;
    const result = await this.store.list_dir(key_prefix);

    // find explicit children
    for (const n of result.contents) {
      if (n.endsWith(this.array_suffix)) {
        const name = n.slice(0, -this.array_suffix.length);
        children.set(name, 'array');
      } else if (n.endsWith(this.group_suffix)) {
        const name = n.slice(0, -this.group_suffix.length);
        children.set(name, 'explicit_group');
      }
    }

    // find implicit children
    for (const name of result.prefixes) {
      children.set(name, children.get(name) || 'implicit_group');
    }

    return children;
  }
}

interface NodeProps {
  store: Store;
  path: string;
  owner: Hierarchy;
}

class Node {
  store: Store;
  path: string;
  owner: Hierarchy;

  constructor({ store, path, owner }: NodeProps) {
    this.store = store;
    this.path = path;
    this.owner = owner;
  }

  get name(): string {
    return this.path.split('/').pop() || '';
  }
}

export class Group extends Node {
  async length() {
    const keys_iter = await this.keys();
    return [...keys_iter].length;
  }

  async keys() {
    const nodes = await this.get_children();
    return nodes.keys();
  }

  async get_children() {
    return this.owner.get_children(this.path);
  }

  private dereference_path(path: string): string {
    if (path[0] !== '/') {
      // treat as relative path
      if (this.path === '/') {
        // special case root group
        path = '/' + path;
      } else {
        path = this.path + '/' + path;
      }
    }
    if (path.length > 1) {
      assert(path[path.length - 1] !== '/', "Path must end with '/'.");
    }
    return path;
  }

  get(path: string) {
    path = this.dereference_path(path);
    return this.owner.get(path);
  }

  has(path: string) {
    path = this.dereference_path(path);
    return this.owner.has(path);
  }

  create_group(path: string, props: any) {
    path = this.dereference_path(path);
    return this.owner.create_group(path, props);
  }

  create_array(path: string, props: CreateArrayProps) {
    path = this.dereference_path(path);
    return this.owner.create_array(path, props);
  }

  get_array(path: string) {
    path = this.dereference_path(path);
    return this.owner.get_array(path);
  }

  get_explicit_group(path: string) {
    path = this.dereference_path(path);
    return this.owner.get_explicit_group(path);
  }

  get_implicit_group(path: string) {
    path = this.dereference_path(path);
    return this.owner.get_implicit_group(path);
  }
}

export class ExplicitGroup extends Group {
  attrs: any;

  constructor(props: NodeProps & { attrs?: any }) {
    super(props);
    this.attrs = props.attrs || {};
  }

  repr() {
    return `<Group ${this.path}>`;
  }
}

class ImplicitGroup extends Group {
  repr() {
    return `<Group ${this.path} (implied)>`;
  }
}

// Array

function system_is_little_endian(): boolean {
  const a = new Uint32Array([0x12345678]);
  const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  return !(b[0] === 0x12);
}

const LITTLE_ENDIAN_OS = system_is_little_endian();

const DTYPES = new Map(
  Object.entries({
    u1: Uint8Array,
    i1: Int8Array,
    u2: Uint16Array,
    i2: Int16Array,
    u4: Uint32Array,
    i4: Int32Array,
    f4: Float32Array,
    f8: Float64Array,
  })
);

export type TypedArray =
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array;

function byte_swap_inplace(src: TypedArray): void {
  const b = src.BYTES_PER_ELEMENT;
  const flipper = new Uint8Array(src.buffer, src.byteOffset, src.length * b);
  const numFlips = b / 2;
  const endByteIndex = b - 1;
  let t = 0;
  for (let i = 0; i < flipper.length; i += b) {
    for (let j = 0; j < numFlips; j += 1) {
      t = flipper[i + j];
      flipper[i + j] = flipper[i + endByteIndex - j];
      flipper[i + endByteIndex - j] = t;
    }
  }
}

interface ArrayProps {
  shape: number[];
  dtype: string;
  chunk_shape: number[];
  chunk_separator: string;
  compressor?: Codec;
  fill_value: number | null;
  attrs?: any;
}

export class ZarrArray extends Node {
  shape: number[];
  dtype: string;
  chunk_shape: number[];
  chunk_separator: string;
  compressor?: Codec;
  fill_value: number | null;
  attrs: any;
  TypedArray: TypedArray;
  private should_byte_swap: boolean;

  constructor(props: NodeProps & ArrayProps) {
    const { shape, dtype, chunk_shape, chunk_separator, compressor, fill_value = null, attrs = {} } = props;
    super(props);
    this.shape = shape;
    this.dtype = dtype;
    this.chunk_shape = chunk_shape;
    this.chunk_separator = chunk_separator;
    this.compressor = compressor;
    this.fill_value = fill_value;
    this.attrs = attrs;
    const key = this.dtype[0] === '<' || this.dtype[0] === '>' ? this.dtype.slice(1, 3) : this.dtype;
    this.TypedArray = (DTYPES.get(key) as any) as TypedArray;
    this.should_byte_swap = (dtype[0] === '>' && LITTLE_ENDIAN_OS) || (dtype[0] === '<' && !LITTLE_ENDIAN_OS);
  }

  get ndim() {
    return this.shape.length;
  }

  get() {
    throw new NotImplementedError('Must import main package export for array indexing.');
  }

  _chunk_key(chunk_coords: number[]): string {
    const chunk_identifier = 'c' + chunk_coords.join(this.chunk_separator);
    const chunk_key = `data/root${this.path}/${chunk_identifier}`;
    return chunk_key;
  }

  async _decode_chunk(buffer: Uint8Array): Promise<TypedArray> {
    // decompress
    let bytes = new Uint8Array(buffer);
    if (this.compressor) {
      bytes = await this.compressor.decode(bytes);
    }
    // view as an NDArray with correct dtype & shape
    const data: TypedArray = new (this.TypedArray as any)(bytes.buffer);

    if (this.should_byte_swap) {
      byte_swap_inplace(data);
    }
    return data;
  }

  async _encode_chunk(data: TypedArray): Promise<Uint8Array> {
    if (this.should_byte_swap) {
      byte_swap_inplace(data);
    }
    let bytes = new Uint8Array(data.buffer);
    if (this.compressor) {
      bytes = await this.compressor.encode(bytes);
    }
    return bytes;
  }

  async get_chunk(chunk_coords: number[]) {
    const chunk_key = this._chunk_key(chunk_coords);
    const buffer = await this.store.get(chunk_key);
    const data = await this._decode_chunk(buffer);
    return { data, shape: this.chunk_shape };
  }

  set() {
    throw new NotImplementedError('Must import main package export for array indexing.');
  }

  repr() {
    return `<Array ${this.path}>`;
  }
}

// STORAGE //

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

export class MemoryStore implements Store {
  map: Map<string, Uint8Array>;

  constructor() {
    this.map = new Map();
  }

  get(key: string, _default?: Uint8Array) {
    const value = this.map.get(key);
    if (!value) {
      if (_default) return _default;
      throw new KeyError(key);
    }
    return value;
  }

  set(key: string, value: Uint8Array) {
    this.map.set(key, value);
    return;
  }

  delete(key: string) {
    return this.map.delete(key);
  }

  list_prefix(prefix: string) {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    assert(prefix[prefix.length - 1] === '/', "Prefix must end with '/'.");
    const items = [];
    for (const path of this.map.keys()) {
      if (path.startsWith(prefix)) {
        items.push(path.split(prefix)[1]);
      }
    }
    return items;
  }

  list_dir(prefix = '') {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    if (prefix) {
      assert(prefix[prefix.length - 1] === '/', "Prefix must end with '/'");
    }

    const contents = [];
    const prefixes: Set<string> = new Set();

    for (const path of this.map.keys()) {
      if (path.includes(prefix)) {
        const name = prefix ? path.split(prefix)[1] : path;
        const segments = name.split('/');
        const item = segments[0];
        if (segments.length === 1) {
          // file
          contents.push(item);
        } else {
          prefixes.add(item);
        }
      }
    }

    return { contents, prefixes: [...prefixes] };
  }

  keys() {
    return this.map.keys();
  }

  repr() {
    return '(MemoryStore)';
  }
}
