---
"@zarrita/indexing": patch
"@zarrita/ndarray": patch
"zarrita": patch
"@zarrita/core": patch
---

feat: Support `VLenUTF8` codec in v2 and introduce a strided JS "object" Array.

```python
import zarr
import numcodecs

zarr.create_dataset(
    "data.zarr",
    data=np.array(
        [[["a", "aa"], ["aaa", "aaaa"]],
        [["b", "bb"], ["bbb", "bbbb"]]],
        dtype=object
    ),
    dtype="|O",
    object_codec=numcodecs.VLenUTF8(),
    chunks=(1, 1, 2),
)
```

```typescript
import * as zarr from "zarrita";

let store = zarr.FetchStore("http://localhost:8080/data.zarr");
let arr = await zarr.open.v2(store, { kind: "array" });
let result = zarr.get(arr);
// {
//   data: ["a", "aa", "aaa", "aaaa", "b", "bb", "bbb", "bbbb"],
//   shape: [2, 2, 2],
//   stride: [4, 2, 1],
// }
```
