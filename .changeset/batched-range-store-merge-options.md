---
"zarrita": minor
---

Add `mergeOptions` to `BatchedRangeStore`. By default, only the first caller's options are forwarded to the inner store. Use `mergeOptions` to combine options (e.g., `AbortSignal`s) across a batch:

```ts
let store = zarr.withRangeBatching(inner, {
  mergeOptions: (batch) => ({
    ...batch[0],
    signal: AbortSignal.any(batch.map(o => o?.signal).filter(Boolean)),
  }),
});
```
