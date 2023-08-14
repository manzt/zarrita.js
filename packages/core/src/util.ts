import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";

import type {
	ArrayMetadata,
	ArrayMetadataV2,
	BigintDataType,
	CodecMetadata,
	DataType,
	GroupMetadata,
	GroupMetadataV2,
	NumberDataType,
	StringDataType,
	TypedArrayConstructor,
} from "./metadata.js";

export function json_encode_object(o: Record<string, any>): Uint8Array {
	const str = JSON.stringify(o, null, 2);
	return new TextEncoder().encode(str);
}

export function json_decode_object(bytes: Uint8Array) {
	const str = new TextDecoder().decode(bytes);
	return JSON.parse(str);
}

export function byteswap_inplace(view: Uint8Array, bytes_per_element: number) {
	const numFlips = bytes_per_element / 2;
	const endByteIndex = bytes_per_element - 1;
	let t = 0;
	for (let i = 0; i < view.length; i += bytes_per_element) {
		for (let j = 0; j < numFlips; j += 1) {
			t = view[i + j];
			view[i + j] = view[i + endByteIndex - j];
			view[i + endByteIndex - j] = t;
		}
	}
}

const CONSTRUCTORS = {
	int8: Int8Array,
	int16: Int16Array,
	int32: Int32Array,
	int64: globalThis.BigInt64Array,
	uint8: Uint8Array,
	uint16: Uint16Array,
	uint32: Uint32Array,
	uint64: globalThis.BigUint64Array,
	float32: Float32Array,
	float64: Float64Array,
	bool: BoolArray,
};

const V2_STRING_REGEX = /v2:([US])(\d+)/;

export function get_ctr<D extends DataType>(
	data_type: D,
): TypedArrayConstructor<D> {
	let match = data_type.match(V2_STRING_REGEX);
	if (match) {
		let [, kind, chars] = match;
		// @ts-expect-error
		return (kind === "U" ? UnicodeStringArray : ByteStringArray).bind(
			null,
			Number(chars),
		);
	}
	let ctr = (CONSTRUCTORS as any)[data_type];
	if (!ctr) {
		throw new Error(`Unknown or unsupported data_type: ${data_type}`);
	}
	return ctr as any;
}

/** Compute strides for 'C' or 'F' ordered array from shape */
export function get_strides(shape: readonly number[], order: "C" | "F") {
	return (order === "C" ? row_major_stride : col_major_stride)(shape);
}

function row_major_stride(shape: readonly number[]) {
	const ndim = shape.length;
	const stride: number[] = globalThis.Array(ndim);
	for (let i = ndim - 1, step = 1; i >= 0; i--) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

function col_major_stride(shape: readonly number[]) {
	const ndim = shape.length;
	const stride: number[] = globalThis.Array(ndim);
	for (let i = 0, step = 1; i < ndim; i++) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

export function encode_chunk_key(
	chunk_coords: number[],
	{ name, configuration }: ArrayMetadata["chunk_key_encoding"],
): string {
	if (name === "default") {
		return ["c", ...chunk_coords].join(configuration.separator);
	}
	if (name === "v2") {
		return chunk_coords.join(configuration.separator) || "0";
	}
	throw new Error(`Unknown chunk key encoding: ${name}`);
}

const endian_regex = /^([<|>])(.*)$/;

export function coerce_dtype(
	dtype: string,
): { data_type: DataType } | { data_type: DataType; endian: "little" | "big" } {
	let match = dtype.match(endian_regex);
	if (!match) {
		throw new Error(`Invalid dtype: ${dtype}`);
	}
	let [, endian, rest] = match;
	let data_type = {
		"b1": "bool",
		"i1": "int8",
		"u1": "uint8",
		"i2": "int16",
		"u2": "uint16",
		"i4": "int32",
		"u4": "uint32",
		"i8": "int64",
		"u8": "uint64",
		"f4": "float32",
		"f8": "float64",
	}[rest] ??
		(rest.startsWith("S") || rest.startsWith("U") ? `v2:${rest}` : undefined);
	if (!data_type) {
		throw new Error(`Unsupported or unknown dtype: ${dtype}`);
	}
	if (endian === "|") {
		return { data_type } as any;
	}
	return { data_type, endian: endian === "<" ? "little" : "big" } as any;
}

export const v2_marker = Symbol("v2");

export function v2_to_v3_array_metadata(
	meta: ArrayMetadataV2,
): ArrayMetadata<DataType> {
	let codecs: CodecMetadata[] = [];
	let dtype = coerce_dtype(meta.dtype);
	if (meta.order === "F") {
		codecs.push({ name: "transpose", configuration: { order: "F" } });
	}
	if ("endian" in dtype && dtype.endian === "big") {
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
		data_type: dtype.data_type,
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

export type DataTypeQuery =
	| DataType
	| "boolean"
	| "number"
	| "bigint"
	| "string";

export type NarrowDataType<
	Dtype extends DataType,
	Query extends DataTypeQuery,
> = Query extends "number" ? NumberDataType
	: Query extends "bigint" ? BigintDataType
	: Query extends "string" ? StringDataType
	: Extract<Query, Dtype>;

export function is_dtype<Query extends DataTypeQuery>(
	dtype: DataType,
	query: Query,
): dtype is NarrowDataType<DataType, Query> {
	if (
		query !== "number" &&
		query !== "bigint" &&
		query !== "boolean" &&
		query !== "string"
	) {
		return dtype === query;
	}
	const is_boolean = dtype === "bool";
	if (query === "boolean") return is_boolean;
	const is_string = dtype.startsWith("v2:U") || dtype.startsWith("v2:S");
	if (query === "string") return is_string;
	const is_bigint = dtype === "int64" || dtype === "uint64";
	if (query === "bigint") return is_bigint;
	return !is_string && !is_bigint && !is_boolean;
}
