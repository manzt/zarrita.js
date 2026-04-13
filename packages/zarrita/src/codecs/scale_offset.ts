/*
The scale_offset codec is an array -> array codec that shifts and
scales input array values on the encoding path, and inverts this
transformation on the decoding path. This codec is only defined for
a specific set of data types (ints and floats). This codec preserves the data type
of the array.

The specification for this codec can be found at https://github.com/zarr-developers/zarr-extensions/tree/main/codecs/scale_offset
*/

import { InvalidMetadataError } from "../errors.js";
import type { Chunk, Scalar } from "../metadata.js";
import { getCtr } from "../util.js";
import { unimplementedEncode } from "./_shared.js";
import {
	type JsonScalar,
	type NumericDataType,
	parseJsonScalar,
} from "./json-scalar.js";

interface ScaleOffsetConfig {
	scale?: JsonScalar;
	offset?: JsonScalar;
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
	#ctr: ReturnType<typeof getCtr<D>>;
	#scale: Scalar<D>;
	#offset: Scalar<D>;

	constructor(
		scale: Scalar<D>,
		offset: Scalar<D>,
		ctr: ReturnType<typeof getCtr<D>>,
	) {
		this.#scale = scale;
		this.#offset = offset;
		this.#ctr = ctr;
	}

	static fromConfig<D extends NumericDataType>(
		config: ScaleOffsetConfig,
		meta: { dataType: D },
	): ScaleOffsetCodec<D> {
		if (!SUPPORTED.has(meta.dataType)) {
			throw new InvalidMetadataError(
				`scale_offset codec does not support data type: ${meta.dataType}`,
			);
		}
		return new ScaleOffsetCodec(
			parseJsonScalar(meta.dataType, config.scale ?? 1),
			parseJsonScalar(meta.dataType, config.offset ?? 0),
			getCtr(meta.dataType),
		);
	}

	encode = unimplementedEncode("scale_offset");

	decode(chunk: Chunk<D>): Chunk<D> {
		const src = chunk.data;
		const out = new this.#ctr(src.length) as Chunk<D>["data"];
		for (let i = 0; i < src.length; i++) {
			// @ts-expect-error - mix of bigint and number arithmetic is safe here
			out[i] = src[i] / this.#scale + this.#offset;
		}
		return { data: out, shape: chunk.shape, stride: chunk.stride };
	}
}
