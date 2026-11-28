import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { FileSystemStore } from "@zarrita/storage";
import { describe, expect, it } from "vitest";
import { PcodecCodec } from "../src/codecs/pcodec.js";
import { create } from "../src/create.js";
import { InvalidMetadataError } from "../src/errors.js";
import { root } from "../src/hierarchy.js";
import { get, set } from "../src/indexing/ops.js";
import type { DataType } from "../src/metadata.js";
import { open } from "../src/open.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));
let fixtures = path.resolve(__dirname, "../../../fixtures");

// arrays written by zarr-python's numcodecs.PCodec (scripts/generate-pcodec.py); each has an
// uncompressed twin `<name>.expected`
function names(version: "v2" | "v3"): string[] {
	return fs
		.readdirSync(path.join(fixtures, version, "pcodec.zarr"))
		.filter(
			(n) =>
				!n.endsWith(".expected") && !n.startsWith(".") && n !== "zarr.json",
		);
}

// values in C order, whatever memory order `get` returned (a transpose codec keeps the chunk's order)
function cOrder(chunk: {
	data: ArrayLike<unknown>;
	shape: number[];
	stride: number[];
}): unknown[] {
	let { data, shape, stride } = chunk;
	let n = shape.reduce((a, b) => a * b, 1);
	let out = new Array(n);
	let index = new Array(shape.length).fill(0);
	for (let i = 0; i < n; i++) {
		let offset = 0;
		for (let d = 0; d < shape.length; d++) offset += index[d] * stride[d];
		out[i] = data[offset];
		for (let d = shape.length - 1; d >= 0; d--) {
			if (++index[d] < shape[d]) break;
			index[d] = 0;
		}
	}
	return out;
}

async function readBoth(version: "v2" | "v3", name: string) {
	let store = new FileSystemStore(path.join(fixtures, version, "pcodec.zarr"));
	let opener = version === "v2" ? open.v2 : open.v3;
	let arr = await opener(root(store).resolve(name), { kind: "array" });
	let expected = await opener(root(store).resolve(`${name}.expected`), {
		kind: "array",
	});
	return { arr, expected };
}

describe("pcodec: arrays written by zarr-python", () => {
	for (let version of ["v3", "v2"] as const) {
		for (let name of names(version)) {
			it(`${version} ${name}`, async () => {
				let { arr, expected } = await readBoth(version, name);
				let got = await get(arr);
				let want = await get(expected);
				expect(got.shape).toEqual(want.shape);
				// biome-ignore lint/suspicious/noExplicitAny: any numeric chunk
				expect(cOrder(got as any)).toEqual(cOrder(want as any));
			});
		}
	}

	it("reads a window across chunk boundaries (v3, transposed)", async () => {
		let { arr, expected } = await readBoth("v3", "2d.transposed.int16");
		let sel = [{ start: 250, stop: 780, step: null }, null] as const;
		// biome-ignore lint/suspicious/noExplicitAny: selection type
		let got = await get(arr, sel as any);
		// biome-ignore lint/suspicious/noExplicitAny: selection type
		let want = await get(expected, sel as any);
		expect(got.shape).toEqual([530, 6]);
		// biome-ignore lint/suspicious/noExplicitAny: any numeric chunk
		expect(cOrder(got as any)).toEqual(cOrder(want as any));
	});

	it("reads one channel of the per-channel sharded layout", async () => {
		let { arr, expected } = await readBoth("v3", "2d.sharded.int16");
		let got = await get(arr, [null, 3]);
		let want = await get(expected, [null, 3]);
		expect(got.shape).toEqual([1000]);
		expect(Array.from(got.data as Int16Array)).toEqual(
			Array.from(want.data as Int16Array),
		);
	});
});

const TYPED: Record<string, (n: number) => ArrayLike<number | bigint>> = {
	int8: (n) => Int8Array.from({ length: n }, (_, i) => (i % 200) - 100),
	uint8: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7) % 256),
	int16: (n) =>
		Int16Array.from({ length: n }, (_, i) => Math.round(300 * Math.sin(i / 9))),
	uint16: (n) => Uint16Array.from({ length: n }, (_, i) => 1000 + (i % 77)),
	int32: (n) => Int32Array.from({ length: n }, (_, i) => i * i - 5000),
	uint32: (n) => Uint32Array.from({ length: n }, (_, i) => i * 3),
	int64: (n) => BigInt64Array.from({ length: n }, (_, i) => BigInt(i) * -3n),
	uint64: (n) => BigUint64Array.from({ length: n }, (_, i) => BigInt(i) << 20n),
	float32: (n) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 5)),
	float64: (n) => Float64Array.from({ length: n }, (_, i) => i / 3),
};

describe("pcodec: encode and decode in zarrita", () => {
	for (let [dtype, make] of Object.entries(TYPED)) {
		it(`roundtrips ${dtype}`, async () => {
			let data = make(1234);
			let codec = PcodecCodec.fromConfig(
				{ level: 8 },
				{
					dataType: dtype as DataType,
					shape: [1234],
				},
			);
			let chunk = { data, shape: [1234], stride: [1] };
			// biome-ignore lint/suspicious/noExplicitAny: generic chunk
			let encoded = await codec.encode(chunk as any);
			expect(encoded.byteLength).toBeLessThan(
				(data as unknown as ArrayBufferView).byteLength,
			);
			let decoded = await codec.decode(encoded);
			expect(Array.from(decoded.data as ArrayLike<unknown>)).toEqual(
				Array.from(data),
			);
		});
	}

	it("roundtrips through zarrita's create/set/get", async () => {
		let store = new Map<string, Uint8Array>();
		let arr = await create(root(store).resolve("x"), {
			shape: [100, 3],
			chunkShape: [40, 3],
			dtype: "int32",
			codecs: [
				{ name: "transpose", configuration: { order: [1, 0] } },
				{ name: "numcodecs.pcodec", configuration: { level: 8 } },
			],
		});
		let data = Int32Array.from({ length: 300 }, (_, i) => (i * 37) % 1001);
		await set(arr, null, { data, shape: [100, 3], stride: [3, 1] });
		let got = await get(arr);
		// biome-ignore lint/suspicious/noExplicitAny: any numeric chunk
		expect(cOrder(got as any)).toEqual(Array.from(data));
	});

	it("rejects a data type pcodec does not support", () => {
		expect(() =>
			PcodecCodec.fromConfig({}, { dataType: "bool", shape: [4] }),
		).toThrow(InvalidMetadataError);
	});

	it("raises on bytes that are not pcodec", async () => {
		let codec = PcodecCodec.fromConfig({}, { dataType: "int16", shape: [4] });
		await expect(codec.decode(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(
			/pcodec/,
		);
	});

	it("raises when the decoded length does not match the chunk", async () => {
		let a = PcodecCodec.fromConfig({}, { dataType: "int16", shape: [10] });
		let b = PcodecCodec.fromConfig({}, { dataType: "int16", shape: [12] });
		let bytes = await a.encode({
			data: new Int16Array(10).fill(3),
			shape: [10],
			stride: [1],
		});
		await expect(b.decode(bytes)).rejects.toThrow(/decoded 10 values/);
	});
});
