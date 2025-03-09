---
"zarrita": minor
---

Replace default `gzip`/`zlib` codecs with dependency-less decode-only versions

This is a **breaking change** since by default **zarrita** no longer supports _encoding_ with these codecs. The new implementation is based on the [`DecompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream) API, preferring a built-in (i.e., dependency-free) solution for the majority use case (read-only) with zarrita.

Encoding remains supported but must be explicitly enabled with a custom codec from `numcodecs`:

```ts
import * as zarr from "zarrita";

import GZip from "numcodecs/gzip";
import Zlib from "numcodecs/zlib";


zarr.registry.set("gzip", () => GZip);
zarr.registry.set("zlib", () => Zlib);
```

