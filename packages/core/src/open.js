import { Array, Group, Location } from "./hierarchy.js";
import { NodeNotFoundError } from "./errors.js";
import {
	json_decode_object,
	v2_to_v3_array_metadata,
	v2_to_v3_group_metadata,
} from "./util.js";

/** @typedef {import("./types.js").DataType} DataType */
/** @typedef {import("@zarrita/storage").Readable} Readable */
/**
 * @template {Record<string, any>} T
 * @typedef {import("@zarrita/storage").Async<T>} Async
 */

/**
 * Open a v2 array.
 *
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @param {{ kind: "array" }} options
 * @returns {Promise<Array<DataType, Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a v2 group.
 *
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @param {{ kind: "group" }} options
 * @returns {Promise<Group<Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a v2 array or group.
 *
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @returns {Promise<Array<DataType, Store> | Group<Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a v2 array or group.
 *
 * @template {Readable | Async<Readable>} Store
 * @param {Location<Store> | Store} location
 * @param {{ kind?: "array" | "group" }} [options]
 * @returns {Promise<Array<DataType, Store> | Group<Store>>}
 * @throws {NodeNotFoundError}
 */
async function open_v2(location, options = {}) {
	let loc = "store" in location ? location : new Location(location);
	if (options.kind === "array") return open_array_v2(loc);
	if (options.kind === "group") return open_group_v2(loc);
	return open_array_v2(loc).catch((err) => {
		if (err instanceof NodeNotFoundError) return open_group_v2(loc);
		throw err;
	});
}

/**
 * @template {Readable | Async<Readable>} Store
 * @param {Location<Store>} location
 * @returns {Promise<Array<DataType, Store>>}
 * @throws {NodeNotFoundError}
 */
async function open_array_v2(location) {
	let { path } = location.resolve(".zarray");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	return new Array(
		location.store,
		location.path,
		v2_to_v3_array_metadata(json_decode_object(meta)),
	);
}

/**
 * @template {Readable | Async<Readable>} Store
 * @param {Location<Store>} location
 * @returns {Promise<Group<Store>>}
 * @throws {NodeNotFoundError}
 */
async function open_group_v2(location) {
	let { path } = location.resolve(".zgroup");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	return new Group(
		location.store,
		location.path,
		v2_to_v3_group_metadata(json_decode_object(meta)),
	);
}

/**
 * @template {Readable | Async<Readable>} Store
 * @param {Location<Store>} location
 * @returns {Promise<Array<DataType, Store> | Group<Store>>}
 */
async function _open_v3(location) {
	let { store, path } = location.resolve("zarr.json");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	/** @type {import("./types.js").ArrayMetadata<DataType> | import("./types.js").GroupMetadata} */
	let meta_doc = json_decode_object(meta);
	return meta_doc.node_type === "array"
		? new Array(store, location.path, meta_doc)
		: new Group(store, location.path, meta_doc);
}

/**
 * Open a v3 group.
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @param {{ kind: "group" }} options
 * @returns {Promise<Group<Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a v3 array.
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @param {{ kind: "array" }} options
 * @returns {Promise<Array<DataType, Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a v3 array or group.
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @returns {Promise<Array<DataType, Store> | Group<Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a v3 array or group.
 * @template {Readable | Async<Readable>} Store
 * @param {Location<Store> | Store} location
 * @param {{ kind?: "array" | "group" }} [options]
 * @returns {Promise<Array<DataType, Store> | Group<Store>>}
 * @throws {NodeNotFoundError}
 */
async function open_v3(location, options = {}) {
	let loc = "store" in location ? location : new Location(location);
	let node = await _open_v3(loc);
	if (options.kind === undefined) return node;
	if (options.kind === "array" && node instanceof Array) return node;
	if (options.kind === "group" && node instanceof Group) return node;
	let kind = node instanceof Array ? "array" : "group";
	throw new Error(`Expected node of kind ${options.kind}, found ${kind}.`);
}

/**
 * Open a Zarr group.
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @param {{ kind: "group" }} options
 * @returns {Promise<Group<Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a Zarr array.
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @param {{ kind: "array" }} options
 * @returns {Promise<Array<DataType, Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a Zarr array or group.
 * @template {Readable | Async<Readable>} Store
 * @overload
 * @param {Location<Store> | Store} location
 * @returns {Promise<Array<DataType, Store> | Group<Store>>}
 * @throws {NodeNotFoundError}
 */
/**
 * Open a Zarr array or group.
 * @template {Readable | Async<Readable>} Store
 * @param {Location<Store> | Store} location
 * @param {{ kind?: "array" | "group" }} [options]
 * @returns {Promise<Array<DataType, Store> | Group<Store>>}
 * @throws {NodeNotFoundError}
 */
export async function open(location, options = {}) {
	return open_v3(location, /** @type {any} */ (options)).catch((err) => {
		if (err instanceof NodeNotFoundError) {
			return open_v2(location, /** @type {any} */ (options));
		}
		throw err;
	});
}

open.v2 = open_v2;
open.v3 = open_v3;
