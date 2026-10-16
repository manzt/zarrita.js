import type { CastValueConfig } from "./codecs/cast_value.js";
import type { ScaleOffsetConfig } from "./codecs/scale_offset.js";
import { InvalidMetadataError } from "./errors.js";
import type {
	ArrayMetadata,
	ArrayMetadataV2,
	BigintDataType,
	Bool,
	CodecMetadata,
	DataType,
	GroupMetadata,
	NumberDataType,
	ObjectType,
	Scalar,
	StringDataType,
	Struct,
	StructScalar,
	TypedArrayConstructor,
} from "./metadata.js";
import {
	BoolArray,
	ByteStringArray,
	StructArray,
	UnicodeStringArray,
} from "./typedarray.js";

export function jsonEncodeObject(o: Record<string, unknown>): Uint8Array {
	const str = JSON.stringify(
		o,
		(_key, value) => {
			// JSON.stringify converts NaN/Infinity/-Infinity to null.
			// Zarr v3 spec requires these as string representations.
			if (typeof value === "number") {
				if (Number.isNaN(value)) return "NaN";
				if (value === Infinity) return "Infinity";
				if (value === -Infinity) return "-Infinity";
			}
			return value;
		},
		2,
	);
	return new TextEncoder().encode(str);
}

export function assertSharedArrayBufferAvailable(): void {
	if (typeof SharedArrayBuffer === "undefined") {
		throw new Error(
			"SharedArrayBuffer is not available. " +
				"In browsers, this requires Cross-Origin-Opener-Policy and " +
				"Cross-Origin-Embedder-Policy headers to be set.",
		);
	}
}

export function createBuffer(
	byteLength: number,
	useShared?: boolean,
): ArrayBufferLike {
	if (useShared) {
		return new SharedArrayBuffer(byteLength);
	}
	return new ArrayBuffer(byteLength);
}

export function jsonDecodeObject(bytes: Uint8Array) {
	const str = new TextDecoder().decode(bytes);
	try {
		return JSON.parse(str);
	} catch (cause) {
		throw new InvalidMetadataError("Failed to decode JSON", { cause });
	}
}

export function byteswapInplace(view: Uint8Array, bytesPerElement: number) {
	const numFlips = bytesPerElement / 2;
	const endByteIndex = bytesPerElement - 1;
	let t = 0;
	for (let i = 0; i < view.length; i += bytesPerElement) {
		for (let j = 0; j < numFlips; j += 1) {
			t = view[i + j];
			view[i + j] = view[i + endByteIndex - j];
			view[i + endByteIndex - j] = t;
		}
	}
}

export function getCtr<D extends DataType>(
	dataType: D,
): TypedArrayConstructor<D> {
	if (dataType === "v2:object") {
		return globalThis.Array as unknown as TypedArrayConstructor<D>;
	}
	if (typeof dataType !== "string") {
		if (dataType?.name !== "struct") {
			throw new InvalidMetadataError(
				`Unknown or unsupported dataType: ${JSON.stringify(dataType)}`,
			);
		}
		// Validates the fields, so that an unsupported one fails here.
		new StructArray(dataType, 0);
		// @ts-expect-error - the bound constructor matches TypedArrayConstructor
		return StructArray.bind(null, dataType);
	}
	let match = dataType.match(/v2:([US])(\d+)/);
	if (match) {
		let [, kind, chars] = match;
		// @ts-expect-error
		return (kind === "U" ? UnicodeStringArray : ByteStringArray).bind(
			null,
			Number(chars),
		);
	}
	// Handle v3 variable-length string type
	if (dataType === "string") {
		return globalThis.Array as unknown as TypedArrayConstructor<D>;
	}
	// @ts-expect-error - We've checked that the key exists
	let ctr: TypedArrayConstructor<D> | undefined = (
		{
			int8: Int8Array,
			int16: Int16Array,
			int32: Int32Array,
			int64: globalThis.BigInt64Array,
			uint8: Uint8Array,
			uint16: Uint16Array,
			uint32: Uint32Array,
			uint64: globalThis.BigUint64Array,
			float16: globalThis.Float16Array,
			float32: Float32Array,
			float64: Float64Array,
			bool: BoolArray,
		} as const
	)[dataType];
	if (!ctr) {
		throw new InvalidMetadataError(
			`Unknown or unsupported dataType: ${dataType}`,
		);
	}
	return ctr;
}

/** Compute strides for 'C' or 'F' ordered array from shape */
export function getStrides(
	shape: readonly number[],
	order: "C" | "F" | Array<number>,
): Array<number> {
	const rank = shape.length;
	if (typeof order === "string") {
		order =
			order === "C"
				? Array.from({ length: rank }, (_, i) => i) // Row-major (identity order)
				: Array.from({ length: rank }, (_, i) => rank - 1 - i); // Column-major (reverse order)
	}
	assert(
		rank === order.length,
		"Order length must match the number of dimensions.",
	);

	let step = 1;
	let stride = new Array(rank);
	for (let i = order.length - 1; i >= 0; i--) {
		stride[order[i]] = step;
		step *= shape[order[i]];
	}

	return stride;
}

// https://zarr-specs.readthedocs.io/en/latest/v3/core/v3.0.html#chunk-key-encoding
export function createChunkKeyEncoder({
	name,
	configuration,
}: ArrayMetadata["chunk_key_encoding"]): (chunkCoords: number[]) => string {
	if (name === "default") {
		const separator = configuration?.separator ?? "/";
		return (chunkCoords) => ["c", ...chunkCoords].join(separator);
	}
	if (name === "v2") {
		const separator = configuration?.separator ?? ".";
		return (chunkCoords) => chunkCoords.join(separator) || "0";
	}
	throw new InvalidMetadataError(`Unknown chunk key encoding: ${name}`);
}

function coerceDtype(
	dtype: string,
): { dataType: DataType } | { dataType: DataType; endian: "little" | "big" } {
	if (dtype === "|O") {
		return { dataType: "v2:object" };
	}

	let match = dtype.match(/^([<|>])(.*)$/);
	if (!match) {
		throw new InvalidMetadataError(`Invalid dtype: ${dtype}`);
	}

	let [, endian, rest] = match;
	let dataType =
		{
			b1: "bool",
			i1: "int8",
			u1: "uint8",
			i2: "int16",
			u2: "uint16",
			i4: "int32",
			u4: "uint32",
			i8: "int64",
			u8: "uint64",
			f2: "float16",
			f4: "float32",
			f8: "float64",
		}[rest] ??
		(rest.startsWith("S") || rest.startsWith("U") ? `v2:${rest}` : undefined);
	if (!dataType) {
		throw new InvalidMetadataError(`Unsupported or unknown dtype: ${dtype}`);
	}
	if (endian === "|") {
		return { dataType } as { dataType: DataType };
	}
	return { dataType, endian: endian === "<" ? "little" : "big" } as {
		dataType: DataType;
		endian: "little" | "big";
	};
}

type FixedScaleOffsetConfig = {
	id: "fixedscaleoffset" | "numcodecs.fixedscaleoffset";
	scale: number;
	offset: number;
	// `astype` is technically optional in numcodecs (defaults to `dtype`),
	// so consumers must fall back before using it as a cast target.
	astype?: string;
	dtype?: string;
};

function isFixedScaleOffsetConfig(
	filter: { id: string } & Record<string, unknown>,
): filter is FixedScaleOffsetConfig {
	return (
		(filter.id === "fixedscaleoffset" ||
			filter.id === "numcodecs.fixedscaleoffset") &&
		typeof filter.scale === "number" &&
		typeof filter.offset === "number" &&
		(filter.astype === undefined || typeof filter.astype === "string") &&
		(filter.dtype === undefined || typeof filter.dtype === "string")
	);
}

export function v2ToV3ArrayMetadata(
	meta: ArrayMetadataV2,
	attributes: Record<string, unknown> = {},
): ArrayMetadata<DataType> {
	let codecs: CodecMetadata[] = [];
	let dtype = coerceDtype(meta.dtype);
	if (meta.order === "F") {
		codecs.push({ name: "transpose", configuration: { order: "F" } });
	}
	for (let filter of meta.filters ?? []) {
		// Translate the numcodecs `fixedscaleoffset` filter into the native v3
		// `scale_offset` + `cast_value` pair from #395. The v2 filter is not
		// part of the zarr v3 spec (see discussion in
		// https://github.com/manzt/zarrita.js/pull/312), but together these
		// two codecs implement the same decode semantics:
		//   (enc / scale + offset).astype(dtype)
		// where `dtype` is the logical (decoded) data type the user sees and
		// `astype` is the quantized on-disk data type.
		if (
			filter.id === "fixedscaleoffset" ||
			filter.id === "numcodecs.fixedscaleoffset"
		) {
			if (!isFixedScaleOffsetConfig(filter)) {
				throw new InvalidMetadataError(
					`Invalid fixedscaleoffset filter: ${JSON.stringify(filter)}`,
				);
			}
			codecs.push({
				name: "scale_offset",
				configuration: {
					scale: filter.scale,
					offset: filter.offset,
				} satisfies ScaleOffsetConfig,
			});
			// `astype` defaults to `dtype` in numcodecs, meaning an identity
			// cast. Skip `cast_value` entirely in that case — and also when
			// `astype` equals the logical v2 dtype, since there's nothing to
			// convert.
			let astype = filter.astype ?? filter.dtype;
			if (astype !== undefined && astype !== meta.dtype) {
				let castTarget = coerceDtype(astype).dataType;
				if (
					!isDataType(castTarget, "number") &&
					!isDataType(castTarget, "bigint")
				) {
					throw new InvalidMetadataError(
						`fixedscaleoffset astype must be a numeric data type, got ${astype}`,
					);
				}
				codecs.push({
					name: "cast_value",
					configuration: {
						data_type: castTarget,
						// `np.around` uses banker's rounding (round-half-to-even).
						rounding: "nearest-even",
						// Matches de-facto numpy integer-overflow behavior.
						out_of_range: "wrap",
					} satisfies CastValueConfig,
				});
			}
			continue;
		}
		let { id, ...configuration } = filter;
		codecs.push({ name: `numcodecs.${id}`, configuration });
	}
	// The `bytes` codec must come *after* any array-to-array codecs that
	// change the data type (e.g. `cast_value`) so that the pipeline's
	// currentMeta has been threaded through `getEncodedMeta` by the time
	// `BytesCodec.fromConfig` sees it. Relative order does not matter for
	// type-preserving codecs like `delta` or `transpose`.
	if ("endian" in dtype && dtype.endian === "big") {
		codecs.push({ name: "bytes", configuration: { endian: "big" } });
	}
	if (meta.compressor) {
		let { id, ...configuration } = meta.compressor;
		codecs.push({ name: `numcodecs.${id}`, configuration });
	}
	let dimensionNames: string[] | undefined;
	if (globalThis.Array.isArray(attributes._ARRAY_DIMENSIONS)) {
		dimensionNames = attributes._ARRAY_DIMENSIONS;
	}
	return {
		zarr_format: 3,
		node_type: "array",
		shape: meta.shape,
		data_type: dtype.dataType,
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
		dimension_names: dimensionNames,
		attributes,
	};
}

export function v2ToV3GroupMetadata(
	_meta: unknown,
	attributes: Record<string, unknown> = {},
): GroupMetadata {
	return {
		zarr_format: 3,
		node_type: "group",
		attributes,
	};
}

export type DataTypeQuery =
	| DataType
	| "boolean"
	| "number"
	| "bigint"
	| "object"
	| "string"
	| "struct";

export type NarrowDataType<
	Dtype extends DataType,
	Query extends DataTypeQuery,
> = Query extends "number"
	? NumberDataType
	: Query extends "bigint"
		? BigintDataType
		: Query extends "boolean"
			? Bool
			: Query extends "string"
				? StringDataType
				: Query extends "object"
					? ObjectType
					: Query extends "struct"
						? Struct
						: Extract<Query, Dtype>;

export function isDataType<Query extends DataTypeQuery>(
	dtype: DataType,
	query: Query,
): dtype is NarrowDataType<DataType, Query> {
	if (
		query !== "number" &&
		query !== "bigint" &&
		query !== "boolean" &&
		query !== "object" &&
		query !== "string" &&
		query !== "struct"
	) {
		return dtype === query;
	}
	// A struct is the one data type that is not a string. Metadata can hold
	// other objects, which no query matches.
	if (typeof dtype !== "string") {
		return query === "struct" && dtype?.name === "struct";
	}
	if (query === "struct") return false;
	let isBoolean = dtype === "bool";
	if (query === "boolean") return isBoolean;
	let isString =
		dtype.startsWith("v2:U") || dtype.startsWith("v2:S") || dtype === "string";
	if (query === "string") return isString;
	let isBigint = dtype === "int64" || dtype === "uint64";
	if (query === "bigint") return isBigint;
	let isObject = dtype === "v2:object";
	if (query === "object") return isObject;
	return !isString && !isBigint && !isBoolean && !isObject;
}

export type ShardingCodecMetadata = {
	name: "sharding_indexed";
	configuration: {
		chunk_shape: number[];
		codecs: CodecMetadata[];
		index_codecs: CodecMetadata[];
	};
};

export function isShardingCodec(
	codec: CodecMetadata,
): codec is ShardingCodecMetadata {
	return codec?.name === "sharding_indexed";
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: necessary for null byte removal
const NULL_BYTES = /\x00/g;

function decodeBase64(text: string): Uint8Array {
	return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

const SPECIAL_FLOATS: Record<string, number> = {
	NaN: NaN,
	Infinity: Infinity,
	"-Infinity": -Infinity,
};

/**
 * Convert the fill value of a struct, as it is in the metadata document,
 * into the value of each field.
 *
 * This is done once, when the document is read: a byte string field holds
 * base64 there, which cannot be told from its decoded value.
 */
export function structFillValue(dataType: Struct, fill: unknown): StructScalar {
	if (typeof fill === "string") {
		// Arrays written before `struct` was registered hold the packed bytes
		// of one record, base64-encoded and little-endian.
		let bytes = decodeBase64(fill);
		return new StructArray(dataType, bytes.buffer, 0, 1).get(0);
	}
	if (typeof fill !== "object" || fill === null) {
		throw new InvalidMetadataError(
			`Invalid fill value for a struct: ${JSON.stringify(fill)}`,
		);
	}
	let record: StructScalar = {};
	for (let { name, data_type } of dataType.configuration.fields) {
		let value = (fill as Record<string, unknown>)[name];
		if (value === undefined) {
			throw new InvalidMetadataError(
				`The fill value of a struct needs a value for field ${JSON.stringify(name)}`,
			);
		}
		if (typeof data_type !== "string") {
			if (data_type.name === "struct") {
				record[name] = structFillValue(data_type, value);
			} else if (data_type.name === "null_terminated_bytes") {
				record[name] = new TextDecoder()
					.decode(decodeBase64(String(value)))
					.replace(NULL_BYTES, "");
			} else {
				record[name] = String(value);
			}
		} else if (data_type === "int64" || data_type === "uint64") {
			record[name] = BigInt(value as number);
		} else if (typeof value === "string" && value in SPECIAL_FLOATS) {
			record[name] = SPECIAL_FLOATS[value];
		} else {
			record[name] = value as number | boolean;
		}
	}
	return record;
}

/**
 * Bring a v3 data type into the form the rest of zarrita expects.
 *
 * `structured` is the name `struct` had before it was registered, with
 * fields as `[name, data_type]` pairs. It is read as a `struct`.
 */
export function normalizeDataType(dataType: unknown): DataType {
	if (typeof dataType !== "object" || dataType === null) {
		return dataType as DataType;
	}
	let { name, configuration } = dataType as {
		name?: string;
		configuration?: { fields?: unknown };
	};
	if (name !== "struct" && name !== "structured") {
		return dataType as DataType;
	}
	if (!globalThis.Array.isArray(configuration?.fields)) {
		throw new InvalidMetadataError("A struct data type needs fields");
	}
	let fields = configuration.fields.map((field) => {
		let [fieldName, fieldType] = globalThis.Array.isArray(field)
			? field
			: [field?.name, field?.data_type];
		return { name: fieldName, data_type: normalizeDataType(fieldType) };
	});
	return { name: "struct", configuration: { fields } } as Struct;
}

export function ensureCorrectScalar<D extends DataType>(
	metadata: ArrayMetadata<D>,
): Scalar<D> | null {
	// The fill value of a struct is converted when its metadata is read.
	if (typeof metadata.data_type !== "string") return metadata.fill_value;
	if (
		(metadata.data_type === "uint64" || metadata.data_type === "int64") &&
		metadata.fill_value != null
	) {
		// @ts-expect-error - We've narrowed the type of fill_value correctly
		return BigInt(metadata.fill_value) as Scalar<D>;
	}
	// Zarr v3 represents IEEE 754 special float values as strings in JSON.
	// Only applies to floating-point types.
	let isFloat =
		metadata.data_type === "float16" ||
		metadata.data_type === "float32" ||
		metadata.data_type === "float64";
	if (typeof metadata.fill_value === "string" && isFloat) {
		let mapping: Record<string, number> = {
			NaN: NaN,
			Infinity: Infinity,
			"-Infinity": -Infinity,
		};
		if (metadata.fill_value in mapping) {
			return mapping[metadata.fill_value] as Scalar<D>;
		}
	}
	return metadata.fill_value;
}

// biome-ignore lint/suspicious/noExplicitAny: Necessary for type inference
type InstanceType<T> = T extends new (...args: any[]) => infer R ? R : never;

// biome-ignore lint/suspicious/noExplicitAny: Abstract base type
type ErrorConstructor = new (...args: any[]) => Error;

/**
 * Ensures an error matches expected type(s), otherwise rethrows.
 *
 * Unmatched errors bubble up, like Python's `except`. Narrows error types for
 * type-safe property access.
 *
 * @see {@link https://gist.github.com/manzt/3702f19abb714e21c22ce48851c75abf}
 *
 * @example
 * ```ts
 * class DatabaseError extends Error { }
 * class NetworkError extends Error { }
 *
 * try {
 *   await db.query();
 * } catch (err) {
 *   rethrowUnless(err, DatabaseError, NetworkError);
 *   err // DatabaseError | NetworkError
 * }
 * ```
 *
 * @param error - The error to check
 * @param errors - Expected error type(s)
 * @throws The original error if it doesn't match expected type(s)
 */
/**
 * Merge a first-class `signal` with the deprecated `opts.signal` shim.
 * If both are set, the signals are combined via `AbortSignal.any` so that
 * aborting either cancels the request.
 */
export function resolveSignal(opts: {
	signal?: AbortSignal;
	opts?: { signal?: AbortSignal };
}): AbortSignal | undefined {
	let a = opts.signal;
	let b = opts.opts?.signal;
	if (a && b) return AbortSignal.any([a, b]);
	return a ?? b;
}

export function rethrowUnless<E extends ReadonlyArray<ErrorConstructor>>(
	error: unknown,
	...errors: E
): asserts error is InstanceType<E[number]> {
	if (!errors.some((ErrorClass) => error instanceof ErrorClass)) {
		throw error;
	}
}

/**
 * Make an assertion.
 *
 * Usage
 * @example
 * ```ts
 * const value: boolean = Math.random() <= 0.5;
 * assert(value, "value is greater than than 0.5!");
 * value // true
 * ```
 *
 * @param expression - The expression to test.
 * @param msg - The optional message to display if the assertion fails.
 * @throws an {@link Error} if `expression` is not truthy.
 */
export function assert(
	expression: unknown,
	msg: string | undefined = "",
): asserts expression {
	if (!expression) {
		throw new Error(msg);
	}
}

/**
 * Decompress data using the given format via the Web Streams API.
 * Views backed by a SharedArrayBuffer are copied into a regular ArrayBuffer
 * since the Response constructor does not accept shared memory.
 */
export async function decompress(
	data: ArrayBuffer | ArrayBufferView,
	{ format, signal }: { format: CompressionFormat; signal?: AbortSignal },
): Promise<ArrayBuffer> {
	let response: Response;
	if (data instanceof ArrayBuffer) {
		response = new Response(data);
	} else {
		let bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
		response = new Response(bytes.slice().buffer);
	}
	assert(response.body, "Response does not contain body.");
	try {
		const decompressedResponse = new Response(
			response.body.pipeThrough(new DecompressionStream(format), { signal }),
		);
		const buffer = await decompressedResponse.arrayBuffer();
		return buffer;
	} catch {
		signal?.throwIfAborted();
		throw new Error(`Failed to decode ${format}`);
	}
}
