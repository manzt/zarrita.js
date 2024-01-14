---
"@zarrita/indexing": minor
"zarrita": minor
"@zarrita/core": minor
---

feat: Add `withConsolidated` store utility

**BREAKING**: Replaces [`openConsolidated`](https://github.com/manzt/zarrita.js/pull/91)
to provide a consistent interface for accessing consolidated and non-consolidated stores.

```javascript
import * as zarr from "zarrita";

// non-consolidated
let store = new zarr.FetchStore("https://localhost:8080/data.zarr");
let grp = await zarr.open(store); // network request for .zgroup/.zattrs
let foo = await zarr.open(grp.resolve("/foo"), { kind: array }); // network request for .zarray/.zattrs

// consolidated
let store = new zarr.FetchStore("https://localhost:8080/data.zarr");
let consolidatedStore = await zarr.withConsolidated(store); // opens ./zmetadata
let contents = consolidatedStore.contents(); // [ {path: "/", kind: "group" }, { path: "/foo", kind: "array" }, ...]
let grp = await zarr.open(consolidatedStore); // no network request
let foo = await zarr.open(grp.resolve(contents[1].path), {
  kind: contents[1].kind,
}); // no network request
```
