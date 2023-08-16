import { json_encode_object } from "./util.js";
import { Array, Group, Location } from "./hierarchy.js";

/** @typedef {import("./metadata.js").DataType} DataType */
/** @typedef {import("@zarrita/storage").Readable} Readable */
/** @typedef {import("@zarrita/storage").Writeable} Writeable */
/**
 * @template {Record<string, any>} T
 * @typedef {import("@zarrita/storage").Async<T>} Async
 */

/** @typedef {{ attributes?: Record<string, any> }} CreateGroupOptions */
/**
 * @template {DataType} Dtype
 * @typedef {{
 *   shape: number[];
 *   chunk_shape: number[];
 *   data_type: Dtype;
 *   codecs?: import("./metadata.js").CodecMetadata[];
 *   fill_value?: import("./metadata.js").Scalar<Dtype>;
 *   chunk_separator?: "." | "/";
 *   attributes?: Record<string, any>;
 * }} CreateArrayOptions
 */

/**
 * @template {(Readable & Writeable) | Async<Readable & Writeable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @returns {Promise<Group<Store>>}
 */
/**
 * Create a group.
 *
 * @template {(Readable & Writeable) | Async<Readable & Writeable>} Store
 *
 * @overload
 * @param {Location<Store> | Store} location
 * @param {CreateGroupOptions} options
 * @returns {Promise<Group<Store>>}
 */
/**
 * Create an array.
 *
 * @template {(Readable & Writeable) | Async<Readable & Writeable>} Store
 * @template {DataType} Dtype
 *
 * @overload
 * @param {Location<Store> | Store} location
 * @param {CreateArrayOptions<Dtype>} options
 * @returns {Promise<Array<Dtype, Store>>}
 */
/**
 * Create a new array or group.
 *
 * @template {(Readable & Writeable) | Async<Readable & Writeable>} Store
 * @template {DataType} Dtype
 *
 * @param {Location<Store> | Store} location
 * @param {CreateArrayOptions<Dtype> | CreateGroupOptions} options
 *
 * @returns {Promise<Array<Dtype, Store> | Group<Store>>}
 */
export async function create(location, options = {}) {
	let loc = "store" in location ? location : new Location(location);
	if ("shape" in options) return create_array(loc, options);
	return create_group(loc, options);
}

/**
 * @template {(Readable & Writeable) | Async<Readable & Writeable>} Store
 * @param {Location<Store>} location
 * @param {CreateGroupOptions} options
 */
async function create_group(location, options) {
	/** @satisfies {import("./metadata.js").GroupMetadata} */
	let metadata = {
		zarr_format: 3,
		node_type: "group",
		attributes: options.attributes ?? {},
	};
	await location.store.set(
		location.resolve("zarr.json").path,
		json_encode_object(metadata),
	);
	return new Group(location.store, location.path, metadata);
}

/**
 * @template {(Readable & Writeable) | Async<Readable & Writeable>} Store
 * @template {DataType} Dtype
 * @param {Location<Store>} location
 * @param {CreateArrayOptions<Dtype>} options
 * @returns {Promise<Array<Dtype, Store>>}
 */
async function create_array(location, options) {
	/** @satisfies {import("./metadata.js").ArrayMetadata<Dtype>} */
	let metadata = {
		zarr_format: 3,
		node_type: "array",
		shape: options.shape,
		data_type: options.data_type,
		chunk_grid: {
			name: "regular",
			configuration: {
				chunk_shape: options.chunk_shape,
			},
		},
		chunk_key_encoding: {
			name: "default",
			configuration: {
				separator: options.chunk_separator ?? "/",
			},
		},
		codecs: options.codecs ?? [],
		fill_value: options.fill_value ?? null,
		attributes: options.attributes ?? {},
	};
	await location.store.set(
		location.resolve("zarr.json").path,
		json_encode_object(metadata),
	);
	return new Array(location.store, location.path, metadata);
}
