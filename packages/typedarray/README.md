# @zarrita/core

> ArrayBuffer-backed containers for **[zarrita.js](https://manzt.github.io/zarrita.js)**.

## Installation

```sh
npm install @zarrita/typedarray@next
```

## Usage

```javascript
import { BoolArray, UnicodeStringArray, ByteStringArray } from "@zarrita/typedarray";

let arrs = [
    new BoolArray([true, false, true]),
    new UnicodeStringArray(5, ["hello", "world"]),
    new ByteStringArray(5, ["hello", "world"]),
];

let bytes = arrs.map(a => new Uint8Array(arr.buffer));
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
