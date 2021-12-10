**Here be dragons**. Zarrita.js is a minimal, exploratory implementation of the Zarr
version 2.0 _and_ version 3.0 protocol. It is implemented in TypeScript and utilizes
[templates literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
to provide rich data-type information from zarr metadata.

#### Usage:

```javascript
import { v3, slice, registry } from 'zarrita';
import MemoryStore from 'zarrita/storage/mem';
// import FileSystemStore from 'zarrita/storage/fs'; (Node)
// import FetchStore from 'zarrita/storage/fetch'; (Browser)
import GZip from 'numcodecs/gzip';

import ndarray from 'ndarray';
import { get, set } from 'zarrita/ndarray';

// codec registry is empty by default, so must add codecs
registry.set(GZip.codecId, () => GZip);

// Create store
const store = new MemoryStore();

(async () => {
  // Create hierarchy
  const h = await v3.create_hierarchy(store);

  // Create Array
  await h.create_array('/arthur/dent', {
    shape: [5, 10],
    dtype: '<i4',
    chunk_shape: [2, 5],
    compressor: new GZip(1),
    attrs: { question: 'life', answer: 42 },
  });

  // Create Array without compressor 
  await h.create_array('/deep/thought', {
    shape: 7500000,
    dtype: '>f4',
    chunk_shape: 42,
    compressor: null,
  });

  // Create a group 
  await h.create_group('/tricia/mcmillan', {
    attrs: { heart: 'gold', improbability: 'infinite' },
  });

  // View whole hierarchy
  const nodes = await h.get_nodes();
  console.log(nodes);
  //  Map(7) {
  //    '/arthur/dent' => 'array',
  //    '/arthur' => 'implicit_group',
  //    '/' => 'implicit_group',
  //    '/deep/thought' => 'array',
  //    '/deep' => 'implicit_group',
  //    '/tricia/mcmillan' => 'explicit_group',
  //    '/tricia' => 'implicit_group'
  //  }
  
  // Open an array
  const a = await h.get('/arthur/dent');
  console.log(await get(a, null));
  // {
  //   data: Int32Array(50) [
  //     0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  //     0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  //     0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  //     0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  //     0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  //   ],
  //   shape: [ 5, 10 ],
  //   stride: [ 10, 1 ]
  // }
  await set(a, [0, null], 42);
  console.log(await get(a, null));
  // {
  //   data: Int32Array(50) [
  //     42, 42, 42, 42, 42, 42, 42, 42, 42, 42,
  //      0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 
  //      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  //      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  //      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  //   ],
  //   shape: [ 5, 10 ],
  //   stride: [ 10, 1 ]
  // }
  await set(a, [null, 3], 42);
  console.log(await get(a, null));
  // {
  //   data: Int32Array(50) [
  //     42, 42, 42, 42, 42, 42, 42, 42, 42, 42,
  //      0,  0,  0, 42,  0,  0,  0,  0,  0,  0,
  //      0,  0,  0, 42,  0,  0,  0,  0,  0,  0,
  //      0,  0,  0, 42,  0,  0,  0,  0,  0,  0,
  //      0,  0,  0, 42,  0,  0,  0,  0,  0,  0,
  //   ],
  //   shape: [ 5, 10 ],
  //   stride: [ 10, 1 ]
  // }

  // np.arange(50).reshape(5, 10);
  await set(a, null, ndarray(new Int32Array([...Array(50).keys()]), [5, 10]));
  console.log(await get(a, null));
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
  
  const selection = [slice(1,4), slice(2,7)];
  console.log(await get(a, selection));
  // {
  //   data: Int32Array(15) [
  //     12, 13, 14, 15, 16,
  //     22, 23, 24, 25, 26,
  //     32, 33, 34, 35, 36,
  //   ],
  //   shape: [ 3, 5 ],
  //   stride: [ 5, 1 ]
  // }
})();
```

```bash
$ tree test.zr3
test.zr3
├── data
│   └── root
│       └── arthur
│           └── dent
│               ├── c0
│               │   ├── 0
│               │   └── 1
│               ├── c1
│               │   ├── 0
│               │   └── 1
│               └── c2
│                   ├── 0
│                   └── 1
├── meta
│   └── root
│       ├── arthur
│       │   └── dent.array.json
│       ├── deep
│       │   └── thought.array.json
│       └── tricia
│           └── mcmillan.group.json
└── zarr.json

12 directories, 10 files
```

#### Development

This library uses the [`pnpm`](https://pnpm.io/) package manager.

```bash
$ pnpm install && pnpm test
```

Tests are run directly on the ESM module (contents of `dist/`), which is generated when
running `pnpm test` thanks to [`mkdist`](https://github.com/unjs/mkdist), a simple
file-to-file transpiler.
