/** @category Number */
export type Int8 = "int8";
/** @category Number */
export type Int16 = "int16";
/** @category Number */
export type Int32 = "int32";
/** @category Bigint */
export type Int64 = "int64";

/** @category Number */
export type Uint8 = "uint8";
/** @category Number */
export type Uint16 = "uint16";
/** @category Number */
export type Uint32 = "uint32";
/** @category Bigint */
export type Uint64 = "uint64";

/** @category Number */
export type Float32 = "float32";
/** @category Number */
export type Float64 = "float64";

/** @category Boolean */
export type Bool = "bool";

/** @category Raw */
export type Raw = `r${number}`;

export type NumberDataType =
	| Int8
	| Int16
	| Int32
	| Uint8
	| Uint16
	| Uint32
	| Float32
	| Float64;

export type BigintDataType = Int64 | Uint64;

export type DataType =
	| NumberDataType
	| BigintDataType
	| Bool
	| Raw;

export type Attributes = Record<string, unknown>;

// Hack to get scalar type since is not defined on any typed arrays.
export type Scalar<D extends DataType> = D extends Bool ? boolean
	: D extends `${"u" | ""}int64` ? bigint
	: D extends Raw ? string
	: number;

export type CodecMetadata = {
	name: string;
	configuration: Record<string, unknown>;
};

/** Zarr v3 Array Metadata. Stored as JSON with key `zarr.json`. */
/** Zarr v3 Array Metadata. Stored as JSON with key `zarr.json`. */
export type ArrayMetadata<D extends DataType = DataType> = {
	zarr_format: 3;
	node_type: "array";
	shape: number[];
	dimension_names?: string[];
	data_type: D;
	chunk_grid: {
		name: "regular";
		configuration: {
			chunk_shape: number[];
		};
	};
	chunk_key_encoding: {
		name: "v2" | "default";
		configuration: {
			separator: "." | "/";
		};
	};
	codecs: CodecMetadata[];
	fill_value: Scalar<D> | null;
	attributes: Attributes;
};

/** Zarr v3 Group Metadata. Stored as JSON with key `zarr.json`. */
export type GroupMetadata = {
	zarr_format: 3;
	node_type: "group";
	attributes: Attributes;
};

/** Zarr v2 Array Metadata. Stored as JSON with key `.zarray`. */
export type ArrayMetadataV2 = {
	zarr_format: 2;
	shape: number[];
	chunks: number[];
	dtype: string;
	compressor: null | Record<string, any>;
	fill_value: any;
	order: "C" | "F";
	filters: null | Record<string, any>[];
	dimension_separator?: "." | "/";
};

/** Zarr v2 Group Metadata. Stored as JSON with key `.zgroup`. */
export type GroupMetadataV2 = {
	zarr_format: 2;
};

export function coerce_dtype(
	dtype: string,
): { data_type: DataType } | { data_type: DataType; endian: "little" | "big" } {
	let data_type = {
		"|b1": "bool",
		"|i1": "int8",
		"|u1": "uint8",
		"<i2": "int16",
		">i2": "int16",
		"<u2": "uint16",
		">u2": "uint16",
		"<i4": "int32",
		">i4": "int32",
		"<u4": "uint32",
		">u4": "uint32",
		"<i8": "int64",
		">i8": "int64",
		"<u8": "uint64",
		">u8": "uint64",
		"<f4": "float32",
		">f4": "float32",
		"<f8": "float64",
		">f8": "float64",
	}[dtype];
	if (!data_type) {
		throw new Error(`Unsupported or unknown dtype: ${dtype}`);
	}
	if (dtype[0] === "|") {
		return { data_type } as any;
	}
	return { data_type, endian: dtype[0] === "<" ? "little" : "big" } as any;
}

export const v2_marker = Symbol("v2");

export function v2_to_v3_array_metadata(
	meta: ArrayMetadataV2,
): ArrayMetadata<DataType> {
	let codecs: CodecMetadata[] = [];
	let d = coerce_dtype(meta.dtype);
	if ("endian" in d && d.endian === "big") {
		codecs.push({ name: "endian", configuration: { endian: "big" } });
	}
	for (let { id, ...configuration } of meta.filters ?? []) {
		codecs.push({ name: id, configuration });
	}
	if (meta.compressor) {
		let { id, ...configuration } = meta.compressor;
		codecs.push({ name: id, configuration });
	}
	return {
		zarr_format: 3,
		node_type: "array",
		shape: meta.shape,
		data_type: d.data_type,
		chunk_grid: {
			name: "regular",
			configuration: {
				chunk_shape: meta.chunks,
			},
		},
		chunk_key_encoding: {
			name: "v2",
			configuration: {
				separator: meta.dimension_separator ?? ".",
			},
		},
		codecs,
		fill_value: meta.fill_value,
		attributes: { [v2_marker]: true },
	};
}

export function v2_to_v3_group_metadata(_meta: GroupMetadataV2): GroupMetadata {
	return {
		zarr_format: 3,
		node_type: "group",
		attributes: { [v2_marker]: true },
	};
}
