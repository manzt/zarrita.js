// @ts-check
import { assert, KeyError } from './lib/errors.js';
import { byte_swap_inplace, parse_dtype, should_byte_swap } from './lib/util.js';

/** @template {import('./types').Store} Store */
export class Node {
  /** @param {{ store: Store, path: string }} props */
  constructor({ store, path }) {
    this.store = store;
    this.path = path;
  }

  get name() {
    return this.path.split('/').pop() ?? '';
  }
}

/**
 * @template {import('./types').Store} Store
 * @template {import('./types').Hierarchy<Store>} Hierarchy
 * @extends {Node<Store>}
 */
export class Group extends Node {
  /** @param {{ store: Store, path: string, owner: Hierarchy }} props */
  constructor(props) {
    super(props);
    this.owner = props.owner;
  }

  async get_children() {
    return this.owner.get_children(this.path);
  }

  /**
   * @param {string} path
   * @returns {string}
   */
  _dereference_path(path) {
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
      assert(path[path.length - 1] !== '/', 'Path must end with \'/\'.');
    }
    return path;
  }

  /** @param {string} path */
  get(path) {
    path = this._dereference_path(path);
    return this.owner.get(path);
  }

  /** @param {string} path */
  has(path) {
    path = this._dereference_path(path);
    return this.owner.has(path);
  }

  /**
   * @param {string} path
   * @param {{ attrs?: Record<string, any> }} props
   */
  create_group(path, props = {}) {
    path = this._dereference_path(path);
    return this.owner.create_group(path, props);
  }

  /**
   * @param {string} path
   * @param {Parameters<Hierarchy['create_array']>[1]} props
   */
  create_array(path, props) {
    path = this._dereference_path(path);
    return this.owner.create_array(path, props);
  }

  /** @param {string} path */
  get_array(path) {
    path = this._dereference_path(path);
    return this.owner.get_array(path);
  }

  /** @param {string} path */
  get_group(path) {
    path = this._dereference_path(path);
    return this.owner.get_group(path);
  }

  /** @param {string} path */
  get_implicit_group(path) {
    path = this._dereference_path(path);
    return this.owner.get_implicit_group(path);
  }
}

/**
 * @template {import('./types').Store} Store
 * @template {import('./types').Hierarchy<Store>} Hierarchy
 * @extends {Group<Store, Hierarchy>}
 */
export class ExplicitGroup extends Group {
  /** @param {{
   *    store: Store,
   *    path: string,
   *    owner: Hierarchy,
   *    attrs: import('./types').Attrs | (() => Promise<import('./types').Attrs>),
   * }} props */
  constructor(props) {
    super(props);
    this._attrs = props.attrs || {};
  }

  /** @returns {Promise<import('./types').Attrs>} */
  get attrs() {
    if (typeof this._attrs === 'object') {
      return Promise.resolve(this._attrs);
    }
    return this._attrs().then((attrs) => {
      this._attrs = attrs;
      return attrs;
    });
  }
}

/**
 * @template {import('./types').Store} Store
 * @template {import('./types').Hierarchy<Store>} Hierarchy
 * @extends {Group<Store, Hierarchy>}
 */
export class ImplicitGroup extends Group {}

/**
 * @template {import('./types').DataType} Dtype
 * @template {import('./types').Store} Store
 * @extends {Node<Store>}
 */
export class ZarrArray extends Node {
  /** @param {import('./types').ArrayAttributes<Dtype, Store>} props */
  constructor(props) {
    super(props);
    this.shape = props.shape;
    this.dtype = props.dtype;
    this.chunk_shape = props.chunk_shape;
    this.compressor = props.compressor;
    this.fill_value = props.fill_value;
    this.chunk_key = props.chunk_key;
    this._attrs = props.attrs;
  }

  /** @returns {Promise<Record<string, any>>} */
  get attrs() {
    if (typeof this._attrs === 'object') {
      return Promise.resolve(this._attrs);
    }
    return this._attrs().then((attrs) => {
      // cache the result
      this._attrs = attrs;
      return attrs;
    });
  }

  get ndim() {
    return this.shape.length;
  }

  /**
   * @template {null | (number | import('./types').Slice | null)[]} S
   * @param {S} selection
   * @returns {S extends null ? Promise<import('./types').NDArray<Dtype>> : S[0] extends null | import('./types').Slice ? Promise<import('./types').NDArray<Dtype>> : Promise<import('./types').NDArray<Dtype> | import('./types').TypedArray<Dtype>[0]>}
   */
  get(selection) {
    throw new Error('Not implemented');
  }

  /**
   * @param {null | (number | import('./types').Slice | null)[]} selection
   * @param {import('./types').TypedArray<Dtype>[0] | import('./types').NDArray<Dtype>} value
   * @returns {Promise<void>}
   */
  set(selection, value) {
    throw new Error('Not implemented');
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<import('./types').TypedArray<Dtype>>}
   */
  async _decode_chunk(bytes) {
    // decompress
    if (this.compressor) {
      bytes = await this.compressor.decode(bytes);
    }
    // view as an NDArray with correct dtype & shape
    const { endianness, create } = parse_dtype(this.dtype);
    const data = create(bytes.buffer);

    if (should_byte_swap(endianness)) {
      byte_swap_inplace(data);
    }
    return data;
  }

  /** @param {import('./types').TypedArray<Dtype>} data */
  async _encode_chunk(data) {
    if (should_byte_swap(parse_dtype(this.dtype).endianness)) {
      byte_swap_inplace(data);
    }
    let bytes = new Uint8Array(data.buffer);
    if (this.compressor) {
      bytes = await this.compressor.encode(bytes);
    }
    return bytes;
  }

  /**
   * @param {number[]} chunk_coords
   * @returns {Promise<{ data: import('./types').TypedArray<Dtype>, shape: number[] }>}
   */
  async get_chunk(chunk_coords) {
    const chunk_key = this.chunk_key(chunk_coords);
    const buffer = await this.store.get(chunk_key);
    if (!buffer) throw new KeyError(chunk_key);
    const data = await this._decode_chunk(buffer);
    return { data, shape: this.chunk_shape };
  }
}
