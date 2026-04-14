# Extensions

**zarrita** has two symmetric extension points for composing behavior on top
of a base store or array: **store extensions** and **array extensions**.

| Layer     | Intercepts                              | Primitive                   | Composer           |
| --------- | --------------------------------------- | --------------------------- | ------------------ |
| Transport | `store.get(key)` and `store.getRange()` | `zarr.defineStoreExtension` | `zarr.extendStore` |
| Data      | `array.getChunk(coords)`                | `zarr.defineArrayExtension` | `zarr.extendArray` |

**Store extensions** are for transport concerns (caching bytes, batching range
requests, short-circuiting metadata, request transformation). **Array
extensions** are for data concerns (caching decoded chunks, prefetch priority,
observability).

## Store extensions

Wrap a store with `zarr.defineStoreExtension`, then compose with
`zarr.extendStore`. **zarrita** ships three store extensions: consolidated
metadata, range coalescing, and caching.

```ts
import * as zarr from "zarrita";

let store = await zarr.extendStore(
  new zarr.FetchStore("https://example.com/data.zarr"),
  zarr.withConsolidatedMetadata,
  (s) => zarr.withRangeCoalescing(s, { coalesceSize: 32768 }),
  (s) => zarr.withByteCaching(s),
);

store.contents(); // from zarr.withConsolidatedMetadata
```

By default `withByteCaching` caches every store request (both `get()` and
`getRange()`, with gets keyed under `path` and ranges keyed by a composite
that encodes `offset`/`length` or `suffixLength`) and allocates an internal
unbounded `Map` for storage. To control the cache, for example to bound its
size with LRU eviction, pass a `cache` option implementing the `ByteCache`
interface:

```ts
export interface ByteCache {
  has(key: string): boolean;
  get(key: string): Uint8Array | undefined;
  set(key: string, value: Uint8Array | undefined): void;
}
```

A plain `Map<string, Uint8Array | undefined>` satisfies this directly, and so
does any third-party LRU library that exposes `has` / `get` / `set`. For
example, using [`quick-lru`](https://github.com/sindresorhus/quick-lru):

```ts
import QuickLRU from "quick-lru";

let cache = new QuickLRU<string, Uint8Array | undefined>({ maxSize: 256 });

let store = await zarr.extendStore(
  new zarr.FetchStore("https://example.com/data.zarr"),
  (s) => zarr.withByteCaching(s, { cache }),
);

cache.clear();   // direct control via the user-owned reference
```

To narrow or reshape the cache policy, for example to cache only metadata
files and skip chunk data, pass your own `keyFor` function. It returns a
string to cache the result under, or `undefined` to skip caching that call:

```ts
let store = await zarr.extendStore(
  new zarr.FetchStore("https://example.com/data.zarr"),
  (s) => zarr.withByteCaching(s, {
    keyFor(path, range) {
      if (range !== undefined) return undefined;
      return /\/(zarr\.json|\.zarray|\.zattrs|\.zgroup)$/.test(path)
        ? path
        : undefined;
    },
  }),
);
```

That single primitive covers metadata-only policies, path-filtered caches,
shard-index-only caches, and anything else you want to express.

Each extension wraps the previous result. `zarr.extendStore` handles async
extensions (like `zarr.withConsolidatedMetadata`, which fetches metadata during
initialization) automatically, and always returns a `Promise`. An extension
with no required options can be passed uncalled; otherwise wrap it in an arrow
so the options are applied to the argument.

You can also call extensions directly:

```ts
let consolidated = await zarr.withConsolidatedMetadata(
  new zarr.FetchStore("https://example.com/data.zarr"),
  { format: "v3" },
);
```

### Defining your own

The factory receives the inner store and user options, and returns an object
of method overrides and extensions. Anything not returned is delegated to the
inner store via `Proxy`. Only `get` and `getRange` are interceptable; any
other keys on the factory result become extensions on the wrapped store.

```ts
import * as zarr from "zarrita";

const withTrace = zarr.defineStoreExtension(
  (store, extOptions: { log: (key: string) => void }) => ({
    async get(key, options) {
      extOptions.log(key);
      return store.get(key, options);
    },
  }),
);

let store = withTrace(new zarr.FetchStore("https://..."), {
  log: (key) => console.log("fetching", key),
});
```

See [Composition and naming conventions](#composition-and-naming-conventions)
below for how to expose state from more elaborate extensions without polluting
the store's top-level surface.

Extensions can be **sync or async**. If the factory returns a `Promise`, the
wrapper returns a `Promise` too:

```ts
const withMetadata = zarr.defineStoreExtension(
  async (store, extOptions: { key: zarr.AbsolutePath }) => {
    let bytes = await store.get(extOptions.key);
    let meta = JSON.parse(new TextDecoder().decode(bytes));
    return {
      metadata() { return meta; },
    };
  },
);

let store = await withMetadata(rawStore, { key: "/meta.json" });
store.metadata(); // loaded during initialization
```

### Composition over inheritance

Top-level fields on factory results are shallow-merged across composition
layers, so an extension *can* put methods directly on the wrapped store.
`withConsolidatedMetadata` does this with `contents()`. It's a first-party
liberty, used sparingly: the extension system is built around the idea that
a composed store is still an `AsyncReadable`, and callers that type a
parameter as `AsyncReadable` should be able to accept one without knowing
what was layered on.

For your own extensions, prefer in order:

1. **Externalize the state.** If the caller can own what you'd otherwise
   track internally, pass it in as an option. The store's type stays exactly
   `AsyncReadable`.
2. **If you must expose state, put the whole surface on one namespace key.**
   Name it after what the extension *is*. The composed type becomes
   `AsyncReadable & { events: EventsHandle }`: a store composed with a
   handle, not a store that *inherits* new methods.

`get`, `getRange`, and `arrayExtensions` are reserved.

**Externalized state.** A logging wrapper has nothing of its own to hold:

```ts
const withLogging = zarr.defineStoreExtension(
  (store, opts: { log: (msg: string) => void }) => ({
    async get(key, options) {
      opts.log(`get ${key}`);
      return store.get(key, options);
    },
  }),
);
```

The caller owns the `log` function. Nothing on the store.

**Namespaced composition.** Some state can't be externalized; an
event subscription registry is the canonical case. The listener set is
dynamic, callers need to add and remove handlers at runtime, and you don't
want `store.subscribe` / `store.unsubscribe` / `store.notify` scattered
across the top-level type. Put the whole API on one key:

```ts
type StoreEvent =
  | { type: "get"; key: zarr.AbsolutePath; durationMs: number }
  | { type: "error"; key: zarr.AbsolutePath; error: unknown };

const withEvents = zarr.defineStoreExtension((store) => {
  let listeners = new Set<(event: StoreEvent) => void>();
  return {
    async get(key, options) {
      let started = performance.now();
      try {
        let value = await store.get(key, options);
        for (let fn of listeners) {
          fn({ type: "get", key, durationMs: performance.now() - started });
        }
        return value;
      } catch (error) {
        for (let fn of listeners) fn({ type: "error", key, error });
        throw error;
      }
    },
    events: {
      subscribe(fn: (event: StoreEvent) => void): () => void {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
  };
});

let store = withEvents(base);
let unsubscribe = store.events.subscribe((e) => {
  if (e.type === "error") console.error("store error", e);
});
```

Downstream code that only reads bytes can still type its parameter as plain
`AsyncReadable` and ignore the `events` handle entirely.

## Array extensions

Array extensions are the symmetric extension point for **chunk-layer** concerns:
anything that wants to intercept `getChunk(coords)` without caring about paths
or bytes. Think chunk caching, prefetch priority, or observability hooks.

```ts
import * as zarr from "zarrita";

const withChunkCache = zarr.defineArrayExtension(
  (array, extOptions: { cache: Map<string, zarr.Chunk<zarr.DataType>> }) => ({
    async getChunk(coords, options) {
      let key = coords.join(",");
      let hit = extOptions.cache.get(key);
      if (hit) return hit;
      let chunk = await array.getChunk(coords, options);
      extOptions.cache.set(key, chunk);
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

Only `getChunk` is interceptable. `shape`, `dtype`, `attrs`, `chunks`,
`store`, and `path` are part of the array's identity and are always delegated
to the inner array. Any other keys on the factory result become extensions on
the wrapped array.

The factory sees `zarr.Array<DataType, Readable>` (the widest form) so it can
be written once and applied to any concrete `Array<D, S>`. At the call site the
outer generics are preserved, so downstream `zarr.get(wrapped)` calls return
the right specific type.

Like `extendStore`, `extendArray` always returns a `Promise` so extensions can
perform async initialization.

## Auto-applying array extensions from a store

A store extension can declare an `arrayExtensions` field on its factory result.
`zarr.open` reads that list from the composed store and wraps every
`zarr.Array` it returns with those extensions, so downstream consumers don't
need to remember to call `zarr.extendArray` at each call site.

This is the primitive for **virtual-format adapters** (hdf5-as-virtual-zarr,
tiff-as-virtual-zarr, parquet-as-virtual-zarr): a single factory parses the
source once, synthesizes metadata at the transport layer, and hands decoded
chunks at the data layer, sharing closure state between both concerns:

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
        zarr.defineArrayExtension(() => ({
          async getChunk(coords) {
            return parsed.readChunk(coords);
          },
        })),
      ],
    };
  },
);

let store = await zarr.extendStore(raw, (s) =>
  hdf5VirtualZarr(s, { root: "/my_image" }),
);

// Downstream code knows nothing about the adapter; it just opens and reads.
let arr = await zarr.open(store, { kind: "array", path: "/my_image" });
await zarr.get(arr, [null, zarr.slice(0, 10)]);
```

**Merge semantics.** When store extensions are stacked, each layer's
`arrayExtensions` are concatenated with the inner store's, inner-first,
outer-last. So if an inner layer contributes `[A]` and an outer layer
contributes `[B]`, the composed store exposes `[A, B]`, and `zarr.open` applies
them so that B wraps A (symmetric with how the store extensions themselves
compose).

**Raw lambdas.** `extendStore` also accepts any `(store) => newStore` function
directly, bypassing `defineStoreExtension`. Raw lambdas are responsible for
spreading `...inner.arrayExtensions` themselves if they want auto-apply to
reach older contributed extensions.

**Groups.** `zarr.open(store, { kind: "group" })` does not wrap the group
(there are no chunks to intercept), but the store reference flows through, so
nested `zarr.open(group.resolve("child"))` calls still auto-apply.
