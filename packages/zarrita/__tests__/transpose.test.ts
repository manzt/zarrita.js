import { describe, expect, it } from "vitest";
import { TransposeCodec } from "../src/codecs/transpose.js";
import * as zarr from "../src/index.js";

/** Read a chunk's values in logical (C) order, honoring its strides. */
function toLogical<D extends zarr.DataType>(chunk: zarr.Chunk<D>): unknown[] {
	let { data, shape, stride } = chunk;
	let total = shape.reduce((a, b) => a * b, 1);
	let index = new globalThis.Array(shape.length).fill(0);
	let out: unknown[] = [];
	for (let n = 0; n < total; n++) {
		let offset = index.reduce((acc, v, d) => acc + v * stride[d], 0);
		out.push((data as ArrayLike<unknown>)[offset]);
		for (let d = shape.length - 1; d >= 0; d--) {
			if (++index[d] < shape[d]) break;
			index[d] = 0;
		}
	}
	return out;
}

async function make(codecs: zarr.CodecMetadata[]) {
	let arr = await zarr.create(zarr.root(new Map()).resolve("/a"), {
		shape: [4, 4, 4],
		chunkShape: [2, 2, 2],
		dtype: "uint8",
		codecs,
	});
	// element (i,j,k) = 16*i + 4*j + k
	let full = new Uint8Array(64).map((_, i) => i);
	await zarr.set(arr, null, {
		data: full,
		shape: [4, 4, 4],
		stride: [16, 4, 1],
	});
	return arr;
}

describe("transpose codec", () => {
	// Integer indexing drops dimensions, so the output rank is lower than the
	// transpose order's rank. The output strides must not blow up on that
	// mismatch. See https://github.com/manzt/zarrita.js/issues/427.
	it("reads slices that drop dimensions from a transposed array", async () => {
		let plain = await make([
			{ name: "bytes", configuration: { endian: "little" } },
		]);
		let transposed = await make([
			{ name: "transpose", configuration: { order: [2, 1, 0] } },
			{ name: "bytes", configuration: { endian: "little" } },
		]);

		let selections = [
			[0, null, null],
			[null, 1, null],
			[null, null, 2],
			[0, 1, null],
			[1, null, 2],
		];

		for (let sel of selections) {
			let expected = await zarr.get(plain, sel);
			let actual = await zarr.get(transposed, sel);
			expect(actual.shape, JSON.stringify(sel)).toEqual(expected.shape);
			// Compare logically — the transposed array's output layout differs
			// from the plain array's, but the values at each coordinate match.
			expect(toLogical(actual), JSON.stringify(sel)).toEqual(
				toLogical(expected),
			);
		}
	});

	// A full read of a transposed array returns data in its native order:
	// for order [2,1,0] on shape [4,4,4] the stride is [1,4,16]. A read that
	// drops a dimension should stay consistent and return the native order
	// *projected* onto the surviving axes, not silently fall back to
	// C-contiguous. Dropping axis 0 keeps axes [1,2], whose relative order in
	// [2,1,0] is [2,1] -> projected order [1,0] -> stride [1,4].
	// `decode` describes the stored bytes as being laid out in `order`, so
	// `encode` has to produce that same layout. It converted to the inverse
	// permutation, which is the same thing only when the order is its own
	// inverse — as [2,1,0] and "C"/"F" are, so nothing here caught it.
	it("round trips an order that is not its own inverse", async () => {
		for (let order of [
			[2, 0, 1],
			[1, 2, 0],
		]) {
			let arr = await make([
				{ name: "transpose", configuration: { order } },
				{ name: "bytes", configuration: { endian: "little" } },
			]);
			let whole = await zarr.get(arr, null);
			expect(toLogical(whole), JSON.stringify(order)).toEqual([
				...globalThis.Array(64).keys(),
			]);
		}
	});

	// Building the transposed copy used `chunk.constructor` — `Object`, since a
	// chunk is a plain object — rather than the constructor of its data, so the
	// copy was a Number wrapper, every write to it was dropped, and a zero byte
	// chunk was stored.
	it("writes a chunk of the expected size when it has to reorder", async () => {
		let store = new Map<string, Uint8Array>();
		let arr = await zarr.create(zarr.root(store).resolve("/a"), {
			shape: [2, 3, 4],
			chunkShape: [2, 3, 4],
			dtype: "int32",
			codecs: [
				{ name: "transpose", configuration: { order: [2, 0, 1] } },
				{ name: "bytes", configuration: { endian: "little" } },
			],
		});
		let data = new Int32Array(24).map((_, i) => i);
		await zarr.set(arr, null, { data, shape: [2, 3, 4], stride: [12, 4, 1] });
		expect(store.get("/a/c/0/0/0")?.length).toBe(24 * 4);
	});

	// The copy walked `src` linearly, which assumes it is laid out with the
	// first axis fastest. It is reached whenever the chunk handed to `encode`
	// is not already in the target layout — including when two strides tie,
	// which a length-1 dimension causes.
	it("encodes a chunk that is not already in the target layout", () => {
		// (i,j) holds 3i + j, laid out C-contiguous
		let data = new Int32Array(6).map((_, i) => i);
		let codec = new TransposeCodec({ order: [1, 0] }, { shape: [2, 3] });
		let out = codec.encode({ data, shape: [2, 3], stride: [3, 1] });
		expect(out.stride).toEqual([1, 2]);
		expect(globalThis.Array.from(out.data as Int32Array)).toEqual([
			0, 3, 1, 4, 2, 5,
		]);
	});

	it("preserves native order on dimension-reducing reads", async () => {
		let transposed = await make([
			{ name: "transpose", configuration: { order: [2, 1, 0] } },
			{ name: "bytes", configuration: { endian: "little" } },
		]);

		let whole = await zarr.get(transposed, null);
		expect(whole.stride).toEqual([1, 4, 16]);

		let slice = await zarr.get(transposed, [0, null, null]);
		expect(slice.stride).toEqual([1, 4]);
	});
});
