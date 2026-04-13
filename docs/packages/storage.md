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
interface GetOptions {
	signal?: AbortSignal;
}

interface Readable {
	get(key: string, options?: GetOptions): Uint8Array | undefined;
}

interface AsyncReadable {
	get(key: string, options?: GetOptions): Promise<Uint8Array | undefined>;
}
```

and may optionally implement `Writable` or `AsyncWritable`:

```typescript
interface Writable {
	set(key: string, value: Uint8Array): void;
}

interface AsyncWritable {
	set(key: string, value: Uint8Array): Promise<void>;
}
```

That's it! `Readable`/`Writable` are enough to allow an
[ES6 Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
to serve as the most basic backend, while also facilitating developers in
creating their custom stores as needed.

## Implementations

The **@zarrita/storage** package provides some useful storage implementations;
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

#### Response handling

The store interprets HTTP responses as follows:

| Status        | Meaning                                    |
| ------------- | ------------------------------------------ |
| **404**       | Missing key — returns `undefined`          |
| **200 / 206** | Success — body is read as `Uint8Array`     |
| **Any other** | Throws an error                            |

If your backend returns different status codes for missing keys (e.g., S3
returns **403** for missing keys on private buckets), you can remap them with a
custom `fetch` (see below).

#### Custom `fetch`

You can provide a custom `fetch` function to intercept every request made by the
store. It receives a standard
[WinterTC fetch handler](https://github.com/nicolo-ribaudo/tc55-proposal-functions-api),
similar to Cloudflare Workers, Deno.serve, and Bun.serve — a
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) in, a
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) out.

This is the recommended way to add authentication, presign URLs, or transform
requests.

::: warning Important
Sharding and partial reads rely on `Range` headers in the request. When
transforming a request (e.g., changing the URL), always use
`new Request(newUrl, originalRequest)` to preserve headers, abort signals, and
other options passed via `store.get(key, init)`.
:::

```javascript
const store = new FetchStore("https://my-bucket.s3.amazonaws.com/data.zarr", {
	async fetch(request) {
		const newUrl = await presign(request.url);
		// Preserves headers, abort signal, and other options from store.get(key, init)
		return fetch(new Request(newUrl, request));
	},
});
```

##### Adding authentication headers

You can set headers on the request directly, which replaces the need for the
deprecated `overrides` option. Since the handler runs on every request, you can
also dynamically refresh credentials:

```javascript
const store = new FetchStore("https://example.com/data.zarr", {
	async fetch(request) {
		const token = await getAccessToken();
		request.headers.set("Authorization", `Bearer ${token}`);
		return fetch(request);
	},
});
```

##### Handling S3 403 responses

S3 returns **403** (not 404) for missing keys on private buckets, which causes
the store to throw. If you know that 403 means "not found" in your setup, remap
it:

```javascript
const store = new FetchStore("https://my-bucket.s3.amazonaws.com/data.zarr", {
	async fetch(request) {
		const response = await fetch(request);
		if (response.status === 403) {
			return new Response(null, { status: 404 });
		}
		return response;
	},
});
```

#### Specific Request Options

When making individual requests, you can supply specific options as the second
argument to `FetchStore.get`. For example, additional headers or an
[`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).

```javascript
const controller = new AbortController();
const bytes = await store.get("/zarr.json", {
	headers: { foo: "bar" },
	signal: controller.signal,
});
```

These per-request options are merged into the `Request` passed to your custom
`fetch` (or the global `fetch` if none is provided). Headers are merged, with
per-request headers taking precedence.


### FileSystemStore <Badge type="tip" text="Readable" /> <Badge type="tip" text="Writable" />

The **FileSystemStore** is designed for JavaScript runtimes with file system access
(i.e., server-side JavaScript). It is built atop the Node.js
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
