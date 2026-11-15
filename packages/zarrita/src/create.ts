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
import { isDataType, jsonEncodeObject } from "./util.js";

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

// The v3 spec requires an array-to-bytes codec and a fill value that matches
// the data type, so other implementations can read what we write (#471).
function defaultCodecs(dtype: DataType): CodecMetadata[] {
	if (dtype === "string") {
		return [{ name: "vlen-utf8", configuration: {} }];
	}
	return [{ name: "bytes", configuration: { endian: "little" } }];
}

function defaultFillValue<D extends DataType>(dtype: D): Scalar<D> | null {
	if (isDataType(dtype, "bigint")) return 0n as Scalar<D>;
	if (isDataType(dtype, "number")) return 0 as Scalar<D>;
	if (isDataType(dtype, "boolean")) return false as Scalar<D>;
	if (isDataType(dtype, "string")) return "" as Scalar<D>;
	return null;
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
		codecs: options.codecs?.length
			? options.codecs
			: defaultCodecs(options.dtype),
		fill_value: options.fillValue ?? defaultFillValue(options.dtype),
		dimension_names: options.dimensionNames,
		attributes: options.attributes ?? {},
	} satisfies ArrayMetadata<Dtype>;
	await location.store.set(
		location.resolve("zarr.json").path,
		jsonEncodeObject(metadata),
	);
	return new Array(location.store, location.path, metadata);
}
