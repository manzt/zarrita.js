---
"@zarrita/storage": patch
---

`FetchStore` throws an error for 403 (forbidden) responses. This is a **breaking** change because previously `404` and `403` responses were treated the same way. Now, only `404` responses signify a "missing" key from the store.
