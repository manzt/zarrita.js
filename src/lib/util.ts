// deno-fmt-ignore
import { BoolArray, ByteStringArray as _ByteStringArray, UnicodeStringArray as _UnicodeStringArray } from "./custom-arrays";

import type {
	ChunkQueue,
	DataType,
	Indices,
	Slice,
	TypedArray,
	TypedArrayConstructor,
} from "../types";
import type { DataTypeQuery, IsDataType } from "../dtypes";

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

const LITTLE_ENDIAN_OS = system_is_little_endian();

export const should_byteswap = (dtype: DataType) => LITTLE_ENDIAN_OS && dtype[0] === ">";

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

const constructors = {
	u1: Uint8Array,
	i1: Int8Array,
	u2: Uint16Array,
	i2: Int16Array,
	u4: Uint32Array,
	i4: Int32Array,
	i8: globalThis.BigInt64Array,
	u8: globalThis.BigUint64Array,
	f4: Float32Array,
	f8: Float64Array,
	b1: BoolArray,
	U: _UnicodeStringArray,
	S: _ByteStringArray,
};

export function get_ctr<D extends DataType>(dtype: D): TypedArrayConstructor<D> {
	const second = dtype[1] as DataType extends `${infer _}${infer T}${infer _}` ? T
		: never;

	// dynamically create typed array, use named class so logging is nice
	if (second === "U") {
		const size = parseInt(dtype.slice(2));
		class UnicodeStringArray extends _UnicodeStringArray {
			constructor(x: ArrayBuffer | number) {
				super(x as any, size);
			}
		}
		return UnicodeStringArray as TypedArrayConstructor<D>;
	}

	// dynamically create typed array, use named class so logging is nice
	if (second === "S") {
		const size = parseInt(dtype.slice(2));
		class ByteStringArray extends _ByteStringArray {
			constructor(x: ArrayBuffer | number) {
				super(x as any, size);
			}
		}
		return ByteStringArray as TypedArrayConstructor<D>;
	}

	// get last two characters of three character DataType; can only be keyof DTYPES at the moment.
	const key = dtype.slice(1) as Exclude<keyof typeof constructors, "U" | "S">;
	const ctr = constructors[key];

	if (!ctr) {
		throw new Error(
			`dtype not supported either in zarrita or in browser! got ${dtype}.`,
		);
	}

	return ctr as TypedArrayConstructor<D>;
}

export async function encode_chunk<Dtype extends DataType>(
	arr: import("./hierarchy").Array<Dtype, any>,
	data: TypedArray<Dtype>,
): Promise<Uint8Array> {
	if (should_byteswap(arr.dtype)) {
		byteswap_inplace(data);
	}
	let bytes = new Uint8Array(data.buffer);
	for (const filter of arr.filters) {
		bytes = await filter.encode(bytes);
	}
	if (arr.compressor) {
		bytes = await arr.compressor.encode(bytes);
	}
	return bytes;
}

export async function decode_chunk<Dtype extends DataType>(
	arr: import("./hierarchy").Array<Dtype, any>,
	bytes: Uint8Array,
): Promise<TypedArray<Dtype>> {
	if (arr.compressor) {
		bytes = await arr.compressor.decode(bytes);
	}

	// reverse through codecs
	for (var i = arr.filters.length - 1; i >= 0; i--) {
		bytes = await arr.filters[i].decode(bytes);
	}

	const data = new arr.TypedArray(bytes.buffer);

	if (should_byteswap(arr.dtype)) {
		byteswap_inplace(data);
	}

	return data;
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
export function* range(start: number, stop?: number, step = 1): Iterable<number> {
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
): IterableIterator<{ [K in keyof T]: T[K] extends Iterable<infer U> ? U : never }> {
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
): dtype is IsDataType<DataType, Query> {
	// fuzzy match, e.g. 'u4'
	if (query.length < 3) {
		return dtype === `|${query}` || dtype === `>${query}` || dtype === `<${query}`;
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
