---
"zarrita": minor
---

Introduce composable store and array extensions via `defineStoreExtension` and `defineArrayExtension`

**New APIs:**

- `zarr.defineStoreExtension(factory)` — define a store extension with automatic Proxy delegation. The factory receives an `AsyncReadable` store and options, returning overrides and extensions. Supports sync and async factories.
- `zarr.defineArrayExtension(factory)` — define an array extension that intercepts `getChunk` on a `zarr.Array`. Same Proxy-delegation model.
- `zarr.extendStore(store, ...extensions)` — compose store extensions in a pipeline. Each extension is `(store) => newStore`. Returns `Promise` to support async extensions like `withConsolidatedMetadata`.
- `zarr.extendArray(array, ...extensions)` — compose array extensions in a pipeline.

**Renamed:**

- `withConsolidated` → `withConsolidatedMetadata`
- `tryWithConsolidated` → `withMaybeConsolidatedMetadata`
- `WithConsolidatedOptions` → `ConsolidatedMetadataOptions`
- `BatchedRangeStoreOptions` → `RangeBatchingOptions`
- `Stats` → `RangeBatchingStats`

**Migration:**

The previous exports are still available but deprecated. Update your imports:

```ts
import * as zarr from "zarrita";

// Pipeline composition (use arrow functions for full type inference)
let store = await zarr.extendStore(
  new zarr.FetchStore("https://..."),
  zarr.withConsolidatedMetadata,
  (s) => zarr.withRangeBatching(s, { mergeOptions: (batch) => batch[0] }),
);
```

**Defining custom extensions:**

```ts
import * as zarr from "zarrita";

const withCaching = zarr.defineStoreExtension(
  (store, opts: { maxSize?: number }) => {
    let cache = new Map();
    return {
      async get(key, options) {
        let hit = cache.get(key);
        if (hit) return hit;
        let result = await store.get(key, options);
        if (result) cache.set(key, result);
        return result;
      },
      clear() { cache.clear(); },
    };
  },
);
```

`BatchedRangeStore` class has been removed in favor of `withRangeBatching` built on `zarr.defineStoreExtension`.
