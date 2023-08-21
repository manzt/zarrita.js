---
"zarrita": patch
---

feat: eagerly read attributes for v2

Replaces the lazy `.attrs()` method on `zarr.Array` and `zarr.Group` with `.attrs` attribute. 
Instead for v2, `.zattrs` (JSON) is eagerly loaded when opening a node.

```javascript
// loads .zattrs by default
(await zarr.open.v2(store)).attrs; // { answer: 42 }

// can be disabled
(await zarr.open.v2(store, { attrs: false })).attrs; // {}
```
