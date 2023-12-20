import { type AbsolutePath, type Readable } from "@zarrita/storage";
import { json_decode_object, json_encode_object } from "./util.js";
import type {
	ArrayMetadata,
	ArrayMetadataV2,
	Attributes,
	GroupMetadata,
	GroupMetadataV2,
} from "./metadata.js";

type ConsolidatedMetadata = {
	metadata: Record<string, ArrayMetadataV2 | GroupMetadataV2>;
	zarr_consolidated_format: 1;
};

type Listable<Store extends Readable> = {
	get: Store["get"];
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

export async function withConsolidated<Store extends Readable>(
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
		async get(
			...args: Parameters<Store["get"]>
		): Promise<Uint8Array | undefined> {
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
			let contents: { path: AbsolutePath; kind: "array" | "group" }[] = [];
			for (let [key, value] of Object.entries(known_meta)) {
				let parts = key.split("/");
				let filename = parts.pop()!;
				let path = (parts.join("/") || "/") as AbsolutePath;
				if (filename === ".zarray") contents.push({ path, kind: "array" });
				if (filename === ".zgroup") contents.push({ path, kind: "group" });
				if (is_v3(value)) {
					contents.push({ path, kind: value.node_type });
				}
			}
			return contents;
		},
	};
}
