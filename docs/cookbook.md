# Cookbook

Simple recipes for using **zarrita**.

## Open an Array <Badge type="tip" text="v2 & v3" />

```js
import * as zarr from "zarrita";

const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open(store, { kind: "array" });
arr; // zarr.Array<DataType, FetchStore>
arr.shape; // [5, 10]
arr.chunks; // [2, 5]
arr.dtype; // "int32"
```

## Open a Group <Badge type="tip" text="v2 & v3" />

```js
import * as zarr from "zarrita";

const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
const group = await zarr.open(store, { kind: "group" });
group; // zarr.Group
```

## Open a Group or Array <Badge type="tip" text="v2 & v3" />

```js
import * as zarr from "zarrita";

const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
const node = await zarr.open(store);
node; // zarr.Array<DataType, FetchStore> | zarr.Group
```

## Open a Group or an Array from another Node <Badge type="tip" text="v2 & v3" />

```js
import * as zarr from "zarrita";

const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
const node = await zarr.open(store);
const arr = await zarr.open(node.resolve("path/to/foo"), { kind: "array" });
```

## Open Array or Group with strict version <Badge type="tip" text="v2 & v3" />

You can enforce version with `open.v2` or `open.v3` respectively.

```js
import * as zarr from "zarrita";

const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open.v2(store, { kind: "array" });
```

## Create an Array <Badge type="tip" text="v3" />

Requires the `store` to implement `Writable`.

```js
import * as zarr from "zarrita";
import { FileSystemStore } from "@zarrita/storage";

const store = new FileSystemStore("tempstore");
const arr = await zarr.create(store, {
	shape: [10, 10],
	chunks: [5, 5],
	dtype: "int32",
});
arr; // zarr.Array<"int32", FileSystemStore>
```

## Create a Group <Badge type="tip" text="v3" />

Requires the `store` to implement `Writable`.

```js
import * as zarr from "zarrita";
import { FileSystemStore } from "@zarrita/storage";

const store = new FileSystemStore("tempstore");
const group = await zarr.create(store, {
	attributes: { answer: 42 },
});
group; // zarr.Group
```

## Open a Consolidated Store

Zarr v2 allows
[consolidating metadata](https://zarr.readthedocs.io/en/stable/tutorial.html#consolidating-metadata)
for an entire hierarchy at the store root (under `/.zmetadata`). Metadata
consolidation is particularly useful when interacting with remote stores, where
each metadata fetch incurs a network request and hence, latency.

The `withConsolidated` helper wraps an existing [store](/packages/storage),
proxying metadata requests with the consolidated metadata, thereby minimizing
network requests.

```js{3}
import * as zarr from "zarrita";

let store = zarr.withConsolidated(
	new zarr.FetchStore("https://localhost:8080/data.zarr")
);

// The following do not incur network requests for metadata
let root = await zarr.open(store, { kind: "group" });
let foo = await zarr.open(root.resolve("foo"), { kind: "array" });
```

The store returned from `withConsolidated` is **readonly** and adds
`.contents()` list the known contents of the hierarchy:

```js
store.contents(); // [{ path: "/", kind: "group" }, { path: "/foo", kind: "array" }, ...]
```

::: tip

The `withConsolidated` helper errors out if v2 consolidated metadata is absent.
Use `tryWithConsolidated` for uncertain cases; it leverages consolidated
metadata if available.

```js
let store = zarr.tryWithConsolidated(
	new zarr.FetchStore("https://localhost:8080/data.zarr"),
);
```

:::
