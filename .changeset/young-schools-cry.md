---
"@zarrita/storage": patch
---

feat: Support partial reads

Introduces the `{ range: RangeQuery }` option to `Readable.get`, which is necessary to
support sharding. `RangeQuery` is inspired by the HTTP [`Range` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range).
Allowing the `suffixLength` query means the store can decide the best way to return the final N bytes from a file.

```javascript
const store = new FetchStore("http://localhost:8080/data.zarr");
await store.get("/foo.json", { range: { suffixLength: 100 } });
await store.get("/foo.json", { range: { start: 10, end: 20 } });
await store.get("/foo.json", { range: { offset: 10, length: 20 } });
```
