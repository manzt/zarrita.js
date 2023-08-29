---
"@zarrita/indexing": patch
---

feat: generalize chunk-indexing/slicing operations

Refactors the internals of `get`/`set` to operate on the raw 1D "bytes" for decompressed chunks.
