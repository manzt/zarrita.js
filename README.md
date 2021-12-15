**Here be dragons** 🐉

# zarrita

**zarrita** is a minimal and modular implementation of Zarr in TypeScript.

- Zero dependencies (optionally [`scijs/ndarray`](https://github.com/scijs/ndarray))
- Supports **v2** or **v3** protocols 
- Runs natively in **Node**, **Browsers**, and **Deno** (ESM)
- Only "C"-order arrays
- Handles **little endian** or **big endian** data-types
- Handles **number**, **bigint**, **string**, and **boolean** data-types
- Configurable compression via [`numcodecs`](https://github.com/manzt/numcodecs.js)
- Allows _very_ flexible storage
- Provides rich, in-editor **type information** via [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)

## Project philosphy

**zarrita's** API is almost entirely [_tree-shakeable_](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking), 
meaning that end-users are able to pick and choose the features of Zarr are necessary
for their applications. At its core, the `zarr.Array` `class` only allows reading individual
_chunks_. "Fancy-indexing" and "slicing" is accomplished via (optional) _functions_ that 
operate on `zarr.Array` objects, and thus you only "pay" for these features when used
(if bundling for the web).

This design choice differs from existing implemenations of Zarr in JavaScript, and
allows **zarrita** to be both minimal _and_ more feature-complete if necessary.

## Example (v2):

```javascript
import * as zarr from 'zarrita/v2';
import FetchStore from 'zarrita/storage/fetch';

// must add codecs to global registry if compression is used
import Blosc from 'numcodecs/blosc';
zarr.registry.set(Blosc.codecId, () => Blosc);

// intialize store
const store = new FetchStore("http://localhost:8080/data.zarr");

// open array from root
const arr = await zarr.get_array(store); // zarr.Array<"<i4", FetchStore, "/">
arr.shape; // [5, 10]
arr.chunk_shape; // [2, 5]
arr.dtype; // "<i4"

// read chunk
const chunk = await arr.get_chunk([0, 0]); // Chunk<"<i4">
console.log(chunk);
// {
//   data: Int32Array(50) [
//      0,  1,  2,  3,  4,
//     10, 11, 12, 13, 14,
//   ],
//   shape: [ 2, 5 ],
// }


// read and combined chunks
import { get } from "zarrita/ops"; // built-in getter, no dependencies
import { get } from "zarrita/ndarray"; // returns scijs/ndarray array

// read entire dataset
const full = await get(arr); // NdArray<"<i4"> | ndarray.Ndarray<TypedArray<"<i4">>
console.log(full);
// {
//   data: Int32Array(50) [
//      0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
//     10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
//     20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
//     30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
//     40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
//   ],
//   shape: [ 5, 10 ],
//   stride: [ 10, 1 ]
// }

// read region
const region = await get(arr, [null, zarr.slice(6)]);
console.log(full);
// {
//   data: Int32Array(50) [
//      0,  1,  2,  3,  4,  5,
//     10, 11, 12, 13, 14, 15,
//     20, 21, 22, 23, 24, 25,
//     30, 31, 32, 33, 34, 35,
//     40, 41, 42, 43, 44, 45,
//   ],
//   shape: [ 5, 6 ],
//   stride: [ 6, 1 ]
// }
```

## Usage

### In Browser

```html
<script type="module">
  import * as zarr from "https://cdn.skypack.dev/zarrita/v2";
  import { get } from "https://cdn.skypack.dev/zarrita/ops";
</script>
```

### In Node.js or Application Bundles

Import using ES module syntax, import all exports into a single object:

```javascript
import * as zarr from "zarrita/v2";
```

Import using ES module syntax, with targeted imports:

```javascript
import { get_array } from "zarrita/v2";
```

#### Development

This library uses the [`pnpm`](https://pnpm.io/) package manager.

```bash
$ pnpm install && pnpm test
```

Tests are run directly on the ESM module (contents of `dist/`), which is generated when
running `pnpm test` thanks to [`mkdist`](https://github.com/unjs/mkdist), a simple
file-to-file transpiler.
