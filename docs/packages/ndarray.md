# @zarrita/ndarray

- Similar to `zarr.get` and `zarr.set` but returns `scijs/ndarray` objects.
- Ideal for applications already using or require `scijs/ndarray` objects.

```javascript
const region = await get(arr, [null, null]);
// ndarray.NdArray<Uint16Array>
```
