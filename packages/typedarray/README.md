# @zarrita/typedarray

[![NPM](https://img.shields.io/npm/v/@zarrita/typedarray/next.svg?color=black)](https://www.npmjs.com/package/zarrita)
[![License](https://img.shields.io/npm/l/zarrita.svg?color=black)](https://github.com/manzt/zarrita.js/raw/main/LICENSE)

> ArrayBuffer-backed containers for
> **[zarrita.js](https://manzt.github.io/zarrita.js)**.

## Installation

```sh
npm install @zarrita/typedarray@next
```

## Usage

```javascript
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";

let arrs = [
	new BoolArray([true, false, true]),
	new UnicodeStringArray(5, ["hello", "world"]),
	new ByteStringArray(5, ["hello", "world"]),
];

let bytes = arrs.map((a) => new Uint8Array(arr.buffer));
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
