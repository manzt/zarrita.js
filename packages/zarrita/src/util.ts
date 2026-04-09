import { JsonDecodeError } from "./errors.js";
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
	TypedArrayConstructor,
} from "./metadata.js";
import {
	BoolArray,
	ByteStringArray,
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
		throw new JsonDecodeError(cause);
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
	assert(ctr, `Unknown or unsupported dataType: ${dataType}`);
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
	throw new Error(`Unknown chunk key encoding: ${name}`);
}

function coerceDtype(
	dtype: string,
): { dataType: DataType } | { dataType: DataType; endian: "little" | "big" } {
	if (dtype === "|O") {
		return { dataType: "v2:object" };
	}

	let match = dtype.match(/^([<|>])(.*)$/);
	assert(match, `Invalid dtype: ${dtype}`);

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
	assert(dataType, `Unsupported or unknown dtype: ${dtype}`);
	if (endian === "|") {
		return { dataType } as { dataType: DataType };
	}
	return { dataType, endian: endian === "<" ? "little" : "big" } as {
		dataType: DataType;
		endian: "little" | "big";
	};
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
	if ("endian" in dtype && dtype.endian === "big") {
		codecs.push({ name: "bytes", configuration: { endian: "big" } });
	}
	for (let { id, ...configuration } of meta.filters ?? []) {
		codecs.push({ name: `numcodecs.${id}`, configuration });
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
	| "string";

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
					: Extract<Query, Dtype>;

export function isDtype<Query extends DataTypeQuery>(
	dtype: DataType,
	query: Query,
): dtype is NarrowDataType<DataType, Query> {
	if (
		query !== "number" &&
		query !== "bigint" &&
		query !== "boolean" &&
		query !== "object" &&
		query !== "string"
	) {
		return dtype === query;
	}
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

export function ensureCorrectScalar<D extends DataType>(
	metadata: ArrayMetadata<D>,
): Scalar<D> | null {
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
export function isAbortable(opts: unknown): opts is { signal: AbortSignal } {
	return (
		opts != null &&
		typeof opts === "object" &&
		"signal" in opts &&
		opts.signal instanceof AbortSignal
	);
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
