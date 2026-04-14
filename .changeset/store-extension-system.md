---
"zarrita": minor
---

Introduce composable store and array extensions

**New primitives for wrapping stores and arrays:**

- `zarr.defineStoreExtension(factory)` — define a store extension with automatic `Proxy` delegation. The factory receives an `AsyncReadable` and user options, returning overrides and extension fields. Supports sync and async factories.
- `zarr.defineArrayExtension(factory)` — define an array extension that intercepts `getChunk` on a `zarr.Array`. Same Proxy-delegation model.
- `zarr.extendStore(store, ...extensions)` — compose store extensions in a pipeline. Returns a `Promise` so async extensions (e.g. `withConsolidatedMetadata`) can initialize during composition.
- `zarr.extendArray(array, ...extensions)` — compose array extensions in a pipeline.

**Store extensions shipped in the box:**

- `zarr.withConsolidatedMetadata` (and `zarr.withMaybeConsolidatedMetadata`) — short-circuit metadata reads from a pre-fetched consolidated blob, v2 `.zmetadata` or v3 `zarr.json` with the `consolidated_metadata` block. Replaces the previous `withConsolidated` / `tryWithConsolidated`.
- `zarr.withRangeCoalescing` — microtask-tick range batcher. Concurrent `getRange` calls within a single microtask are grouped by path, coalesced across a byte-gap threshold, and issued as a single fetch per group. Emits `onFlush` callbacks with immutable `FlushReport` objects for observability.
- `zarr.withByteCaching` — byte cache over `get()` and `getRange()`. By default, caches every request (gets under `path`, ranges under a composite key that encodes `offset`/`length` or `suffixLength`). An optional `keyFor` function (of type `CacheKeyFor`) lets callers narrow or reshape the policy by returning a cache key per call, or `undefined` to skip. The cache container is any object implementing `ByteCache` (`has` / `get` / `set`); a plain `Map` satisfies it and is the default when no `cache` option is supplied.

**Removed:**

- `BatchedRangeStore` (class)

**Example:**

```ts
import * as zarr from "zarrita";

let store = await zarr.extendStore(
  new zarr.FetchStore("https://example.com/data.zarr"),
  zarr.withConsolidatedMetadata,
  (s) => zarr.withRangeCoalescing(s, { coalesceSize: 32768 }),
  (s) => zarr.withByteCaching(s),
);

let arr = await zarr.open(store, { kind: "array" });
await zarr.get(arr, null);
```

**Defining custom extensions:**

```ts
const withTrace = zarr.defineStoreExtension(
  (store, opts: { log: (key: string) => void }) => ({
    async get(key, options) {
      opts.log(key);
      return store.get(key, options);
    },
  }),
);
```
