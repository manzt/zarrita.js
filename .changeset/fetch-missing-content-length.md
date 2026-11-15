---
"@zarrita/storage": patch
---

`FetchStore` no longer downloads a whole file when only part of it was requested. If a server leaves out `Content-Length`, the store asks for the last bytes directly. If a server ignores the `Range` header, the read throws instead of downloading everything.
