import type { AbsolutePath, Readable } from "@zarrita/storage";
import { KeyError, NodeNotFoundError } from "./errors.js";
import type {
	ArrayMetadata,
	ArrayMetadataV2,
	Attributes,
	DataType,
	GroupMetadata,
	GroupMetadataV2,
} from "./metadata.js";
import { VERSION_COUNTER } from "./open.js";
import {
	ensureCorrectScalar,
	jsonDecodeObject,
	jsonEncodeObject,
	rethrowUnless,
} from "./util.js";

type ConsolidatedMetadataV2 = {
	metadata: Record<string, ArrayMetadataV2 | GroupMetadataV2>;
	zarr_consolidated_format: 1;
};

type ConsolidatedMetadataV3 = {
	kind: "inline";
	must_understand: false;
	metadata: Record<string, ArrayMetadata | GroupMetadata>;
};

function isConsolidatedV2(meta: unknown): meta is ConsolidatedMetadataV2 {
	return (
		typeof meta === "object" &&
		meta !== null &&
		"zarr_consolidated_format" in meta &&
		meta.zarr_consolidated_format === 1 &&
		"metadata" in meta &&
		typeof meta.metadata === "object" &&
		meta.metadata !== null
	);
}

function isConsolidatedV3(meta: unknown): meta is GroupMetadata & {
	consolidated_metadata: ConsolidatedMetadataV3;
} {
	return (
		typeof meta === "object" &&
		meta !== null &&
		"zarr_format" in meta &&
		meta.zarr_format === 3 &&
		"node_type" in meta &&
		meta.node_type === "group" &&
		"consolidated_metadata" in meta &&
		typeof meta.consolidated_metadata === "object" &&
		meta.consolidated_metadata !== null &&
		"metadata" in meta.consolidated_metadata &&
		typeof meta.consolidated_metadata.metadata === "object" &&
		meta.consolidated_metadata.metadata !== null
	);
}

/**
 * Represents a read-only store that can list its contents.
 */
export interface Listable<Store extends Readable> {
	/** Get the bytes at a given path. */
	get: (...args: Parameters<Store["get"]>) => Promise<Uint8Array | undefined>;
	/** Get a byte range at a given path. */
	getRange: Store["getRange"];
	/** List the contents of the store. */
	contents(): { path: AbsolutePath; kind: "array" | "group" }[];
}

/** The format of consolidated metadata to use. */
export type ConsolidatedFormat = "v2" | "v3";

/** Options for {@linkcode withConsolidated} and {@linkcode tryWithConsolidated}. */
export interface WithConsolidatedOptions {
	/**
	 * The format(s) of consolidated metadata to try.
	 *
	 * - `"v2"` — Zarr v2 consolidated metadata (`.zmetadata`).
	 * - `"v3"` — Zarr v3 consolidated metadata (`zarr.json`). This targets the
	 *   experimental consolidated metadata implemented in zarr-python, which is
	 *   not yet part of the official Zarr v3 specification.
	 * - An array of formats to try in order (e.g., `["v3", "v2"]`).
	 *
	 * When omitted, the format is auto-detected using the store's version history.
	 */
	readonly format?: ConsolidatedFormat | ConsolidatedFormat[];
	/**
	 * Key to read consolidated metadata from. Only applies to `"v2"` format.
	 *
	 * @default {".zmetadata"}
	 */
	readonly metadataKey?: string;
}

type Metadata =
	| ArrayMetadataV2
	| GroupMetadataV2
	| ArrayMetadata
	| GroupMetadata
	| Attributes;

function isMetaKey(key: string): boolean {
	return (
		key.endsWith(".zarray") ||
		key.endsWith(".zgroup") ||
		key.endsWith(".zattrs") ||
		key.endsWith("zarr.json")
	);
}

function isV3(meta: Metadata): meta is ArrayMetadata | GroupMetadata {
	return "zarr_format" in meta && meta.zarr_format === 3;
}

async function loadConsolidatedV2(
	store: Readable,
	metadataKey: string | undefined,
): Promise<Record<AbsolutePath, Metadata>> {
	let key = metadataKey ?? ".zmetadata";
	let bytes = await store.get(`/${key}`);
	if (!bytes) {
		throw new NodeNotFoundError("v2 consolidated metadata", {
			cause: new KeyError(`/${key}`),
		});
	}
	let meta: unknown = jsonDecodeObject(bytes);
	if (!isConsolidatedV2(meta)) {
		throw new NodeNotFoundError("v2 consolidated metadata", {
			cause: new Error("Invalid or unsupported v2 consolidated format."),
		});
	}
	let knownMeta: Record<AbsolutePath, Metadata> = {};
	for (let [k, value] of Object.entries(meta.metadata)) {
		knownMeta[`/${k}`] = value;
	}
	return knownMeta;
}

async function loadConsolidatedV3(
	store: Readable,
): Promise<Record<AbsolutePath, Metadata>> {
	let bytes = await store.get("/zarr.json");
	if (!bytes) {
		throw new NodeNotFoundError("v3 consolidated metadata", {
			cause: new KeyError("/zarr.json"),
		});
	}
	let rootMeta: unknown = jsonDecodeObject(bytes);
	if (!isConsolidatedV3(rootMeta)) {
		throw new NodeNotFoundError("v3 consolidated metadata", {
			cause: new Error(
				"Root zarr.json does not contain consolidated_metadata.",
			),
		});
	}
	let knownMeta: Record<AbsolutePath, Metadata> = {};
	// Add root group metadata
	knownMeta["/zarr.json"] = {
		zarr_format: 3,
		node_type: "group",
		attributes: rootMeta.attributes ?? {},
	} satisfies GroupMetadata;
	for (let [path, meta] of Object.entries(
		rootMeta.consolidated_metadata.metadata,
	)) {
		// Normalize path: ensure it starts with /
		let normalized = path.startsWith("/") ? path : `/${path}`;
		let key = `${normalized}/zarr.json` as AbsolutePath;
		if (meta.node_type === "array") {
			(meta as ArrayMetadata<DataType>).fill_value = ensureCorrectScalar(
				meta as ArrayMetadata<DataType>,
			);
		}
		knownMeta[key] = meta;
	}
	return knownMeta;
}

function resolveFormats(
	store: Readable,
	format: ConsolidatedFormat | ConsolidatedFormat[] | undefined,
): ConsolidatedFormat[] {
	if (format !== undefined) {
		return globalThis.Array.isArray(format) ? format : [format];
	}
	// Auto-detect: use version counter to decide priority
	let versionMax = VERSION_COUNTER.versionMax(store);
	return versionMax === "v3" ? ["v3", "v2"] : ["v2", "v3"];
}

function createListable<Store extends Readable>(
	store: Store,
	knownMeta: Record<AbsolutePath, Metadata>,
): Listable<Store> {
	return {
		async get(
			...args: Parameters<Store["get"]>
		): Promise<Uint8Array | undefined> {
			let [key, opts] = args;
			if (knownMeta[key]) {
				return jsonEncodeObject(knownMeta[key]);
			}
			let maybeBytes = await store.get(key, opts);
			if (isMetaKey(key) && maybeBytes) {
				let meta = jsonDecodeObject(maybeBytes);
				knownMeta[key] = meta;
			}
			return maybeBytes;
		},
		getRange: store.getRange?.bind(store),
		contents(): { path: AbsolutePath; kind: "array" | "group" }[] {
			let contents: { path: AbsolutePath; kind: "array" | "group" }[] = [];
			for (let [key, value] of Object.entries(knownMeta)) {
				let parts = key.split("/");
				let filename = parts.pop();
				let path = (parts.join("/") || "/") as AbsolutePath;
				if (filename === ".zarray") contents.push({ path, kind: "array" });
				if (filename === ".zgroup") contents.push({ path, kind: "group" });
				if (isV3(value)) {
					contents.push({ path, kind: value.node_type });
				}
			}
			return contents;
		},
	};
}

/**
 * Open a consolidated store.
 *
 * Supports both Zarr v2 consolidated metadata (`.zmetadata`) and
 * v3 consolidated metadata (`zarr.json` with `consolidated_metadata`).
 *
 * @param store The store to open.
 * @param opts Options object.
 * @returns A listable store.
 *
 * @example
 * ```js
 * // Auto-detect format (default)
 * let store = await withConsolidated(
 *   new zarr.FetchStore("https://my-bucket.s3.amazonaws.com")
 * );
 *
 * // Explicit v2
 * let store = await withConsolidated(rawStore, { format: "v2" });
 *
 * // Explicit v3
 * let store = await withConsolidated(rawStore, { format: "v3" });
 *
 * // Try v3 first, then v2
 * let store = await withConsolidated(rawStore, { format: ["v3", "v2"] });
 *
 * store.contents(); // [{ path: "/", kind: "group" }, { path: "/foo", kind: "array" }, ...]
 * ```
 */
export async function withConsolidated<Store extends Readable>(
	store: Store,
	opts: WithConsolidatedOptions = {},
): Promise<Listable<Store>> {
	let formats = resolveFormats(store, opts.format);
	let lastError: unknown;
	for (let format of formats) {
		try {
			let knownMeta =
				format === "v2"
					? await loadConsolidatedV2(store, opts.metadataKey)
					: await loadConsolidatedV3(store);
			return createListable(store, knownMeta);
		} catch (err) {
			rethrowUnless(err, NodeNotFoundError);
			lastError = err;
		}
	}
	throw lastError;
}

/**
 * Try to open a consolidated store, but fall back to the original store if the
 * consolidated metadata is missing.
 *
 * Provides a convenient way to open a store that may or may not have consolidated,
 * returning a consistent interface for both cases. Ideal for usage senarios with
 * known access paths, since store with consolidated metadata do not incur
 * additional network requests when accessing underlying groups and arrays.
 *
 * @param store The store to open.
 * @param opts Options to pass to withConsolidated.
 * @returns A listable store.
 */
export async function tryWithConsolidated<Store extends Readable>(
	store: Store,
	opts: WithConsolidatedOptions = {},
): Promise<Listable<Store> | Store> {
	return withConsolidated(store, opts).catch((error: unknown) => {
		rethrowUnless(error, NodeNotFoundError);
		return store;
	});
}
