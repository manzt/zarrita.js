---
"zarrita": patch
"@zarrita/core": patch
---

feat: Add `openConsolidated` helper

A utility for working with v2 consolidated metadata.

```javascript
import * as zarr from "zarrita";

let store = new zarr.FetchStore("http://localhost:8080/data.zarr");
let nodes = await zarr.openConsolidated(store);
nodes; // [zarr.Group, zarr.Array, zarr.Array, ...]
```
