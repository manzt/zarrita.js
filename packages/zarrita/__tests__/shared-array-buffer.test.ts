import { describe, expect, test } from "vitest";
import * as zarr from "../src/index.js";

describe("SharedArrayBuffer support", () => {
	test("get() with useSharedArrayBuffer returns SharedArrayBuffer-backed TypedArray", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4, 4],
			chunkShape: [2, 2],
			dataType: "int32",
			fillValue: 42,
		});

		let chunk = await zarr.get(arr, null, { useSharedArrayBuffer: true });
		expect(chunk.data.buffer).toBeInstanceOf(SharedArrayBuffer);
		expect(chunk.data.length).toBe(16);
		// All values should be fill_value since no data was written
		expect(Array.from(chunk.data)).toEqual(Array(16).fill(42));
	});

	test("get() without useSharedArrayBuffer returns regular ArrayBuffer-backed TypedArray", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4, 4],
			chunkShape: [2, 2],
			dataType: "int32",
			fillValue: 42,
		});

		let chunk = await zarr.get(arr);
		expect(chunk.data.buffer).toBeInstanceOf(ArrayBuffer);
		expect(chunk.data.buffer).not.toBeInstanceOf(SharedArrayBuffer);
	});

	test("getChunk() with useSharedArrayBuffer returns SharedArrayBuffer-backed TypedArray for fill-value chunks", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4, 4],
			chunkShape: [2, 2],
			dataType: "float32",
			fillValue: 3.14,
		});

		// No data written, so getChunk returns fill-value chunk
		let chunk = await arr.getChunk([0, 0], undefined, {
			useSharedArrayBuffer: true,
		});
		expect(chunk.data.buffer).toBeInstanceOf(SharedArrayBuffer);
		expect(chunk.data.length).toBe(4);
		// Use toBeCloseTo for float comparison due to precision
		for (const val of chunk.data) {
			expect(val).toBeCloseTo(3.14, 5);
		}
	});

	test("getChunk() without useSharedArrayBuffer returns regular ArrayBuffer", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4, 4],
			chunkShape: [2, 2],
			dataType: "float32",
			fillValue: 3.14,
		});

		let chunk = await arr.getChunk([0, 0]);
		expect(chunk.data.buffer).toBeInstanceOf(ArrayBuffer);
		expect(chunk.data.buffer).not.toBeInstanceOf(SharedArrayBuffer);
	});

	test("useSharedArrayBuffer works with various numeric data types", async () => {
		const testCases = [
			{ dataType: "int8" as const, fillValue: -1 },
			{ dataType: "int16" as const, fillValue: -100 },
			{ dataType: "int32" as const, fillValue: -1000 },
			{ dataType: "uint8" as const, fillValue: 255 },
			{ dataType: "uint16" as const, fillValue: 1000 },
			{ dataType: "uint32" as const, fillValue: 100000 },
			{ dataType: "float32" as const, fillValue: 1.5 },
			{ dataType: "float64" as const, fillValue: 2.5 },
		];

		for (const { dataType, fillValue } of testCases) {
			let h = zarr.root();
			let arr = await zarr.create(h.resolve("/test"), {
				shape: [2],
				chunkShape: [2],
				dataType,
				fillValue,
			});

			let chunk = await zarr.get(arr, null, { useSharedArrayBuffer: true });
			expect(chunk.data.buffer).toBeInstanceOf(SharedArrayBuffer);
			expect(chunk.data.length).toBe(2);
		}
	});

	test("useSharedArrayBuffer works with bool data type", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4],
			chunkShape: [2],
			dataType: "bool",
			fillValue: true,
		});

		let chunk = await zarr.get(arr, null, { useSharedArrayBuffer: true });
		expect(chunk.data.buffer).toBeInstanceOf(SharedArrayBuffer);
		expect(chunk.data.length).toBe(4);
		expect(Array.from(chunk.data)).toEqual([true, true, true, true]);
	});

	test("useSharedArrayBuffer warns and falls back for string data type", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [2],
			chunkShape: [2],
			dataType: "string",
			fillValue: "hello",
		});

		// Should warn but not throw, falling back to regular array
		let chunk = await zarr.get(arr, null, { useSharedArrayBuffer: true });
		// String arrays use regular JS arrays, not TypedArrays with buffers
		expect(Array.isArray(chunk.data)).toBe(true);
		expect(chunk.data.length).toBe(2);
	});

	test("get() with useSharedArrayBuffer works with written data", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4],
			chunkShape: [2],
			dataType: "int32",
			fillValue: 0,
		});

		// Write some data
		await zarr.set(arr, null, {
			data: new Int32Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});

		// Read with SharedArrayBuffer
		let chunk = await zarr.get(arr, null, { useSharedArrayBuffer: true });
		expect(chunk.data.buffer).toBeInstanceOf(SharedArrayBuffer);
		expect(Array.from(chunk.data)).toEqual([1, 2, 3, 4]);
	});

	test("get() with useSharedArrayBuffer works with slicing", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4, 4],
			chunkShape: [2, 2],
			dataType: "int32",
			fillValue: 0,
		});

		// Write some data
		let data = new Int32Array(16);
		for (let i = 0; i < 16; i++) data[i] = i;
		await zarr.set(arr, null, {
			data,
			shape: [4, 4],
			stride: [4, 1],
		});

		// Read a slice with SharedArrayBuffer
		let chunk = await zarr.get(arr, [zarr.slice(1, 3), null], {
			useSharedArrayBuffer: true,
		});
		expect(chunk.data.buffer).toBeInstanceOf(SharedArrayBuffer);
		expect(chunk.shape).toEqual([2, 4]);
		expect(Array.from(chunk.data)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
	});
});
