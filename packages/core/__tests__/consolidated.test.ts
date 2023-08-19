import { describe, expect, it } from "vitest";
import * as path from "node:path";
import * as url from "node:url";

import { FileSystemStore } from "@zarrita/storage";
import { openConsolidated } from "../src/consolidated.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("openConsolidated", () => {
	it("loads consolidated metadata", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let h = await openConsolidated(new FileSystemStore(root));
		let map = new Map(
			[...h.contents.values()].map((entry) => [entry.path, entry.kind]),
		);
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
			  "/1d.contiguous.blosc.i2" => "array",
			  "/1d.contiguous.f4.be" => "array",
			  "/1d.contiguous.f4.le" => "array",
			  "/1d.contiguous.f8" => "array",
			  "/1d.contiguous.i4" => "array",
			  "/1d.contiguous.lz4.i2" => "array",
			  "/1d.contiguous.raw.i2" => "array",
			  "/1d.contiguous.u1" => "array",
			  "/1d.contiguous.zlib.i2" => "array",
			  "/1d.contiguous.zstd.i2" => "array",
			  "/2d.chunked.U7" => "array",
			  "/2d.chunked.i2" => "array",
			  "/2d.chunked.ragged.i2" => "array",
			  "/2d.contiguous.i2" => "array",
			  "/3d.chunked.i2" => "array",
			  "/3d.chunked.mixed.i2.C" => "array",
			  "/3d.chunked.mixed.i2.F" => "array",
			  "/3d.contiguous.i2" => "array",
			}
		`);
	});

	it("loads chunk data from underlying store", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let h = await openConsolidated(new FileSystemStore(root));
		let arr = h.open("/3d.chunked.mixed.i2.C", { kind: "array" });
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
		let h = await openConsolidated(new FileSystemStore(path_root));
		let grp = h.root();
		expect(grp.kind).toBe("group");
		let arr = h.open(grp.resolve("1d.chunked.i2"), { kind: "array" });
		expect(arr.kind).toBe("array");
	});
});
