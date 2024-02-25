# @zarrita/storage

## 0.1.0-next.4

### Patch Changes

- Add support for passing fetch options to ReferenceStore. ([#155](https://github.com/manzt/zarrita.js/pull/155))

- Add support for passing fetch options to ZipFileStore.fromUrl. ([#156](https://github.com/manzt/zarrita.js/pull/156))

## 0.1.0-next.3

### Minor Changes

- fix(storage): Rename storage type `Writeable` to `Writable` ([#114](https://github.com/manzt/zarrita.js/pull/114))

## 0.1.0-next.2

### Patch Changes

- Use a counter to prioritize v2/v3 when opening. ([#109](https://github.com/manzt/zarrita.js/pull/109))

## 0.1.0-next.1

### Patch Changes

- Add licenses and READMES to packages ([#107](https://github.com/manzt/zarrita.js/pull/107))

## 0.1.0-next.0

### Minor Changes

- chore: prepare preleases ([`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5))

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
