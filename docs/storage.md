# @zarrita/storage

- Provides a set of storage backends for Zarr.
- Stores can be `Readable` and optionally `Writeable`.
- Basic store example: JavaScript `Map` for in-memory storage.
- Implements stores for the Node filesystem API and `fetch` API for reading Zarr
  from file system and HTTP requests respectively.
- Ideal for Zarr users in the browser: `FetchStore`.
- Implement your own store!
