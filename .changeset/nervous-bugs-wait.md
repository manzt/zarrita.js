---
"zarrita": patch
"@zarrita/core": patch
---

feat: Add `openConsolidated` helper

A utility for working with v2 consolidated metadata.

```javascript
import * as zarr from "zarrita";

let store = new zarr.FetchStore("http://localhost:8080/data.zarr");
let hierarchy = await zarr.openConsolidated(store);
hierarchy.contents;
// Map {
//  "/" => Group,
//  "/foo" => Array,
//  "/bar" => Group,
//  "/bar/baz" => Array,
// }
let grp = hierarchy.root(); // Group
let foo = hierarchy.open("/foo", { kind: "array" }); // Array
let baz = hierarchy.open(grp.resolve("bar/baz"), { kind: "array" }); // Array
let bar = hierarchy.open(baz.resolve(".."), { kind: "group" }); // Group
```
