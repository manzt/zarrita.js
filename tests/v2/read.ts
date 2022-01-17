import { suite } from "uvu";
import * as assert from "uvu/assert";

import { get_group, get_array } from "../../src/v2";
import { get as ndget } from "../../src/ndarray";
import { get } from "../../src/ops";

import { range } from "../../src/lib/util";

import FSStore from "../../src/storage/fs";
import { BoolArray, ByteStringArray, UnicodeStringArray } from "../../src/lib/custom-arrays";

import * as path from "node:path";

let root = path.resolve(__dirname, "data.zarr");
let store = new FSStore(root);

let contiguous = suite("contiguous");

contiguous("1d.contiguous.zlib.i2", async () => {
	let arr = await get_array(store, "/1d.contiguous.zlib.i2");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Int16Array([1, 2, 3, 4]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.blosc.i2", async () => {
	let arr = await get_array(store, "/1d.contiguous.blosc.i2");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Int16Array([1, 2, 3, 4]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.lz4.i2", async () => {
	let arr = await get_array(store, "/1d.contiguous.lz4.i2");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Int16Array([1, 2, 3, 4]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.zstd.i2", async () => {
	let arr = await get_array(store, "/1d.contiguous.zstd.i2");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Int16Array([1, 2, 3, 4]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.raw.i2", async () => {
	let arr = await get_array(store, "/1d.contiguous.raw.i2");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Int16Array([1, 2, 3, 4]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.i4", async () => {
	let arr = await get_array(store, "/1d.contiguous.i4");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Int32Array([1, 2, 3, 4]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.u1", async () => {
	let arr = await get_array(store, "/1d.contiguous.u1");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Uint8Array([255, 0, 255, 0]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.f4.le", async () => {
	let arr = await get_array(store, "/1d.contiguous.f4.le");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Float32Array([-1000.5, 0, 1000.5, 0]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.f4.be", async () => {
	let arr = await get_array(store, "/1d.contiguous.f4.be");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Float32Array([-1000.5, 0, 1000.5, 0]));
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.f8", async () => {
	let arr = await get_array(store, "/1d.contiguous.f8");
	let chunk = await arr.get_chunk([0]);
	assert.equal(chunk.data, new Float64Array([1.5, 2.5, 3.5, 4.5]));
	assert.equal(chunk.shape, [4]);
})

contiguous("1d.contiguous.U13.le", async () => {
	let arr = await get_array(store, "/1d.contiguous.U13.le");
	let chunk = await arr.get_chunk([0]);
	assert.instance(chunk.data, UnicodeStringArray);
	assert.equal(Array.from(chunk.data as UnicodeStringArray<13>), ['a', 'b', 'cc', 'd']);
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.U13.be", async () => {
	let arr = await get_array(store, "/1d.contiguous.U13.be");
	let chunk = await arr.get_chunk([0]);
	assert.instance(chunk.data, UnicodeStringArray);
	assert.equal(Array.from(chunk.data as UnicodeStringArray<14>), ['a', 'b', 'cc', 'd']);
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.U7", async () => {
	let arr = await get_array(store, "/1d.contiguous.U7");
	let chunk = await arr.get_chunk([0]);
	assert.instance(chunk.data, UnicodeStringArray);
	assert.equal(Array.from(chunk.data as UnicodeStringArray<7>), ['a', 'b', 'cc', 'd']);
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.S7", async () => {
	let arr = await get_array(store, "/1d.contiguous.S7");
	let chunk = await arr.get_chunk([0]);
	assert.instance(chunk.data, ByteStringArray);
	assert.equal(Array.from(chunk.data as ByteStringArray<7>), ['a', 'b', 'cc', 'd']);
	assert.equal(chunk.shape, [4]);
});

contiguous("1d.contiguous.b1", async () => {
	let arr = await get_array(store, "/1d.contiguous.b1");
	let chunk = await arr.get_chunk([0]);
	assert.instance(chunk.data, BoolArray);
	assert.equal(Array.from(chunk.data as BoolArray), [true, false, true, false]);
	assert.equal(chunk.shape, [4]);
});

contiguous("2d.contiguous.i2", async () => {
	let arr = await get_array(store, "/2d.contiguous.i2");
	let chunk = await arr.get_chunk([0, 0]);
	assert.equal(chunk.data, new Int16Array([1, 2, 3, 4]));
	assert.equal(chunk.shape, [2, 2]);
});

contiguous("3d.contiguous.i2", async () => {
	let arr = await get_array(store, "/3d.contiguous.i2");
	let chunk = await arr.get_chunk([0, 0, 0]);
	assert.equal(chunk.data, new Int16Array(range(27)));
	assert.equal(chunk.shape, [3, 3, 3]);
})

contiguous.run();



let chunked = suite('chunked');

chunked("1d.chunked.i2", async () => {
	let arr = await get_array(store, "/1d.chunked.i2");
	let [c1, c2] = await Promise.all([
		arr.get_chunk([0]),
		arr.get_chunk([1]),
	]);
	assert.equal(c1.data, new Int16Array([1, 2]));
	assert.equal(c1.shape, [2]);
	assert.equal(c2.data, new Int16Array([3, 4]));
	assert.equal(c2.shape, [2]);
});

chunked("1d.chunked.ragged.i2", async () => {
	let arr = await get_array(store, "/1d.chunked.ragged.i2");
	let [c1, c2, c3] = await Promise.all([
		arr.get_chunk([0]),
		arr.get_chunk([1]),
		arr.get_chunk([2]),
	]);
	assert.equal(c1.data, new Int16Array([1, 2]));
	assert.equal(c1.shape, [2]);
	assert.equal(c2.data, new Int16Array([3, 4]));
	assert.equal(c2.shape, [2]);
	assert.equal(c3.data, new Int16Array([5, 0]));
	assert.equal(c3.shape, [2]);
});

chunked("2d.chunked.i2", async () => {
	let arr = await get_array(store, "/2d.chunked.i2");
	let [c1, c2, c3, c4] = await Promise.all([
		arr.get_chunk([0, 0]),
		arr.get_chunk([0, 1]),
		arr.get_chunk([1, 0]),
		arr.get_chunk([1, 1]),
	]);
	assert.equal(c1.data, new Int16Array([1]));
	assert.equal(c1.shape, [1, 1]);
	assert.equal(c2.data, new Int16Array([2]));
	assert.equal(c2.shape, [1, 1]);
	assert.equal(c3.data, new Int16Array([3]));
	assert.equal(c3.shape, [1, 1]);
	assert.equal(c4.data, new Int16Array([4]));
	assert.equal(c4.shape, [1, 1]);
});

chunked("2d.chunked.U7", async () => {
	let arr = await get_array(store, "/2d.chunked.U7");
	let [c1, c2, c3, c4] = await Promise.all([
		arr.get_chunk([0, 0]),
		arr.get_chunk([0, 1]),
		arr.get_chunk([1, 0]),
		arr.get_chunk([1, 1]),
	]);
	assert.equal(Array.from(c1.data as UnicodeStringArray<7>), ['a']);
	assert.equal(c1.shape, [1, 1]);
	assert.equal(Array.from(c2.data as UnicodeStringArray<7>), ['b']);
	assert.equal(c2.shape, [1, 1]);
	assert.equal(Array.from(c3.data as UnicodeStringArray<7>), ['cc']);
	assert.equal(c3.shape, [1, 1]);
	assert.equal(Array.from(c4.data as UnicodeStringArray<7>), ['d']);
	assert.equal(c4.shape, [1, 1]);
});

chunked("2d.chunked.ragged.i2", async () => {
	let arr = await get_array(store, "/2d.chunked.ragged.i2");
	let [c1, c2, c3, c4] = await Promise.all([
		arr.get_chunk([0, 0]),
		arr.get_chunk([0, 1]),
		arr.get_chunk([1, 0]),
		arr.get_chunk([1, 1]),
	]);
	assert.equal(c1.data, new Int16Array([1, 2, 4, 5]));
	assert.equal(c1.shape, [2, 2]);
	assert.equal(c2.data, new Int16Array([3, 0, 6, 0]));
	assert.equal(c2.shape, [2, 2]);
	assert.equal(c3.data, new Int16Array([7, 8, 0, 0]));
	assert.equal(c3.shape, [2, 2]);
	assert.equal(c4.data, new Int16Array([9, 0, 0, 0]));
	assert.equal(c4.shape, [2, 2]);
});

chunked("3d.chunked.i2", async () => {
	let arr = await get_array(store, "/3d.chunked.i2");
	let [c1, c2, c3, c4] = await Promise.all([
		arr.get_chunk([0, 0, 0]),
		arr.get_chunk([0, 0, 2]),
		arr.get_chunk([1, 1, 1]),
		arr.get_chunk([2, 2, 2]),
	]);
	assert.equal(c1.data, new Int16Array([0]));
	assert.equal(c1.shape, [1, 1, 1]);
	assert.equal(c2.data, new Int16Array([2]));
	assert.equal(c2.shape, [1, 1, 1]);
	assert.equal(c3.data, new Int16Array([13]));
	assert.equal(c3.shape, [1, 1, 1]);
	assert.equal(c4.data, new Int16Array([26]));
	assert.equal(c4.shape, [1, 1, 1]);
});

chunked.run();


let mixed = suite('mixed');

mixed("3d.chunked.mixed.i2.C", async () => {
	let arr = await get_array(store, "/3d.chunked.mixed.i2.C");
	let [c1, c2, c3] = await Promise.all([
		arr.get_chunk([0, 0, 0]),
		arr.get_chunk([0, 0, 1]),
		arr.get_chunk([0, 0, 2]),
	]);
	let shape = [3, 3, 1];
	let stride = [3, 1, 1];
	assert.equal(c1.data, new Int16Array(range(0, 27, 3)));
	assert.equal(c1.shape, shape);
	assert.equal(c1.stride, stride);
	assert.equal(c2.data, new Int16Array(range(1, 27, 3)));
	assert.equal(c2.shape, shape);
	assert.equal(c2.stride, stride);
	assert.equal(c3.data, new Int16Array(range(2, 27, 3)));
	assert.equal(c3.shape, shape);
	assert.equal(c3.stride, stride);
});

mixed("3d.chunked.mixed.i2.F", async () => {
	let arr = await get_array(store, "/3d.chunked.mixed.i2.F");
	let [c1, c2, c3] = await Promise.all([
		arr.get_chunk([0, 0, 0]),
		arr.get_chunk([0, 0, 1]),
		arr.get_chunk([0, 0, 2]),
	]);
	let shape = [3, 3, 1];
	let stride = [1, 3, 9];
	assert.equal(c1.data, new Int16Array([0, 9, 18, 3, 12, 21, 6, 15, 24]));
	assert.equal(c1.shape, shape);
	assert.equal(c1.stride, stride);
	assert.equal(c2.data, new Int16Array([1, 10, 19, 4, 13, 22, 7, 16, 25]));
	assert.equal(c2.shape, shape);
	assert.equal(c2.stride, stride);
	assert.equal(c3.data, new Int16Array([2, 11, 20, 5, 14, 23, 8, 17, 26]));
	assert.equal(c3.shape, shape);
	assert.equal(c3.stride, stride);
});

mixed.run();

