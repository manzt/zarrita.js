import {
	BoolArray,
	ByteStringArray as _ByteStringArray,
	UnicodeStringArray as _UnicodeStringArray,
} from "@zarrita/typedarray";

import type {
	ArrayMetadata,
	Chunk,
	ChunkQueue,
	DataType,
	DataTypeQuery,
	Indices,
	NarrowDataType,
	Slice,
	TypedArray,
	TypedArrayConstructor,
} from "./types.js";

import { registry } from "./codec-registry.js";
import type { Codec } from "numcodecs";

export function json_encode_object(o: Record<string, any>): Uint8Array {
	const str = JSON.stringify(o, null, 2);
	return new TextEncoder().encode(str);
}

export function json_decode_object(bytes: Uint8Array) {
	const str = new TextDecoder().decode(bytes);
	return JSON.parse(str);
}

function system_is_little_endian(): boolean {
	const a = new Uint32Array([0x12345678]);
	const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
	return !(b[0] === 0x12);
}

export const LITTLE_ENDIAN_OS = system_is_little_endian();

export const should_byteswap = (dtype: DataType) =>
	LITTLE_ENDIAN_OS && dtype[0] === ">";

export function byteswap_inplace(src: TypedArray<DataType>) {
	if (src instanceof _UnicodeStringArray) {
		src = (src as any)._data as Int32Array;
	}
	if (!("BYTES_PER_ELEMENT" in src)) {
		return;
	}
	const b = src.BYTES_PER_ELEMENT;
	const flipper = new Uint8Array(src.buffer, src.byteOffset, src.length * b);
	const numFlips = b / 2;
	const endByteIndex = b - 1;
	let t = 0;
	for (let i = 0; i < flipper.length; i += b) {
		for (let j = 0; j < numFlips; j += 1) {
			t = flipper[i + j];
			flipper[i + j] = flipper[i + endByteIndex - j];
			flipper[i + endByteIndex - j] = t;
		}
	}
}

export function ensure_array<T>(maybe_arr: T | T[]): T[] {
	return Array.isArray(maybe_arr) ? maybe_arr : [maybe_arr];
}

const CONSTRUCTORS = {
	int8: Int8Array,
	int16: Int16Array,
	int32: Int32Array,
	int64: globalThis.BigInt64Array,
	uint8: Uint8Array,
	uint16: Uint16Array,
	uint32: Uint32Array,
	uint64: globalThis.BigUint64Array,
	float32: Float32Array,
	float64: Float64Array,
	bool: BoolArray,
};

export function get_ctr<D extends DataType>(
	data_type: D,
): TypedArrayConstructor<D> {
	let ctr = (CONSTRUCTORS as any)[data_type];
	if (!ctr) {
		throw new Error(`Unknown or unsupported data_type: ${data_type}`);
	}
	return ctr as any;
}

/** Compute strides for 'C' or 'F' ordered array from shape */
export function get_strides(shape: readonly number[], order: "C" | "F") {
	return (order === "C" ? row_major_stride : col_major_stride)(shape);
}

function row_major_stride(shape: readonly number[]) {
	const ndim = shape.length;
	const stride: number[] = globalThis.Array(ndim);
	for (let i = ndim - 1, step = 1; i >= 0; i--) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

function col_major_stride(shape: readonly number[]) {
	const ndim = shape.length;
	const stride: number[] = globalThis.Array(ndim);
	for (let i = 0, step = 1; i < ndim; i++) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

/** Similar to python's `range` function. Supports positive ranges only. */
export function* range(
	start: number,
	stop?: number,
	step = 1,
): Iterable<number> {
	if (stop === undefined) {
		stop = start;
		start = 0;
	}
	for (let i = start; i < stop; i += step) {
		yield i;
	}
}

/**
 * python-like itertools.product generator
 * https://gist.github.com/cybercase/db7dde901d7070c98c48
 */
export function* product<T extends Array<Iterable<any>>>(
	...iterables: T
): IterableIterator<
	{ [K in keyof T]: T[K] extends Iterable<infer U> ? U : never }
> {
	if (iterables.length === 0) {
		return;
	}
	// make a list of iterators from the iterables
	const iterators = iterables.map((it) => it[Symbol.iterator]());
	const results = iterators.map((it) => it.next());
	if (results.some((r) => r.done)) {
		throw new Error("Input contains an empty iterator.");
	}
	for (let i = 0;;) {
		if (results[i].done) {
			// reset the current iterator
			iterators[i] = iterables[i][Symbol.iterator]();
			results[i] = iterators[i].next();
			// advance, and exit if we've reached the end
			if (++i >= iterators.length) {
				return;
			}
		} else {
			yield results.map(({ value }) => value) as any;
			i = 0;
		}
		results[i] = iterators[i].next();
	}
}

// https://github.com/python/cpython/blob/263c0dd16017613c5ea2fbfc270be4de2b41b5ad/Objects/sliceobject.c#L376-L519
function slice_indices(
	start: number | null,
	stop: number | null,
	step: number | null,
	length: number,
): Indices {
	if (step === 0) {
		throw new Error("slice step cannot be zero");
	}
	step = step ?? 1;
	const step_is_negative = step < 0;

	/* Find lower and upper bounds for start and stop. */
	const [lower, upper] = step_is_negative ? [-1, length - 1] : [0, length];

	/* Compute start. */
	if (start === null) {
		start = step_is_negative ? upper : lower;
	} else {
		if (start < 0) {
			start += length;
			if (start < lower) {
				start = lower;
			}
		} else if (start > upper) {
			start = upper;
		}
	}

	/* Compute stop. */
	if (stop === null) {
		stop = step_is_negative ? lower : upper;
	} else {
		if (stop < 0) {
			stop += length;
			if (stop < lower) {
				stop = lower;
			}
		} else if (stop > upper) {
			stop = upper;
		}
	}

	return [start, stop, step];
}

/** @category Utilty */
export function slice(stop: number | null): Slice;
export function slice(
	start: number | null,
	stop?: number | null,
	step?: number | null,
): Slice;
export function slice(
	start: number | null,
	stop?: number | null,
	step: number | null = null,
): Slice {
	if (stop === undefined) {
		stop = start;
		start = null;
	}
	return {
		start,
		stop,
		step,
		indices(length: number) {
			return slice_indices(this.start, this.stop, this.step, length);
		},
	};
}

/** Built-in "queue" for awaiting promises. */
export function create_queue(): ChunkQueue {
	const promises: Promise<void>[] = [];
	return {
		add: (fn) => promises.push(fn()),
		onIdle: () => Promise.all(promises),
	};
}

export function is_dtype<Query extends DataTypeQuery>(
	dtype: DataType,
	query: Query,
): dtype is NarrowDataType<DataType, Query> {
	// fuzzy match, e.g. 'u4'
	if (query.length < 3) {
		return dtype === `|${query}` || dtype === `>${query}` ||
			dtype === `<${query}`;
	}
	if (query !== "string" && query !== "number" && query !== "bigint") {
		return dtype === query;
	}

	let prefix = dtype[1];
	let nbytes = dtype.slice(2);

	let is_string = prefix === "S" || prefix === "U";
	if (query === "string") return is_string;

	let is_bigint = (prefix === "u" || prefix === "i") && nbytes === "8";
	if (query === "bigint") return is_bigint;

	// number
	return !is_string && !is_bigint;
}

export type CodecPipeline = ReturnType<typeof create_codec_pipeline>;

export function create_codec_pipeline(
	array_metadata: ArrayMetadata<DataType>,
	codec_registry: typeof registry = registry,
) {
	let codecs: Promise<Codec>[] | undefined;

	function init() {
		let metadata = array_metadata.codecs;

		if (metadata[0]?.name !== "transpose") {
			// TODO: first codec needs to be transpose?
			metadata = [
				{ name: "transpose", configuration: { order: "C" } },
				...metadata,
			];
		}

		return metadata.map(async (meta) => {
			let Codec = await codec_registry.get(meta.name)?.();
			if (!Codec) {
				throw new Error(`Unknown codec: ${meta.name}`);
			}
			// @ts-expect-error
			return Codec.fromConfig(meta.configuration, array_metadata);
		});
	}
	return {
		async encode<Dtype extends DataType>(
			data: TypedArray<Dtype>,
		): Promise<Uint8Array> {
			if (!codecs) codecs = init();
			for await (const codec of codecs) {
				data = codec.encode(data);
			}
			return data as Uint8Array;
		},
		async decode(bytes: Uint8Array): Promise<Chunk<DataType>> {
			if (!codecs) codecs = init();
			let data = bytes;
			for (let i = codecs.length - 1; i >= 0; i--) {
				let codec = await codecs[i];
				data = await codec.decode(data);
			}
			return data as any;
		},
	};
}

export function encode_chunk_key(
	chunk_coords: number[],
	{ name, configuration }: ArrayMetadata["chunk_key_encoding"],
): string {
	if (name === "default") {
		return ["c", ...chunk_coords].join(configuration.separator);
	}
	if (name === "v2") {
		return chunk_coords.join(configuration.separator) || "0";
	}
	throw new Error(`Unknown chunk key encoding: ${name}`);
}
