# Store Middleware

Many of the stores in [`@zarrita/storage`](/packages/storage) (like
[`FetchStore`](/packages/storage#fetchstore) and
[`FileSystemStore`](/packages/storage#filesystemstore)) handle the raw
byte-level connection with a data source.

A common pattern is to _wrap_ a store in another store that adds behavior
(e.g., caching responses, batching range requests, or serving pre-loaded
metadata) while delegating everything else to the inner store.

`zarr.wrapStore` lets you define this kind of "middleware" that you can
_compose_ with base stores using `zarr.createStore`.

## Built-in middleware

**zarrita** ships with middleware for consolidated metadata and range batching:

```ts
import * as zarr from "zarrita";

let store = await zarr.createStore(
  new zarr.FetchStore("https://example.com/data.zarr"),
  zarr.withConsolidation({ format: "v3" }),
  zarr.withRangeBatching(),
);

store.contents(); // from zarr.withConsolidation
store.stats;      // from zarr.withRangeBatching
```

Each middleware in the pipeline wraps the previous result. `zarr.createStore`
handles async middleware (like `zarr.withConsolidation`, which loads metadata)
automatically. It always returns a `Promise`.

You can also use middleware directly without `zarr.createStore`:

```ts
let consolidated = await zarr.withConsolidation(
  new zarr.FetchStore("https://example.com/data.zarr"),
  { format: "v3" },
);
```

## Defining your own middleware

Use `zarr.wrapStore` to define custom middleware. The factory function receives
the inner store and custom options, and returns an object with method overrides
and/or new methods. Anything not returned is automatically delegated to the
inner store via `Proxy`.

```ts
import * as zarr from "zarrita";

const withCaching = zarr.wrapStore(
  (store: zarr.AsyncReadable, opts: { maxSize?: number } = {}) => {
    let cache = new Map<string, Uint8Array>();
    return {
      async get(key: zarr.AbsolutePath, options?: unknown) {
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
store.clear(); // new method from the middleware
```

The returned middleware supports a **dual API**: call it directly with `(store,
opts)` or curry it with `(opts)` for use in `zarr.createStore` pipelines:

```ts
// Direct
let store = withCaching(new zarr.FetchStore("https://..."), { maxSize: 256 });

// Curried (for zarr.createStore)
let store = await zarr.createStore(
  new zarr.FetchStore("https://..."),
  withCaching({ maxSize: 256 }),
);
```

Middleware can be **sync or async**. If the factory returns a `Promise`, the
wrapper returns a `Promise` too:

```ts
const withMetadata = zarr.wrapStore(
  async (store: zarr.AsyncReadable, opts: { key: string }) => {
    let meta = JSON.parse(new TextDecoder().decode(await store.get(opts.key)));
    return {
      metadata() { return meta; },
    };
  },
);

let store = await withMetadata(rawStore, { key: "/meta.json" });
store.metadata(); // loaded during initialization
```

## Store options and generics

Stores are generic over their request options type. For example,
[`zarr.FetchStore`](/packages/storage#fetchstore) uses `RequestInit` so you can
pass headers or an `AbortSignal` to individual requests. Most middleware
doesn't need to know about this type, and `zarr.wrapStore` preserves it
automatically through the chain.

Sometimes, though, middleware options _depend_ on the store's request options.
For example, `zarr.withRangeBatching` has a `mergeOptions` callback that
combines request options from concurrent callers, and its parameter type
should match the store's options.

This is an advanced typing feature purely for caller convenience. It ensures
users get proper type inference and autocomplete on options that reference
the store's request type. Use `zarr.wrapStore.generic` with a
`zarr.GenericOptions` interface that maps the store's options type into your
middleware options:

```ts
import * as zarr from "zarrita";

// 1. Define your options as a normal generic interface
interface LoggingOptions<O> {
  label?: string;
  formatOptions?: (opts: O) => string;
}

// 2. Create the type lambda (one line that wires up the generic)
interface LoggingOptsFor extends zarr.GenericOptions {
  readonly options: LoggingOptions<this["_O"]>;
}

// 3. Define the middleware
const withLogging = zarr.wrapStore.generic<LoggingOptsFor>()(
  (store, opts: LoggingOptions<unknown> = {}) => {
    let label = opts.label ?? "store";
    let format = opts.formatOptions ?? String;
    return {
      async get(key: zarr.AbsolutePath, options?: unknown) {
        console.log(`[${label}] get ${key} ${format(options)}`);
        return store.get(key, options);
      },
    };
  },
);
```

At the call site, `formatOptions` receives the store's options type:

```ts
let store = withLogging(new zarr.FetchStore("https://..."), {
  label: "my-store",
  formatOptions: (opts) => {
    //            ^^^^ typed as RequestInit
    return opts.method ?? "GET";
  },
});
```

This is an advanced pattern. Most middleware won't need it. It exists so
that _users_ of your middleware get proper type inference and autocomplete
when their options reference the store's request type. If your options don't
depend on the store type, use the simpler `zarr.wrapStore` and skip the
`zarr.GenericOptions` boilerplate entirely.

Under the hood, `zarr.GenericOptions` uses TypeScript's `this` types to encode
a [higher-kinded type](https://www.typescriptlang.org/docs/handbook/2/classes.html#this-types):
`this["_O"]` refers to the store's request options, which gets substituted with
the concrete type (e.g., `RequestInit`) at the call site.
