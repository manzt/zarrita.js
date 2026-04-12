/*
The scale_offset codec is an array -> array codec that shifts and
scales input array values on the encoding path, and inverts this
transformation on the decoding path. This codec is only defined for
a specific set of data types (ints and floats). This codec preserves the data type
of the array.

The specification for this codec can be found at https://github.com/zarr-developers/zarr-extensions/tree/main/codecs/scale_offset
*/

import type {
	BigintDataType,
	Chunk,
	NumberDataType,
	Scalar,
} from "../metadata.js";

type ScaleOffsetCompatibleType = NumberDataType | BigintDataType;

type SpecialFloat = "NaN" | "Infinity" | "-Infinity";
type HexString = `0x${string}`;
type JsonScalar = number | SpecialFloat | HexString;

interface ScaleOffsetConfig {
	scale: JsonScalar;
	offset: JsonScalar;
}

const SCALE_OFFSET_SUPPORTED_DATA_TYPE: ReadonlySet<string> = new Set<ScaleOffsetCompatibleType>([
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

// Overlaps with ensureCorrectScalar in metadata.ts
const SPECIAL_FLOATS: Record<string, number> = {
	NaN: NaN,
	Infinity: Infinity,
	"-Infinity": -Infinity,
};

const FLOAT_BYTES: Record<string, number> = {
	float16: 2,
	float32: 4,
	float64: 8,
};

/*
Reinterpret a hex-encoded integer as a float of the given byte width. 
This is necessary because the Zarr V3 spec allows floats to declare their fill value as a hex 
string representing the raw bytes of the float.
 */
function hexToFloat(hex: string, byteWidth: number): number {
	const int = BigInt(hex);
	const buf = new ArrayBuffer(byteWidth);
	const view = new DataView(buf);
	if (byteWidth === 2) {
		view.setUint16(0, Number(int));
		return view.getFloat16(0);
	}
	if (byteWidth === 4) {
		view.setUint32(0, Number(int));
		return view.getFloat32(0);
	}
	view.setBigUint64(0, int);
	return view.getFloat64(0);
}

function isFloatType(dataType: string): boolean {
	return dataType in FLOAT_BYTES;
}

// Overlaps with ensureCorrectScalar in metadata.ts
function toScalar<D extends ScaleOffsetCompatibleType>(
	dataType: D,
	value: JsonScalar,
): Scalar<D> {
	if (dataType === "int64" || dataType === "uint64") {
		if (typeof value !== "number" || !Number.isInteger(value)) {
			throw new Error(
				`Expected an integer value for data type "${dataType}", got ${JSON.stringify(value)}`,
			);
		}
		return BigInt(value) as Scalar<D>;
	}
	if (typeof value === "number") {
		if (!isFloatType(dataType) && !Number.isInteger(value)) {
			throw new Error(
				`Expected an integer value for data type "${dataType}", got ${value}`,
			);
		}
		return value as Scalar<D>;
	}
	// value is SpecialFloat | HexString — only valid for float types
	if (!isFloatType(dataType)) {
		throw new Error(
			`String-encoded scalar "${value}" is not valid for non-float data type "${dataType}"`,
		);
	}
	if (value in SPECIAL_FLOATS) {
		return SPECIAL_FLOATS[value] as Scalar<D>;
	}
	return hexToFloat(value, FLOAT_BYTES[dataType]) as Scalar<D>;
}

export class ScaleOffsetCodec<D extends ScaleOffsetCompatibleType> {
	kind = "array_to_array" as const;
	#scale: Scalar<D>;
	#offset: Scalar<D>;

	constructor(scale: Scalar<D>, offset: Scalar<D>) {
		this.#scale = scale;
		this.#offset = offset;
	}

	static fromConfig<D extends ScaleOffsetCompatibleType>(
		config: ScaleOffsetConfig,
		meta: { dataType: D },
	): ScaleOffsetCodec<D> {
		if (!SCALE_OFFSET_SUPPORTED_DATA_TYPE.has(meta.dataType)) {
			throw new Error(
				`ScaleOffset codec does not support data type: ${meta.dataType}`,
			);
		}
		return new ScaleOffsetCodec(
			toScalar(meta.dataType, config.scale),
			toScalar(meta.dataType, config.offset),
		);
	}

	encode(_chunk: Chunk<D>): never {
		throw new Error(
			"ScaleOffset encoding is not supported.",
		);
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
