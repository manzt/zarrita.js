import * as path from "node:path";
import * as url from "node:url";
import { describe, expect, it } from "vitest";
import * as zarr from "../src/index.js";
import { defineArrayMiddleware } from "../src/middleware/define-array.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));
let fixturesRoot = path.resolve(__dirname, "../../../fixtures/v3/data.zarr");

async function openFixture(name: string) {
	let store = new zarr.FileSystemStore(fixturesRoot);
	return zarr.open.v3(zarr.root(store).resolve(name), { kind: "array" });
}

describe("defineArrayMiddleware", () => {
	it("intercepts getChunk", async () => {
		let calls: number[][] = [];
		let withTrace = defineArrayMiddleware((array) => ({
			async getChunk(coords, options) {
				calls.push(coords);
				return array.getChunk(coords, options);
			},
		}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withTrace(arr);
		let chunk = await wrapped.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(Int16Array);
		expect(calls).toEqual([[0]]);
	});

	it("pass-through getters still work (private field access)", async () => {
		let withNoop = defineArrayMiddleware((_array) => ({}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withNoop(arr);
		// These all read from `this.#metadata` via getters on Array.
		expect(wrapped.shape).toEqual(arr.shape);
		expect(wrapped.dtype).toBe(arr.dtype);
		expect(wrapped.chunks).toEqual(arr.chunks);
		expect(wrapped.attrs).toEqual(arr.attrs);
	});

	it("extensions appear on the wrapped array", async () => {
		let withCounter = defineArrayMiddleware((_array) => {
			let n = 0;
			return {
				bump() {
					n += 1;
				},
				get count(): number {
					return n;
				},
			};
		});
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withCounter(arr);
		wrapped.bump();
		wrapped.bump();
		expect(wrapped.count).toBe(2);
	});

	it("works with zarr.get through the interception chain", async () => {
		let cache = new Map<string, zarr.Chunk<zarr.DataType>>();
		let withCache = defineArrayMiddleware((array) => ({
			async getChunk(coords, options) {
				let key = coords.join(",");
				let hit = cache.get(key);
				if (hit) return hit;
				let chunk = await array.getChunk(coords, options);
				cache.set(key, chunk);
				return chunk;
			},
		}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withCache(arr);
		let a = await zarr.get(wrapped);
		let b = await zarr.get(wrapped);
		expect(a.data).toStrictEqual(b.data);
		// Second pass should hit the cache for each chunk.
		expect(cache.size).toBeGreaterThan(0);
	});
});

describe("extendArray", () => {
	it("no middleware returns the array as-is", async () => {
		let arr = await openFixture("1d.chunked.i2");
		let result = await zarr.extendArray(arr);
		expect(result).toBe(arr);
	});

	it("composes multiple middlewares in order", async () => {
		let order: string[] = [];
		let withA = defineArrayMiddleware((_array) => ({
			tagA: "a",
			async getChunk(coords, options) {
				order.push("a");
				return _array.getChunk(coords, options);
			},
		}));
		let withB = defineArrayMiddleware((_array) => ({
			tagB: "b",
			async getChunk(coords, options) {
				order.push("b");
				return _array.getChunk(coords, options);
			},
		}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = await zarr.extendArray(
			arr,
			(a) => withA(a),
			(a) => withB(a),
		);
		expect(wrapped.tagA).toBe("a");
		expect(wrapped.tagB).toBe("b");
		await wrapped.getChunk([0]);
		// Outer wrapper runs first; it calls through to inner.
		expect(order).toEqual(["b", "a"]);
	});
});
