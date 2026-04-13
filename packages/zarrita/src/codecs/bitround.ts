import { InvalidMetadataError } from "../errors.js";
import type { Chunk, Float32, Float64 } from "../metadata.js";
import { unimplementedEncode } from "./_shared.js";

/**
 * A codec for bit-rounding.
 *
 * Reduces floating-point precision by truncating mantissa bits during encoding.
 * Decoding is a no-op as the process is lossy and precision cannot be restored.
 *
 * Note: {@link BitroundCodec.encode} is not yet implemented since Zarrita is
 * primarily used in read-only contexts (web browser). If you need encoding support,
 * please open an issue at {@link https://github.com/manzt/zarrita.js/issues}.
 *
 * @see {@link https://github.com/zarr-developers/numcodecs/blob/main/numcodecs/bitround.py}
 * for the original Python implementation.
 *
 * @remarks
 * Data types are not validated, and `float16` arrays are not supported (reflecting browser support).
 */
export class BitroundCodec<D extends Float64 | Float32> {
	kind = "array_to_array";

	constructor(configuration: { keepbits: number }, _meta: { dataType: D }) {
		if (configuration.keepbits < 0) {
			throw new InvalidMetadataError("keepbits must be zero or positive");
		}
	}

	static fromConfig<D extends Float32 | Float64>(
		configuration: { keepbits: number },
		meta: { dataType: D },
	): BitroundCodec<D> {
		return new BitroundCodec(configuration, meta);
	}

	encode = unimplementedEncode("bitround");

	/**
	 * Decode a chunk of data (no-op).
	 * @param arr - The chunk to decode
	 * @returns The decoded chunk
	 */
	decode(arr: Chunk<D>): Chunk<D> {
		return arr; // No-op as bit-rounding is lossy
	}
}
