# Getting Started

## Try zarrita online

The fastest way to get started with zarrita is on Observable! We have a notebook

## Zarr in vanilla HTML

In vanilla HTML, you can load **zarrita** from a CDN such as
[jsDelivr](https://www.jsdelivr.com/) or [esm.sh](https://esm.sh) or you can
download it locally. We recommend using the CDN-hosted ES module bundle as it
automatically loads Plot’s dependency on D3. But for those who need it, we also
provide a UMD bundle that exports the Plot global when loaded as a plain script.

```html
<!DOCTYPE html>
<script type="importmap">
  {
    "imports": {
      "@zarrita/core": "https://cdn.jsdelivr.net/npm/@zarrita/core@0.0.1/+esm",
      "@zarrita/indexing": "https://cdn.jsdelivr.net/npm/@zarrita/indexing@0.0.1/+esm"
    }
  }
</script>
<script type="module">
  import * as zarr from "@zarrita/core";
  import { get } from "@zarrita/indexing";
</script>
```

## Usage

```js
import * as zarr from "@zarrita/core";
import { FetchStore } from "@zarrita/storage";
import { get, slice } from "@zarrita/indexing";

const store = new FetchStore("http://localhost:8080/data.zarr");
const arr = await zarr.open.v2(store, { kind: "array" });

// Read the entire dataset into memory
const full = await get(arr);
// {
//   data: Int32Array(50) [
//      0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
//     10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
//     20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
//     30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
//     40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
//   ],
//   shape: [ 5, 10 ],
//   stride: [ 10, 1 ]
// }

// Read a subset into memory
const region = await get(arr, [null, slice(6)]);
// {
//   data: Int32Array(30) [
//      0,  1,  2,  3,  4,  5,
//     10, 11, 12, 13, 14, 15,
//     20, 21, 22, 23, 24, 25,
//     30, 31, 32, 33, 34, 35,
//     40, 41, 42, 43, 44, 45,
//   ],
//   shape: [ 5, 6 ],
//   stride: [ 6, 1 ]
// }
```
