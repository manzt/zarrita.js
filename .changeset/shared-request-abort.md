---
"zarrita": patch
---

Aborting one read no longer fails other reads that share its request. Reads in the same shard share one index fetch, and `withRangeCoalescing` merges nearby reads into one fetch. That shared fetch is now cancelled only once every read waiting on it has aborted.
