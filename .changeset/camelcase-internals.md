---
"zarrita": minor
---

**BREAKING**: `zarr.create` options now use camelCase (`chunkShape`, `dataType`, `fillValue`, `chunkSeparator`, `dimensionNames`).

```ts
zarr.create(store, {
  shape: [100, 100],
  chunkShape: [10, 10],
  dataType: "float32",
  fillValue: 0,
  dimensionNames: ["y", "x"],
});
```
