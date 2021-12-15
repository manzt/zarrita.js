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

export const should_byte_swap = (dtype: DataType) => LITTLE_ENDIAN_OS && dtype[0] === ">";

export function byte_swap_inplace(src: TypedArray<DataType>) {
	if (!("BYTES_PER_ELEMENT" in src)) return;
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
		class UnicodeStringArray extends _UnicodeStringArray<typeof size> {
			constructor(x: ArrayBuffer | number) {
				super(x as any, size);
			}
		}
		return UnicodeStringArray as TypedArrayConstructor<D>;
	}

	// dynamically create typed array, use named class so logging is nice
	if (second === "S") {
		const size = parseInt(dtype.slice(2));
		class ByteStringArray extends _ByteStringArray<typeof size> {
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

export function* range(start: number, stop?: number, step = 1): Generator<number> {
	if (stop == undefined) {
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

/** @category Utilty */
export function slice(end: number | null): Slice;
export function slice(start: number, end: number | null): Slice;
export function slice(start: number, end: number | null, step: number | null): Slice;
export function slice(
	start: number | null,
	stop?: number | null,
	step: number | null = null,
): Slice {
	if (stop === undefined) {
		stop = start;
		start = null;
	}
	const indices = (length: number): Indices => {
		const istep = step ?? 1;
		let start_ix = start ?? (istep < 0 ? length - 1 : 0);
		let end_ix = stop ?? (istep < 0 ? -1 : length);
		if (start_ix < 0) start_ix += length;
		if (end_ix < 0) end_ix += length;
		return [start_ix, end_ix, istep];
	};
	return { start, stop, step, indices, kind: "slice" };
}

/** Built-in "queue" for awaiting promises. */
export function create_queue(): ChunkQueue {
	const promises: Promise<void>[] = [];
	return {
		add: (fn) => promises.push(fn()),
		onIdle: () => Promise.all(promises),
	};
}
