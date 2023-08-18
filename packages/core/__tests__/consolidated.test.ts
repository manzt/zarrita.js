import { describe, expect, it, vi } from "vitest";
import * as path from "node:path";
import * as url from "node:url";

import { FetchStore, FileSystemStore } from "@zarrita/storage";
import { withConsolidated } from "../src/consolidated.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("withConsolidated", () => {
	it("works with FileSystemStore", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = await withConsolidated(new FileSystemStore(root));
		expect(store.metadata).toMatchInlineSnapshot(`
			{
			  ".zgroup": {
			    "zarr_format": 2,
			  },
			  "1d.chunked.i2/.zarray": {
			    "chunks": [
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.chunked.ragged.i2/.zarray": {
			    "chunks": [
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      5,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.S7/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "|S7",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.U13.be/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": ">U13",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.U13.le/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<U13",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.U7/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<U7",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.b1/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "|b1",
			    "fill_value": false,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.blosc.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.f4.be/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": ">f4",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.f4.le/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<f4",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.f8/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<f8",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.i4/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i4",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.lz4.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "acceleration": 1,
			      "id": "lz4",
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.raw.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": null,
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.u1/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "|u1",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.zlib.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "id": "zlib",
			      "level": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.zstd.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "id": "zstd",
			      "level": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.chunked.U7/.zarray": {
			    "chunks": [
			      1,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<U7",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      2,
			      2,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.chunked.i2/.zarray": {
			    "chunks": [
			      1,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      2,
			      2,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.chunked.ragged.i2/.zarray": {
			    "chunks": [
			      2,
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.contiguous.i2/.zarray": {
			    "chunks": [
			      2,
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      2,
			      2,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.chunked.i2/.zarray": {
			    "chunks": [
			      1,
			      1,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.chunked.mixed.i2.C/.zarray": {
			    "chunks": [
			      3,
			      3,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.chunked.mixed.i2.F/.zarray": {
			    "chunks": [
			      3,
			      3,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "F",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.contiguous.i2/.zarray": {
			    "chunks": [
			      3,
			      3,
			      3,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			}
		`);
	});

	it("works with FetchStore", async () => {
		// `vitest --api` exposes the port 51204
		// ref: https://vitest.dev/config/#api
		let href = "http://localhost:51204/fixtures/v2/data.zarr";
		let store = await withConsolidated(new FetchStore(href));
		expect(store.metadata).toMatchInlineSnapshot(`
			{
			  ".zgroup": {
			    "zarr_format": 2,
			  },
			  "1d.chunked.i2/.zarray": {
			    "chunks": [
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.chunked.ragged.i2/.zarray": {
			    "chunks": [
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      5,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.S7/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "|S7",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.U13.be/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": ">U13",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.U13.le/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<U13",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.U7/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<U7",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.b1/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "|b1",
			    "fill_value": false,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.blosc.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.f4.be/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": ">f4",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.f4.le/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<f4",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.f8/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<f8",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.i4/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i4",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.lz4.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "acceleration": 1,
			      "id": "lz4",
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.raw.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": null,
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.u1/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "|u1",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.zlib.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "id": "zlib",
			      "level": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "1d.contiguous.zstd.i2/.zarray": {
			    "chunks": [
			      4,
			    ],
			    "compressor": {
			      "id": "zstd",
			      "level": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      4,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.chunked.U7/.zarray": {
			    "chunks": [
			      1,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<U7",
			    "fill_value": "",
			    "filters": null,
			    "order": "C",
			    "shape": [
			      2,
			      2,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.chunked.i2/.zarray": {
			    "chunks": [
			      1,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      2,
			      2,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.chunked.ragged.i2/.zarray": {
			    "chunks": [
			      2,
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "2d.contiguous.i2/.zarray": {
			    "chunks": [
			      2,
			      2,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      2,
			      2,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.chunked.i2/.zarray": {
			    "chunks": [
			      1,
			      1,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.chunked.mixed.i2.C/.zarray": {
			    "chunks": [
			      3,
			      3,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.chunked.mixed.i2.F/.zarray": {
			    "chunks": [
			      3,
			      3,
			      1,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "F",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			  "3d.contiguous.i2/.zarray": {
			    "chunks": [
			      3,
			      3,
			      3,
			    ],
			    "compressor": {
			      "blocksize": 0,
			      "clevel": 5,
			      "cname": "lz4",
			      "id": "blosc",
			      "shuffle": 1,
			    },
			    "dtype": "<i2",
			    "fill_value": 0,
			    "filters": null,
			    "order": "C",
			    "shape": [
			      3,
			      3,
			      3,
			    ],
			    "zarr_format": 2,
			  },
			}
		`);
	});

	it("should avoid reading metadata from the underlying store", async () => {
		let root = path.join(__dirname, "../../../fixtures/v2/data.zarr");
		let store = new FileSystemStore(root);
		let consolidated = await withConsolidated(store);
		let spy = vi.spyOn(store, "get");
		let meta_bytes = await consolidated.get("/.zgroup");
		expect(spy).not.toHaveBeenCalled();
		expect(meta_bytes).toBeDefined();
	});
});
