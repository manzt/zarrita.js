import { expect, test } from "vitest";
import * as zarrita from "zarrita";

test("public API surface", () => {
	expect(Object.keys(zarrita).sort()).toMatchInlineSnapshot(`
		[
		  "Array",
		  "BoolArray",
		  "ByteStringArray",
		  "CodecPipelineError",
		  "FetchStore",
		  "Group",
		  "InvalidMetadataError",
		  "InvalidSelectionError",
		  "Location",
		  "NotFoundError",
		  "UnicodeStringArray",
		  "UnknownCodecError",
		  "UnsupportedError",
		  "_zarrita_internal_get",
		  "_zarrita_internal_getStrides",
		  "_zarrita_internal_set",
		  "_zarrita_internal_sliceIndices",
		  "create",
		  "defineArrayExtension",
		  "defineStoreExtension",
		  "extendArray",
		  "extendStore",
		  "get",
		  "isZarritaError",
		  "open",
		  "registry",
		  "root",
		  "select",
		  "set",
		  "slice",
		  "withByteCaching",
		  "withConsolidatedMetadata",
		  "withMaybeConsolidatedMetadata",
		  "withRangeCoalescing",
		]
	`);
});
