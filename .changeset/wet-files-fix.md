---
"zarrita": minor
---

feat!: Re-export `@zarrita/*` under `zarrita`.

This is a BREAKING change. The `zarrita` package is now a wrapper around the `@zarrita/*` modules.

```javascript
import * as zarr from "zarrita";

const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open(store, { kind: "array" });
const region = await zarr.get(arr, [null, null, 0]);
```
