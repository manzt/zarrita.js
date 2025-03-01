---
"zarrita": patch
---

Support read-only `bitround` codec

Introduces `BitroundCodec` with a no-op for decoding because bit-rounding is lossy, and precision cannot be restored. Encoding is not yet implemented, reflecting zarrita's current focus on read-heavy contexts. Open an issue if encoding support is needed.
