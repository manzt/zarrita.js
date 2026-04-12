/*
The scale_offset codec is an array -> array codec that shifts and
scales input array values on the encoding path, and inverts this
transformation on the decoding path. This codec is only defined for
a specific set of data types (ints and floats). This codec preserves the data type
of the array.

The specification for this codec can be found at https://github.com/zarr-developers/zarr-extensions/tree/main/codecs/scale_offset
*/

import type { Chunk, Scalar } from "../metadata.js";
import {
	type JsonScalar,
	type NumericDataType,
	parseJsonScalar,
} from "./json-scalar.js";

interface ScaleOffsetConfig {
	scale: JsonScalar;
	offset: JsonScalar;
}

const SUPPORTED: ReadonlySet<string> = new Set<NumericDataType>([
	"int8",
	"uint8",
	"int16",
	"uint16",
	"int32",
	"uint32",
	"int64",
	"uint64",
	"float16",
	"float32",
	"float64",
]);

export class ScaleOffsetCodec<D extends NumericDataType> {
	kind = "array_to_array" as const;
	#scale: Scalar<D>;
	#offset: Scalar<D>;

	constructor(scale: Scalar<D>, offset: Scalar<D>) {
		this.#scale = scale;
		this.#offset = offset;
	}

	static fromConfig<D extends NumericDataType>(
		config: ScaleOffsetConfig,
		meta: { dataType: D },
	): ScaleOffsetCodec<D> {
		if (!SUPPORTED.has(meta.dataType)) {
			throw new Error(
				`ScaleOffset codec does not support data type: ${meta.dataType}`,
			);
		}
		return new ScaleOffsetCodec(
			parseJsonScalar(meta.dataType, config.scale),
			parseJsonScalar(meta.dataType, config.offset),
		);
	}

	encode(_chunk: Chunk<D>): never {
		throw new Error("ScaleOffset encoding is not supported.");
	}

	decode(chunk: Chunk<D>): Chunk<D> {
		const src = chunk.data;
		for (let i = 0; i < src.length; i++) {
			// @ts-expect-error - mix of bigint and number arithmetic is safe here
			src[i] = src[i] / this.#scale + this.#offset;
		}
		return chunk;
	}
}
