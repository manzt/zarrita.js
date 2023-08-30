# @zarrita/indexing

> Fancy indexing and slicing for Zarr arrays.

## Installation

```sh
npm install @zarrita/indexing@next
```

## Usage

```javascript
import { get, slice } from "@zarrita/indexing";
let arr = await zarr.open(group.resolve("foo"), { kind: "array" });
let region = await get(arr, [slice(10, 20), null, 0]);
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
