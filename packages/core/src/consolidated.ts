import type { AbsolutePath, Async, Readable } from "@zarrita/storage";

import { Array, Group, Location } from "./hierarchy.js";
import {
	json_decode_object,
	v2_to_v3_array_metadata,
	v2_to_v3_group_metadata,
} from "./util.js";
import type { ArrayMetadataV2, DataType, GroupMetadataV2 } from "./metadata.js";
import { NodeNotFoundError } from "./errors.js";

type ConsolidatedMetadata = {
	metadata: Record<string, any>;
	zarr_consolidated_format: 1;
};

async function get_consolidated_metadata(
	store: Async<Readable>,
): Promise<ConsolidatedMetadata> {
	let bytes = await store.get("/.zmetadata");
	if (!bytes) throw new Error("No consolidated metadata found.");
	let meta: ConsolidatedMetadata = json_decode_object(bytes);
	if (meta.zarr_consolidated_format !== 1) {
		throw new Error("Unsupported consolidated format.");
	}
	return meta;
}

/** Proxies requests to the underlying store. */
export async function openConsolidated<Store extends Async<Readable>>(
	store: Store,
) {
	let { metadata } = await get_consolidated_metadata(store);
	let meta_nodes = Object
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
				{
					meta?: ArrayMetadataV2 | GroupMetadataV2;
					attrs?: Record<string, any>;
				}
			>,
		);
	let nodes = new Map<AbsolutePath, Array<DataType, Store> | Group<Store>>();
	for (let [path, { meta, attrs }] of Object.entries(meta_nodes)) {
		if (!meta) throw new Error("missing metadata");
		let node: Array<DataType, Store> | Group<Store>;
		if ("shape" in meta) {
			let metadata = v2_to_v3_array_metadata(meta, attrs);
			node = new Array(store, path as AbsolutePath, metadata);
		} else {
			let metadata = v2_to_v3_group_metadata(meta, attrs);
			node = new Group(store, path as AbsolutePath, metadata);
		}
		nodes.set(path as AbsolutePath, node);
	}
	return new ConsolidatedHierarchy(nodes);
}

class ConsolidatedHierarchy<Store extends Readable | Async<Readable>> {
	constructor(
		public contents: Map<AbsolutePath, Array<DataType, Store> | Group<Store>>,
	) {}
	open(
		where: AbsolutePath | Location<unknown>,
		options: { kind: "group" },
	): Group<Store>;
	open(
		where: AbsolutePath | Location<unknown>,
		options: { kind: "array" },
	): Array<DataType, Store>;
	open(
		where: AbsolutePath | Location<unknown>,
	): Array<DataType, Store> | Group<Store>;
	open(
		where: AbsolutePath | Location<unknown>,
		options: { kind?: "array" | "group" } = {},
	) {
		let path = typeof where === "string" ? where : where.path;
		let node = this.contents.get(path);
		if (node && (!options.kind || options.kind == node.kind)) return node;
		throw new NodeNotFoundError(path);
	}
	root() {
		return this.open("/", { kind: "group" });
	}
}
