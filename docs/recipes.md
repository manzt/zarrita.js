# Recipes

## Open an Array

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

## Open a Group

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const group = await zarr.open(store, { kind: "group" });

group; // zarr.Group
```

## Open a Group or an Array

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const node = await zarr.open(store);

node; // zarr.Array<DataType, FetchStore> | zarr.Group
```

## Open a Group or an Array from another Node

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const node = await zarr.open(store);

const arr = await zarr.open(node.resolve("path/to/foo"), { kind: "array" });
```

## Open Array or Group with strict version

You can enforce version with `open.v2` or `open.v3` respectively.

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open.v2(store, { kind: "array" });
```

## Create an Array (v3)

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

## Create an Group (v3)

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
