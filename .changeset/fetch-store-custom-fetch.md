---
"@zarrita/storage": minor
---

Add custom `fetch` option to `FetchStore`. Accepts a WinterTC-style fetch handler ([`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) in, [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) out) to cover the long tail of things users need at the fetch level. Deprecates `overrides`.

Presigning a URL:

```ts
const store = new FetchStore("https://my-bucket.s3.amazonaws.com/data.zarr", {
  async fetch(request) {
    const newUrl = await presign(request.url);
    return fetch(new Request(newUrl, request));
  },
});
```

Remapping response status codes:

```ts
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

#### Migrating from `overrides`

`overrides` only supported static [`RequestInit`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) properties. For anything dynamic (like refreshing a token), you had to thread it through every call site:

```ts
const store = new FetchStore("https://example.com/data.zarr");
const arr = await zarr.open(store);

// token logic leaks into every get call
let chunk = await zarr.get(arr, null, {
  opts: { headers: { Authorization: `Bearer ${await getAccessToken()}` } },
});
```

With `fetch`, auth is configured once on the store and every request picks it up:

```ts
const store = new FetchStore("https://example.com/data.zarr", {
  async fetch(request) {
    const token = await getAccessToken();
    request.headers.set("Authorization", `Bearer ${token}`);
    return fetch(request);
  },
});
const arr = await zarr.open(store);

// call sites don't need to know about auth
let chunk = await zarr.get(arr);
```
