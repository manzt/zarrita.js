# @zarrita/core

[![NPM](https://img.shields.io/npm/v/@zarrita/core/next.svg?color=black)](https://www.npmjs.com/package/zarrita)
[![License](https://img.shields.io/npm/l/zarrita.svg?color=black)](https://github.com/manzt/zarrita.js/raw/main/LICENSE)

> Primatives for using Zarr in JavaScript. Navigate a store hierarchy and load individual chunks.

## Installation

```sh
npm install @zarrita/core@next
```

## Usage

```javascript
import * as zarr from "@zarrita/core";

// Create an in-memory store & navigate to the root
let store = new Map();
let root = zarr.root(store);

// Initialize an array at "/foo"
await zarr.create(root.resolve("foo"), {
  data_type: "int64",
  shape: [100, 100],
  chunk_shape: [10, 10],
});

// Open an array from "/foo"
let arr = await zarr.open(root.resolve("foo"), { kind: "array" });

// Load a chunk
let chunk = await arr.getChunk([0, 0]);
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
