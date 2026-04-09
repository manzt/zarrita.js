import type { Mutable } from "@zarrita/storage";

import { Array, Group, Location } from "./hierarchy.js";
import type {
	ArrayMetadata,
	Attributes,
	CodecMetadata,
	DataType,
	GroupMetadata,
	Scalar,
} from "./metadata.js";
import { jsonEncodeObject } from "./util.js";

interface CreateGroupOptions {
	attributes?: Record<string, unknown>;
}

interface CreateArrayOptions<Dtype extends DataType> {
	shape: number[];
	chunkShape: number[];
	dtype: Dtype;
	codecs?: CodecMetadata[];
	fillValue?: Scalar<Dtype>;
	chunkSeparator?: "." | "/";
	dimensionNames?: string[];
	attributes?: Attributes;
}

export async function create<
	Store extends Mutable,
	_Dtype extends DataType = DataType,
>(location: Location<Store> | Store): Promise<Group<Store>>;

export async function create<
	Store extends Mutable,
	_Dtype extends DataType = DataType,
>(
	location: Location<Store> | Store,
	options: CreateGroupOptions,
): Promise<Group<Store>>;

export async function create<Store extends Mutable, Dtype extends DataType>(
	location: Location<Store> | Store,
	options: CreateArrayOptions<Dtype>,
): Promise<Array<Dtype, Store>>;

export async function create<Store extends Mutable, Dtype extends DataType>(
	location: Location<Store> | Store,
	options: CreateArrayOptions<Dtype> | CreateGroupOptions = {},
): Promise<Array<Dtype, Store> | Group<Store>> {
	let loc = "store" in location ? location : new Location(location);
	if ("shape" in options) {
		let arr = await createArray(loc, options);
		return arr as Array<Dtype, Store>;
	}
	return createGroup(loc, options);
}

async function createGroup<Store extends Mutable>(
	location: Location<Store>,
	options: CreateGroupOptions = {},
): Promise<Group<Store>> {
	let metadata = {
		zarr_format: 3,
		node_type: "group",
		attributes: options.attributes ?? {},
	} satisfies GroupMetadata;
	await location.store.set(
		location.resolve("zarr.json").path,
		jsonEncodeObject(metadata),
	);
	return new Group(location.store, location.path, metadata);
}

async function createArray<Store extends Mutable, Dtype extends DataType>(
	location: Location<Store>,
	options: CreateArrayOptions<Dtype>,
): Promise<Array<DataType, Store>> {
	let metadata = {
		zarr_format: 3,
		node_type: "array",
		shape: options.shape,
		data_type: options.dtype,
		chunk_grid: {
			name: "regular",
			configuration: {
				chunk_shape: options.chunkShape,
			},
		},
		chunk_key_encoding: {
			name: "default",
			configuration: {
				separator: options.chunkSeparator ?? "/",
			},
		},
		codecs: options.codecs ?? [],
		fill_value: options.fillValue ?? null,
		dimension_names: options.dimensionNames,
		attributes: options.attributes ?? {},
	} satisfies ArrayMetadata<Dtype>;
	await location.store.set(
		location.resolve("zarr.json").path,
		jsonEncodeObject(metadata),
	);
	return new Array(location.store, location.path, metadata);
}
