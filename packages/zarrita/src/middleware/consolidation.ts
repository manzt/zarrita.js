import type { AbsolutePath, Readable } from "@zarrita/storage";
import { InvalidMetadataError, NotFoundError } from "../errors.js";
import type {
	ArrayMetadata,
	ArrayMetadataV2,
	Attributes,
	DataType,
	GroupMetadata,
	GroupMetadataV2,
} from "../metadata.js";
import { VERSION_COUNTER } from "../open.js";
import {
	ensureCorrectScalar,
	jsonDecodeObject,
	jsonEncodeObject,
	rethrowUnless,
} from "../util.js";
import { wrapStore } from "./define.js";

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

/** The format of consolidated metadata to use. */
export type ConsolidatedFormat = "v2" | "v3";

/** Options for {@linkcode withConsolidation} and {@linkcode withMaybeConsolidation}. */
export interface ConsolidationOptions {
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
		throw new NotFoundError("v2 consolidated metadata", {
			path: `/${key}`,
		});
	}
	let meta: unknown = jsonDecodeObject(bytes);
	if (!isConsolidatedV2(meta)) {
		throw new InvalidMetadataError(
			"Invalid or unsupported v2 consolidated format",
			{ path: `/${key}` },
		);
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
		throw new NotFoundError("v3 consolidated metadata", {
			path: "/zarr.json",
		});
	}
	let rootMeta: unknown = jsonDecodeObject(bytes);
	if (!isConsolidatedV3(rootMeta)) {
		throw new InvalidMetadataError(
			"Root zarr.json does not contain consolidated_metadata",
			{ path: "/zarr.json" },
		);
	}
	let knownMeta: Record<AbsolutePath, Metadata> = {};
	knownMeta["/zarr.json"] = {
		zarr_format: 3,
		node_type: "group",
		attributes: rootMeta.attributes ?? {},
	} satisfies GroupMetadata;
	for (let [path, meta] of Object.entries(
		rootMeta.consolidated_metadata.metadata,
	)) {
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
	let versionMax = VERSION_COUNTER.versionMax(store);
	return versionMax === "v3" ? ["v3", "v2"] : ["v2", "v3"];
}

/** A store augmented with a `contents()` method from consolidated metadata. */
export type Listable<Store extends Readable> = Store & {
	contents(): { path: AbsolutePath; kind: "array" | "group" }[];
};

/**
 * Wraps a store with consolidated metadata, enabling efficient listing and
 * metadata access without extra network requests.
 *
 * Supports Zarr v2 (`.zmetadata`) and v3 (`zarr.json` with
 * `consolidated_metadata`). Throws if no consolidated metadata is found.
 *
 * @example
 * ```ts
 * // Direct
 * let store = await zarr.withConsolidation(new zarr.FetchStore("https://..."));
 *
 * // With options
 * let store = await zarr.withConsolidation(rawStore, { format: "v3" });
 *
 * // In a pipeline
 * let store = await zarr.createStore(
 *   new zarr.FetchStore("https://..."),
 *   zarr.withConsolidation({ format: "v3" }),
 * );
 *
 * store.contents(); // [{ path: "/", kind: "group" }, ...]
 * ```
 */
export const withConsolidation = wrapStore(
	async (store: Readable, opts: ConsolidationOptions = {}) => {
		let formats = resolveFormats(store, opts.format);
		let lastError: unknown;
		for (let format of formats) {
			try {
				let knownMeta =
					format === "v2"
						? await loadConsolidatedV2(store, opts.metadataKey)
						: await loadConsolidatedV3(store);
				return {
					async get(
						key: AbsolutePath,
						options?: unknown,
					): Promise<Uint8Array | undefined> {
						if (knownMeta[key]) {
							return jsonEncodeObject(knownMeta[key]);
						}
						let maybeBytes = await store.get(key, options);
						if (isMetaKey(key) && maybeBytes) {
							knownMeta[key] = jsonDecodeObject(maybeBytes);
						}
						return maybeBytes;
					},
					contents(): { path: AbsolutePath; kind: "array" | "group" }[] {
						let contents: {
							path: AbsolutePath;
							kind: "array" | "group";
						}[] = [];
						for (let [key, value] of Object.entries(knownMeta)) {
							let parts = key.split("/");
							let filename = parts.pop();
							let path = (parts.join("/") || "/") as AbsolutePath;
							if (filename === ".zarray")
								contents.push({ path, kind: "array" });
							if (filename === ".zgroup")
								contents.push({ path, kind: "group" });
							if (isV3(value)) {
								contents.push({ path, kind: value.node_type });
							}
						}
						return contents;
					},
				};
			} catch (err) {
				rethrowUnless(err, NotFoundError, InvalidMetadataError);
				lastError = err;
			}
		}
		throw lastError;
	},
);

/**
 * Like {@linkcode withConsolidation}, but falls back to the original store if
 * no consolidated metadata is found (instead of throwing).
 */
export async function withMaybeConsolidation<Store extends Readable>(
	store: Store,
	opts: ConsolidationOptions = {},
): Promise<Listable<Store> | Store> {
	return (withConsolidation(store, opts) as Promise<Listable<Store>>).catch(
		(error: unknown) => {
			rethrowUnless(error, NotFoundError, InvalidMetadataError);
			return store;
		},
	);
}
