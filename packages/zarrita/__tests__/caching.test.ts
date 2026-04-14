import type { AbsolutePath, RangeQuery } from "@zarrita/storage";
import { describe, expect, it, vi } from "vitest";
import { type CacheKeyFor, withByteCaching } from "../src/extension/caching.js";

function fakeStore() {
	return {
		get: vi.fn((_key: AbsolutePath) =>
			Promise.resolve<Uint8Array | undefined>(new Uint8Array([1, 2, 3])),
		),
		getRange: vi.fn(
			(
				_key: AbsolutePath,
				range: RangeQuery,
			): Promise<Uint8Array | undefined> => {
				if ("suffixLength" in range) {
					return Promise.resolve(new Uint8Array(range.suffixLength));
				}
				return Promise.resolve(new Uint8Array(range.length));
			},
		),
	};
}

describe("withByteCaching", () => {
	describe("default policy", () => {
		it("caches get() calls", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let store = withByteCaching(inner, { cache });

			await store.get("/a");
			await store.get("/a");

			expect(inner.get).toHaveBeenCalledOnce();
		});

		it("caches getRange() calls with identical ranges", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let store = withByteCaching(inner, { cache });

			await store.getRange("/a", { offset: 0, length: 10 });
			await store.getRange("/a", { offset: 0, length: 10 });

			expect(inner.getRange).toHaveBeenCalledOnce();
		});

		it("uses disjoint keys for gets and getRange on the same path", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let store = withByteCaching(inner, { cache });

			await store.get("/a");
			await store.getRange("/a", { offset: 0, length: 10 });

			// The get cache entry must not shadow the getRange lookup.
			expect(inner.get).toHaveBeenCalledOnce();
			expect(inner.getRange).toHaveBeenCalledOnce();
		});

		it("misses on a different range of the same path", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let store = withByteCaching(inner, { cache });

			await store.getRange("/a", { offset: 0, length: 10 });
			await store.getRange("/a", { offset: 5, length: 10 });

			expect(inner.getRange).toHaveBeenCalledTimes(2);
		});

		it("caches suffix-length range reads under their own keys", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let store = withByteCaching(inner, { cache });

			await store.getRange("/a", { suffixLength: 1024 });
			await store.getRange("/a", { suffixLength: 1024 });

			expect(inner.getRange).toHaveBeenCalledOnce();
		});

		it("caches undefined (confirmed not-found) results", async () => {
			let inner = fakeStore();
			inner.get.mockResolvedValue(undefined);
			let cache = new Map<string, Uint8Array | undefined>();
			let store = withByteCaching(inner, { cache });

			await store.get("/missing");
			await store.get("/missing");

			expect(inner.get).toHaveBeenCalledOnce();
		});
	});

	describe("default cache (internal Map)", () => {
		it("works with no options at all — allocates its own", async () => {
			let inner = fakeStore();
			let store = withByteCaching(inner);

			await store.get("/a");
			await store.get("/a");

			expect(inner.get).toHaveBeenCalledOnce();
		});
	});

	describe("custom key policy", () => {
		it("respects undefined as skip-caching", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let skipEverything: CacheKeyFor = () => undefined;
			let store = withByteCaching(inner, { cache, keyFor: skipEverything });

			await store.get("/a");
			await store.get("/a");

			expect(inner.get).toHaveBeenCalledTimes(2);
		});

		it("caches only paths matching a predicate", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let metaOnly: CacheKeyFor = (path, range) => {
				if (range !== undefined) return undefined;
				return path.endsWith(".json") ? path : undefined;
			};
			let store = withByteCaching(inner, { cache, keyFor: metaOnly });

			await store.get("/meta.json");
			await store.get("/meta.json");
			await store.get("/data.bin");
			await store.get("/data.bin");

			// 1 cached hit + 2 uncached calls = 3 inner invocations.
			expect(inner.get).toHaveBeenCalledTimes(3);
		});

		it("narrows to gets-only when the policy skips ranges", async () => {
			let inner = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();
			let getsOnly: CacheKeyFor = (path, range) =>
				range === undefined ? path : undefined;
			let store = withByteCaching(inner, { cache, keyFor: getsOnly });

			await store.getRange("/a", { offset: 0, length: 10 });
			await store.getRange("/a", { offset: 0, length: 10 });

			expect(inner.getRange).toHaveBeenCalledTimes(2);
		});
	});

	describe("shared cache", () => {
		it("two withByteCaching instances share one cache by reference", async () => {
			let inner1 = fakeStore();
			let inner2 = fakeStore();
			let cache = new Map<string, Uint8Array | undefined>();

			let store1 = withByteCaching(inner1, { cache });
			let store2 = withByteCaching(inner2, { cache });

			await store1.get("/shared");
			await store2.get("/shared");

			expect(inner1.get).toHaveBeenCalledOnce();
			expect(inner2.get).not.toHaveBeenCalled();
		});
	});
});
