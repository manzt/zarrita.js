---
"zarrita": minor
---

feat: Add `tryWithConsolidated` store helper

Provides a convenient way to open a store that may or may not have consolidated
metadata. Ideal for usage senarios with known access paths, since store with
consolidated metadata do not incur additional network requests when accessing
underlying groups and arrays.

```js
import * as zarr from "zarrita";

let store = await zarr.tryWithConsolidated(
  new zarr.FetchStore("https://localhost:8080/data.zarr");
);

// The following do not read from the store
// (make network requests) if it is consolidated.
let grp = await zarr.open(store, { kind: "group" });
let foo = await zarr.open(grp.resolve("foo"), { kind: "array" });
```
