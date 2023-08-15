# What is zarrita.js?

**zarrita** is a modular Zarr implementation in TypeScript.

- **Zero dependencies** (optionally
  [`scijs/ndarray`](https://github.com/scijs/ndarray))
- Supports **v2** or **v3** protocols, C & F-order arrays, and diverse data-types
- Runs natively in **Node**, **Browsers**, and **Deno** (ESM)
- Allows flexible **storage** backends and **compression** codecs
- Provides rich, in-editor **type information** via [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)

## Zarr building blocks

**zarrita**'s API is almost entirely
[tree-shakeable](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking),
meaning users are able to pick and choose only the features of Zarr which are
necessary for an applications. At its core, the `zarr.Array` class allows
reading individual chunks. "Fancy-indexing" and "slicing" are accomplished via
(optional) functions which operate on `zarr.Array` objects.

Thus, you only _pay_ for these features if used (when bundling for the web).
This design choice differs from existing implemenations of Zarr in JavaScript,
and allows **zarrita** to be both minimal and more feature-complete if
necessary.

## Project overview

### @zarrita/storage

- Provides a set of storage backends for Zarr.
- Stores can be `Readable` and optionally `Writeable`.
- Basic store example: JavaScript `Map` for in-memory storage.
- Implements stores for the Node filesystem API and `fetch` API for reading Zarr from file system and HTTP requests respectively.
- Ideal for Zarr users in the browser: `FetchStore`.
- Implement your own store!

### @zarrita/core

- Central component of Zarr.
- Offers `open` (for `Readable` stores) and `create` (for `Writeable` stores) functions.
- Main function: Initialize `zarr.Array` or `zarr.Group` based on the path hierarchy.
- A `zarr.Array` allows loading and decompressing individual _chunks_ by their coordinates – useful for applications needing direct chunk access like tile-based viewers.

### @zarrita/indexing

- Operates on core `zarr.Array` for advanced indexing and slicing.
- Offers an ergonomic API familiar to Zarr/numpy users.
- Returns objects with strided TypedArrays

```javascript
const region = await get(arr, [null, null]);
// {
//   data: Uint16Array([ 1, 2, 3, 4]),
//   shape: [2, 2],
//   stride: [2, 1],
// }
```

### @zarrita/ndarray

- Similar to `@zarrita/indexing` but returns `scijs/ndarray` objects.
- Ideal for applications already using or require `scijs/ndarray` objects.

```javascript
const region = await get(arr, [null, null]);
// ndarray.NdArray<Uint16Array>
```
