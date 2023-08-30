# @zarrita/core

> Primatives for using Zarr in JavaScript. Navigate a store hierarchy and load individual chunks.

## Installation

```sh
npm install @zarrita/core@next
```

## Usage

```javascript
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage/fetch";

let store = new FetchStore("http://localhost:8080/data.zarr");
let grp = await zarr.open(store, { kind: "group" });
let arr = await zarr.open(group.resolve("foo"), { kind: "array" });
let chunk = await arr.getChunk([0, 0]);
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
