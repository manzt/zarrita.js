---
"zarrita": minor
---

Add `numcodecs.` namespace for v2 codec registry and built-in shuffle/delta codecs

V2 filters and compressors are now registered under a `numcodecs.` prefix
(e.g., `numcodecs.blosc`, `numcodecs.zlib`) matching zarr-python's convention.
This separates v2-specific codecs from the v3 codec namespace.

Adds built-in `numcodecs.shuffle` and `numcodecs.delta` codecs for reading v2
data that uses these common numcodecs filters. Both are pure JS with no WASM
dependencies.

Custom v2 codecs can be registered under the same namespace:

```ts
zarr.registry.set("numcodecs.my-filter", async () => ({
  fromConfig(config) {
    return {
      kind: "bytes_to_bytes",
      encode(data) { /* ... */ },
      decode(data) { /* ... */ },
    };
  },
}));
```
