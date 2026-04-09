import type {
	BigintDataType,
	NumberDataType,
	TypedArrayConstructor,
} from "../metadata.js";
import { assert, get_ctr } from "../util.js";

/**
 * Delta filter codec (numcodecs compat).
 *
 * Stores differences between consecutive elements rather than the elements
 * themselves.
 */
export class DeltaCodec<D extends NumberDataType | BigintDataType> {
	kind = "bytes_to_bytes";
	#TypedArray: TypedArrayConstructor<D>;
	#BYTES_PER_ELEMENT: number;

	constructor(_configuration: { dtype?: string }, meta: { data_type: D }) {
		this.#TypedArray = get_ctr(meta.data_type);
		let sample = new this.#TypedArray(0);
		assert(
			"BYTES_PER_ELEMENT" in sample,
			`Delta codec requires a fixed-size dtype, got "${meta.data_type}"`,
		);
		this.#BYTES_PER_ELEMENT = sample.BYTES_PER_ELEMENT;
	}

	static fromConfig<D extends NumberDataType | BigintDataType>(
		configuration: { dtype?: string },
		meta: { data_type: D },
	): DeltaCodec<D> {
		return new DeltaCodec(configuration, meta);
	}

	encode(data: Uint8Array): Uint8Array {
		return this.#apply(data, "encode");
	}

	decode(data: Uint8Array): Uint8Array {
		return this.#apply(data, "decode");
	}

	#apply(data: Uint8Array, mode: "encode" | "decode"): Uint8Array {
		let bpe = this.#BYTES_PER_ELEMENT;
		if (data.length % bpe !== 0) {
			throw new Error(
				`Data length (${data.length}) is not a multiple of element size (${bpe})`,
			);
		}
		let n = data.length / bpe;
		if (n === 0) return new Uint8Array(0);

		let input = new this.#TypedArray(data.buffer, data.byteOffset, n);
		let result = new Uint8Array(data.length);
		let output = new this.#TypedArray(result.buffer, 0, n);

		output[0] = input[0];
		if (mode === "encode") {
			for (let i = 1; i < n; i++) {
				// @ts-expect-error - we know the types are the same
				output[i] = input[i] - input[i - 1];
			}
		} else {
			for (let i = 1; i < n; i++) {
				// @ts-expect-error - we know the types are the same
				output[i] = output[i - 1] + input[i];
			}
		}

		return result;
	}
}
