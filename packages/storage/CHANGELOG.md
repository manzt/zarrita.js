# @zarrita/storage

## 0.1.0-next.9

### Patch Changes

- Add default generic paramter to `ZipFileStore` ([#248](https://github.com/manzt/zarrita.js/pull/248))

## 0.1.0-next.8

### Patch Changes

- Fix TypedArray types for TypeScript < 5.7 ([#239](https://github.com/manzt/zarrita.js/pull/239))

  TypeScript changed the typing behavior of all `TypedArray` objects to now be generic over the underlying `ArrayBufferLike` type. In order to have our types be consistent with these changes, we needed to specify the `ArrayBuffer` explicitly, but that breaks for older versions of TypeScript. This PR fixes the version of TypeScript to 5.6. We will need to bump again when we want to support 5.7.

## 0.1.0-next.7

### Patch Changes

- `FetchStore` throws an error for 403 (forbidden) responses. This is a **breaking** change because previously `404` and `403` responses were treated the same way. Now, only `404` responses signify a "missing" key from the store. ([#212](https://github.com/manzt/zarrita.js/pull/212))

## 0.1.0-next.6

### Patch Changes

- Enable creation of ReferenceStore via non-async functions. ([#203](https://github.com/manzt/zarrita.js/pull/203))

## 0.1.0-next.5

### Patch Changes

- Remove use of public any from API in favor of unknown ([#173](https://github.com/manzt/zarrita.js/pull/173))

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
