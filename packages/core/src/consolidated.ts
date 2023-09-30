import { FetchStore, type AbsolutePath, type Readable } from "@zarrita/storage";

import { Array, Group } from "./hierarchy.js";
import {
	json_decode_object,
	json_encode_object,
	v2_to_v3_array_metadata,
	v2_to_v3_group_metadata,
} from "./util.js";
import type {
	ArrayMetadata,
	ArrayMetadataV2,
	GroupMetadata,
	GroupMetadataV2,
	Attributes,
} from "./metadata.js";

type ConsolidatedMetadata = {
	metadata: Record<string, ArrayMetadataV2 | GroupMetadataV2>;
	zarr_consolidated_format: 1;
};

type Listable<Store extends Readable> = {
	get(...args: Parameters<Store["get"]>): Promise<Uint8Array | undefined>;
	contents(): { path: AbsolutePath; kind: "array" | "group" }[];
};

async function get_consolidated_metadata(
	store: Readable,
): Promise<ConsolidatedMetadata> {
	let bytes = await store.get("/.zmetadata");
	if (!bytes) throw new Error("No consolidated metadata found.");
	let meta: ConsolidatedMetadata = json_decode_object(bytes);
	if (meta.zarr_consolidated_format !== 1) {
		throw new Error("Unsupported consolidated format.");
	}
	return meta;
}

type Metadata =
	| ArrayMetadataV2
	| GroupMetadataV2
	| ArrayMetadata
	| GroupMetadata
	| Attributes;

function is_meta_key(key: string): boolean {
	return (
		key.endsWith(".zarray") ||
		key.endsWith(".zgroup") ||
		key.endsWith(".zattrs") ||
		key.endsWith("zarr.json")
	);
}

function is_v3(meta: Metadata): meta is ArrayMetadata | GroupMetadata {
	return "zarr_format" in meta && meta.zarr_format === 3;
}

async function withConsolidated<Store extends Readable>(
	store: Store,
): Promise<Listable<Store>> {
	let known_meta: Record<AbsolutePath, Metadata> =
		await get_consolidated_metadata(store)
			.then((meta) => {
				let new_meta: Record<AbsolutePath, Metadata> = {};
				for (let [key, value] of Object.entries(meta.metadata)) {
					new_meta[`/${key}`] = value;
				}
				return new_meta;
			})
			.catch(() => ({}));

	return {
		async get(...args: Parameters<Store["get"]>): Promise<Uint8Array | undefined> {
			let [key, opts] = args;
			if (known_meta[key]) {
				return json_encode_object(known_meta[key]);
			}
			let maybe_bytes = await store.get(key, opts);
			if (is_meta_key(key) && maybe_bytes) {
				let meta = json_decode_object(maybe_bytes);
				known_meta[key] = meta;
			}
			return maybe_bytes;
		},
		contents(): { path: AbsolutePath; kind: "array" | "group" }[] {
			let contents: { path: AbsolutePath, kind: "array" | "group" }[] = [];
			for (let [key, value] of Object.entries(known_meta)) {
				let path = key as AbsolutePath;
				if (key.endsWith(".zarray")) contents.push({ path, kind: "array" });
				if (key.endsWith(".zgroup")) contents.push({ path, kind: "group" });
				if (is_v3(value)) contents.push({ path, kind: value.node_type });
			}
			return contents;
		}
	};
}

async function openListable<Store extends Readable>(store: Listable<Store>) {
	let metadata = await Promise.all(
		store.contents().map(({ path }) => [path, store.get(path)] as const)
	);

	metadata
		.reduce(
			(acc, [path, content]) => {
				let parts = path.split("/");
				let file_name = parts.pop()!;
				let key: AbsolutePath = `/${parts.join("/")}`;
				if (!acc[key]) acc[key] = {};
				if (file_name === ".zarray") {
					acc[key].meta = content;
				} else if (file_name === ".zgroup") {
					acc[key].meta = content;
				} else if (file_name === ".zattrs") {
					acc[key].attrs = content;
				}
				return acc;
			},
			{} as Record<
				AbsolutePath,
				{
					meta?: ArrayMetadataV2 | GroupMetadataV2;
					attrs?: Record<string, any>;
				}
			>,
		);


}
