---
"zarrita": patch
---

Fixed buffer misalignment issue in BytesCodec.decode, ensuring that the start offset for a buffer passed into the TypedArray constructor is a multiple of the number of bytes per element.
