import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";
import { get_ctr, get_strides } from "../util.js";

/**
 * @template {import("../types.js").DataType} D
 * @typedef{{ [x: number]: import("../types.js").Scalar<D> }} TypedArrayProxy
 */
/**
 * @template {import("../types.js").DataType} D
 * @param {import("../types.js").TypedArray<D>} arr
 * @returns {TypedArrayProxy<D>}
 */
function proxy(arr) {
	if (
		arr instanceof BoolArray ||
		arr instanceof UnicodeStringArray ||
		arr instanceof ByteStringArray
	) {
		return new Proxy(/** @type {any} */ (arr), {
			get(target, prop) {
				return target.get(Number(prop));
			},
			set(target, prop, value) {
				target.set(Number(prop), value);
				return true;
			},
		});
	}
	return /** @type {any} */ (arr);
}

/**
 * @template {import("../types.js").DataType} D
 * @param {import("../types.js").Chunk<D>} chunk
 * @param {"C" | "F"} order
 * @returns {import("../types.js").Chunk<D>}
 */
function empty_like(chunk, order) {
	let TypedArray = get_ctr(chunk.data);
	return {
		data: new TypedArray(chunk.data.length),
		shape: chunk.shape,
		stride: get_strides(chunk.shape, order),
	};
}

/**
 * @template {import("../types.js").DataType} D
 * @param {import("../types.js").Chunk<D>} src
 * @param {"C" | "F"} target
 * @returns {import("../types.js").Chunk<D>}
 */
function convert_array_order(src, target) {
	let out = empty_like(src, target);
	let n_dims = src.shape.length;
	let size = src.data.length;
	let index = Array(n_dims).fill(0);

	let src_data = proxy(src.data);
	let out_data = proxy(out.data);

	for (let src_idx = 0; src_idx < size; src_idx++) {
		let out_idx = 0;
		for (let dim = 0; dim < n_dims; dim++) {
			out_idx += index[dim] * out.stride[dim];
		}
		out_data[out_idx] = src_data[src_idx];

		index[0] += 1;
		for (let dim = 0; dim < n_dims; dim++) {
			if (index[dim] === src.shape[dim]) {
				if (dim + 1 === n_dims) {
					break;
				}
				index[dim] = 0;
				index[dim + 1] += 1;
			}
		}
	}

	return out;
}

/**
 * @param {import("../types.js").Chunk<import("../types.js").DataType>} arr
 * @returns {"C" | "F"}
 */
function get_order(arr) {
	// Assume C order if no stride is given
	if (!arr.stride) return "C";
	let row_major_strides = get_strides(arr.shape, "C");
	return arr.stride.every((s, i) => s === row_major_strides[i]) ? "C" : "F";
}

/**
 * @template {import("../types.js").DataType} D
 */
export class TransposeCodec {
	kind = "array_to_array";

	/**
	 * @param {{ order: "C" | "F" }} configuration
	 * @param {import("../types.js").ArrayMetadata<D>} array_metadata
	 */
	constructor(configuration, array_metadata) {
		/** @type {{ order: "C" | "F" }} */
		this.configuration = configuration;
		/** @type {import("../types.js").ArrayMetadata<D>} */
		this.array_metadata = array_metadata;
	}

	/**
	 * @template {import("../types.js").DataType} D
	 * @param {{ order: "C" | "F" }} configuration
	 * @param {import("../types.js").ArrayMetadata<D>} array_metadata
	 * @returns {TransposeCodec<D>}
	 */
	static fromConfig(configuration, array_metadata) {
		return new TransposeCodec(configuration, array_metadata);
	}

	/**
	 * @param {import("../types.js").Chunk<D>} arr
	 * @returns {import("../types.js").Chunk<D>}
	 */
	encode(arr) {
		if (get_order(arr) === this.configuration.order) {
			return arr;
		}
		return convert_array_order(arr, this.configuration.order);
	}

	/**
	 * @param {import("../types.js").Chunk<D>} arr
	 * @returns {import("../types.js").Chunk<D>}
	 */
	decode(arr) {
		return arr;
	}
}
