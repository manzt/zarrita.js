---
"@zarrita/storage": patch
"zarrita": patch
---

Fix handling of paths with spaces in Zarr stores

Paths containing spaces or other special characters in Zarr stores were not being resolved correctly. The internal use of the `URL` for path resolution was inadvertently exposing URL-encoded paths (e.g., converting spaces to `%20`), preventing stores from finding entries with these characters.

This fix ensures paths are properly decoded after resolution, allowing Zarr arrays and groups with spaces in their names to be accessed correctly in both `ZipFileStore` and consolidated metadata.
