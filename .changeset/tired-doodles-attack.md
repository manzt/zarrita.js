---
"zarrita": minor
---

Replace default `gzip`/`zlib` codecs with dependency-less decode-only versions

This is a **breaking change**. Since usage of **zarrita** is primarily read-only, this change replaces the default `numcodecs/gzip` and `numcodecs/zlib` codecs with custom decode-only codecs based on the builtin `DecompressionStream` API.

These changes reduce dynamic imports and remove additional dependencies for the majority use case. Users who require encoding must explicitly register their own codecs from `numcodecs`.

```ts
import * as zarr from "zarrita";

import GZip from "numcodecs/gzip";
import Zlib from "numcodecs/zlib";


zarr.registry.set("gzip", () => GZip);
zarr.registry.set("zlib", () => Zlib);
```

