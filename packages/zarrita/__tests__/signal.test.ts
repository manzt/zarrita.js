import * as path from "node:path";
import * as url from "node:url";
import {
	type AbsolutePath,
	type AsyncReadable,
	FileSystemStore,
	type GetOptions,
	type RangeQuery,
} from "@zarrita/storage";
import { describe, expect, it } from "vitest";
import * as zarr from "../src/index.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));
let fixturesRoot = path.resolve(__dirname, "../../../fixtures/v3/data.zarr");

/** Wraps a store so every get/getRange call is observable. */
function recordingStore<S extends AsyncReadable>(inner: S) {
	let calls: Array<GetOptions | undefined> = [];
	let wrapped: AsyncReadable = {
		get(key, opts) {
			calls.push(opts);
			return inner.get(key, opts);
		},
	};
	if (inner.getRange) {
		wrapped.getRange = (
			key: AbsolutePath,
			range: RangeQuery,
			opts?: GetOptions,
		) => {
			calls.push(opts);
			return inner.getRange?.(key, range, opts) ?? Promise.resolve(undefined);
		};
	}
	return { store: wrapped, calls };
}

describe("signal propagation through zarr.get", () => {
	it("passes signal to store.get for a simple array", async () => {
		let fsStore = new FileSystemStore(fixturesRoot);
		let { store, calls } = recordingStore(fsStore);
		let arr = await zarr.open.v3(
			zarr.root(store).resolve("1d.contiguous.raw.i2"),
			{
				kind: "array",
			},
		);
		let ctl = new AbortController();
		await zarr.get(arr, null, { signal: ctl.signal });
		expect(calls.length).toBeGreaterThan(0);
		let seen = calls.find((c) => c?.signal === ctl.signal);
		expect(seen).toBeDefined();
	});

	it("aborting signal rejects a pending zarr.get", async () => {
		let fsStore = new FileSystemStore(fixturesRoot);
		let arr = await zarr.open.v3(
			zarr.root(fsStore).resolve("1d.contiguous.raw.i2"),
			{ kind: "array" },
		);
		let ctl = new AbortController();
		ctl.abort(new Error("aborted"));
		await expect(zarr.get(arr, null, { signal: ctl.signal })).rejects.toThrow(
			/abort/i,
		);
	});

	it("propagates signal through a sharded chunk getter (#306)", async () => {
		let fsStore = new FileSystemStore(fixturesRoot);
		let { store, calls } = recordingStore(fsStore);
		let arr = await zarr.open.v3(
			zarr.root(store).resolve("1d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
		let ctl = new AbortController();
		await zarr.get(arr, null, { signal: ctl.signal });
		// Chunk data reads receive the caller's signal directly.
		let rangeCalls = calls.filter((c) => c?.signal === ctl.signal);
		expect(rangeCalls.length).toBeGreaterThan(0);
	});

	it("still accepts the deprecated `opts` shim", async () => {
		let fsStore = new FileSystemStore(fixturesRoot);
		let arr = await zarr.open.v3(
			zarr.root(fsStore).resolve("1d.contiguous.raw.i2"),
			{ kind: "array" },
		);
		let ctl = new AbortController();
		ctl.abort(new Error("aborted"));
		await expect(
			zarr.get(arr, null, { opts: { signal: ctl.signal } }),
		).rejects.toThrow(/abort/i);
	});

	it("merges `signal` and deprecated `opts.signal` via AbortSignal.any", async () => {
		let fsStore = new FileSystemStore(fixturesRoot);
		let arr = await zarr.open.v3(
			zarr.root(fsStore).resolve("1d.contiguous.raw.i2"),
			{ kind: "array" },
		);
		// Only the deprecated one is aborted; the resolved signal should
		// still be aborted because of AbortSignal.any.
		let live = new AbortController();
		let aborted = new AbortController();
		aborted.abort(new Error("deprecated aborted"));
		await expect(
			zarr.get(arr, null, {
				signal: live.signal,
				opts: { signal: aborted.signal },
			}),
		).rejects.toThrow(/abort/i);
	});
});

describe("zarr.set cancels on signal", () => {
	it("aborting signal rejects a pending zarr.set", async () => {
		let store = new Map<string, Uint8Array>();
		let arr = await zarr.create(store, {
			dtype: "int16",
			shape: [4],
			chunkShape: [2],
		});
		let ctl = new AbortController();
		ctl.abort(new Error("aborted"));
		await expect(
			zarr.set(arr, null, 42, { signal: ctl.signal }),
		).rejects.toThrow(/abort/i);
	});
});

describe("signal propagation through extendStore pipeline", () => {
	it("aborts an in-flight chunk data read in the inner store", async () => {
		let fsStore = new FileSystemStore(fixturesRoot);
		let started = Promise.withResolvers<AbortSignal | undefined>();
		let store: AsyncReadable = {
			get: fsStore.get.bind(fsStore),
			getRange(key, range, opts) {
				if ("offset" in range) started.resolve(opts?.signal);
				return fsStore.getRange(key, range, opts);
			},
		};
		let composed = zarr.extendStore(store, zarr.withRangeCoalescing);
		let arr = await zarr.open.v3(
			zarr.root(composed).resolve("1d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
		let ctl = new AbortController();
		let read = zarr.get(arr, [0], { signal: ctl.signal });
		let innerSignal = await started.promise;
		expect(innerSignal?.aborted).toBe(false);
		ctl.abort(new Error("cancel chunk read"));
		expect(innerSignal?.reason).toBe(ctl.signal.reason);
		await expect(read).rejects.toBe(ctl.signal.reason);
	});
});
