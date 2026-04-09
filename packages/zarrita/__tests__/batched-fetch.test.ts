import type { AbsolutePath, RangeQuery } from "@zarrita/storage";
import { describe, expect, it, vi } from "vitest";
import { withRangeBatching } from "../src/middleware/range-batching.js";

/**
 * Create a fake store with controllable getRange.
 * Default behavior: returns a Uint8Array filled with (offset + i) & 0xff.
 */
function fakeStore() {
	return {
		get: vi.fn((_key: AbsolutePath, _opts?: RequestInit) =>
			Promise.resolve<Uint8Array | undefined>(new Uint8Array(0)),
		),
		getRange: vi.fn(
			(
				_key: AbsolutePath,
				range: RangeQuery,
				_options?: RequestInit,
			): Promise<Uint8Array | undefined> => {
				if ("suffixLength" in range) {
					return Promise.resolve(new Uint8Array(range.suffixLength));
				}
				let buf = new Uint8Array(range.length);
				for (let i = 0; i < buf.length; i++) {
					buf[i] = (range.offset + i) & 0xff;
				}
				return Promise.resolve(buf);
			},
		),
	};
}

describe("withRangeBatching", () => {
	describe("get() pass-through", () => {
		it("delegates to inner store", async () => {
			let inner = fakeStore();
			let expected = new Uint8Array([1, 2, 3]);
			inner.get.mockResolvedValueOnce(expected);
			let store = withRangeBatching(inner);
			let result = await store.get("/some/path");
			expect(inner.get).toHaveBeenCalledOnce();
			expect(result).toBe(expected);
		});
	});

	describe("getRange() batching", () => {
		it("batches concurrent getRange calls into a single merged fetch", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			let [r1, r2, r3] = await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 100, length: 100 }),
				store.getRange("/data/chunk", { offset: 200, length: 100 }),
			]);

			// One merged getRange call (0-300)
			expect(inner.getRange).toHaveBeenCalledOnce();
			let call = inner.getRange.mock.calls[0];
			expect(call[1]).toEqual({ offset: 0, length: 300 });

			// Correct slices
			expect(r1?.length).toBe(100);
			expect(r2?.length).toBe(100);
			expect(r3?.length).toBe(100);
			expect(r1?.[0]).toBe(0);
			expect(r2?.[0]).toBe(100);
			expect(r3?.[0]).toBe(200);

			expect(store.stats.batchedRequests).toBe(3);
			expect(store.stats.mergedRequests).toBe(1);
		});

		it("splits ranges with large gaps into separate groups", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			// 200KB gap exceeds GAP_THRESHOLD (32KB)
			await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 200000, length: 100 }),
			]);

			expect(inner.getRange).toHaveBeenCalledTimes(2);
			expect(store.stats.mergedRequests).toBe(2);
		});

		it("honors custom coalesceSize", async () => {
			let inner = fakeStore();
			// 50KB gap, default 32KB coalesce size would split
			let store = withRangeBatching(inner, { coalesceSize: 65536 });

			await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 51300, length: 100 }),
			]);

			// 50KB gap < 64KB coalesce size, should merge
			expect(inner.getRange).toHaveBeenCalledOnce();
		});

		it("groups requests from different paths independently", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			await Promise.all([
				store.getRange("/data/a", { offset: 0, length: 100 }),
				store.getRange("/data/b", { offset: 0, length: 100 }),
			]);

			expect(inner.getRange).toHaveBeenCalledTimes(2);
		});
	});

	describe("edge cases", () => {
		it("handles overlapping ranges correctly", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			let [r1, r2] = await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 50, length: 100 }),
			]);

			// Merged into single fetch [0, 150)
			expect(inner.getRange).toHaveBeenCalledOnce();
			let call = inner.getRange.mock.calls[0];
			expect(call[1]).toEqual({ offset: 0, length: 150 });

			expect(r1?.length).toBe(100);
			expect(r2?.length).toBe(100);
			expect(r1?.[0]).toBe(0);
			expect(r2?.[0]).toBe(50);
		});

		it("resolves concurrent identical offset ranges correctly", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			let [r1, r2] = await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
			]);

			expect(inner.getRange).toHaveBeenCalledOnce();
			expect(r1?.length).toBe(100);
			expect(r2?.length).toBe(100);
			expect(r1?.[0]).toBe(0);
			expect(r2?.[0]).toBe(0);
		});
	});

	describe("caching", () => {
		it("returns cached data on second request", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			await store.getRange("/data/chunk", { offset: 0, length: 100 });

			// Second request should hit cache
			let r2 = await store.getRange("/data/chunk", { offset: 0, length: 100 });

			expect(inner.getRange).toHaveBeenCalledOnce();
			expect(store.stats.hits).toBe(1);
			expect(r2?.length).toBe(100);
		});

		it("caches suffix range requests", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			await store.getRange("/data/shard", { suffixLength: 1024 });
			await store.getRange("/data/shard", { suffixLength: 1024 });

			expect(inner.getRange).toHaveBeenCalledOnce();
			expect(store.stats.hits).toBe(1);
		});

		it("deduplicates concurrent suffix requests", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			// Fire two suffix requests concurrently (same as concurrent band opens)
			let [r1, r2] = await Promise.all([
				store.getRange("/data/shard", { suffixLength: 1024 }),
				store.getRange("/data/shard", { suffixLength: 1024 }),
			]);

			expect(inner.getRange).toHaveBeenCalledOnce();
			expect(r1?.length).toBe(1024);
			expect(r2?.length).toBe(1024);
			expect(store.stats.hits).toBe(1);
			expect(store.stats.misses).toBe(1);
		});

		it("evicts failed suffix request from inflight cache", async () => {
			let inner = fakeStore();
			let callCount = 0;
			inner.getRange.mockImplementation(
				(
					_key: AbsolutePath,
					range: RangeQuery,
					_options?: RequestInit,
				): Promise<Uint8Array | undefined> => {
					callCount++;
					if (callCount === 1 && "suffixLength" in range) {
						return Promise.reject(new Error("transient error"));
					}
					if ("suffixLength" in range) {
						return Promise.resolve(new Uint8Array(range.suffixLength));
					}
					return Promise.resolve(new Uint8Array(0));
				},
			);
			let store = withRangeBatching(inner);

			await expect(
				store.getRange("/data/shard", { suffixLength: 1024 }),
			).rejects.toThrow("transient error");

			// Retry should succeed (not permanently poisoned)
			let result = await store.getRange("/data/shard", { suffixLength: 1024 });
			expect(result?.length).toBe(1024);
		});
	});

	describe("LRU eviction", () => {
		it("evicts oldest entry when cache capacity exceeded", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner, { cacheSize: 2 });

			// Fill cache with 3 entries (capacity 2)
			await store.getRange("/a", { offset: 0, length: 10 });
			await store.getRange("/b", { offset: 0, length: 10 });
			await store.getRange("/c", { offset: 0, length: 10 });

			// /a should be evicted, /b and /c cached
			inner.getRange.mockClear();
			await store.getRange("/b", { offset: 0, length: 10 });
			expect(inner.getRange).not.toHaveBeenCalled();

			await store.getRange("/a", { offset: 0, length: 10 });
			expect(inner.getRange).toHaveBeenCalledOnce();
		});

		it("honors cacheSize option", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner, { cacheSize: 1 });

			await store.getRange("/a", { offset: 0, length: 10 });
			await store.getRange("/b", { offset: 0, length: 10 });

			inner.getRange.mockClear();
			await store.getRange("/a", { offset: 0, length: 10 });
			expect(inner.getRange).toHaveBeenCalledOnce();
		});
	});

	describe("error handling", () => {
		it("rejects all requests in a group when fetch fails", async () => {
			let inner = fakeStore();
			inner.getRange.mockRejectedValue(new Error("Network error"));
			let store = withRangeBatching(inner);

			let results = await Promise.allSettled([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 100, length: 100 }),
			]);

			expect(results[0].status).toBe("rejected");
			expect(results[1].status).toBe("rejected");
			expect((results[0] as PromiseRejectedResult).reason.message).toBe(
				"Network error",
			);
		});
	});

	describe("short read", () => {
		it("rejects all requests when server returns fewer bytes than expected", async () => {
			let inner = fakeStore();
			inner.getRange.mockImplementation(
				(
					_key: AbsolutePath,
					range: RangeQuery,
					_options?: RequestInit,
				): Promise<Uint8Array | undefined> => {
					if ("suffixLength" in range) {
						return Promise.resolve(new Uint8Array(range.suffixLength));
					}
					// Return only half the requested bytes
					return Promise.resolve(new Uint8Array(Math.floor(range.length / 2)));
				},
			);
			let store = withRangeBatching(inner);

			let results = await Promise.allSettled([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 100, length: 100 }),
			]);

			expect(results[0].status).toBe("rejected");
			expect(results[1].status).toBe("rejected");
			expect((results[0] as PromiseRejectedResult).reason.message).toMatch(
				/Short read/,
			);
		});
	});

	describe("mergeOptions", () => {
		it("uses first caller's options by default", async () => {
			let inner = fakeStore();
			let store = withRangeBatching(inner);

			await Promise.all([
				store.getRange(
					"/data/chunk",
					{ offset: 0, length: 100 },
					{ headers: { "x-req": "first" } },
				),
				store.getRange(
					"/data/chunk",
					{ offset: 100, length: 100 },
					{ headers: { "x-req": "second" } },
				),
			]);

			expect(inner.getRange.mock.calls[0][2]?.headers).toEqual({
				"x-req": "first",
			});
		});

		it("rejects pending requests and recovers when mergeOptions throws", async () => {
			let inner = fakeStore();
			let shouldThrow = true;
			let store = withRangeBatching(inner, {
				mergeOptions: () => {
					if (shouldThrow) throw new Error("bad merge");
					return undefined;
				},
			});

			// First batch: mergeOptions throws, all requests should reject
			let results = await Promise.allSettled([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 100, length: 100 }),
			]);
			expect(results[0].status).toBe("rejected");
			expect(results[1].status).toBe("rejected");
			expect((results[0] as PromiseRejectedResult).reason.message).toBe(
				"bad merge",
			);

			// Second batch: store should not be deadlocked
			shouldThrow = false;
			let r = await store.getRange("/data/chunk", { offset: 0, length: 100 });
			expect(r?.length).toBe(100);
		});

		it("applies mergeOptions reducer across batched callers", async () => {
			interface TaggedOptions {
				tags: string[];
			}
			let inner = {
				get: vi.fn((_key: AbsolutePath, _opts?: TaggedOptions) =>
					Promise.resolve<Uint8Array | undefined>(new Uint8Array(0)),
				),
				getRange: vi.fn(
					(
						_key: AbsolutePath,
						range: RangeQuery,
						_options?: TaggedOptions,
					): Promise<Uint8Array | undefined> => {
						if ("suffixLength" in range) {
							return Promise.resolve(new Uint8Array(range.suffixLength));
						}
						return Promise.resolve(new Uint8Array(range.length));
					},
				),
			};
			let store = withRangeBatching(inner, {
				mergeOptions: (batch) => ({
					tags: batch.flatMap((o) => o?.tags ?? []),
				}),
			});

			await Promise.all([
				store.getRange(
					"/data/chunk",
					{ offset: 0, length: 100 },
					{ tags: ["a"] },
				),
				store.getRange(
					"/data/chunk",
					{ offset: 100, length: 100 },
					{ tags: ["b"] },
				),
			]);

			expect(inner.getRange.mock.calls[0][2]?.tags).toEqual(["a", "b"]);
		});
	});

	describe("undefined data", () => {
		it("resolves with undefined when inner returns undefined", async () => {
			let inner = fakeStore();
			inner.getRange.mockResolvedValue(undefined);
			let store = withRangeBatching(inner);

			let result = await store.getRange("/data/chunk", {
				offset: 0,
				length: 100,
			});
			expect(result).toBeUndefined();
		});
	});
});
