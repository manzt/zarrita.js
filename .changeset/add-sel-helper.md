---
"zarrita": minor
---

Add `sel` helper for named-dimension selection. Converts a record of dimension names to the positional selection array that `get` and `set` accept, using the array's `dimensionNames` metadata. Throws for unknown dimension names.

```ts
let arr = await zarr.open(store, { kind: "array" });
// arr.dimensionNames -> ["time", "lat", "lon"]

let selection = zarr.sel(arr, { lat: zarr.slice(100, 200), time: 0 });
// -> [0, slice(100, 200), null]

let result = await zarr.get(arr, selection);
```
