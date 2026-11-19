import type { AbsolutePath, RangeQuery } from "@zarrita/storage";
import { describe, expect, it } from "vitest";
import { createShardedChunkGetter } from "../src/codecs/sharding.js";
import { Location } from "../src/hierarchy.js";

/**
 * A store holding one shard of four 1-byte chunks. Index fetches are held
 * until `release()` so tests can abort readers while one is in flight.
 */
function shardStore() {
	let index = new BigUint64Array([0n, 1n, 1n, 1n, 2n, 1n, 3n, 1n]);
	let shard = new Uint8Array(4 + index.byteLength);
	shard.set([10, 11, 12, 13]);
	shard.set(new Uint8Array(index.buffer), 4);
	let indexFetches: { signal?: AbortSignal; release: () => void }[] = [];
	let store = {
		async get() {
			return undefined;
		},
		getRange(
			_key: AbsolutePath,
			range: RangeQuery,
			options?: { signal?: AbortSignal },
		): Promise<Uint8Array | undefined> {
			if (!("suffixLength" in range)) {
				let { offset, length } = range;
				return Promise.resolve(shard.slice(offset, offset + length));
			}
			let { suffixLength } = range;
			return new Promise((resolve, reject) => {
				let signal = options?.signal;
				signal?.addEventListener("abort", () => reject(signal.reason));
				indexFetches.push({
					signal,
					release: () => resolve(shard.slice(-suffixLength)),
				});
			});
		},
	};
	let getChunk = createShardedChunkGetter(
		new Location(store),
		[4],
		(coord) => `c/${coord.join("/")}`,
		{
			chunk_shape: [1],
			codecs: [{ name: "bytes", configuration: { endian: "little" } }],
			index_codecs: [{ name: "bytes", configuration: { endian: "little" } }],
		},
	);
	return { getChunk, indexFetches };
}

/** Let the pending index request reach the store. */
let tick = () => new Promise((resolve) => setTimeout(resolve));

describe("aborting reads that share a shard index", () => {
	it("one read aborting does not fail the others", async () => {
		let { getChunk, indexFetches } = shardStore();
		let a = new AbortController();
		let b = new AbortController();
		let first = getChunk([0], { signal: a.signal });
		let second = getChunk([1], { signal: b.signal });
		await tick();
		expect(indexFetches).toHaveLength(1);

		a.abort(new Error("a aborted"));
		await expect(first).rejects.toThrow("a aborted");
		expect(indexFetches[0].signal?.aborted).toBe(false);

		indexFetches[0].release();
		expect(await second).toEqual(new Uint8Array([11]));
	});

	it("cancels the index fetch once every read has aborted", async () => {
		let { getChunk, indexFetches } = shardStore();
		let a = new AbortController();
		let b = new AbortController();
		let reads = Promise.allSettled([
			getChunk([0], { signal: a.signal }),
			getChunk([1], { signal: b.signal }),
		]);
		await tick();
		a.abort();
		b.abort();
		expect(indexFetches[0].signal?.aborted).toBe(true);
		for (let result of await reads) {
			expect(result.status).toBe("rejected");
		}
	});

	it("a read after a cancelled fetch starts a fresh one", async () => {
		let { getChunk, indexFetches } = shardStore();
		let a = new AbortController();
		let first = getChunk([0], { signal: a.signal });
		await tick();
		a.abort(new Error("a aborted"));
		await expect(first).rejects.toThrow("a aborted");

		let second = getChunk([2]);
		await tick();
		expect(indexFetches).toHaveLength(2);
		indexFetches[1].release();
		expect(await second).toEqual(new Uint8Array([12]));
	});
});
