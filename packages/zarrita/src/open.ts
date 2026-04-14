/**
 * Open Zarr arrays and groups from a {@link Readable} store.
 *
 * The main entry point is {@linkcode open}, which auto-detects whether the
 * target node is a Zarr v2 or v3 array/group. Use {@linkcode open.v2} or
 * {@linkcode open.v3} to pin a specific format.
 *
 * ```ts
 * import * as zarr from "zarrita";
 *
 * const store = new zarr.FetchStore("https://example.com/data.zarr");
 *
 * // Auto-detect version and node kind.
 * const node = await zarr.open(store);
 *
 * // Or narrow to an array (throws NotFoundError if it's a group).
 * const arr = await zarr.open(store, { kind: "array" });
 * ```
 *
 * @module
 */

import type { Readable } from "@zarrita/storage";
import { InvalidMetadataError, NotFoundError } from "./errors.js";
import type { ArrayExtension } from "./extension/define-array.js";
import { extendArray } from "./extension/extend-array.js";
import { Array, Group, Location } from "./hierarchy.js";
import type {
	ArrayMetadata,
	Attributes,
	DataType,
	GroupMetadata,
} from "./metadata.js";
import {
	ensureCorrectScalar,
	jsonDecodeObject,
	rethrowUnless,
	v2ToV3ArrayMetadata,
	v2ToV3GroupMetadata,
} from "./util.js";

/**
 * If the backing store carries `arrayExtensions` (typically contributed by
 * a virtual-format adapter built on `defineStoreExtension`), wrap the array
 * with them before handing it back. Inner-first, outer-last: the outermost
 * store extension's array extension becomes the outermost array wrapper.
 */
async function maybeExtend<D extends DataType, S extends Readable>(
	array: Array<D, S>,
): Promise<Array<D, S>> {
	let exts = (
		array.store as Readable & {
			arrayExtensions?: ReadonlyArray<ArrayExtension>;
		}
	).arrayExtensions;
	if (!exts?.length) return array;
	// Fixed-arity overloads of `extendArray` don't model variadic spreads,
	// so thread the rest-parameter implementation directly.
	let variadic = extendArray as (
		array: Array<D, S>,
		...extensions: ArrayExtension[]
	) => Array<D, S> | Promise<Array<D, S>>;
	return await variadic(array, ...exts);
}

export let VERSION_COUNTER = createVersionCounter();
function createVersionCounter() {
	let versionCounts = new WeakMap<Readable, { v2: number; v3: number }>();
	function getCounts(store: Readable) {
		let counts = versionCounts.get(store) ?? { v2: 0, v3: 0 };
		versionCounts.set(store, counts);
		return counts;
	}
	return {
		increment(store: Readable, version: "v2" | "v3") {
			getCounts(store)[version] += 1;
		},
		versionMax(store: Readable): "v2" | "v3" {
			let counts = getCounts(store);
			return counts.v3 > counts.v2 ? "v3" : "v2";
		},
	};
}

async function loadAttrs(
	location: Location<Readable>,
	signal?: AbortSignal,
): Promise<Attributes> {
	let metaBytes = await location.store.get(location.resolve(".zattrs").path, {
		signal,
	});
	if (!metaBytes) return {};
	return jsonDecodeObject(metaBytes);
}

type OpenV2Options = {
	kind?: "array" | "group";
	attrs?: boolean;
	signal?: AbortSignal;
};

function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenV2Options & { kind: "group" },
): Promise<Group<Store>>;

function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenV2Options & { kind: "array" },
): Promise<Array<DataType, Store>>;

function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options?: OpenV2Options,
): Promise<Array<DataType, Store> | Group<Store>>;

async function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenV2Options = {},
) {
	let loc = "store" in location ? location : new Location(location);
	let { signal } = options;
	let attrs = {};
	if (options.attrs ?? true) attrs = await loadAttrs(loc, signal);
	signal?.throwIfAborted();
	if (options.kind === "array") return openArrayV2(loc, attrs, signal);
	if (options.kind === "group") return openGroupV2(loc, attrs, signal);
	return openArrayV2(loc, attrs, signal).catch((err) => {
		rethrowUnless(err, NotFoundError, InvalidMetadataError);
		return openGroupV2(loc, attrs, signal);
	});
}

async function openArrayV2<Store extends Readable>(
	location: Location<Store>,
	attrs: Attributes,
	signal?: AbortSignal,
) {
	let { path } = location.resolve(".zarray");
	let meta = await location.store.get(path, { signal });
	if (!meta) {
		throw new NotFoundError("v2 array", { path });
	}
	VERSION_COUNTER.increment(location.store, "v2");
	return maybeExtend(
		new Array(
			location.store,
			location.path,
			v2ToV3ArrayMetadata(jsonDecodeObject(meta), attrs),
		),
	);
}

async function openGroupV2<Store extends Readable>(
	location: Location<Store>,
	attrs: Attributes,
	signal?: AbortSignal,
) {
	let { path } = location.resolve(".zgroup");
	let meta = await location.store.get(path, { signal });
	if (!meta) {
		throw new NotFoundError("v2 group", { path });
	}
	VERSION_COUNTER.increment(location.store, "v2");
	return new Group(
		location.store,
		location.path,
		v2ToV3GroupMetadata(jsonDecodeObject(meta), attrs),
	);
}

async function _openV3<Store extends Readable>(
	location: Location<Store>,
	signal?: AbortSignal,
) {
	let { store, path } = location.resolve("zarr.json");
	let meta = await location.store.get(path, { signal });
	if (!meta) {
		throw new NotFoundError("v3 array or group", { path });
	}
	let metaDoc: ArrayMetadata<DataType> | GroupMetadata = jsonDecodeObject(meta);
	if (metaDoc.node_type === "array") {
		metaDoc.fill_value = ensureCorrectScalar(metaDoc);
	}
	return metaDoc.node_type === "array"
		? maybeExtend(new Array(store, location.path, metaDoc))
		: new Group(store, location.path, metaDoc);
}

type OpenV3Options = {
	kind?: "array" | "group";
	signal?: AbortSignal;
};

function openV3<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenV3Options & { kind: "group" },
): Promise<Group<Store>>;

function openV3<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenV3Options & { kind: "array" },
): Promise<Array<DataType, Store>>;

function openV3<Store extends Readable>(
	location: Location<Store> | Store,
	options?: OpenV3Options,
): Promise<Array<DataType, Store> | Group<Store>>;

async function openV3<Store extends Readable>(
	location: Location<Store>,
	options: OpenV3Options = {},
): Promise<Array<DataType, Store> | Group<Store>> {
	let loc = "store" in location ? location : new Location(location);
	let node = await _openV3(loc, options.signal);
	VERSION_COUNTER.increment(loc.store, "v3");
	if (options.kind === undefined) return node;
	if (options.kind === "array" && node instanceof Array) return node;
	if (options.kind === "group" && node instanceof Group) return node;
	let kind: "array" | "group" = node instanceof Array ? "array" : "group";
	throw new NotFoundError(`${options.kind} at ${loc.path}`, {
		path: loc.path,
		found: kind,
	});
}

type OpenOptions = {
	kind?: "array" | "group";
	attrs?: boolean;
	signal?: AbortSignal;
};

/**
 * Open a Zarr array or group, auto-detecting the on-disk format version.
 *
 * Tries Zarr v3 and v2 in the order most likely to succeed for the given
 * store (based on previous opens), falling back to the other version on
 * {@linkcode NotFoundError} or {@linkcode InvalidMetadataError}. Pass `kind`
 * to require a specific node type, or use {@linkcode open.v2} /
 * {@linkcode open.v3} to pin the format.
 *
 * @example Usage
 * ```ts
 * import * as zarr from "zarrita";
 *
 * const store = new zarr.FetchStore("https://example.com/data.zarr");
 * const arr = await zarr.open(store, { kind: "array" });
 * console.log(arr.shape, arr.dtype);
 * ```
 *
 * @example Child node of a group
 * ```ts
 * import * as zarr from "zarrita";
 *
 * const store = new zarr.FetchStore("https://example.com/data.zarr");
 * const group = await zarr.open(store, { kind: "group" });
 * const child = await zarr.open(group.resolve("temperature"), { kind: "array" });
 * ```
 *
 * @param location A {@linkcode Readable} store, or a {@linkcode Location}
 *   pointing at a node within a store.
 * @param options Open options. Set `kind` to `"array"` or `"group"` to
 *   require that node type, or pass an `AbortSignal` to cancel the request.
 * @returns The opened {@linkcode Array} or {@linkcode Group}.
 * @throws {NotFoundError} If no array or group exists at the location, or if
 *   the node kind does not match `options.kind`.
 * @throws {InvalidMetadataError} If metadata is present but malformed.
 * @category Read
 */
export function open<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenOptions & { kind: "group" },
): Promise<Group<Store>>;
/**
 * Open a Zarr array or group, auto-detecting the on-disk format version.
 * @category Read
 */
export function open<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenOptions & { kind: "array" },
): Promise<Array<DataType, Store>>;
/**
 * Open a Zarr array or group, auto-detecting the on-disk format version.
 * @category Read
 */
export function open<Store extends Readable>(
	location: Location<Store> | Store,
	options?: OpenOptions,
): Promise<Array<DataType, Store> | Group<Store>>;

export async function open<Store extends Readable>(
	location: Location<Store> | Store,
	options: OpenOptions = {},
): Promise<Array<DataType, Store> | Group<Store>> {
	let store = "store" in location ? location.store : location;
	let versionMax = VERSION_COUNTER.versionMax(store);
	// Use the open function for the version with the most successful opens.
	// Note that here we use the dot syntax to access the open functions
	// because this enables us to use vi.spyOn during testing.
	let openPrimary = versionMax === "v2" ? open.v2 : open.v3;
	let openSecondary = versionMax === "v2" ? open.v3 : open.v2;
	return openPrimary(location, options).catch((err) => {
		rethrowUnless(err, NotFoundError, InvalidMetadataError);
		return openSecondary(location, options);
	});
}

/**
 * Open a Zarr v2 array or group, ignoring any v3 metadata that may coexist.
 *
 * @example Usage
 * ```ts
 * import * as zarr from "zarrita";
 *
 * const store = new zarr.FetchStore("https://example.com/legacy.zarr");
 * const arr = await zarr.open.v2(store, { kind: "array" });
 * ```
 *
 * @category Read
 */
open.v2 = openV2;

/**
 * Open a Zarr v3 array or group, ignoring any v2 metadata that may coexist.
 *
 * @example Usage
 * ```ts
 * import * as zarr from "zarrita";
 *
 * const store = new zarr.FetchStore("https://example.com/data.zarr");
 * const group = await zarr.open.v3(store, { kind: "group" });
 * ```
 *
 * @category Read
 */
open.v3 = openV3;
