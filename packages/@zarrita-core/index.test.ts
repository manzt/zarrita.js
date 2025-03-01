import { expect, it } from "vitest";

import * as mod from "./index.js";

it("exports all the things", () => {
	expect(mod).toMatchInlineSnapshot(`
		{
		  "Array": [Function],
		  "BoolArray": [Function],
		  "ByteStringArray": [Function],
		  "FetchStore": [Function],
		  "Group": [Function],
		  "IndexError": [Function],
		  "KeyError": [Function],
		  "Location": [Function],
		  "NodeNotFoundError": [Function],
		  "UnicodeStringArray": [Function],
		  "_zarrita_internal_get": [Function],
		  "_zarrita_internal_get_strides": [Function],
		  "_zarrita_internal_set": [Function],
		  "_zarrita_internal_slice_indices": [Function],
		  "create": [Function],
		  "get": [Function],
		  "open": [Function],
		  "registry": Map {
		    "blosc" => [Function],
		    "gzip" => [Function],
		    "lz4" => [Function],
		    "zlib" => [Function],
		    "zstd" => [Function],
		    "transpose" => [Function],
		    "bytes" => [Function],
		    "crc32c" => [Function],
		    "vlen-utf8" => [Function],
		    "json2" => [Function],
		    "bitround" => [Function],
		  },
		  "root": [Function],
		  "set": [Function],
		  "slice": [Function],
		  "tryWithConsolidated": [Function],
		  "withConsolidated": [Function],
		}
	`);
});
