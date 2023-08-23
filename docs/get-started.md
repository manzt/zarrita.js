# Getting Started

**zarrita** supports a variety of environments, including the browser, Node.js,
and Deno.

## Try Zarr online

You can try out **zarrita** on
[Observable](https://observablehq.com/d/35b6921f8cb3aeef)! Fork the
[example notebook](https://observablehq.com/d/35b6921f8cb3aeef) and
try loading some of your own data.

## Zarr in vanilla HTML

In vanilla HTML, you can load **zarrita** from a CDN such as
[jsDelivr](https://www.jsdelivr.com/) or [esm.sh](https://esm.sh) or you can
download it locally. We recommend using the CDN-hosted ES module bundle since it
automatically loads the other dependencies.

::: tabs

== jsDelivr

```html
<!DOCTYPE html>
<script type="module">
  import * as zarr from "https://cdn.jsdelivr.net/npm/zarrita@0.3/+esm";
  const store = new zarr.FetchStore("https://raw.githubusercontent.com/zarr-developers/zarr_implementations/5dc998ac72/examples/zarr.zr/blosc");
  const arr = await zarr.open(store, { kind: "array" });
  // {
  //   store: FetchStore,
  //   path: "/",
  //   dtype: "uint8",
  //   shape: [512, 512, 3],
  //   chunks: [100, 100, 1],
  // }
  const view = await zarr.get(arr, [null, null, 0]);
  // {
  //   data: Uint8Array,
  //   shape: [512, 512],
  //   stride: [512, 1],
  // }
</script>
```

== esm.sh

```html
<!DOCTYPE html>
<script type="module">
  import * as zarr from "https://esm.sh/zarrita@0.3";
  const store = new zarr.FetchStore("https://raw.githubusercontent.com/zarr-developers/zarr_implementations/5dc998ac72/examples/zarr.zr/blosc");
  const arr = await zarr.open(store, { kind: "array" });
  // {
  //   store: FetchStore,
  //   path: "/",
  //   dtype: "uint8",
  //   shape: [512, 512, 3],
  //   chunks: [100, 100, 1],
  // }
  const view = await zarr.get(arr, [null, null, 0]);
  // {
  //   data: Uint8Array,
  //   shape: [512, 512],
  //   stride: [512, 1],
  // }
</script>
```

== unpkg + import map

```html
<!DOCTYPE html>
<script type="importmap">
  {
    "imports": {
      "zarrita": "https://unpkg.com/zarrita@0.3",
      "@zarrita/core": "https://unpkg.com/@zarrita/core@0.0",
      "@zarrita/typedarray": "https://unpkg.com/@zarrita/typedarray@0.0",
      "@zarrita/indexing": "https://unpkg.com/@zarrita/indexing@0.0",
      "@zarrita/storage/fetch": "https://unpkg.com/@zarrita/storage@0.0/dist/src/fetch.js",
      "numcodecs/blosc": "https://unpkg.com/numcodecs@0.2/blosc",
      "numcodecs/lz4": "https://unpkg.com/numcodecs@0.2/lz4",
      "numcodecs/zlib": "https://unpkg.com/numcodecs@0.2/zlib",
      "numcodecs/zstd": "https://unpkg.com/numcodecs@0.2/zstd",
      "numcodecs/gzip": "https://unpkg.com/numcodecs@0.2/gzip"
    }
  }
</script>
<script type="module">
  import * as zarr from "zarrita";
  const store = new zarr.FetchStore("https://raw.githubusercontent.com/zarr-developers/zarr_implementations/5dc998ac72/examples/zarr.zr/blosc");
  const arr = await zarr.open(store, { kind: "array" });
  // {
  //   store: FetchStore,
  //   path: "/",
  //   dtype: "uint8",
  //   shape: [512, 512, 3],
  //   chunks: [100, 100, 1],
  // }
  const view = await zarr.get(arr, [null, null, 0]);
  // {
  //   data: Uint8Array,
  //   shape: [512, 512],
  //   stride: [512, 1],
  // }
</script>
```

:::

## Installing from npm

If you're developing an application with Node.js, you can install **zarrita**
via yarn, npm, pnpm:

::: tabs key:pkg

== yarn

```sh
yarn add zarrita
```

== npm

```sh
npm install zarrita
```

== pnpm

```sh
pnpm add zarrita
```

:::

You can then load **zarrita** modules into your app as:

```javascript
import * as zarr from "zarrita";
const arr = await zarr.open(store);
```

or instead, import specific exports:

```javascript
import { open } from "zarrita";
const arr = await open(store);
```

::: info

Bundlers like Rollup are smart enough to tree-shake namespace imports, so the
above code will result in the same final bundle.

:::
