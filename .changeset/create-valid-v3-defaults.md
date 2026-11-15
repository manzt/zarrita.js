---
"zarrita": patch
---

Arrays created with `zarr.create` can now be opened by other Zarr libraries such as zarr-python. When `codecs` or `fillValue` is left out, the array gets a `bytes` codec (`vlen-utf8` for strings) and a fill value of zero. Creating `int64` and `uint64` arrays also works now.
