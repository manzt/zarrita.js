---
"zarrita": minor
---

Add v3 consolidated metadata support to `withConsolidated`. The v3 format reads `consolidated_metadata` from the root `zarr.json`, matching zarr-python's implementation. Note that v3 consolidated metadata is not yet part of the official Zarr v3 spec and should be considered experimental.

A new `format` option controls which format(s) to try, accepting a single string or an array for fallback ordering. When omitted, format is auto-detected using the store's version history.

```ts
await withConsolidated(store);                            // auto-detect
await withConsolidated(store, { format: "v2" });          // v2 only
await withConsolidated(store, { format: "v3" });          // v3 only
await withConsolidated(store, { format: ["v3", "v2"] });  // try v3, fall back to v2
```
