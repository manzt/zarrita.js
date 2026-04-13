---
"zarrita": patch
---

Support reading v2 `fixedscaleoffset`-encoded arrays

Translates the numcodecs `fixedscaleoffset` filter into the native v3 `scale_offset` + `cast_value` codec pair on read. Covers both v2 arrays (via the `filters` field) and v3 arrays produced by zarr-python's `numcodecs.zarr3` wrapper (via the `numcodecs.fixedscaleoffset` codec name). Arrays are exposed with the logical (decoded) data type even though the bytes on disk are quantized.
