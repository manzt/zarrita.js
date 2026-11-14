---
"zarrita": patch
---

Support `index_location: "start"` in the sharding codec. Shard indexes were
always read from the end of the shard, so stores written with the index first
failed with `416 Range Not Satisfiable`.
