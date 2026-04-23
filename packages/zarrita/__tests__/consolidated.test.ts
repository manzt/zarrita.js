import * as path from "node:path";
import * as url from "node:url";
import { FileSystemStore } from "@zarrita/storage";
import { assert, describe, expect, it } from "vitest";
import { NotFoundError } from "../src/errors.js";
import {
	withConsolidatedMetadata,
	withMaybeConsolidatedMetadata,
} from "../src/extension/consolidation.js";
import { Array as ZarrArray } from "../src/hierarchy.js";
import { open } from "../src/open.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("withConsolidatedMetadata", () => {
	it("loads consolidated metadata", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withConsolidatedMetadata(new FileSystemStore(root));
		let map = new Map(store.contents().map((x) => [x.path, x.kind]));
		expect(map).toMatchInlineSnapshot(`
			Map {
			  "/" => "group",
			  "/1d.chunked.i2" => "array",
			  "/1d.chunked.ragged.i2" => "array",
			  "/1d.contiguous.S7" => "array",
			  "/1d.contiguous.U13.be" => "array",
			  "/1d.contiguous.U13.le" => "array",
			  "/1d.contiguous.U7" => "array",
			  "/1d.contiguous.b1" => "array",
			  "/1d.contiguous.bitround.f4" => "array",
			  "/1d.contiguous.blosc.i2" => "array",
			  "/1d.contiguous.delta.i2" => "array",
			  "/1d.contiguous.delta.shuffle.i2" => "array",
			  "/1d.contiguous.f4.be" => "array",
			  "/1d.contiguous.f4.le" => "array",
			  "/1d.contiguous.f8" => "array",
			  "/1d.contiguous.fixedscaleoffset.f4" => "array",
			  "/1d.contiguous.i4" => "array",
			  "/1d.contiguous.json2.O" => "array",
			  "/1d.contiguous.lz4.i2" => "array",
			  "/1d.contiguous.raw.i2" => "array",
			  "/1d.contiguous.shuffle.i2" => "array",
			  "/1d.contiguous.u1" => "array",
			  "/1d.contiguous.zlib.i2" => "array",
			  "/1d.contiguous.zstd.i2" => "array",
			  "/2d.chunked.U7" => "array",
			  "/2d.chunked.i2" => "array",
			  "/2d.chunked.ragged.i2" => "array",
			  "/2d.contiguous.i2" => "array",
			  "/3d.chunked.O" => "array",
			  "/3d.chunked.i2" => "array",
			  "/3d.chunked.mixed.i2.C" => "array",
			  "/3d.chunked.mixed.i2.F" => "array",
			  "/3d.contiguous.i2" => "array",
			  "/my group with spaces" => "group",
			}
		`);
	});

	it("loads chunk data from underlying store", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withConsolidatedMetadata(new FileSystemStore(root));
		// biome-ignore lint/style/noNonNullAssertion: Fine for a test
		let entry = store
			.contents()
			.find((x) => x.path === "/3d.chunked.mixed.i2.C")!;
		let grp = await open(store, { kind: "group" });
		let arr = await open(grp.resolve(entry.path), { kind: entry.kind });
		expect(arr).toBeInstanceOf(ZarrArray);
		// @ts-expect-error - we know this is an array
		expect(await arr.getChunk([0, 0, 0])).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    0,
			    3,
			    6,
			    9,
			    12,
			    15,
			    18,
			    21,
			    24,
			  ],
			  "shape": [
			    3,
			    3,
			    1,
			  ],
			  "stride": [
			    3,
			    1,
			    1,
			  ],
			}
		`);
	});

	it("loads and navigates from root", async () => {
		let path_root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withConsolidatedMetadata(new FileSystemStore(path_root));
		let grp = await open(store, { kind: "group" });
		expect(grp.kind).toBe("group");
		let arr = await open(grp.resolve("1d.chunked.i2"), { kind: "array" });
		expect(arr.kind).toBe("array");
	});

	it("throws if consolidated metadata is missing", async () => {
		let root = path.join(
			__dirname,
			"../../../fixtures/v2/data.zarr/3d.contiguous.i2",
		);
		let try_open = () =>
			withConsolidatedMetadata(new FileSystemStore(root), { format: "v2" });
		await expect(try_open).rejects.toThrowError(NotFoundError);
		await expect(try_open).rejects.toThrowErrorMatchingInlineSnapshot(
			"[NotFoundError: Not found: v2 consolidated metadata]",
		);
	});
});

describe("withConsolidatedMetadata (v3)", () => {
	let v3root = path.join(
		__dirname,
		"../../../fixtures/v3/data.zarr/consolidated",
	);

	it("loads v3 consolidated metadata", async () => {
		let store = await withConsolidatedMetadata(new FileSystemStore(v3root), {
			format: "v3",
		});
		let map = new Map(store.contents().map((x) => [x.path, x.kind]));
		expect(map).toMatchInlineSnapshot(`
			Map {
			  "/" => "group",
			  "/1d.chunked.i2" => "array",
			  "/2d.contiguous.i2" => "array",
			  "/nested" => "group",
			  "/nested/1d.i2" => "array",
			}
		`);
	});

	it("loads chunk data from underlying store", async () => {
		let store = await withConsolidatedMetadata(new FileSystemStore(v3root), {
			format: "v3",
		});
		let grp = await open(store, { kind: "group" });
		let arr = await open(grp.resolve("/1d.chunked.i2"), { kind: "array" });
		expect(arr).toBeInstanceOf(ZarrArray);
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			  ],
			  "shape": [
			    2,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("loads and navigates from root", async () => {
		let store = await withConsolidatedMetadata(new FileSystemStore(v3root), {
			format: "v3",
		});
		let grp = await open(store, { kind: "group" });
		expect(grp.kind).toBe("group");
		expect(grp.attrs).toEqual({ answer: 42 });
		let arr = await open(grp.resolve("1d.chunked.i2"), { kind: "array" });
		expect(arr.kind).toBe("array");
	});

	it("throws if v3 consolidated metadata is missing", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let try_open = () =>
			withConsolidatedMetadata(new FileSystemStore(root), { format: "v3" });
		await expect(try_open).rejects.toThrowError(NotFoundError);
	});

	// Regression for https://github.com/manzt/zarrita.js/issues/410: opening an
	// int64/uint64 array from a consolidated store used to poison the cache
	// with a BigInt fill_value, so the next `store.get` would throw
	// "Do not know how to serialize a BigInt" from `JSON.stringify`.
	it("opens int64/uint64 arrays without poisoning the cache", async () => {
		let baseMeta = {
			node_type: "array",
			zarr_format: 3,
			shape: [4],
			chunk_grid: {
				name: "regular",
				configuration: { chunk_shape: [4] },
			},
			chunk_key_encoding: {
				name: "default",
				configuration: { separator: "/" },
			},
			codecs: [{ name: "bytes", configuration: { endian: "little" } }],
			attributes: {},
		};
		let rootMeta = {
			zarr_format: 3,
			node_type: "group",
			attributes: {},
			consolidated_metadata: {
				kind: "inline",
				must_understand: false,
				metadata: {
					time: { ...baseMeta, data_type: "int64", fill_value: 0 },
					band: { ...baseMeta, data_type: "int16", fill_value: 0 },
				},
			},
		};
		let bytes = new TextEncoder().encode(JSON.stringify(rootMeta));
		let backing = {
			async get(key: string) {
				return key === "/zarr.json" ? bytes : undefined;
			},
		};
		let store = await withConsolidatedMetadata(backing, { format: "v3" });
		let grp = await open(store, { kind: "group" });
		let time = await open(grp.resolve("time"), { kind: "array" });
		let band = await open(grp.resolve("band"), { kind: "array" });
		expect(time.dtype).toBe("int64");
		expect(band.dtype).toBe("int16");
		// `ensureCorrectScalar` still runs on the freshly-decoded copy inside
		// `_openV3`, so int64 fill_values are converted to BigInt.
		expect(typeof time.fillValue).toBe("bigint");
		// Re-opening the same array must also work — proves the cache entry
		// stayed JSON-serializable after the first open.
		let timeAgain = await open(grp.resolve("time"), { kind: "array" });
		expect(timeAgain.dtype).toBe("int64");
	});
});

describe("withConsolidatedMetadata (format array)", () => {
	it("tries formats in order", async () => {
		let root = path.join(
			__dirname,
			"../../../fixtures/v3/data.zarr/consolidated",
		);
		let store = await withConsolidatedMetadata(new FileSystemStore(root), {
			format: ["v3", "v2"],
		});
		let contents = store.contents();
		expect(contents.length).toBeGreaterThan(0);
		let map = new Map(contents.map((x) => [x.path, x.kind]));
		expect(map.get("/")).toBe("group");
	});

	it("falls back to second format", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withConsolidatedMetadata(new FileSystemStore(root), {
			format: ["v3", "v2"],
		});
		let contents = store.contents();
		expect(contents.length).toBeGreaterThan(0);
	});
});

describe("withMaybeConsolidatedMetadata", () => {
	it("creates Listable from consolidated store", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withMaybeConsolidatedMetadata(new FileSystemStore(root));
		expect(store).toHaveProperty("contents");
	});

	it("falls back to original store if missing consolidated metadata", async () => {
		let root = path.join(
			__dirname,
			"../../../fixtures/v2/data.zarr/3d.contiguous.i2",
		);
		let store = await withMaybeConsolidatedMetadata(new FileSystemStore(root));
		expect(store).toBeInstanceOf(FileSystemStore);
	});

	it("supports a zmetadataKey option", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withMaybeConsolidatedMetadata(new FileSystemStore(root), {
			metadataKey: ".zmetadata",
		});
		expect(store).toHaveProperty("contents");
	});

	it("falls back to original store if metadataKey is incorrect", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withMaybeConsolidatedMetadata(new FileSystemStore(root), {
			metadataKey: ".nonexistent",
		});
		expect(store).toBeInstanceOf(FileSystemStore);
	});
});

describe("Listable.getRange", () => {
	it("does not expose getRange if the underlying store does not support it", async () => {
		let store = await withMaybeConsolidatedMetadata(new Map());
		expect("getRange" in store).toBeFalsy();
	});
	it("retrieves a byte range from an underlying store", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withMaybeConsolidatedMetadata(new FileSystemStore(root));
		assert(typeof store.getRange === "function");
	});
});
