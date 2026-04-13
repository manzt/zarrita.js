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
	dtype: "int32",
	shape: [10, 10],
	chunkShape: [5, 5],
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

## Open a Consolidated Store <Badge type="tip" text="v2 & v3" />

Consolidated metadata stores the entire hierarchy's metadata in a single
location, avoiding per-node network requests. This is particularly useful
with remote stores where each metadata fetch incurs latency.

The `withConsolidated` helper wraps an existing [store](/packages/storage),
proxying metadata requests with the consolidated metadata, thereby minimizing
network requests. It supports both Zarr v2 (`.zmetadata`) and v3
(`consolidated_metadata` in root `zarr.json`).

```js{3}
import * as zarr from "zarrita";

let store = await zarr.withConsolidated(
	new zarr.FetchStore("https://localhost:8080/data.zarr")
);

// The following do not incur network requests for metadata
let root = await zarr.open(store, { kind: "group" });
let foo = await zarr.open(root.resolve("foo"), { kind: "array" });
```

The store returned from `withConsolidated` is **readonly** and adds
`.contents()` to list the known contents of the hierarchy:

```js
store.contents(); // [{ path: "/", kind: "group" }, { path: "/foo", kind: "array" }, ...]
```

By default, the format is auto-detected. You can explicitly specify the
format with the `format` option, or provide an array to try formats in order:

```js
// v2 only
let store = await zarr.withConsolidated(rawStore, { format: "v2" });

// v3 only
let store = await zarr.withConsolidated(rawStore, { format: "v3" });

// try v3 first, fall back to v2
let store = await zarr.withConsolidated(rawStore, { format: ["v3", "v2"] });
```

::: tip

The `withConsolidated` helper errors out if consolidated metadata is absent.
Use `tryWithConsolidated` for uncertain cases; it leverages consolidated
metadata if available.

```js
let store = await zarr.tryWithConsolidated(
	new zarr.FetchStore("https://localhost:8080/data.zarr"),
);
```

:::

::: warning

Zarr v3 consolidated metadata (`format: "v3"`) targets the experimental
consolidated metadata implemented in zarr-python, which is not yet part of the
official Zarr v3 specification. See [zarr-specs#309](https://github.com/zarr-developers/zarr-specs/pull/309)
for the ongoing spec discussion.

:::


## Batch and Cache Range Requests

When reading chunked data over HTTP, many small range requests can be
expensive due to per-request latency. The `withRangeBatching` helper wraps a
store so that concurrent `getRange()` calls within the same microtask tick are
automatically merged into fewer, larger fetches. Results are cached in an LRU
cache (assumes immutable data).

```js{3-5}
import * as zarr from "zarrita";

let store = zarr.withRangeBatching(
  new zarr.FetchStore("https://localhost:8080/data.zarr"),
);

let arr = await zarr.open(store, { kind: "array" });
```

Adjacent byte ranges separated by less than `coalesceSize` bytes (default
32 KB) are coalesced into a single request. You can tune this along with the
LRU cache capacity:

```js
let store = zarr.withRangeBatching(
  new zarr.FetchStore("https://localhost:8080/data.zarr"),
  {
    coalesceSize: 65536, // merge ranges within 64 KB of each other
    cacheSize: 512,      // keep up to 512 entries in the LRU cache
  },
);
```

When multiple callers each pass their own `AbortSignal` and their requests
land in the same batch, the signals are merged via `AbortSignal.any`: the
shared request aborts as soon as any one caller aborts.

You can inspect batching statistics via `store.stats`:

```js
store.stats;
// { hits: 12, misses: 4, batchedRequests: 16, mergedRequests: 4 }
```


## Read Data with SharedArrayBuffer <Badge type="tip" text="v2 & v3" />

Pass `useSharedArrayBuffer: true` to `zarr.get` or `arr.getChunk` to allocate
output arrays backed by
[`SharedArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer).
This enables zero-copy transfer of chunk data to Web Workers, which is useful
for offloading heavy computation (e.g., rendering, analysis) to background
threads.

```js
import * as zarr from "zarrita";

const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open(store, { kind: "array" });

// Read a region backed by SharedArrayBuffer
const region = await zarr.get(arr, [zarr.slice(10, 20), null], {
	useSharedArrayBuffer: true,
});
region.data.buffer; // SharedArrayBuffer

// Or read a single chunk
const chunk = await arr.getChunk([0, 0], undefined, {
	useSharedArrayBuffer: true,
});
chunk.data.buffer; // SharedArrayBuffer
```

::: warning

`SharedArrayBuffer` requires the page to be
[cross-origin isolated](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements).
Your server must send the following headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If `SharedArrayBuffer` is not available, an error is thrown.

:::

::: info

String and object data types do not support `SharedArrayBuffer` and will fall
back to regular allocation with a console warning.

:::
