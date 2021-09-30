// @ts-check

import { ExplicitGroup, ZarrArray } from './hierarchy.js';
import { registry } from './registry.js';
import { KeyError, NodeNotFoundError } from './lib/errors.js';
import {
  ensure_array,
  ensure_dtype,
  json_decode_object,
  json_encode_object,
  // normalize_path,
} from './lib/util.js';

export { slice } from './lib/indexing.js';
export { ExplicitGroup, registry, ZarrArray };

/** @param {import('numcodecs').Codec} codec */
function encode_codec_metadata(codec) {
  // @ts-ignore
  return { id: codec.constructor.codecId, ...codec };
}

/**
 * @param {any} config
 * @returns {Promise<import('numcodecs').Codec>}
 */
async function decode_codec_metadata(config) {
  const importer = registry.get(config.id);
  if (!importer) throw new Error('missing codec' + config.id);
  const ctr = await importer();
  return ctr.fromConfig(config);
}

/**
 * @template {import('./types').DataType} Dtype
 *
 * @typedef {{
 * 	zarr_format: 2;
 * 	shape: number[];
 * 	chunks: number[];
 * 	dtype: Dtype;
 * 	compressor: null | Record<string, any>;
 * 	fill_value: import('./types').Scalar<Dtype> | null;
 * 	order: 'C' | 'F',
 * 	filters: null | Record<string, any>[];
 * 	dimension_separator?: '.' | '/'
 * }} ArrayMetadata
 */

/** @typedef {{ zarr_format: 2 }} GroupMetadata */

/** @param {string} path */
const key_prefix = (path) => path.length > 1 ? path + '/' : '';

/** @param {string} path */
const array_meta_key = (path) => key_prefix(path) + '.zarray';

/** @param {string} path */
const group_meta_key = (path) => key_prefix(path) + '.zgroup';

/** @param {string} path */
const attrs_key = (path) => key_prefix(path) + '.zattrs';

/**
 * @param {import('./types').Store} store
 * @param {string} path
 * @returns {Promise<import('./types').Attrs>}
 */
const get_attrs = async (store, path) => {
  const attrs = await store.get(attrs_key(path));
  return attrs ? json_decode_object(attrs) : {};
};

/**
 * @param {string} path
 * @param {'.' | '/'} chunk_separator
 * @returns {(chunk_coords: number[]) => string}
 */
const chunk_key = (path, chunk_separator) => {
  const prefix = key_prefix(path);
  return (chunk_coords) => {
    const chunk_identifier = chunk_coords.join(chunk_separator);
    const chunk_key = prefix + chunk_identifier;
    return chunk_key;
  };
};
/**
 * @template {import('./types').Store} S
 * @param {S} store
 * @return {Hierarchy<S>}
 */
export const create_hierarchy = (store) => new Hierarchy({ store });

/**
 * @template {import('./types').Store} S
 * @param {S} store
 * @returns {Hierarchy<S>}
 */
export const get_hierarchy = (store) => new Hierarchy({ store });

/**
 * @template {import('./types').Store} S
 * @typedef {import('./types').Hierarchy<S>} HierarchyProtocol
 */

/**
 * @template {import('./types').Store} S
 * @implements {HierarchyProtocol<S>}
 */
export class Hierarchy {
  /** @param {{ store: S }} props */
  constructor({ store }) {
    this.store = store;
  }

  get root() {
    return this.get('/');
  }

  /**
   * @param {string} path
   * @param {{ attrs?: Record<string, any> }} props
   * @returns {Promise<ExplicitGroup<S, Hierarchy<S>>>}
   */
  async create_group(path, props = {}) {
    const { attrs } = props;
    // sanity checks
    // path = normalize_path(path);

    // serialise and store metadata document
    const meta_doc = json_encode_object({ zarr_format: 2 });
    const meta_key = group_meta_key(path);
    await this.store.set(meta_key, meta_doc);

    if (attrs) {
      await this.store.set(attrs_key(path), json_encode_object(attrs));
    }

    return new ExplicitGroup({ store: this.store, owner: this, path, attrs: attrs ?? {} });
  }

  /**
   * @template {import('./types').DataType} Dtype
   *
   * @param {string} path
   * @param {import('./types').CreateArrayProps<Dtype>} props
   * @returns {Promise<ZarrArray<Dtype, S>>}
   */
  async create_array(path, props) {
    // sanity checks
    // path = normalize_path(path);
    const shape = ensure_array(props.shape);
    const dtype = ensure_dtype(props.dtype);
    const chunk_shape = ensure_array(props.chunk_shape);
    const compressor = props.compressor;
    const chunk_separator = props.chunk_separator ?? '.';

    /** @type {ArrayMetadata<Dtype>} */
    const meta = {
      zarr_format: 2,
      shape,
      dtype,
      chunks: chunk_shape,
      dimension_separator: chunk_separator,
      order: 'C',
      fill_value: props.fill_value ?? null,
      filters: [],
      compressor: compressor ? encode_codec_metadata(compressor) : null,
    };

    // serialise and store metadata document
    const meta_doc = json_encode_object(meta);
    const meta_key = array_meta_key(path);
    await this.store.set(meta_key, meta_doc);

    if (props.attrs) {
      await this.store.set(attrs_key(path), json_encode_object(props.attrs));
    }

    return new ZarrArray({
      store: this.store,
      path,
      shape: meta.shape,
      dtype: dtype,
      chunk_shape: meta.chunks,
      chunk_key: chunk_key(path, chunk_separator),
      compressor: compressor,
      fill_value: meta.fill_value,
      attrs: props.attrs ?? {},
    });
  }

  /**
   * @param {string} path
   * @returns {Promise<ZarrArray<import('./types').DataType, S>>}
   */
  async get_array(path) {
    // path = normalize_path(path);
    const meta_key = array_meta_key(path);
    const meta_doc = await this.store.get(meta_key);

    if (!meta_doc) {
      throw new NodeNotFoundError(path);
    }

    /** @type {ArrayMetadata<import('./types').DataType>} */
    const meta = json_decode_object(meta_doc);

    return new ZarrArray({
      store: this.store,
      path,
      shape: meta.shape,
      dtype: meta.dtype,
      chunk_shape: meta.chunks,
      chunk_key: chunk_key(path, meta.dimension_separator ?? '.'),
      compressor: meta.compressor
        ? await decode_codec_metadata(meta.compressor)
        : undefined,
      fill_value: meta.fill_value,
      attrs: () => get_attrs(this.store, path),
    });
  }

  /**
   * @param {string} path
   * @returns {Promise<ExplicitGroup<S, Hierarchy<S>>>}
   */
  async get_group(path) {
    // path = normalize_path(path);

    const meta_key = group_meta_key(path);
    const meta_doc = await this.store.get(meta_key);

    if (!meta_doc) {
      throw new NodeNotFoundError(path);
    }

    // instantiate explicit group
    return new ExplicitGroup({
      store: this.store,
      owner: this,
      path,
      attrs: () => get_attrs(this.store, path),
    });
  }

  /**
   * @param {string} path
   * @returns {Promise<ZarrArray<import('./types').DataType, S> | ExplicitGroup<S, Hierarchy<S>>>}
   */
  async get(path) {
    try {
      return await this.get_array(path);
    } catch (err) {
      if (!(err instanceof NodeNotFoundError)) {
        throw err;
      }
    }
    // try explicit group
    try {
      return await this.get_group(path);
    } catch (err) {
      if (!(err instanceof NodeNotFoundError)) {
        throw err;
      }
    }
    throw new KeyError(path);
  }

  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async has(path) {
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

  /** @param {string} _path */
  async get_children(_path) {
    console.warn('get_children not implemented for v2.');
    return new Map();
  }

  /**
   * @param {string} _path
   * @returns {never}
   */
  get_implicit_group(_path) {
    throw new Error('Implicit group not implemented for v2.');
  }
}
