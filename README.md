**Here be dragons (in JavaScript)**. Zarrita.js is a minimal, exploratory implementation of the Zarr version 3.0 core protocol. 
This repo is meant to mirror [`zarrita`](https://github.com/alimanfoo/zarrita), the python implementation. The test suite in 
`test/index.test.js` mirrors the doctest from `zarrita`, and tests both the default `MemoryStore` and Node.js-specific 
`FileSystemStore` (located in `./src/fsstore.js`).

#### TODO:

- Implement simple `HTTPStore`.

#### Usage:

```javascript
import FileSystemStore from './src/fsstore.js';
import { create_hierarchy, slice, registry } from './src/index.js';
import GZip from 'numcodecs/gzip';

// codec registry is empty by default, so must add codecs
registry.set(GZip.codecId, () => GZip);

// Clean slate
import fs from 'fs';
fs.rmdirSync('test.zr3', { recursive: true });

// Create store
const store = new FileSystemStore('test.zr3');

(async () => {
  // Create hierarchy
  const h = await create_hierarchy(store);

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
  console.log(await a.get(null));
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
  await a.set([0, null], 42);
  console.log(await a.get(null));
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
  await a.set([null, 3], 42);
  console.log(await a.get(null));
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
  await a.set(null, { data: new Int32Array([...Array(50).keys()]), shape: [5, 10] });
  console.log(await a.get(null));
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
  console.log(await a.get(selection));
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


#### Compatibility with `ndarray`

Zarrita.js has no dependencies other than `numcodecs.js` (for decoding compressed arrays). The 
`ZarrArray.get` and `ZarrArray.get_chunk` methods return an simple object with `data`, `shape`,
and `stride` properties. This is to avoid bundling an extra dependency, and enable compatilbility
with other array libraries. Similarly, setting a `ZarrArray` expects an object with these properties,
which means you can set a slice of a `ZarrArray` using `ndarray`.


```javascript
import ndarray from 'ndarray';

const selection = [slice(1,4), slice(2,7)];
const { data, shape, stride } = await a.get(selection);
const arr = ndarray(data, shape, stride);

/* perform some array operations */
await a.set(selection, arr); // set using ndarray!
```


#### Development

```bash
$ npm install && npm test
```
