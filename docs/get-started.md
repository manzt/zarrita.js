# Getting Started

## Open an Array

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open.v2(store, { kind: "array" });
```

## Read a chunk

```js
const chunk = await arr.getChunk([0, 0]);
// {
//   data: Int32Array(10) [
//      0,  1,  2,  3,  4,
//     10, 11, 12, 13, 14,
//   ],
//   shape: [ 2, 5 ],
// }
```

## Read entire dataset

```js
import { get } from "@zarrita/indexing";

const full = await get(arr); // ndarray.Ndarray<Int32Array>
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
```

## Read a selection

```js
const region = await get(arr, [null, zarr.slice(6)]);
// {
//   data: Int32Array(30) [
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

## Read as a `scijs/ndarray`

```js
import { get } from "@zarrita/ndarray";

const full = await get(arr); // ndarray.Ndarray<Int32Array>
const region = await get(arr, [null, zarr.slice(6)]); // ndarray.Ndarray<Int32Array>
```
