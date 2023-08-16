import { create_codec_pipeline } from "./codecs.js";
import {
	encode_chunk_key,
	is_dtype,
	json_decode_object,
	v2_marker,
} from "./util.js";
import { KeyError } from "./errors.js";

/** @typedef {import("./types.js").DataType} DataType */
/** @typedef {import("@zarrita/storage").Readable} Readable */
/** @typedef {import("@zarrita/storage").Writeable} Writeable */
/**
 * @template {Record<string, any>} T
 * @typedef {import("@zarrita/storage").Async<T>} Async
 */

/**
 * A navigable location in a Zarr store.
 * @template Store
 */
export class Location {
	/**
	 * @param {Store} store
	 * @param {import("@zarrita/storage").AbsolutePath} path
	 */
	constructor(store, path = "/") {
		this.store = store;
		this.path = path;
	}

	/**
	 * @param {string} path
	 * @returns {Location<Store>}
	 *
	 * @example
	 * ```javascript
	 * let root = new Location(new Map);
	 * let bar = root.resolve("foo").resolve("bar");
	 * bar.path; // "/foo/bar"
	 * bar.resolve("..").path; // "/foo"
	 * bar.resolve("/baz").path; // "/baz"
	 * ```
	 */
	resolve(path) {
		// reuse URL resolution logic built into the browser
		// handles relative paths, absolute paths, etc.
		let root = new URL(
			`file://${this.path.endsWith("/") ? this.path : `${this.path}/`}`,
		);
		return new Location(
			this.store,
			/** @type {import("@zarrita/storage").AbsolutePath} */ (new URL(
				path,
				root,
			).pathname),
		);
	}
}

/**
 * @template Store
 * @overload
 * @param {Store} store
 * @returns {Location<Store>}
 */
/**
 * @overload
 * @returns {Location<Map<string, Uint8Array>>}
 */
/**
 * @template Store
 * @param {Store} [store]
 * @returns {Location<Store | Map<string, Uint8Array>>}
 */
export function root(store) {
	return new Location(store ?? new Map());
}

/**
 * A Zarr group.
 *
 * @template {Readable | Async<Readable>} Store
 * @extends {Location<Store>}
 */
export class Group extends Location {
	/** @type {import("./types.js").GroupMetadata} */
	#metadata;
	/** @type {Record<string, any> | undefined} */
	#attributes;

	/**
	 * @param {Store} store
	 * @param {import("@zarrita/storage").AbsolutePath} path
	 * @param {import("./types.js").GroupMetadata} metadata
	 */
	constructor(store, path, metadata) {
		super(store, path);
		this.#metadata = metadata;
	}

	/**
	 * Access the metadata for this group.
	 *
	 * For v2, this loads and caches the JSON from `.zattrs`.
	 * For v3, this returns the (already loaded) metadata from the `zarr.json` file.
	 *
	 * @returns {Promise<import("./types.js").Attributes>}
	 */
	async attrs() {
		if (
			this.#attributes === undefined &&
			v2_marker in this.#metadata.attributes
		) {
			let attrs = await this.store.get(this.resolve(".zattrs").path);
			this.#attributes = (attrs && json_decode_object(attrs)) || {};
		} else {
			this.#attributes = this.#metadata.attributes;
		}
		return this.#attributes ?? {};
	}
}

/**
 * A Zarr array.
 *
 * @template {DataType} Dtype
 * @template {Readable | Async<Readable>} Store
 * @extends {Location<Store>}
 */
export class Array extends Location {
	/** @type {ReturnType<typeof create_codec_pipeline>} */
	codec;
	/** @type {import("./types.js").ArrayMetadata<Dtype>} */
	#metadata;
	/** @type {Record<string, any> | undefined} */
	#attributes;
	/** @type {"C" | "F"} */
	_order;

	/**
	 * @param {Store} store
	 * @param {import("@zarrita/storage").AbsolutePath} path
	 * @param {import("./types.js").ArrayMetadata<Dtype>} metadata
	 */
	constructor(store, path, metadata) {
		super(store, path);
		this.codec = create_codec_pipeline(metadata);
		this.#metadata = metadata;
		if (typeof metadata.attributes === "object") {
			this.#attributes = metadata.attributes;
		}
		const maybe_transpose_codec = metadata.codecs.find(
			(c) => c.name === "transpose",
		);
		this._order = maybe_transpose_codec?.configuration?.order === "F"
			? "F"
			: "C";
	}

	/**
	 * @param {number[]} chunk_coords
	 * @returns {string}
	 */
	chunk_key(chunk_coords) {
		return encode_chunk_key(
			chunk_coords,
			this.#metadata.chunk_key_encoding,
		);
	}

	/**
	 * Load and decode the chunk at the given coordinates.
	 *
	 * @raises {KeyError} if the chunk does not exist
	 *
	 * @param {number[]} chunk_coords
	 * @param {Parameters<Store["get"]>[1]} [options]
	 * @returns {Promise<import("./types.js").Chunk<Dtype>>}
	 */
	async get_chunk(chunk_coords, options) {
		let chunk_path = this.resolve(this.chunk_key(chunk_coords)).path;
		let maybe_bytes = await this.store.get(chunk_path, options);
		if (!maybe_bytes) {
			throw new KeyError(chunk_path);
		}
		return this.codec.decode(maybe_bytes);
	}

	get shape() {
		return this.#metadata.shape;
	}

	/**	The chunk shape of the array. */
	get chunk_shape() {
		return this.#metadata.chunk_grid.configuration.chunk_shape;
	}

	get dtype() {
		return this.#metadata.data_type;
	}

	get fill_value() {
		return this.#metadata.fill_value;
	}

	/**
	 * Access the metadata for this array.
	 *
	 * For v2, this loads and caches the JSON from `.zattrs`.
	 * For v3, this returns the (already loaded) metadata from the `zarr.json` file.
	 *
	 * @returns {Promise<import("./types.js").Attributes>}
	 */
	async attrs() {
		if (
			this.#attributes === undefined &&
			v2_marker in this.#metadata.attributes
		) {
			let attrs = await this.store.get(this.resolve(".zattrs").path);
			this.#attributes = (attrs && json_decode_object(attrs)) || {};
		} else {
			this.#attributes = this.#metadata.attributes;
		}
		return this.#attributes ?? {};
	}

	/**
	 * A helper method to narrow `zarr.Array` Dtype.
	 *
	 * @template {import("./types.js").DataTypeQuery} Query
	 * @param {Query} query
	 * @returns {this is Array<import("./types.js").NarrowDataType<Dtype, Query>, Store>}
	 *
	 * @example
	 * ```typescript
	 * let arr: zarr.Array<DataType, FetchStore> = zarr.open(store, { kind: "array" });
	 *
	 * // Option 1: narrow by scalar type (e.g. "bool", "raw", "bigint", "number")
	 * if (arr.is("bigint")) {
	 *   // zarr.Array<"int64" | "uint64", FetchStore>
	 * }
	 *
	 * // Option 3: exact match
	 * if (arr.is("float32")) {
	 *   // zarr.Array<"float32", FetchStore, "/">
	 * }
	 * ```
	 */
	is(query) {
		return is_dtype(this.dtype, query);
	}
}
