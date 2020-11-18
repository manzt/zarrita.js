**Here be dragons (in JavaScript)**. Zarrita.js is a minimal, exploratory implementation of the Zarr version 3.0 core protocol. 
This repo is meant to mirror [`zarrita`](https://github.com/alimanfoo/zarrita), the python implementation. The test suite in 
`index.test.js` mirrors the doctest from `zarrita`, and tests both the default `MemoryStore` and Node.js-specific 
`FileSystemStore` (located in `./fsstore.js`).

> NOTE: Only hierarchy creation and traversal are implemented. Need to implement `get` and `set` for `ZarrArray`, but
> currently `arr.get_chunk(chunk_coord)` is supported.

#### TODO:

- Write minimal `NDArray` for slicing / indexing of `ZarrArray`.
- Modularize lib. Bundle smallest `core` lib for travsersing hierarchy and decoding array chunks by key -- no `ZarrArray` indexing or `NDArray`.
Top-level export mutates `ZarrArray` prototype and adds indexing and  `NDArray` dep.

```javascript
import FileSystemStore from './fsstore.js';
import { create_hierarchy, registry } from './zarrita.js';
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
    dtype: '>f2',
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
})();
```

```bash
$ tree test.zr3
├── meta
│   └── root
│       ├── arthur
│       │   └── dent.array.json
│       ├── deep
│       │   └── thought.array.json
│       └── tricia
│           └── mcmillan.group.json
└── zarr.json

5 directories, 4 files
```

#### Development

```bash
$ npm install && npm test
```
