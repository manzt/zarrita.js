# @zarrita/storage

Storage backends for Zarr in the browser, Node.js, Bun.js, and Deno.

## What is a store?

In Zarr, a **store** is the primary interface for data access. It serves as a
pluggable layer to link the Zarr's internal engine to the physical location of
data, be it in-memory, on disk, or across a network.

The **store** abstraction stands at the heart of Zarr's design, allowing users
to define custom storage backends or adapt existing stores to their specific
needs.

In **zarrita**, a **store** must implement the `Readable` or `AsyncReadable`
interface,

```typescript
interface Readable<Options> {
	get(key: string, options?: Options): Unit8Array | undefined;
}

interface AsyncReadable<Options> {
	get(key: string, options?: Options): Promise<Uint8Array | undefined>;
}
```

and may optionally implement `Writeable` or `AsyncWriteable`:

```typescript
interface Writeable {
	set(key: string, value: Uint8Array): void;
}

interface AsyncWriteable {
	set(key: string, value: Uint8Array): Promise<void>;
}
```

That's it! `Readable`/`Writeable` are enough to allow an
[ES6 Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
to serve as the most basic backend, while also facilitating developers in
creating their custom stores as needed.

## Implementations

The **@zarrita/storage** package provides some useful storage implementions;
some are tailored for browsers, while others are designed for various JS
runtimes like Node.js and Deno.

### FetchStore <Badge type="tip" text="Readable" />

The **FetchStore** is a storage solution based on HTTP requests using the
[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). This
store is compatible anywhere the `fetch` is available, which includes browsers,
Node.js, and Deno.

```javascript
import { FetchStore } from "@zarrita/storage";

const store = new FetchStore("http://localhost:8080/data.zarr");
```

You can optionally provide `RequestInit` to forward to each `fetch` request:

```javascript
const store = new FetchStore("http://localhost:8080/data.zarr", {
	headers: { Authorization: "XXXXX" },
});
```

### FileSystemStore <Badge type="tip" text="Readable" /> <Badge type="tip" text="Writeable" />

Designed for JavaScript runtimes with file system access, the The
**FileSystemStore** is designed for JavaScript runtimes with file system access
(i.e., server-side JavaScript). It is build atop the Node.js
[`fs`](https://nodejs.org/api/fs.html) module and is compatible with
environments like Node.js, Bun, and Deno.

```javascript
import { FileSystemStore } from "@zarrita/storage";

const store = new FileSystemStore("data.zarr");
```

### ZipFileStore <Badge type="warning" text="experimental" /> <Badge type="tip" text="Readable" />

The **ZipFileStore** enables reading a Zarr store collected in a single Zip
archive. This store supports reading either remotely via HTTP range-requests or
in-memory from a `Blob`.

```javascript
import { ZipFileStore } from "@zarrita/storage";

const store = ZipFileStore.fromUrl("http://localhost:8080/data.zarr.zip");
const store = ZipFileStore.fromBlob(blob);
```

### ReferenceStore <Badge type="warning" text="experimental" /> <Badge type="tip" text="Readable" />

The **ReferenceStore** supports reading the
[reference file specification](https://fsspec.github.io/kerchunk/spec.html)
produced by [kerchunk](https://github.com/fsspec/kerchunk). It enables efficient
random access from monolithic binary files like HDF5 or TIFF that have been
mapped to Zarr.

```javascript
import { ReferenceStore } from "@zarrita/storage";

const response = await fetch("http://localhost:8080/refs.json");
const store = await ReferenceStore.fromSpec(await response.json());
```
