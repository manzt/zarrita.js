import { describe, expect, test } from "vitest";
import * as zarr from "../src/index.js";

describe("SharedArrayBuffer support", () => {
	test("get() with useSharedArrayBuffer returns SharedArrayBuffer-backed TypedArray", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4, 4],
			chunk_shape: [2, 2],
			data_type: "int32",
			fill_value: 42,
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
			chunk_shape: [2, 2],
			data_type: "int32",
			fill_value: 42,
		});

		let chunk = await zarr.get(arr);
		expect(chunk.data.buffer).toBeInstanceOf(ArrayBuffer);
		expect(chunk.data.buffer).not.toBeInstanceOf(SharedArrayBuffer);
	});

	test("getChunk() with useSharedArrayBuffer returns SharedArrayBuffer-backed TypedArray for fill-value chunks", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4, 4],
			chunk_shape: [2, 2],
			data_type: "float32",
			fill_value: 3.14,
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
			chunk_shape: [2, 2],
			data_type: "float32",
			fill_value: 3.14,
		});

		let chunk = await arr.getChunk([0, 0]);
		expect(chunk.data.buffer).toBeInstanceOf(ArrayBuffer);
		expect(chunk.data.buffer).not.toBeInstanceOf(SharedArrayBuffer);
	});

	test("useSharedArrayBuffer works with various numeric data types", async () => {
		const testCases = [
			{ data_type: "int8" as const, fill_value: -1 },
			{ data_type: "int16" as const, fill_value: -100 },
			{ data_type: "int32" as const, fill_value: -1000 },
			{ data_type: "uint8" as const, fill_value: 255 },
			{ data_type: "uint16" as const, fill_value: 1000 },
			{ data_type: "uint32" as const, fill_value: 100000 },
			{ data_type: "float32" as const, fill_value: 1.5 },
			{ data_type: "float64" as const, fill_value: 2.5 },
		];

		for (const { data_type, fill_value } of testCases) {
			let h = zarr.root();
			let arr = await zarr.create(h.resolve("/test"), {
				shape: [2],
				chunk_shape: [2],
				data_type,
				fill_value,
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
			chunk_shape: [2],
			data_type: "bool",
			fill_value: true,
		});

		let chunk = await zarr.get(arr, null, { useSharedArrayBuffer: true });
		expect(chunk.data.buffer).toBeInstanceOf(SharedArrayBuffer);
		expect(chunk.data.length).toBe(4);
		expect(Array.from(chunk.data)).toEqual([true, true, true, true]);
	});

	test("useSharedArrayBuffer throws for string data type", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [2],
			chunk_shape: [2],
			data_type: "string",
			fill_value: "hello",
		});

		await expect(
			zarr.get(arr, null, { useSharedArrayBuffer: true }),
		).rejects.toThrow(
			"useSharedArrayBuffer is not supported for string or object data types",
		);
	});

	test("get() with useSharedArrayBuffer works with written data", async () => {
		let h = zarr.root();
		let arr = await zarr.create(h.resolve("/test"), {
			shape: [4],
			chunk_shape: [2],
			data_type: "int32",
			fill_value: 0,
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
			chunk_shape: [2, 2],
			data_type: "int32",
			fill_value: 0,
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
