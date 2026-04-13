---
"zarrita": minor
---

Auto-apply array extensions carried by a store

A store extension factory may now declare an `arrayExtensions` field on its
returned overrides. `defineStoreExtension` merges each layer's list with the
inner store's (inner-first, outer-last), and `zarr.open` applies the resulting
list to every `zarr.Array` it returns — so downstream consumers don't need to
call `zarr.extendArray` at each call site.

This is the primitive for virtual-format adapters (hdf5-as-virtual-zarr,
tiff-as-virtual-zarr, parquet-as-virtual-zarr) that pair a transport-layer
store extension (synthesizing metadata keys) with a data-layer array extension
(supplying decoded chunks) from a single factory with shared closure state:

```ts
const hdf5VirtualZarr = zarr.defineStoreExtension((inner, opts: { root: string }) => {
  let parsed = parseHdf5(opts.root);
  return {
    async get(key, options) {
      if (isVirtualMetadataKey(key, parsed)) return synthesizeJson(key, parsed);
      return inner.get(key, options);
    },
    arrayExtensions: [
      zarr.defineArrayExtension((_inner) => ({
        async getChunk(coords) { return parsed.readChunk(coords); },
      })),
    ],
  };
});

let store = await zarr.extendStore(raw, (s) => hdf5VirtualZarr(s, { root: "/img" }));
let arr = await zarr.open(store, { kind: "array", path: "/img" }); // auto-wrapped
```

Also exports a new public type `zarr.ArrayExtension` for authoring these lists.
