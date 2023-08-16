import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";

/**
 * @param {Record<string, any>} o
 * @returns {Uint8Array}
 */
export function json_encode_object(o) {
	const str = JSON.stringify(o, null, 2);
	return new TextEncoder().encode(str);
}

/**
 * @param {Uint8Array} bytes
 * @returns {any}
 */
export function json_decode_object(bytes) {
	const str = new TextDecoder().decode(bytes);
	return JSON.parse(str);
}

/**
 * @param {Uint8Array} view
 * @param {number} bytes_per_element
 * @returns {void}
 */
export function byteswap_inplace(view, bytes_per_element) {
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

/**
 * @template {import("./metadata.js").DataType} D
 * @param {D | import("./metadata.js").TypedArray<D>} data_type
 * @returns {import("./metadata.js").TypedArrayConstructor<D>}
 */
export function get_ctr(data_type) {
	if (typeof data_type !== "string") {
		if (
			data_type instanceof UnicodeStringArray ||
			data_type instanceof ByteStringArray
		) {
			return data_type.constructor.bind(null, data_type.chars);
		}
		return /** @type {any} */ (data_type.constructor);
	}
	let match = data_type.match(V2_STRING_REGEX);
	if (match) {
		let [, kind, chars] = match;
		// @ts-expect-error
		return (kind === "U" ? UnicodeStringArray : ByteStringArray).bind(
			null,
			Number(chars),
		);
	}
	let ctr = /** @type {Record<string, any>}*/ (CONSTRUCTORS)[data_type];
	if (!ctr) {
		throw new Error(`Unknown or unsupported data_type: ${data_type}`);
	}
	return ctr;
}

/**
 * Compute strides for 'C' or 'F' ordered array from shape
 * @param {readonly number[]} shape
 * @param {"C" | "F"} order
 */
export function get_strides(shape, order) {
	return (order === "C" ? row_major_stride : col_major_stride)(shape);
}

/**
 * @param {readonly number[]} shape
 * @returns {number[]}
 */
function row_major_stride(shape) {
	const ndim = shape.length;
	/** @type {number[]} */
	const stride = globalThis.Array(ndim);
	for (let i = ndim - 1, step = 1; i >= 0; i--) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

/**
 * @param {readonly number[]} shape
 * @returns {number[]}
 */
function col_major_stride(shape) {
	const ndim = shape.length;
	/** @type {number[]} */
	const stride = globalThis.Array(ndim);
	for (let i = 0, step = 1; i < ndim; i++) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

/**
 * @param {readonly number[]} chunk_coords
 * @param {import("./metadata.js").ArrayMetadata["chunk_key_encoding"]} chunk_grid
 * @returns {string}
 */
export function encode_chunk_key(chunk_coords, { name, configuration }) {
	if (name === "default") {
		return ["c", ...chunk_coords].join(configuration.separator);
	}
	if (name === "v2") {
		return chunk_coords.join(configuration.separator) || "0";
	}
	throw new Error(`Unknown chunk key encoding: ${name}`);
}

const endian_regex = /^([<|>])(.*)$/;

/**
 * @param {string} dtype
 * @returns {{ data_type: import("./metadata.js").DataType } | { data_type: import("./metadata.js").DataType; endian: "little" | "big" }}
 */
export function coerce_dtype(dtype) {
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
		return /** @type {{ data_type: import("./metadata.js").DataType }} */ ({
			data_type,
		});
	}
	return /** @type {{ data_type: import("./metadata.js").DataType, endian: "little" | "big" }} */ ({
		data_type,
		endian: endian === "<" ? "little" : "big",
	});
}

export const v2_marker = Symbol("v2");

/**
 * @param {import("./metadata.js").ArrayMetadataV2} meta
 * @returns {import("./metadata.js").ArrayMetadata<import("./metadata.js").DataType>}
 */
export function v2_to_v3_array_metadata(meta) {
	/** @type {import("./metadata.js").CodecMetadata[]} */
	let codecs = [];
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

/**
 * @param {import("./metadata.js").GroupMetadataV2} _meta
 * @returns {import("./metadata.js").GroupMetadata}
 */
export function v2_to_v3_group_metadata(_meta) {
	return {
		zarr_format: 3,
		node_type: "group",
		attributes: { [v2_marker]: true },
	};
}

/**
 * @template {import("./metadata.js").DataType} D
 * @template {import("./metadata.js").DataTypeQuery} Query
 * @param {D} dtype
 * @param {Query} query
 * @returns {dtype is import("./metadata.js").NarrowDataType<D, Query>}
 */
export function is_dtype(dtype, query) {
	if (
		query !== "number" &&
		query !== "bigint" &&
		query !== "boolean" &&
		query !== "string"
	) {
		// @ts-expect-error
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
