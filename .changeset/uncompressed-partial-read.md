---
"zarrita": minor
---

Read only the needed rows of uncompressed chunks. When an array's only codec is `bytes` (or it is a v2 array with no compressor, filters, or F order) and the store supports `getRange`, `get` fetches the rows of each chunk that a selection touches with one range request, instead of the whole chunk. An uncompressed chunk is stored in C order, so those rows are one contiguous run of bytes. Arrays wrapped by an extension that overrides `getChunk` still read whole chunks through it.
