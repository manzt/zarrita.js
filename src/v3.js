// @ts-check
import { ExplicitGroup, ImplicitGroup, ZarrArray } from './hierarchy.js';
import { registry } from './registry.js';
import {
  assert,
  KeyError,
  NodeNotFoundError,
  NotImplementedError,
} from './lib/errors.js';
import {
  ensure_array,
  ensure_dtype,
  json_decode_object,
  json_encode_object,
  normalize_path,
} from './lib/util.js';

export { slice } from './lib/indexing.js';
export { ExplicitGroup, ImplicitGroup, registry, ZarrArray };

/**
 * @typedef {{
 * 	zarr_format: string;
 * 	metadata_encoding: string;
 * 	metadata_key_suffix: string;
 * 	extensions: Record<string, unknown>[];
 * }} RootMetadata
 */
/**
 * @template {import('./types').DataType} Dtype
 *
 * @typedef {{
 * 	shape: number[];
 * 	data_type: Dtype;
 * 	chunk_grid: {
 * 	  type: "regular";
 * 	  separator: "/" | ".";
 * 	  chunk_shape: number[];
 * 	};
 * 	chunk_memory_layout: "C";
 * 	fill_value: null | import('./types').Scalar<Dtype>;
 * 	extensions: Record<string, any>[];
 * 	attributes: Record<string, any>;
 * 	compressor?: CodecMetadata;
 * }} ArrayMetadata
 */
/**
 * @typedef {{
 * 	codec: string;
 * 	configuration: Record<string, unknown>;
 * }} CodecMetadata
 */
/**
 * @typedef {{
 * 	attributes: Record<string, any>;
 * 	extensions: Record<string, any>[];
 * }} GroupMetadata
}


/** @param {import('numcodecs').Codec} codec */
export function encode_codec_metadata(codec) {
  // only support gzip for now
  const supported_codecs = new Set('gzip');
  // @ts-ignore
  const codec_id = codec.constructor.codecId;
  assert(
    !supported_codecs.has(codec_id),
    `codec not supported for metadata, got: ${codec_id}.`,
  );
  // @ts-ignore
  const config = { level: codec.level };
  const meta = {
    codec: 'https://purl.org/zarr/spec/codec/gzip/1.0',
    configuration: config,
  };
  return meta;
}

/** @param {CodecMetadata} meta */
export async function decode_codec_metadata(meta) {
  // only support gzip for now
  if (meta.codec !== 'https://purl.org/zarr/spec/codec/gzip/1.0') {
    throw new NotImplementedError(
      `No support for codec, got ${meta.codec}.`,
    );
  }
  const importer = registry.get('gzip');
  if (!importer) {
    throw new Error(`Missing gzip codec in registry.`);
  }
  const GZip = await importer();
  const codec = GZip.fromConfig(meta.configuration);
  return codec;
}

/**
 * @param {string} path
 * @param {string} suffix
 */
export function array_meta_key(path, suffix) {
  if (path === '/') {
    // special case root path
    return 'meta/root.array' + suffix;
  }
  return `meta/root${path}.array` + suffix;
}

/**
 * @param {string} path
 * @param {string} suffix
 */
export function group_meta_key(path, suffix) {
  if (path === '/') {
    // special case root path
    return 'meta/root.group' + suffix;
  }
  return `meta/root${path}.group` + suffix;
}

/**
 * @template {import('./types').Store} Store
 * @param {Store} store
 * @return {Promise<Hierarchy<Store>>}
 */
export async function create_hierarchy(store) {
  // create entry point metadata document
  const meta_key_suffix = '.json';

  /** @type {RootMetadata} */
  const meta = {
    zarr_format: 'https://purl.org/zarr/spec/protocol/core/3.0',
    metadata_encoding: 'https://purl.org/zarr/spec/protocol/core/3.0',
    metadata_key_suffix: meta_key_suffix,
    extensions: [],
  };

  // serialise and store metadata document
  const entry_meta_doc = json_encode_object(meta);
  const entry_meta_key = 'zarr.json';
  await store.set(entry_meta_key, entry_meta_doc);

  // instantiate a hierarchy
  return new Hierarchy({ store, meta_key_suffix });
}

/**
 * @template {import('./types').Store} Store
 * @param {Store} store
 * @returns {Promise<Hierarchy<Store>>}
 */
export async function get_hierarchy(store) {
  // retrieve and parse entry point metadata document
  const meta_key = 'zarr.json';
  const meta_doc = await store.get(meta_key);

  if (!meta_doc) {
    throw new NodeNotFoundError(meta_key);
  }

  /** @type {RootMetadata} */
  const meta = json_decode_object(meta_doc);

  // check protocol version
  const segments = meta.zarr_format.split('/');
  const protocol_version = segments.pop() || '';
  const protocol_uri = segments.join('/');
  if (protocol_uri !== 'https://purl.org/zarr/spec/protocol/core') {
    throw new NotImplementedError(
      `No support for Protocol URI, got ${protocol_uri}.`,
    );
  }
  const protocol_major_version = protocol_version.split('.')[0];
  if (protocol_major_version !== '3') {
    throw new NotImplementedError(
      `No support for protocol version, got ${protocol_major_version}.`,
    );
  }

  // check metadata encoding
  if (
    meta.metadata_encoding !==
      'https://purl.org/zarr/spec/protocol/core/3.0'
  ) {
    throw new NotImplementedError(
      `No support for metadata encoding, got ${meta.metadata_encoding}.`,
    );
  }

  // check extensions
  for (const spec of meta.extensions) {
    if (spec.must_understand) {
      throw new NotImplementedError(
        `No support for required extensions, got ${JSON.stringify(spec)}.`,
      );
    }
  }

  // instantiate hierarchy
  const meta_key_suffix = meta.metadata_key_suffix;
  return new Hierarchy({ store, meta_key_suffix });
}

/**
 * @template {import('./types').Store} Store
 * @typedef {import('./types').Hierarchy<Store>} HierarchyProtocol
 */

/**
 * @template {import('./types').Store} Store
 * @implements {HierarchyProtocol<Store>}
 */
export class Hierarchy {
  /** @param {{ store: Store, meta_key_suffix: string }} props */
  constructor({ store, meta_key_suffix }) {
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

  /**
   * @param {string} path
   * @param {{ attrs?: import('./types').Attrs }} props
   * @returns {Promise<ExplicitGroup<Store, Hierarchy<Store>>>}
   */
  async create_group(path, props = {}) {
    const { attrs = {} } = props;
    // sanity checks
    path = normalize_path(path);

    /** @type {GroupMetadata} */
    const meta = { extensions: [], attributes: attrs };

    // serialise and store metadata document
    const meta_doc = json_encode_object(meta);
    const meta_key = group_meta_key(path, this.meta_key_suffix);
    await this.store.set(meta_key, meta_doc);

    return new ExplicitGroup({
      store: this.store,
      owner: this,
      path,
      attrs,
    });
  }

  /**
   * @template {import('./types').DataType} Dtype
   * @param {string} path
   * @param {{
   *   shape: number | number[],
   *   chunk_shape: number | number[],
   *   dtype: Dtype;
   * } & Partial<Omit<import('./types').ArrayAttributes, 'store' | 'path' | 'dtype' | 'shape' | 'chunk_shape'>>} props
   * @returns {Promise<ZarrArray<Dtype, Store>>}
   */
  async create_array(path, props) {
    // sanity checks
    path = normalize_path(path);
    const shape = ensure_array(props.shape);
    const dtype = ensure_dtype(props.dtype);
    const chunk_shape = ensure_array(props.chunk_shape);
    const compressor = props.compressor;

    assert(
      shape.length === chunk_shape.length,
      'shape and chunk_shape must have same number of dims.',
    );

    /** @type {ArrayMetadata<Dtype>} */
    const meta = {
      shape,
      data_type: dtype,
      chunk_grid: {
        type: 'regular',
        separator: props.chunk_separator ?? '/',
        chunk_shape,
      },
      chunk_memory_layout: 'C',
      fill_value: props.fill_value ?? null,
      extensions: [],
      attributes: props.attrs ?? {},
    };

    if (compressor) {
      meta.compressor = encode_codec_metadata(compressor);
    }

    // serialise and store metadata document
    const meta_doc = json_encode_object(meta);
    const meta_key = array_meta_key(path, this.meta_key_suffix);
    await this.store.set(meta_key, meta_doc);

    return new ZarrArray({
      store: this.store,
      path,
      shape: meta.shape,
      dtype: dtype,
      chunk_shape: meta.chunk_grid.chunk_shape,
      chunk_separator: meta.chunk_grid.separator,
      compressor: compressor,
      fill_value: meta.fill_value,
      attrs: meta.attributes,
    });
  }

  /**
   * @param {string} path
   * @returns {Promise<ZarrArray<import('./types').DataType, Store>>}
   */
  async get_array(path) {
    path = normalize_path(path);
    // retrieve and parse array metadata document
    const meta_key = array_meta_key(path, this.meta_key_suffix);

    const meta_doc = await this.store.get(meta_key);

    if (!meta_doc) {
      throw new NodeNotFoundError(path);
    }

    /** @type {ArrayMetadata<import('./types').DataType>} */
    const meta = json_decode_object(meta_doc);

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

    if (chunk_grid.type !== 'regular') {
      throw new NotImplementedError(
        `Only support for "regular" chunk_grids, got ${chunk_grid.type}.`,
      );
    }

    if (chunk_memory_layout !== 'C') {
      throw new NotImplementedError(
        `Only support for "C" order chunk_memory_layout, got ${chunk_memory_layout}.`,
      );
    }

    for (const spec of extensions) {
      if (spec.must_understand) {
        throw new NotImplementedError(
          `No support for required extensions found, ${JSON.stringify(spec)}.`,
        );
      }
    }

    return new ZarrArray({
      store: this.store,
      path,
      shape: shape,
      dtype: ensure_dtype(dtype),
      chunk_shape: chunk_grid.chunk_shape,
      chunk_separator: chunk_grid.separator,
      compressor: meta.compressor
        ? await decode_codec_metadata(meta.compressor)
        : undefined,
      fill_value,
      attrs,
    });
  }

  /**
   * @param {string} path
   * @returns {Promise<ExplicitGroup<Store, Hierarchy<Store>>>}
   */
  async get_explicit_group(path) {
    path = normalize_path(path);

    // retrieve and parse group metadata document
    const meta_key = group_meta_key(path, this.meta_key_suffix);
    const meta_doc = await this.store.get(meta_key);

    if (!meta_doc) {
      throw new NodeNotFoundError(path);
    }

    /** @type {GroupMetadata} */
    const meta = json_decode_object(meta_doc);

    // instantiate explicit group
    return new ExplicitGroup({
      store: this.store,
      owner: this,
      path,
      attrs: meta.attributes,
    });
  }

  /**
   * @param {string} path
   * @returns {Promise<ImplicitGroup<Store, Hierarchy<Store>>>}
   */
  async get_implicit_group(path) {
    path = normalize_path(path);

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

  /**
   * @param {string} path
   * @returns {Promise<ZarrArray<import('./types').DataType, Store> | ExplicitGroup<Store, Hierarchy<Store>> | ImplicitGroup<Store, Hierarchy<Store>>>}
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

  /** @returns {Promise<Map<string, string>>} */
  async get_nodes() {
    /** @type {Map<string, string>} */
    const nodes = new Map();
    const result = await this.store.list_prefix('meta/');

    /** @param {string} key */
    const lookup = (key) => {
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
            nodes.set(
              parent,
              nodes.get(parent) || 'implicit_group',
            );
            segments.pop();
          }
          nodes.set('/', nodes.get('/') || 'implicit_group');
        }
      }
    }
    return nodes;
  }

  /**
   * @param {string} path
   * @returns {Promise<Map<string, string>>}
   */
  async get_children(path = '/') {
    path = normalize_path(path);

    /** @type {Map<string, string>} */
    const children = new Map;

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
