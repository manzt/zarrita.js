import type { GetOptions, Readable } from "@zarrita/storage";
import { InvalidMetadataError, NotFoundError } from "./errors.js";
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
	opts?: GetOptions,
): Promise<Attributes> {
	let metaBytes = await location.store.get(
		location.resolve(".zattrs").path,
		opts,
	);
	if (!metaBytes) return {};
	return jsonDecodeObject(metaBytes);
}

function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options: { kind: "group"; attrs?: boolean; opts?: GetOptions },
): Promise<Group<Store>>;

function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options: { kind: "array"; attrs?: boolean; opts?: GetOptions },
): Promise<Array<DataType, Store>>;

function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options?: { kind?: "array" | "group"; attrs?: boolean; opts?: GetOptions },
): Promise<Array<DataType, Store> | Group<Store>>;

async function openV2<Store extends Readable>(
	location: Location<Store> | Store,
	options: {
		kind?: "array" | "group";
		attrs?: boolean;
		opts?: GetOptions;
	} = {},
) {
	let loc = "store" in location ? location : new Location(location);
	let { opts } = options;
	let attrs = {};
	if (options.attrs ?? true) attrs = await loadAttrs(loc, opts);
	opts?.signal?.throwIfAborted();
	if (options.kind === "array") return openArrayV2(loc, attrs, opts);
	if (options.kind === "group") return openGroupV2(loc, attrs, opts);
	return openArrayV2(loc, attrs, opts).catch((err) => {
		rethrowUnless(err, NotFoundError, InvalidMetadataError);
		return openGroupV2(loc, attrs, opts);
	});
}

async function openArrayV2<Store extends Readable>(
	location: Location<Store>,
	attrs: Attributes,
	opts?: GetOptions,
) {
	let { path } = location.resolve(".zarray");
	let meta = await location.store.get(path, opts);
	if (!meta) {
		throw new NotFoundError("v2 array", { path });
	}
	VERSION_COUNTER.increment(location.store, "v2");
	return new Array(
		location.store,
		location.path,
		v2ToV3ArrayMetadata(jsonDecodeObject(meta), attrs),
	);
}

async function openGroupV2<Store extends Readable>(
	location: Location<Store>,
	attrs: Attributes,
	opts?: GetOptions,
) {
	let { path } = location.resolve(".zgroup");
	let meta = await location.store.get(path, opts);
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
	opts?: GetOptions,
) {
	let { store, path } = location.resolve("zarr.json");
	let meta = await location.store.get(path, opts);
	if (!meta) {
		throw new NotFoundError("v3 array or group", { path });
	}
	let metaDoc: ArrayMetadata<DataType> | GroupMetadata = jsonDecodeObject(meta);
	if (metaDoc.node_type === "array") {
		metaDoc.fill_value = ensureCorrectScalar(metaDoc);
	}
	return metaDoc.node_type === "array"
		? new Array(store, location.path, metaDoc)
		: new Group(store, location.path, metaDoc);
}

function openV3<Store extends Readable>(
	location: Location<Store> | Store,
	options: { kind: "group"; opts?: GetOptions },
): Promise<Group<Store>>;

function openV3<Store extends Readable>(
	location: Location<Store> | Store,
	options: { kind: "array"; opts?: GetOptions },
): Promise<Array<DataType, Store>>;

function openV3<Store extends Readable>(
	location: Location<Store> | Store,
	options?: { opts?: GetOptions },
): Promise<Array<DataType, Store> | Group<Store>>;

function openV3<Store extends Readable>(
	location: Location<Store> | Store,
	options?: { opts?: GetOptions },
): Promise<Array<DataType, Store> | Group<Store>>;

async function openV3<Store extends Readable>(
	location: Location<Store>,
	options: { kind?: "array" | "group"; opts?: GetOptions } = {},
): Promise<Array<DataType, Store> | Group<Store>> {
	let loc = "store" in location ? location : new Location(location);
	let node = await _openV3(loc, options.opts);
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

export function open<Store extends Readable>(
	location: Location<Store> | Store,
	options: { kind: "group"; attrs?: boolean; opts?: GetOptions },
): Promise<Group<Store>>;

export function open<Store extends Readable>(
	location: Location<Store> | Store,
	options: { kind: "array"; attrs?: boolean; opts?: GetOptions },
): Promise<Array<DataType, Store>>;

export async function open<Store extends Readable>(
	location: Location<Store> | Store,
	options: { kind?: "array" | "group"; attrs?: boolean; opts?: GetOptions },
): Promise<Array<DataType, Store> | Group<Store>>;

export function open<Store extends Readable>(
	location: Location<Store> | Store,
): Promise<Array<DataType, Store> | Group<Store>>;

export function open<Store extends Readable>(
	location: Location<Store> | Store,
): Promise<Array<DataType, Store> | Group<Store>>;

export async function open<Store extends Readable>(
	location: Location<Store> | Store,
	options: {
		kind?: "array" | "group";
		attrs?: boolean;
		opts?: GetOptions;
	} = {},
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

open.v2 = openV2;
open.v3 = openV3;
