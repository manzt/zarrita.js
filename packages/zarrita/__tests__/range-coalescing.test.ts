import type { AbsolutePath, RangeQuery } from "@zarrita/storage";
import { describe, expect, it, vi } from "vitest";
import {
	type FlushReport,
	withRangeCoalescing,
} from "../src/extension/range-coalescing.js";

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

describe("withRangeCoalescing", () => {
	describe("get() pass-through", () => {
		it("delegates to inner store without interception", async () => {
			let inner = fakeStore();
			let expected = new Uint8Array([1, 2, 3]);
			inner.get.mockResolvedValueOnce(expected);
			let store = withRangeCoalescing(inner);
			let result = await store.get("/some/path");
			expect(inner.get).toHaveBeenCalledOnce();
			expect(result).toBe(expected);
		});
	});

	describe("getRange() batching", () => {
		it("batches concurrent getRange calls into a single merged fetch", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner);

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
		});

		it("splits ranges with large gaps into separate groups", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner);

			await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 200000, length: 100 }),
			]);

			expect(inner.getRange).toHaveBeenCalledTimes(2);
		});

		it("honors custom coalesceSize", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner, { coalesceSize: 65536 });

			await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 51300, length: 100 }),
			]);

			expect(inner.getRange).toHaveBeenCalledOnce();
		});

		it("groups requests from different paths independently", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner);

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
			let store = withRangeCoalescing(inner);

			let [r1, r2] = await Promise.all([
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
				store.getRange("/data/chunk", { offset: 50, length: 100 }),
			]);

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
			let store = withRangeCoalescing(inner);

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

	describe("suffix passthrough", () => {
		it("passes suffix-length queries directly through to inner", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner);

			await store.getRange("/data/shard", { suffixLength: 1024 });
			expect(inner.getRange).toHaveBeenCalledOnce();
			expect(inner.getRange.mock.calls[0][1]).toEqual({ suffixLength: 1024 });
		});

		it("does not batch suffix reads across microtasks", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner);

			await Promise.all([
				store.getRange("/data/shard", { suffixLength: 1024 }),
				store.getRange("/data/shard", { suffixLength: 1024 }),
			]);

			expect(inner.getRange).toHaveBeenCalledTimes(2);
		});
	});

	describe("onFlush callback", () => {
		it("emits one report per path per flush", async () => {
			let inner = fakeStore();
			let reports: FlushReport[] = [];
			let store = withRangeCoalescing(inner, {
				onFlush: (r) => reports.push(r),
			});

			await Promise.all([
				store.getRange("/data/a", { offset: 0, length: 100 }),
				store.getRange("/data/a", { offset: 100, length: 100 }),
				store.getRange("/data/b", { offset: 0, length: 50 }),
			]);

			expect(reports).toHaveLength(2);
			let a = reports.find((r) => r.path === "/data/a");
			let b = reports.find((r) => r.path === "/data/b");
			expect(a).toEqual({
				path: "/data/a",
				groupCount: 1,
				requestCount: 2,
				bytesFetched: 200,
			});
			expect(b).toEqual({
				path: "/data/b",
				groupCount: 1,
				requestCount: 1,
				bytesFetched: 50,
			});
		});

		it("swallows errors thrown from the callback", async () => {
			let inner = fakeStore();
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			let store = withRangeCoalescing(inner, {
				onFlush: () => {
					throw new Error("boom");
				},
			});

			await expect(
				store.getRange("/data/chunk", { offset: 0, length: 100 }),
			).resolves.toBeDefined();
			expect(warn).toHaveBeenCalledOnce();
			warn.mockRestore();
		});

		it("does not emit for suffix reads", async () => {
			let inner = fakeStore();
			let reports: FlushReport[] = [];
			let store = withRangeCoalescing(inner, {
				onFlush: (r) => reports.push(r),
			});

			await store.getRange("/data/shard", { suffixLength: 1024 });
			expect(reports).toHaveLength(0);
		});
	});

	describe("error handling", () => {
		it("rejects all requests in a group when fetch fails", async () => {
			let inner = fakeStore();
			inner.getRange.mockRejectedValue(new Error("Network error"));
			let store = withRangeCoalescing(inner);

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
					return Promise.resolve(new Uint8Array(Math.floor(range.length / 2)));
				},
			);
			let store = withRangeCoalescing(inner);

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

	describe("signal merging", () => {
		it("merges caller signals via AbortSignal.any across a batch", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner);

			let a = new AbortController();
			let b = new AbortController();
			await Promise.all([
				store.getRange(
					"/data/chunk",
					{ offset: 0, length: 100 },
					{ signal: a.signal },
				),
				store.getRange(
					"/data/chunk",
					{ offset: 100, length: 100 },
					{ signal: b.signal },
				),
			]);

			let passedSignal = inner.getRange.mock.calls[0][2]?.signal;
			expect(passedSignal).toBeInstanceOf(AbortSignal);
			a.abort(new Error("a aborted"));
			expect(passedSignal?.aborted).toBe(true);
		});

		it("passes a single signal through unchanged", async () => {
			let inner = fakeStore();
			let store = withRangeCoalescing(inner);
			let ctl = new AbortController();

			await store.getRange(
				"/data/chunk",
				{ offset: 0, length: 100 },
				{ signal: ctl.signal },
			);
			expect(inner.getRange.mock.calls[0][2]?.signal).toBe(ctl.signal);
		});
	});

	describe("undefined data", () => {
		it("resolves with undefined when inner returns undefined", async () => {
			let inner = fakeStore();
			inner.getRange.mockResolvedValue(undefined);
			let store = withRangeCoalescing(inner);

			let result = await store.getRange("/data/chunk", {
				offset: 0,
				length: 100,
			});
			expect(result).toBeUndefined();
		});
	});
});
