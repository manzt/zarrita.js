# What is zarrita.js?

**zarrita** is a modular Zarr implementation in TypeScript.

- **Zero dependencies** (optionally
  [`scijs/ndarray`](https://github.com/scijs/ndarray))
- Supports **v2** or **v3** protocols, C & F-order arrays, and diverse
  data-types
- Runs natively in **Node**, **Browsers**, and **Deno** (ESM)
- Allows flexible **storage** backends and **compression** codecs
- Provides rich, in-editor **type information** via
  [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)

## Zarr building blocks

**zarrita** is a collection of
[ECMAScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
(ESM). Each module exports independent **functions** to interact with Zarr
entities like stores, arrays, and groups.

The choice of ESM exports over a class-based methods allows for better static
analysis by bundlers, enabling unused features in **zarrita** to be
[tree-shaken](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking).
This design differs from existing implementations of Zarr in JavaScript and
allows **zarrita** to be both <u>minimal and feature complete</u> if necessary.

## Project overview

**zarrita** is broken down into several packages to create and interact with
Zarr.

### [zarrita](/packages/zarrita)

- Navigate a storage hierarchy and `open` or `create` **groups** and **arrays**.
- Load individual array **chunks** on-demand based on their key.
- Slice and index an **array**, stitching together one or more chunks.

```javascript
const region = await get(arr, [null, null]);
// {
//   data: Uint16Array([ 1, 2, 3, 4]),
//   shape: [2, 2],
//   stride: [2, 1],
// }
```

### [@zarrita/storage](/packages/storage)

- A collection of useful storage backends for Zarr.
- Implement your own `Readable` and (optionally `Writable`) stores.


### [@zarrita/ndarray](/packages/ndarray)

- Similar to `zarrita`'s builtin slicing but returns `scijs/ndarray` objects.
- Ideal for applications already using or require `scijs/ndarray`.

```javascript
const region = await get(arr, [null, null]);
// ndarray.NdArray<Uint16Array>
```
