---
"zarrita": minor
---

Introduce composable store middleware via `defineStoreMiddleware`

**New APIs:**

- `zarr.defineStoreMiddleware(factory)` — define a store middleware with automatic Proxy delegation. The factory receives an `AsyncReadable` store and options, returning overrides and extensions. Supports sync and async factories.
- `zarr.defineStoreMiddleware.generic<OptsLambda>()(factory)` — for middleware whose options depend on the store's request options type (e.g., `mergeOptions`). Uses `GenericOptions` interface for higher-kinded type encoding.
- `zarr.extendStore(store, ...middleware)` — compose middleware in a pipeline. Each middleware is `(store) => newStore`. Returns `Promise` to support async middleware like `withConsolidation`.

**Renamed:**

- `withConsolidated` → `withConsolidation`
- `tryWithConsolidated` → `withMaybeConsolidation`
- `WithConsolidatedOptions` → `ConsolidationOptions`
- `BatchedRangeStoreOptions` → `RangeBatchingOptions`
- `Stats` → `RangeBatchingStats`

**Migration:**

The previous exports are still available but deprecated. Update your imports:

```ts
import * as zarr from "zarrita";

// Pipeline composition (use arrow functions for full type inference)
let store = await zarr.extendStore(
  new zarr.FetchStore("https://..."),
  zarr.withConsolidation,
  (s) => zarr.withRangeBatching(s, { mergeOptions: (batch) => batch[0] }),
);
```

**Defining custom middleware:**

```ts
import * as zarr from "zarrita";

const withCaching = zarr.defineStoreMiddleware(
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

`BatchedRangeStore` class has been removed in favor of `withRangeBatching` built on `zarr.defineStoreMiddleware`.
