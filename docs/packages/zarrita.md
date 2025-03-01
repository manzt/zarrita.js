# zarrita

The primary engine for interacting with Zarr in JavaScript. Navigate a store
hierarchy and load individual array chunks.

## Zarr hierarchy

A Zarr dataset is structured as a hierarchy, composed up of **arrays** and
**groups**. This hierarchy can be visualized in a manner similar to a file
system:

```
data.zarr/
  ├─ zarr.json
  └─ foo/
      ├─ zarr.json
      └─ c/
          ├─ 0/
          │   ├─ 0
          │   └─ 1
          └─ 1/
              ├─ 0
              └─ 1
```

or an flat key-value store like a dictionary:

```
{
  "data.zarr/zarr.json": Uint8Array,
  "data.zarr/foo/zarr.json": Uint8Array,
  "data.zarr/foo/c/0/0": Uint8Array,
  "data.zarr/foo/c/0/1": Uint8Array,
  "data.zarr/foo/c/1/0": Uint8Array,
  "data.zarr/foo/c/1/1": Uint8Array,
}
```

Interacting with a Zarr dataset requires **traversing** this hierarchy (either
v2 or v3), loading the relevant metadata (JSON), and preparing objects to access
array chunks on-demand.

## Navigation

The **zarrita** module introduces a `Location` primitive to navigate
through a storage hierarchy. This object associates a **path** with a **store**
(i.e., a specific location in the hierarchy), and exposes a useful `resolve`
helper:

```javascript
import * as zarr from "zarrita";

let root = zarr.root(new zarr.FetchStore("http://localhost:8080/data.zarr"));
root.store; // FetchStore
root.path; // "/"

let bar = root.resolve("foo/bar");
bar.store; // FetchStore
bar.path; // "/foo/bar"

let foo = bar.resolve("/foo");
foo.store; // FetchStore
foo.path; // "/foo"
```

### Open an array or group <Badge type="tip" text="v2" /> <Badge type="tip" text="v3" />

Using a `Location`, you can access an **array** or **group** with `open`:

```javascript
import * as zarr from "zarrita";

let root = zarr.root(new zarr.FetchStore("http://localhost:8080/data.zarr"));
let node = await zarr.open(root);
node; // zarr.Array<DataType, FetchStore> | zarr.Group
```

Note that `open` could yield either an **array** or **group**. To enforce a
specific node type, indicate the "kind":

```javascript
let grp = await zarr.open(root.resolve("foo"), { kind: "group" });
let arr = await zarr.open(root.resolve("foo/bar"), { kind: "array" });
```

::: info

`open` handles both the v3 and v2 Zarr format. If you know what version of Zarr
you are working with beforehand, you can use the `open.v2` or `open.v3`:

```javascript
let arr = await zarr.open.v2(root.resolve("foo/bar"), { kind: "array" });
```

:::

### Access a chunk

To load individual **array** chunks on demand base on their key, use the
`Array.getChunk` method. This feature is useful in applications where you want
to load chunks lazily (i.e. a tiled image viewer).

```javascript
const chunk = await arr.getChunk([0, 0]);
```

An in-memory `Chunk` is represented as
[**strided array**](https://ajcr.net/stride-guide-part-1/):

```javascript
console.log(chunk);
// {
//   data: Int32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
//   shape: [3, 4],
//   stride: [4, 1],
// }
```

- `data` - a 1D view (e.g., a
  [`TypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray))
  of the decompressed chunk data.
- `shape` - the shape of the chunk
- `stride` – the number of elements needed to advance one value along each
  dimension

This is the minimal representation of the chunk data is often suitable for many
applications. However, for further processing or manipulations of the chunk
data, you can integrate with [`scijs/ndarray`](https://github.com/scijs/ndarray)
to convert it into an `ndarray` object.

```javascript
import ndarray from "ndarray";

const view = ndarray(chunk.data, chunk.shape, chunk.stride);
view.get(1, 3); // 7
```

### Create an array or group <Badge type="tip" text="v3" />

Given a `Location`, you can also create an **array** or **group** with `create`:

```javascript
import * as zarr from "zarrita";

let root = zarr.root(new Map());
let grp = await zarr.create(root);
let arr = await zarr.create(root.resolve("foo"), {
	data_type: "int32",
	shape: [4, 4],
	chunk_shape: [2, 2],
});
console.log(root.store);
// Map(2) {
//   '/zarr.json' => Uint8Array(66) [ ... ],
//   '/foo/zarr.json' => Uint8Array(392) [ ... ],
// }
```


## Slicing and indexing

Slicing and indexing are standard operations for those familiar with
multidimensional array data. In Zarr, these operations are applied over
"chunked" array storage, enabling users to efficiently access subsets of data,
even when the data size exceeds memory capacity.

While slicing and indexing are foundational concepts as in Zarr, they are
presented through a higher-level (optional) API in **zarrita**. This choice
caters to applications that might prefer direct interaction with chunks.

You can use either **zarrita** or **@zarrita/ndarray** to conveniently
access specific data subsets without thinking about chunking details.

### How to slice

To slice a `zarr.Array`, you must define a _selection_ across each dimension of
your data. A dimension selection can be either:

- `null`: all elements of the dimension.
- `number`: a specific (integer) index within the dimension.
- `Slice`: a specific subset within a dimension.

Concretely, if you have an `zarr.Array` of shape `[512, 256, 3]` and want to
access 10 elements from the first dimension, all from the second, and the first
from the third (resulting in a 2D array shaped `[10, 256]`), you'd use:

```javascript
import { get, slice } from "zarrita";
const region = await get(arr, [slice(10, 20), null, 0]);
```

::: info

The `slice` utility supports:

- `slice(end)`
- `slice(start, end)`
- `slice(start, end, step)`

Note that `slice(null)` and `null` are equivalent selections.

:::

To draw a parallel, this operation in Python would look like:

```python
region = arr[10:20, ..., 0]
```

## Data Typing in TypeScript

Zarr's dynamic nature presents a challenge in accurately representing data types
to static type systems. **zarrita** leverages TypeScript's advanced typing
capabilities to extract and communicate Zarr `data_type` metadata across its
APIs.

In essense, you (moreover your editor) is always informed about the data types
at hand when working with Zarr via **zarrita**. TypeScript assists in
covering edge cases, but (importantly) steps back once you've demonstrated data
correctness.

What does this mean in practice? Imagine that you have a function that requires
a `BigUint64Array` or `BigInt64Array`:

```typescript
function getBigIntValue(
	arr: BigInt64Array | BigUint64Array,
	idx: number,
): bigint {
	return arr[idx];
}
```

Let's say we `create` an array with a "int64" data type. Notice how the type
system correctly infers that the value of chunk `data` is a `BigInt64Array`:

```javascript
let arr = await zarr.create(root.resolve("foo"), {
	data_type: "int64",
	shape: [4, 4],
	chunk_shape: [2, 2],
});
let chunk = await arr.getChunk([0, 0]);
// ^ Chunk<"int64">
let data = chunk.data;
// ^ BigInt64Array
```

Now, when you pass `data` to a function expecting a `BigInt64Array`, TypeScript
is perfectly happy!

```javascript
getBigIntValue(chunk.data, 0); // 0n
```

But what about when the data type isn't known? Let's say we now `open` a remote
Zarr array:

```javascript
let store = new zarr.FetchStore("http://localhost:8080/data.zarr");
let arr = await zarr.open(store);
let chunk = await arr.getChunk([0, 0]);

getBigIntValue(chunk.data, 0); // type error!!!
```

Here, TypeScript flags a type error because it can't verify that `chunk.data` is
a `BigInt64Array` or `BigUint64Array`. To ensure we're working with the expected
data type (and make TypeScript happy), we can introduce a type guard to
[narrow](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) the
`chunk.data` type:

```javascript
if (
	chunk.data instanceof BigInt64Array ||
	chunk.data instanceof BigUint64Array
) {
	getBigIntValue(chunk.data, 0); // 0n
} else {
	throw Error("oops we don't support this!");
}
```

Assert data types like this repeatedly can be cumbersome and repetative.

Instead, wouldn't it be convenient if you could verify the data type once, and
then TypeScript would automatically understand the expected data type for all
subsequent `getChunk` calls?

**@zarrita/core** introduces the `zarr.Array.is` type guard to achieve just
that:

```javascript
if (!arr.is("int64") || !arr.is("uint64")) {
  thow Error("data type not supported!");
}
const chunk = await arr.getChunk([0, 0]);
   // ^ Chunk<"int64" | "uint64">
getBigIntValue(cunk.data, 0); // 0n
```

With this method, you've informed TypeScript about the possible data types for
chunks from this array. Future interactions are now type-safe without needing
repeated assertions.

The `zarr.Array.is` method also accepts primitive names such as "string",
"bigint", "number", and "boolean". It narrows down the data type to the
corresponding JavaScript primitive:

```javascript
if (arr.is("bigint")) {
	const chunk = await arr.getChunk([0, 0]);
	// ^ Chunk<"int64" | "uint64">;
	chunk.data;
	// ^ BigUint64Array | BigUint64Array
}
if (arr.is("number")) {
	const chunk = await arr.getChunk([0, 0]);
	// ^ Chunk<"int8" | "int16" | "int32" | "uint8" | "uint16" | "uint32" | "float32" | "float64">;
	chunk.data;
	// ^ Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Float32Array | Float64Array
}
if (arr.is("string")) {
	const chunk = await arr.getChunk([0, 0]);
	// ^ Chunk<`v2:U${number}` | `v2:S${number}`>;
	chunk.data;
	// ^ ByteStringArray | UnicodeStringArray
}
if (arr.is("boolean")) {
	const chunk = await arr.getChunk([0, 0]);
	// ^ Chunk<"bool">;
	chunk.data;
	// ^ BoolArray
}
```
