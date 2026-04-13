/*
The cast_value codec converts an array from one data type to another by applying a defined
casting procedure to each element.

The specification for this codec can be found at https://github.com/zarr-developers/zarr-extensions/tree/main/codecs/cast_value
*/

import { InvalidMetadataError } from "../errors.js";
import type { Chunk, Scalar } from "../metadata.js";
import { getCtr } from "../util.js";
import { unimplementedEncode } from "./_shared.js";
import {
	isBigintType,
	isFloatType,
	type JsonScalar,
	type NumericDataType,
	parseJsonScalar,
} from "./json-scalar.js";

type RoundingMode =
	| "nearest-even"
	| "towards-zero"
	| "towards-positive"
	| "towards-negative"
	| "nearest-away";

type OutOfRangeMode = "clamp" | "wrap";

interface ScalarMapConfig {
	encode?: [JsonScalar, JsonScalar][];
	decode?: [JsonScalar, JsonScalar][];
}

export interface CastValueConfig {
	data_type: NumericDataType;
	rounding?: RoundingMode;
	out_of_range?: OutOfRangeMode;
	scalar_map?: ScalarMapConfig;
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

// Integer range bounds, keyed by data type string.
const INT_BOUNDS: Record<string, [min: number, max: number]> = {
	int8: [-(2 ** 7), 2 ** 7 - 1],
	uint8: [0, 2 ** 8 - 1],
	int16: [-(2 ** 15), 2 ** 15 - 1],
	uint16: [0, 2 ** 16 - 1],
	int32: [-(2 ** 31), 2 ** 31 - 1],
	uint32: [0, 2 ** 32 - 1],
};

const BIGINT_BOUNDS: Record<string, [min: bigint, max: bigint]> = {
	int64: [-(2n ** 63n), 2n ** 63n - 1n],
	uint64: [0n, 2n ** 64n - 1n],
};

// ---------------------------------------------------------------------------
// Scalar map
// ---------------------------------------------------------------------------

// A pre-parsed scalar map entry with native JS values.
type ScalarMapEntry = { src: number | bigint; tgt: number | bigint };

/** Parse scalar_map entries from JSON into native JS values. */
function parseScalarMapEntries(
	entries: [JsonScalar, JsonScalar][],
	srcType: NumericDataType,
	tgtType: NumericDataType,
): ScalarMapEntry[] {
	return entries.map(([src, tgt]) => ({
		src: parseJsonScalar(srcType, src) as number | bigint,
		tgt: parseJsonScalar(tgtType, tgt) as number | bigint,
	}));
}

/**
 * Look up a value in the scalar map. Returns the mapped target value if found,
 * or undefined if no match. NaN is matched specially (NaN !== NaN).
 */
function scalarMapLookup(
	value: number | bigint,
	entries: ScalarMapEntry[],
): number | bigint | undefined {
	for (const entry of entries) {
		if (typeof entry.src === "number" && Number.isNaN(entry.src)) {
			if (typeof value === "number" && Number.isNaN(value)) {
				return entry.tgt;
			}
		} else if (value === entry.src) {
			return entry.tgt;
		}
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Rounding — resolved once at construction, not per element.
// ---------------------------------------------------------------------------

function roundNearestEven(value: number): number {
	if (!Number.isFinite(value)) return value;
	// Math.round breaks ties towards +Infinity; we need ties to even.
	if (Math.abs(value - Math.trunc(value)) === 0.5) {
		const floor = Math.floor(value);
		const ceil = Math.ceil(value);
		return floor % 2 === 0 ? floor : ceil;
	}
	return Math.round(value);
}

function nearestAway(value: number): number {
	return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

/** Resolve a RoundingMode string to a concrete function (once, at construction). */
function getRoundingFn(mode: RoundingMode): (value: number) => number {
	switch (mode) {
		case "nearest-even":
			return roundNearestEven;
		case "towards-zero":
			return Math.trunc;
		case "towards-positive":
			return Math.ceil;
		case "towards-negative":
			return Math.floor;
		case "nearest-away":
			return nearestAway;
	}
}

// ---------------------------------------------------------------------------
// Out-of-range handling — resolved once at construction, not per element.
// ---------------------------------------------------------------------------

function makeIntRangeCheck(
	lo: number,
	hi: number,
	outOfRange: OutOfRangeMode | undefined,
): (value: number) => number {
	const range = hi - lo + 1;
	switch (outOfRange) {
		case "clamp":
			return (v) => (v < lo ? lo : v > hi ? hi : v);
		case "wrap":
			return (v) =>
				v >= lo && v <= hi ? v : ((((v - lo) % range) + range) % range) + lo;
		default:
			return (v) => {
				if (v >= lo && v <= hi) return v;
				throw new Error(
					`Value ${v} out of range [${lo}, ${hi}]. ` +
						"Set out_of_range='clamp' or out_of_range='wrap' to handle this.",
				);
			};
	}
}

function makeBigintRangeCheck(
	lo: bigint,
	hi: bigint,
	outOfRange: OutOfRangeMode | undefined,
): (value: bigint) => bigint {
	const range = hi - lo + 1n;
	switch (outOfRange) {
		case "clamp":
			return (v) => (v < lo ? lo : v > hi ? hi : v);
		case "wrap":
			return (v) =>
				v >= lo && v <= hi ? v : ((((v - lo) % range) + range) % range) + lo;
		default:
			return (v) => {
				if (v >= lo && v <= hi) return v;
				throw new Error(
					`Value ${v} out of range [${lo}, ${hi}]. ` +
						"Set out_of_range='clamp' or out_of_range='wrap' to handle this.",
				);
			};
	}
}

// ---------------------------------------------------------------------------
// Codec
// ---------------------------------------------------------------------------

/**
 * Array-to-array codec that casts element values between two numeric types.
 *
 * Two data types are in play:
 *   - `ArrayDtype`:   the array's declared data type (`meta.dataType`).
 *                     This is what the user reads/writes.
 *   - `EncodedDtype`: the on-disk type (`config.data_type`).
 *                     This is what the bytes codec sees.
 *
 * Encode: ArrayDtype -> EncodedDtype  (not implemented, throws)
 * Decode: EncodedDtype -> ArrayDtype
 */
export class CastValueCodec<
	ArrayDtype extends NumericDataType,
	EncodedDtype extends NumericDataType,
> {
	kind = "array_to_array" as const;
	#encodedType: EncodedDtype;
	#arrayTypeCtr: ReturnType<typeof getCtr<ArrayDtype>>;
	#decodeValue: (value: Scalar<EncodedDtype>) => Scalar<ArrayDtype>;
	#encodeFillValue: (value: Scalar<ArrayDtype>) => Scalar<EncodedDtype>;

	constructor(
		arrayType: ArrayDtype,
		encodedType: EncodedDtype,
		rounding: RoundingMode,
		outOfRange: OutOfRangeMode | undefined,
		decodeMapEntries: ScalarMapEntry[],
		encodeMapEntries: ScalarMapEntry[],
	) {
		this.#encodedType = encodedType;
		this.#arrayTypeCtr = getCtr(arrayType);
		this.#decodeValue = buildConverter<EncodedDtype, ArrayDtype>(
			encodedType,
			arrayType,
			rounding,
			outOfRange,
			decodeMapEntries,
		);
		this.#encodeFillValue = buildConverter<ArrayDtype, EncodedDtype>(
			arrayType,
			encodedType,
			rounding,
			outOfRange,
			encodeMapEntries,
		);
	}

	/** Return updated metadata reflecting the type and fill value after encoding. */
	getEncodedMeta(meta: {
		dataType: string;
		shape: number[];
		codecs: unknown[];
		fillValue: unknown;
	}): {
		dataType: string;
		shape: number[];
		codecs: unknown[];
		fillValue: unknown;
	} {
		let fillValue = meta.fillValue;
		if (fillValue != null) {
			fillValue = this.#encodeFillValue(fillValue as Scalar<ArrayDtype>);
		}
		return { ...meta, dataType: this.#encodedType, fillValue };
	}

	static fromConfig<A extends NumericDataType>(
		config: CastValueConfig,
		meta: { dataType: A },
	): CastValueCodec<A, NumericDataType> {
		const arrayType = meta.dataType;
		const encodedType = config.data_type;
		if (!SUPPORTED.has(arrayType)) {
			throw new InvalidMetadataError(
				`cast_value codec does not support array data type: ${arrayType}`,
			);
		}
		if (!SUPPORTED.has(encodedType)) {
			throw new InvalidMetadataError(
				`cast_value codec does not support encoded data type: ${encodedType}`,
			);
		}
		const rounding = config.rounding ?? "nearest-even";

		// Decode scalar_map: entries are [encoded value, array value].
		const decodeMapEntries = config.scalar_map?.decode
			? parseScalarMapEntries(config.scalar_map.decode, encodedType, arrayType)
			: [];

		// Encode scalar_map: entries are [array value, encoded value].
		// Used for fill value propagation.
		const encodeMapEntries = config.scalar_map?.encode
			? parseScalarMapEntries(config.scalar_map.encode, arrayType, encodedType)
			: [];

		return new CastValueCodec(
			arrayType,
			encodedType,
			rounding,
			config.out_of_range,
			decodeMapEntries,
			encodeMapEntries,
		);
	}

	encode = unimplementedEncode("cast_value");

	decode(chunk: Chunk<EncodedDtype>): Chunk<ArrayDtype> {
		const input = chunk.data;
		const out = new this.#arrayTypeCtr(
			input.length,
		) as Chunk<ArrayDtype>["data"];
		for (let i = 0; i < input.length; i++) {
			out[i] = this.#decodeValue(input[i] as Scalar<EncodedDtype>);
		}
		return { data: out, shape: chunk.shape, stride: chunk.stride };
	}
}

// ---------------------------------------------------------------------------
// Build a per-element converter function from one numeric type to another.
// Src/Dst here are generic: the caller decides which is the "from" and "to".
// ---------------------------------------------------------------------------

// All type dispatch, bounds lookups, rounding resolution, and out-of-range
// mode selection happen here — once per codec construction. The returned
// function is a tight per-element converter with no re-dispatch.
function buildConverter<
	Src extends NumericDataType,
	Dst extends NumericDataType,
>(
	sourceType: Src,
	targetType: Dst,
	rounding: RoundingMode,
	outOfRange: OutOfRangeMode | undefined,
	mapEntries: ScalarMapEntry[],
): (value: Scalar<Src>) => Scalar<Dst> {
	const srcIsFloat = isFloatType(sourceType);
	const srcIsBigint = isBigintType(sourceType);
	const dstIsFloat = isFloatType(targetType);
	const dstIsBigint = isBigintType(targetType);

	// biome-ignore lint/suspicious/noExplicitAny: runtime dispatch across number/bigint boundary
	let baseFn: (v: any) => any;

	if (srcIsFloat && dstIsFloat) {
		if (rounding !== "nearest-even") {
			throw new InvalidMetadataError(
				`cast_value float -> float only supports "nearest-even" rounding, got "${rounding}"`,
			);
		}
		// TypedArray assignment handles nearest-even natively.
		baseFn = (v: number) => v;
	} else if (srcIsFloat && !dstIsFloat && !dstIsBigint) {
		// float -> int (number)
		const round = getRoundingFn(rounding);
		const check = makeIntRangeCheck(...INT_BOUNDS[targetType], outOfRange);
		baseFn = (v: number) => {
			if (!Number.isFinite(v)) {
				throw new Error(`Cannot cast ${v} to integer type without scalar_map`);
			}
			return check(round(v));
		};
	} else if (srcIsFloat && dstIsBigint) {
		// float -> bigint
		const round = getRoundingFn(rounding);
		const check = makeBigintRangeCheck(
			...BIGINT_BOUNDS[targetType],
			outOfRange,
		);
		baseFn = (v: number) => {
			if (!Number.isFinite(v)) {
				throw new Error(`Cannot cast ${v} to integer type without scalar_map`);
			}
			return check(BigInt(round(v)));
		};
	} else if (!srcIsFloat && !srcIsBigint && dstIsFloat) {
		// int (number) -> float
		baseFn = (v: number) => v;
	} else if (srcIsBigint && dstIsFloat) {
		// bigint -> float
		baseFn = (v: bigint) => Number(v);
	} else if (!srcIsFloat && !srcIsBigint && !dstIsFloat && !dstIsBigint) {
		// int (number) -> int (number)
		baseFn = makeIntRangeCheck(...INT_BOUNDS[targetType], outOfRange);
	} else if (!srcIsFloat && !srcIsBigint && dstIsBigint) {
		// int (number) -> bigint
		const check = makeBigintRangeCheck(
			...BIGINT_BOUNDS[targetType],
			outOfRange,
		);
		baseFn = (v: number) => check(BigInt(v));
	} else if (srcIsBigint && !dstIsFloat && !dstIsBigint) {
		// bigint -> int (number)
		const check = makeIntRangeCheck(...INT_BOUNDS[targetType], outOfRange);
		baseFn = (v: bigint) => check(Number(v));
	} else if (srcIsBigint && dstIsBigint) {
		// bigint -> bigint
		baseFn = makeBigintRangeCheck(...BIGINT_BOUNDS[targetType], outOfRange);
	} else {
		throw new Error(
			`Unhandled type combination: ${sourceType} -> ${targetType}`,
		);
	}

	// If there are no scalar_map entries, use the base converter directly.
	if (mapEntries.length === 0) {
		return baseFn as (value: Scalar<Src>) => Scalar<Dst>;
	}

	// Wrap with scalar_map lookup: check map first, fall back to base conversion.
	// biome-ignore lint/suspicious/noExplicitAny: runtime dispatch across number/bigint boundary
	const fn = (v: any) => {
		const mapped = scalarMapLookup(v, mapEntries);
		if (mapped !== undefined) return mapped;
		return baseFn(v);
	};

	return fn as (value: Scalar<Src>) => Scalar<Dst>;
}
