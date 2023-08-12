# Getting Started

## Quick Start

### Open an Array

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open.v2(store, { kind: "array" });
```

### Read a chunk

```js
const chunk = await arr.get_chunk([0, 0]);
// {
//   data: Int32Array(10) [
//      0,  1,  2,  3,  4,
//     10, 11, 12, 13, 14,
//   ],
//   shape: [ 2, 5 ],
// }
```

### Read entire dataset

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

### Read a selection

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

### Read as a `scijs/ndarray`

```js
import { get } from "@zarrita/ndarray";

const full = await get(arr); // ndarray.Ndarray<Int32Array>
const region = await get(arr, [null, zarr.slice(6)]); // ndarray.Ndarray<Int32Array>
```

## Recipes

### Open an Array

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open(store, { kind: "array" });

arr; // zarr.Array<DataType, FetchStore>
arr.shape; // [5, 10]
arr.chunk_shape; // [2, 5]
arr.dtype; // "int32"
```

### Open a Group

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const group = await zarr.open(store, { kind: "group" });

group; // zarr.Group
```

### Open a Group or an Array

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const node = await zarr.open(store);

node; // zarr.Array<DataType, FetchStore> | zarr.Group
```

### Open a Group or an Array from another Node

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const node = await zarr.open(store);

const arr = await zarr.open(node.resolve("path/to/foo"), { kind: "array" });
```

### Open Array or Group with strict version

You can enforce version with `open.v2` or `open.v3` respectively.

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open.v2(store, { kind: "array" });
```

### Create an Array (v3)

Requires the `store` to implement `Writeable`.

```js
import * as zarr from "@zarrita/core";
import { FileSystemStore } from "@zarrita/storage";

const store = new FileSystemStore("tempstore");
const arr = await zarr.create(store, {
	shape: [10, 10],
	chunk_shape: [5, 5],
	data_type: "int32",
});
arr; // zarr.Array<"int32", FileSystemStore>
```

### Create an Group (v3)

Requires the `store` to implement `Writeable`.

```js
import * as zarr from "@zarrita/core";
import { FileSystemStore } from "@zarrita/storage";

const store = new FileSystemStore("tempstore");
const group = await zarr.create(store, {
	attributes: { answer: 42 },
});
group; // zarr.Group
```
