# @zarrita/typedarray

## 0.1.0-next.6

### Patch Changes

- Updated dependencies []:
  - zarrita@0.4.0-next.23

## 0.1.0-next.5

### Patch Changes

- Remove \`@zarrita/typedarray\` package (now included in zarrita) ([`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59))

- Deprecate package and move into zarrita ([`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59))

- Updated dependencies [[`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59), [`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59)]:
  - zarrita@0.4.0-next.22

## 0.1.0-next.4

### Patch Changes

- Fix TypedArray types for TypeScript < 5.7 ([#239](https://github.com/manzt/zarrita.js/pull/239))

  TypeScript changed the typing behavior of all `TypedArray` objects to now be generic over the underlying `ArrayBufferLike` type. In order to have our types be consistent with these changes, we needed to specify the `ArrayBuffer` explicitly, but that breaks for older versions of TypeScript. This PR fixes the version of TypeScript to 5.6. We will need to bump again when we want to support 5.7.

## 0.1.0-next.3

### Patch Changes

- Remove use of public any from API in favor of unknown ([#173](https://github.com/manzt/zarrita.js/pull/173))

## 0.1.0-next.2

### Patch Changes

- feat: Make unicode string array data view private ([#123](https://github.com/manzt/zarrita.js/pull/123))

## 0.1.0-next.1

### Patch Changes

- Add licenses and READMES to packages ([#107](https://github.com/manzt/zarrita.js/pull/107))

## 0.1.0-next.0

### Minor Changes

- chore: prepare preleases ([`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5))

## 0.0.1

### Patch Changes

- feat: Support v2 string data types with builtin indexing ([#75](https://github.com/manzt/zarrita.js/pull/75))
