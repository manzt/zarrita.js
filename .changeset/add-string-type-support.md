---
"zarrita": minor
---

Add support for `data_type: "string"` (Zarr v3).

From a TypeScript perspective, this is a minor change because narrowing with `arr.is("string")` now expands the container type to `ByteStringArray | UnicodeStringArray | Array<string>`. TypeScript will require handling this new case. In a future version of zarrita, we will likely coerce all string data types to `Array<string>`. In the meantime, you can normalize the result:

```ts
if (arr.is("string")) {
  const chunk = await get(arr);
  const data = Array.from(chunk.data); // Array<string>
}
```
