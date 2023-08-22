import type {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";

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
// export type Raw = `r${number}`;

/** @category String */
export type UnicodeStr = `v2:U${number}`;
/** @category String */
export type ByteStr = `v2:S${number}`;

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

export type StringDataType = UnicodeStr | ByteStr;

export type DataType =
	| NumberDataType
	| BigintDataType
	| StringDataType
	| Bool;

export type Attributes = Record<string, unknown>;

// Hack to get scalar type since is not defined on any typed arrays.
export type Scalar<D extends DataType> = D extends Bool ? boolean
	: D extends BigintDataType ? bigint
	: D extends StringDataType ? string
	: D extends NumberDataType ? number
	: never;

export type CodecMetadata = {
	name: string;
	configuration: Record<string, unknown>;
};

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

export type TypedArray<D extends DataType> = D extends Int8 ? Int8Array
	: D extends Int16 ? Int16Array
	: D extends Int32 ? Int32Array
	: D extends Int64 ? BigInt64Array
	: D extends Uint8 ? Uint8Array
	: D extends Uint16 ? Uint16Array
	: D extends Uint32 ? Uint32Array
	: D extends Uint64 ? BigUint64Array
	: D extends Float32 ? Float32Array
	: D extends Float64 ? Float64Array
	: D extends Bool ? BoolArray
	: D extends UnicodeStr ? UnicodeStringArray
	: D extends ByteStr ? ByteStringArray
	: never;

export type TypedArrayConstructor<D extends DataType> = {
	new (length: number): TypedArray<D>;
	new (
		array: ArrayLike<Scalar<D>> | ArrayBufferLike,
		byteOffset?: number,
		length?: number,
	): TypedArray<D>;
};

export type Chunk<Dtype extends DataType> = {
	data: TypedArray<Dtype>;
	shape: number[];
	stride: number[];
};
