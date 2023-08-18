import type { AbsolutePath, Async, Readable } from "@zarrita/storage";

import { Array, Group } from "./hierarchy.js";
import { v2_to_v3_array_metadata, v2_to_v3_group_metadata } from "./util.js";
import type { ArrayMetadataV2, GroupMetadataV2 } from "./metadata.js";

type ConsolidatedMetadata = {
	metadata: Record<string, any>;
	zarr_consolidated_format: 1;
};

/** Proxies requests to the underlying store. */
export async function openConsolidated<Store extends Async<Readable>>(
	store: Store,
) {
	let meta_bytes = await store.get("/.zmetadata");
	if (!meta_bytes) throw new Error("No consolidated metadata found.");
	let { metadata }: ConsolidatedMetadata = JSON.parse(
		new TextDecoder().decode(meta_bytes),
	);
	let nodes = Object
		.entries(metadata)
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
				{ meta?: ArrayMetadataV2 | GroupMetadataV2; attrs?: any }
			>,
		);
	return Object.entries(nodes)
		.map(([path, { meta, attrs }]) => {
			if (!meta) throw new Error("No metadata found.");
			if ("shape" in meta) {
				let metadata = v2_to_v3_array_metadata(meta, attrs);
				return new Array(store, path as AbsolutePath, metadata);
			}
			let metadata = v2_to_v3_group_metadata(meta, attrs);
			return new Group(store, path as AbsolutePath, metadata);
		});
}
