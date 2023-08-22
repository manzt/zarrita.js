# @zarrita/storage

## 0.0.2

### Patch Changes

- feat: Support partial reads from `Readable` ([#93](https://github.com/manzt/zarrita.js/pull/93))

  Introduces the `Readable.getRange` method, which can be optionally implemented by a store to support partial reads.
  The `RangeQuery` param is inspired by the HTTP [`Range` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range).
  Allowing the `suffixLength` query means the store can decide the best way to return the final N bytes from a file.

  ```javascript
  const store = new FetchStore("http://localhost:8080/data.zarr");
  await store.getRange("/foo.json", { suffixLength: 100 });
  await store.getRange("/foo.json", { offset: 10, length: 20 });
  ```

## 0.0.1

### Patch Changes

- feat: allow `RequestInit` options to be configured in `FetchStore` constructor ([#77](https://github.com/manzt/zarrita.js/pull/77))
