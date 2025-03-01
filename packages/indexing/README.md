# ⚠️ @zarrita/indexing

[![NPM](https://img.shields.io/npm/v/@zarrita/indexing/next.svg?color=black)](https://www.npmjs.com/package/zarrita)
[![License](https://img.shields.io/npm/l/zarrita.svg?color=black)](https://github.com/manzt/zarrita.js/raw/main/LICENSE)

> Fancy indexing and slicing for Zarr arrays.

This package has been deprecated and its functionality is now part of `zarrita`.

## Migration

If you were using `@zarrita/typedarray`, switch to `zarrita`:

**Before**

```ts
import { get, set, slice, type Slice, type Indices } from "@zarrita/indexing";
```

**After**

```ts
import { get, set, slice, type Slice, type Indices } from "zarrita";
```

Read the [documentation](https://manzt.github.io/zarrita.js/) to learn more.

## License

MIT
