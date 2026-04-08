---
"zarrita": minor
---

Add AbortSignal support to `open` and `set`. Store options containing a `signal` are forwarded to underlying `store.get` calls and checked between async steps for early cancellation.

```ts
const controller = new AbortController();
const opts = { signal: controller.signal };

await zarr.open(store, { kind: "array", opts });
await zarr.get(arr, [null], { opts });
await zarr.set(arr, [null], value, { opts });
```
