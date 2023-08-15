# @zarrita/indexing

- Operates on core `zarr.Array` for advanced indexing and slicing.
- Offers an ergonomic API familiar to Zarr/numpy users.
- Returns objects with strided TypedArrays

```javascript
const region = await get(arr, [null, null]);
// {
//   data: Uint16Array([ 1, 2, 3, 4]),
//   shape: [2, 2],
//   stride: [2, 1],
// }
```
