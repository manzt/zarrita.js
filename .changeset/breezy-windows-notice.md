---
"@zarrita/core": patch
"@zarrita/indexing": patch
"@zarrita/ndarray": patch
"@zarrita/storage": patch
"@zarrita/typedarray": patch
"zarrita": patch
---

Fix TypedArray types for TypeScript < 5.7

TypeScript changed the typing behavior of all `TypedArray` objects to now be generic over the underlying `ArrayBufferLike` type. In order to have our types be consistent with these changes, we needed to specify the `ArrayBuffer` explicitly, but that breaks for older versions of TypeScript. This PR fixes the version of TypeScript to 5.6. We will need to bump again when we want to support 5.7.
