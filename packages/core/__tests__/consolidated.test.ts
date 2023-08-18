import { describe, expect, it } from "vitest";
import * as path from "node:path";
import * as url from "node:url";

import { FetchStore, FileSystemStore } from "@zarrita/storage";
import { openConsolidated } from "../src/consolidated.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("openConsolidated", () => {
	it("works with FileSystemStore", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let nodes = await openConsolidated(new FileSystemStore(root));
		expect(
			nodes.map((node) => ({
				kind: node.kind,
				path: node.path,
				attrs: node.attrs,
			})),
		).toMatchInlineSnapshot(`
			[
			  {
			    "attrs": {
			      "answer": 42,
			    },
			    "kind": "group",
			    "path": "/",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.chunked.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.chunked.ragged.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.S7",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.U13.be",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.U13.le",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.U7",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.b1",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.blosc.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.f4.be",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.f4.le",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.f8",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.i4",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.lz4.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.raw.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.u1",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.zlib.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.zstd.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.chunked.U7",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.chunked.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.chunked.ragged.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.contiguous.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.chunked.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.chunked.mixed.i2.C",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.chunked.mixed.i2.F",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.contiguous.i2",
			  },
			]
		`);
	});

	it("works with FetchStore", async () => {
		// `vitest --api` exposes the port 51204
		// ref: https://vitest.dev/config/#api
		let href = "http://localhost:51204/fixtures/v2/data.zarr";
		let nodes = await openConsolidated(new FetchStore(href));
		expect(
			nodes.map((node) => ({
				kind: node.kind,
				path: node.path,
				attrs: node.attrs,
			})),
		).toMatchInlineSnapshot(`
			[
			  {
			    "attrs": {
			      "answer": 42,
			    },
			    "kind": "group",
			    "path": "/",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.chunked.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.chunked.ragged.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.S7",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.U13.be",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.U13.le",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.U7",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.b1",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.blosc.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.f4.be",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.f4.le",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.f8",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.i4",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.lz4.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.raw.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.u1",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.zlib.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/1d.contiguous.zstd.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.chunked.U7",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.chunked.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.chunked.ragged.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/2d.contiguous.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.chunked.i2",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.chunked.mixed.i2.C",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.chunked.mixed.i2.F",
			  },
			  {
			    "attrs": {},
			    "kind": "array",
			    "path": "/3d.contiguous.i2",
			  },
			]
		`);
	});

	it("loads data", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let nodes = await openConsolidated(new FileSystemStore(root));
		let arr = nodes.find((node) => node.path === "/3d.chunked.mixed.i2.C");
		expect(await (arr as any).getChunk([0, 0, 0])).toMatchInlineSnapshot(`
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
});
