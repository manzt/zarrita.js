---
"zarrita": minor
---

Introduce composable store middleware via `wrapStore`

**New APIs:**

- `wrapStore(factory)` — define a store middleware with dual API (direct + curried) and automatic Proxy delegation. Supports sync and async factories.
- `wrapStore.generic<OptsLambda>()(factory)` — for middleware whose options depend on the store's request options type (e.g., `mergeOptions`). Uses `GenericOptions` interface for higher-kinded type encoding.
- `createStore(store, ...middleware)` — compose middleware in a pipeline. Returns `Promise` to support async middleware like `withConsolidation`.

**Renamed:**

- `withConsolidated` → `withConsolidation`
- `tryWithConsolidated` → `withMaybeConsolidation`
- `WithConsolidatedOptions` → `ConsolidationOptions`
- `BatchedRangeStoreOptions` → `RangeBatchingOptions`
- `Stats` → `RangeBatchingStats`

**Migration:**

The previous exports are still available but deprecated. Update your imports:

```ts
// Before
import { withConsolidated, tryWithConsolidated, withRangeBatching } from "zarrita";

// After
import { withConsolidation, withMaybeConsolidation, withRangeBatching } from "zarrita";

// Pipeline composition
let store = await createStore(
  new FetchStore("https://..."),
  withConsolidation({ format: "v3" }),
  withRangeBatching(),
);
```

**Defining custom middleware:**

```ts
import { wrapStore } from "zarrita";

const withCaching = wrapStore(
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

`BatchedRangeStore` class has been removed in favor of `withRangeBatching` built on `wrapStore`.
