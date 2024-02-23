import { expect, it } from "vitest";

import * as mod from "./index.js";

it("exports all the things", () => {
	expect(mod).toMatchInlineSnapshot(`
		{
		  "Array": [Function],
		  "FetchStore": [Function],
		  "Group": [Function],
		  "KeyError": [Function],
		  "Location": [Function],
		  "NodeNotFoundError": [Function],
		  "_internal_get_array_context": [Function],
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
		  },
		  "root": [Function],
		  "set": [Function],
		  "slice": [Function],
		  "tryWithConsolidated": [Function],
		  "withConsolidated": [Function],
		}
	`);
});
