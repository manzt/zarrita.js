---
"zarrita": patch
---

Fix `BytesCodec` mutating its input buffer in place when byte-swapping big-endian data. Combined with `withByteCaching`, this corrupted cached chunks so repeated reads alternated between correct and incorrect values. The codec now copies before swapping on both encode and decode.
