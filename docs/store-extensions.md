# Extensions

**zarrita** has two symmetric extension points for composing behavior on top
of a base store or array: **store extensions** and **array extensions**.

| Layer | Intercepts | Primitive | Composer |
| --- | --- | --- | --- |
| Transport | `store.get(key, range)` | `zarr.defineStoreExtension` | `zarr.extendStore` |
| Data | `array.getChunk(coords)` | `zarr.defineArrayExtension` | `zarr.extendArray` |

Store extensions are for transport concerns (caching bytes, batching range
requests, short-circuiting metadata, request transformation). Array extensions
are for data concerns (caching decoded chunks, prefetch priority, observability).
If you're not sure which layer you need: if your code deals in paths and
bytes, it's a store extension; if it deals in chunk coordinates, it's an
array extension.

## Store extensions

Wrap a store with `zarr.defineStoreExtension`, then compose with
`zarr.extendStore`. **zarrita** ships with extensions for consolidated metadata
and range batching:

```ts
import * as zarr from "zarrita";

let store = await zarr.extendStore(
  new zarr.FetchStore("https://example.com/data.zarr"),
  zarr.withConsolidation,
  (s) => zarr.withRangeBatching(s, { cacheSize: 512 }),
);

store.contents(); // from zarr.withConsolidation
store.stats;      // from zarr.withRangeBatching
```

Each extension wraps the previous result. `zarr.extendStore` handles async
extensions (like `zarr.withConsolidation`, which fetches metadata during
initialization) automatically, and always returns a `Promise`. An extension
with no required options can be passed uncalled; otherwise wrap it in an arrow
so the options are applied to the argument.

You can also call extensions directly:

```ts
let consolidated = await zarr.withConsolidation(
  new zarr.FetchStore("https://example.com/data.zarr"),
  { format: "v3" },
);
```

### Defining your own

The factory receives the inner store and user options, and returns an object
of method overrides and extensions. Anything not returned is delegated to the
inner store via `Proxy`.

```ts
import * as zarr from "zarrita";

const withCaching = zarr.defineStoreExtension(
  (store, opts: { maxSize?: number } = {}) => {
    let cache = new Map<zarr.AbsolutePath, Uint8Array>();
    return {
      async get(key, options) {
        let hit = cache.get(key);
        if (hit) return hit;
        let result = await store.get(key, options);
        if (result) cache.set(key, result);
        return result;
      },
      clear() {
        cache.clear();
      },
    };
  },
);

let store = withCaching(new zarr.FetchStore("https://..."), { maxSize: 256 });
store.clear(); // new method from the extension
```

Only `get` and `getRange` are interceptable; any other keys on the factory
result become extensions on the wrapped store.

Extensions can be **sync or async**. If the factory returns a `Promise`, the
wrapper returns a `Promise` too:

```ts
const withMetadata = zarr.defineStoreExtension(
  async (store, opts: { key: zarr.AbsolutePath }) => {
    let bytes = await store.get(opts.key);
    let meta = JSON.parse(new TextDecoder().decode(bytes));
    return {
      metadata() { return meta; },
    };
  },
);

let store = await withMetadata(rawStore, { key: "/meta.json" });
store.metadata(); // loaded during initialization
```

## Array extensions

Array extensions are the symmetric extension point for **chunk-layer** concerns:
anything that wants to intercept `getChunk(coords)` without caring about paths
or bytes. Think chunk caching, prefetch priority, or observability hooks.

```ts
import * as zarr from "zarrita";

const withChunkCache = zarr.defineArrayExtension(
  (array, opts: { cache: Map<string, zarr.Chunk<zarr.DataType>> }) => ({
    async getChunk(coords, options) {
      let key = coords.join(",");
      let hit = opts.cache.get(key);
      if (hit) return hit;
      let chunk = await array.getChunk(coords, options);
      opts.cache.set(key, chunk);
      return chunk;
    },
  }),
);

let arr = await zarr.extendArray(
  await zarr.open(store, { kind: "array" }),
  (a) => withChunkCache(a, { cache: new Map() }),
);

await zarr.get(arr, null); // cache hits are served from the Map
```

Only `getChunk` is interceptable in v1 — `shape`, `dtype`, `attrs`, `chunks`,
`store`, and `path` are part of the array's identity and are always delegated
to the inner array. Any other keys on the factory result become extensions on
the wrapped array.

The factory sees `zarr.Array<DataType, Readable>` (the widest form) so it can
be written once and applied to any concrete `Array<D, S>`. At the call site
the outer generics are preserved, so downstream `zarr.get(wrapped)` calls
return the right specific type.

Like `extendStore`, `extendArray` always returns a `Promise` so extensions can
perform async initialization.

## Auto-applying array extensions from a store

A store extension can declare an `arrayExtensions` field on its factory
result. `zarr.open` reads that list from the composed store and wraps every
`zarr.Array` it returns with those extensions — so downstream consumers
don't need to remember to call `zarr.extendArray` at each call site.

This is the primitive for **virtual-format adapters** (hdf5-as-virtual-zarr,
tiff-as-virtual-zarr, parquet-as-virtual-zarr): a single factory parses the
source once, synthesizes metadata at the transport layer, and hands decoded
chunks at the data layer — sharing closure state between both concerns:

```ts
import * as zarr from "zarrita";

const hdf5VirtualZarr = zarr.defineStoreExtension(
  (inner, opts: { root: string }) => {
    let parsed = parseHdf5(opts.root); // shared closure state
    return {
      async get(key, options) {
        if (isVirtualMetadataKey(key, parsed)) {
          return synthesizeJson(key, parsed);
        }
        return inner.get(key, options);
      },
      arrayExtensions: [
        zarr.defineArrayExtension((_inner) => ({
          async getChunk(coords) { return parsed.readChunk(coords); },
        })),
      ],
    };
  },
);

let store = await zarr.extendStore(raw, (s) =>
  hdf5VirtualZarr(s, { root: "/my_image" }),
);

// Downstream code knows nothing about the adapter — just opens and reads.
let arr = await zarr.open(store, { kind: "array", path: "/my_image" });
await zarr.get(arr, [null, zarr.slice(0, 10)]);
```

**Merge semantics.** When store extensions are stacked, each layer's
`arrayExtensions` are concatenated with the inner store's — inner-first,
outer-last. So if an inner layer contributes `[A]` and an outer layer
contributes `[B]`, the composed store exposes `[A, B]`, and `zarr.open`
applies them so that B wraps A (symmetric with how the store extensions
themselves compose).

**Raw lambdas.** `extendStore` also accepts any `(store) => newStore` function
directly, bypassing `defineStoreExtension`. Raw lambdas are responsible for
spreading `...inner.arrayExtensions` themselves if they want auto-apply to
reach older contributed extensions.

**Groups.** `zarr.open(store, { kind: "group" })` does not wrap the group
(there are no chunks to intercept), but the store reference flows through,
so nested `zarr.open(group.resolve("child"))` calls still auto-apply.
