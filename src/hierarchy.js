// @ts-check
import { assert, KeyError } from './lib/errors.js';
import { byte_swap_inplace, parse_dtype, should_byte_swap } from './lib/util.js';

/** @template {import('./types').Store} S */
export class Node {
  /** @param {{ store: S, path: string }} props */
  constructor({ store, path }) {
    this.store = store;
    this.path = path;
  }

  get name() {
    return this.path.split('/').pop() ?? '';
  }
}

/**
 * @template {import('./types').Store} S
 * @template {import('./types').Hierarchy<S>} H
 * @extends {Node<S>}
 */
export class Group extends Node {
  /** @param {{ store: S, path: string, owner: H }} props */
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
   * @param {Parameters<H['create_array']>[1]} props
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
  get_explicit_group(path) {
    path = this._dereference_path(path);
    return this.owner.get_explicit_group(path);
  }

  /** @param {string} path */
  get_implicit_group(path) {
    path = this._dereference_path(path);
    return this.owner.get_implicit_group(path);
  }
}

/**
 * @template {import('./types').Store} S
 * @template {import('./types').Hierarchy<S>} H
 * @extends {Group<S, H>}
 */
export class ExplicitGroup extends Group {
  /** @param {{ store: S, path: string, owner: H, attrs?: Record<string, any> }} props */
  constructor(props) {
    super(props);
    this.attrs = props.attrs || {};
  }
}

/**
 * @template {import('./types').Store} S
 * @template {import('./types').Hierarchy<S>} H
 * @extends {Group<S, H>}
 */
export class ImplicitGroup extends Group {}

/**
 * @template {import('./types').Dtype} D
 * @template {import('./types').Store} S
 * @extends {Node<S>}
 */
export class ZarrArray extends Node {
  /** @param {import('./types').ArrayProps<D, S>} props */
  constructor(props) {
    super(props);
    this.shape = props.shape;
    this.dtype = props.dtype;
    this.chunk_shape = props.chunk_shape;
    this.compressor = props.compressor;
    this.chunk_separator = props.chunk_separator;
    this.fill_value = props.fill_value;
    this.attrs = props.attrs;
  }

  get ndim() {
    return this.shape.length;
  }

  /**
   * @template {null | (number | import('./types').Slice | null)[]} S
   * @param {S} selection
   * @returns {S extends null ? Promise<import('./types').NDArray<D>> : S[0] extends null | import('./types').Slice ? Promise<import('./types').NDArray<D>> : Promise<import('./types').NDArray<D> | import('./types').TypedArray<D>[0]>}
   */
  get(selection) {
    throw new Error('Not implemented');
  }

  /**
   * @param {null | (number | import('./types').Slice | null)[]} selection
   * @param {import('./types').TypedArray<D>[0] | import('./types').NDArray<D>} value
   * @returns {Promise<void>}
   */
  set(selection, value) {
    throw new Error('Not implemented');
  }

  /**
   * @param {number[]} chunk_coords
   * @returns {string}
   */
  _chunk_key(chunk_coords) {
    const chunk_identifier = 'c' + chunk_coords.join(this.chunk_separator);
    const chunk_key = `data/root${this.path}/${chunk_identifier}`;
    return chunk_key;
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<import('./types').TypedArray<D>>}
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

  /** @param {import('./types').TypedArray<D>} data */
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
   * @returns {Promise<{ data: import('./types').TypedArray<D>, shape: number[] }>}
   */
  async get_chunk(chunk_coords) {
    const chunk_key = this._chunk_key(chunk_coords);
    const buffer = await this.store.get(chunk_key);
    if (!buffer) throw new KeyError(chunk_key);
    const data = await this._decode_chunk(buffer);
    return { data, shape: this.chunk_shape };
  }
}
