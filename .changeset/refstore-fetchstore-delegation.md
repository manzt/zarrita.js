---
"@zarrita/storage": minor
---

`ReferenceStore` now uses `FetchStore` internally and accepts the same `fetch` option. The default fetch handler translates `s3://`, `gs://`, and `gcs://` URIs to HTTPS, but you can provide your own to add auth or handle other protocols:

```ts
const store = await ReferenceStore.fromUrl("https://example.com/refs.json", {
  async fetch(request) {
    // translate s3:// and gs:// URIs to HTTPS
    const url = ReferenceStore.resolveUri(request.url);
    const req = new Request(url, request);
    req.headers.set("Authorization", `Bearer ${await getToken()}`);
    return fetch(req);
  },
});
```
