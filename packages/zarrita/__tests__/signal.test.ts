import * as path from "node:path";
import * as url from "node:url";
import type {
	AbsolutePath,
	AsyncReadable,
	GetOptions,
	RangeQuery,
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
		let fsStore = new zarr.FileSystemStore(fixturesRoot);
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
		let fsStore = new zarr.FileSystemStore(fixturesRoot);
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
		let fsStore = new zarr.FileSystemStore(fixturesRoot);
		let { store, calls } = recordingStore(fsStore);
		let arr = await zarr.open.v3(
			zarr.root(store).resolve("1d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
		let ctl = new AbortController();
		await zarr.get(arr, null, { signal: ctl.signal });
		// The shard index + shard chunk reads should both see our signal.
		let rangeCalls = calls.filter((c) => c?.signal === ctl.signal);
		expect(rangeCalls.length).toBeGreaterThan(0);
	});

	it("still accepts the deprecated `opts` shim", async () => {
		let fsStore = new zarr.FileSystemStore(fixturesRoot);
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
		let fsStore = new zarr.FileSystemStore(fixturesRoot);
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
	it("reaches the inner store through multiple middlewares", async () => {
		let fsStore = new zarr.FileSystemStore(fixturesRoot);
		let { store: recorder, calls } = recordingStore(fsStore);
		let composed = await zarr.extendStore(recorder, (s) =>
			zarr.withRangeBatching(s),
		);
		let arr = await zarr.open.v3(
			zarr.root(composed).resolve("1d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
		let ctl = new AbortController();
		await zarr.get(arr, null, { signal: ctl.signal });
		// At least one of the inner-store calls carried our signal through
		// the batching middleware.
		let seen = calls.some((c) => c?.signal === ctl.signal);
		expect(seen).toBe(true);
	});
});
