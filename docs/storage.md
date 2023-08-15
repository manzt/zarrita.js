# @zarrita/core

- Central component of Zarr.
- Offers `open` (for `Readable` stores) and `create` (for `Writeable` stores)
  functions.
- Main function: Initialize `zarr.Array` or `zarr.Group` based on the path
  hierarchy.
- A `zarr.Array` allows loading and decompressing individual _chunks_ by their
  coordinates – useful for applications needing direct chunk access like
  tile-based viewers.
