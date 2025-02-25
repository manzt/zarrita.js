# ⚠️ @zarrita/typedarray

[![NPM](https://img.shields.io/npm/v/@zarrita/typedarray/next.svg?color=black)](https://www.npmjs.com/package/zarrita)
[![License](https://img.shields.io/npm/l/zarrita.svg?color=black)](https://github.com/manzt/zarrita.js/raw/main/LICENSE)

> ArrayBuffer-backed containers for
> **[zarrita.js](https://manzt.github.io/zarrita.js)**.

This package has been deprecated and its functionality is now part of `zarrita`.

## Migration

If you were using `@zarrita/typedarray`, switch to `zarrita`:

**Before**

```ts
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";
```

**After**

```ts
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "zarrita";
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
