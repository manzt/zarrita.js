---
"zarrita": patch
---

Fix sharded v3 reads when `index_codecs` does not include `crc32c`. The shard-index suffix length is now derived from the index codec pipeline instead of assuming a 4-byte checksum.
