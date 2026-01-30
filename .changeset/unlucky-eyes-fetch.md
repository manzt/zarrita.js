---
"@zarrita/storage": patch
"zarrita": patch
---

Add `getRange()` to `ZipFileStore` for sharding support

Enables reading sharded arrays from zip files by implementing partial byte-range reads. Uncompressed entries support true partial reads; compressed entries fall back to reading the full entry and slicing.
