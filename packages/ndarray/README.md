# @zarrita/ndarray

[![NPM](https://img.shields.io/npm/v/@zarrita/ndarray/next.svg?color=black)](https://www.npmjs.com/package/zarrita)
[![License](https://img.shields.io/npm/l/zarrita.svg?color=black)](https://github.com/manzt/zarrita.js/raw/main/LICENSE)

> Slice and index a Zarr array with
> [`scijs/ndarray`](https://github.com/scijs/ndarray).

## Installation

```sh
npm install @zarrita/ndarray@next
```

## Usage

```javascript
import { get, slice } from "@zarrita/ndarray";
let arr = await zarr.open(group.resolve("foo"), { kind: "array" });
let region = await get(arr, [slice(10, 20), null, 0]);
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
