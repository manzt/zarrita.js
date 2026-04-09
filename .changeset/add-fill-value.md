---
"zarrita": minor
---

Add `fillValue` getter on `Array` to expose the fill value from array metadata. Works uniformly across v2 and v3 arrays, with proper deserialization of IEEE 754 special values (`NaN`, `Infinity`, `-Infinity`).
