---
"zarrita": minor
---

**BREAKING**: `zarr.create` options now use camelCase (`chunkShape`, `fillValue`, `chunkSeparator`, `dimensionNames`).

```ts
await zarr.create(store, {
  dtype: "float32",            // was data_type
  shape: [100, 100],
  chunkShape: [10, 10],        // was chunk_shape
  fillValue: 0,                // was fill_value
  dimensionNames: ["y", "x"],  // was dimension_names
})
```
