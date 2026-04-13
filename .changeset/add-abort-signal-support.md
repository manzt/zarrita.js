---
"zarrita": minor
---

Add `AbortSignal` support to `open`, `get`, and `set`. The signal is forwarded to `store.get` calls and checked between async steps for early cancellation.

```ts
const controller = new AbortController();
const signal = controller.signal;

await zarr.open(store, { kind: "array", signal });
await zarr.get(arr, [null], { signal });
await zarr.set(arr, [null], value, { signal });
```
