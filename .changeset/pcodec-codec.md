---
"zarrita": minor
---

Read and write pcodec arrays (`numcodecs.pcodec`, the codec zarr-python and numcodecs write as `PCodec`; Zarr v2 compressor id `pcodec`). The codec runs pcodec's Rust library (pco 1.1.0, the version behind Python's `pcodec` 1.1.0), compiled to WebAssembly and loaded the first time a pcodec chunk is read. It supports every data type pcodec does: int8 to int64, uint8 to uint64, float16, float32 and float64.
