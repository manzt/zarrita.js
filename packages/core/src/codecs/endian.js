import { byteswap_inplace, get_ctr, get_strides } from "../util.js";

const LITTLE_ENDIAN_OS = system_is_little_endian();

/**
 * Returns true if the system is little endian.
 * @returns {boolean}
 */
function system_is_little_endian() {
	const a = new Uint32Array([0x12345678]);
	const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
	return !(b[0] === 0x12);
}

/**
 * Returns the number of bytes per element for the given data type.
 * @param {import("../types.js").DataType} data_type
 * @returns {number}
 */
function bytes_per_element(data_type) {
	/** @type {Record<string, number>} */
	const mapping = {
		int8: 1,
		int16: 2,
		int32: 4,
		int64: 8,
		uint8: 1,
		uint16: 2,
		uint32: 4,
		uint64: 8,
		float32: 4,
		float64: 8,
	};
	let b = mapping[data_type] ?? data_type.startsWith("v2:U") ? 4 : undefined;
	if (!b) {
		throw new Error(`Unknown or unsupported data type: ${data_type}`);
	}
	return b;
}

/**
 * @template {import("../types.js").DataType} D
 */
export class EndianCodec {
	kind = "array_to_bytes";

	/**
	 * @param {{ endian: "little" | "big" }} configuration
	 * @param {import("../types.js").ArrayMetadata<D>} array_metadata
	 */
	constructor(configuration, array_metadata) {
		/** @type {{ endian: "little" | "big" }} */
		this.configuration = configuration;
		/** @type {import("../types.js").ArrayMetadata<D>} */
		this.array_metadata = array_metadata;
	}

	/**
	 * @template {import("../types.js").DataType} D
	 * @param {{ endian: "little" | "big" }} configuration
	 * @param {import("../types.js").ArrayMetadata<D>} array_metadata
	 * @returns {EndianCodec<D>}
	 */
	static fromConfig(configuration, array_metadata) {
		return new EndianCodec(configuration, array_metadata);
	}

	/**
	 * @param {import("../types.js").Chunk<D>} arr
	 * @returns {Uint8Array}
	 */
	encode(arr) {
		let bytes = new Uint8Array(arr.data.buffer);
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.array_metadata.data_type));
		}
		return bytes;
	}

	/**
	 * @param {Uint8Array} bytes
	 * @returns {import("../types.js").Chunk<D>}
	 */
	decode(bytes) {
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.array_metadata.data_type));
		}
		let ctr = get_ctr(this.array_metadata.data_type);
		let maybe_transpose_codec = this.array_metadata.codecs.find((c) =>
			c.name === "transpose"
		);
		return {
			data: new ctr(bytes.buffer),
			shape: this.array_metadata.chunk_grid.configuration.chunk_shape,
			stride: get_strides(
				this.array_metadata.chunk_grid.configuration.chunk_shape,
				maybe_transpose_codec?.configuration.order === "F" ? "F" : "C",
			),
		};
	}
}
