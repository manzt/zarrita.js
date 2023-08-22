# @zarrita/core

## 0.0.3

### Patch Changes

- feat: Support `VLenUTF8` codec in v2 and introduce a strided JS "object" Array. ([#96](https://github.com/manzt/zarrita.js/pull/96))

  ```python
  import zarr
  import numcodecs

  zarr.create_dataset(
      "data.zarr",
      data=np.array(
          [[["a", "aa"], ["aaa", "aaaa"]],
          [["b", "bb"], ["bbb", "bbbb"]]],
          dtype=object
      ),
      dtype="|O",
      object_codec=numcodecs.VLenUTF8(),
      chunks=(1, 1, 2),
  )
  ```

  ```typescript
  import * as zarr from "zarrita";

  let store = zarr.FetchStore("http://localhost:8080/data.zarr");
  let arr = await zarr.open.v2(store, { kind: "array" });
  let result = zarr.get(arr);
  // {
  //   data: ["a", "aa", "aaa", "aaaa", "b", "bb", "bbb", "bbbb"],
  //   shape: [2, 2, 2],
  //   stride: [4, 2, 1],
  // }
  ```

## 0.0.2

### Patch Changes

- feat: Add `openConsolidated` helper ([`6e7df4f`](https://github.com/manzt/zarrita.js/commit/6e7df4fe887cabae81e4e0e842628894082d9c27))

  A utility for working with v2 consolidated metadata.

  ```javascript
  import * as zarr from "zarrita";

  let store = new zarr.FetchStore("http://localhost:8080/data.zarr");
  let hierarchy = await zarr.openConsolidated(store);
  hierarchy.contents;
  // Map {
  //  "/" => Group,
  //  "/foo" => Array,
  //  "/bar" => Group,
  //  "/bar/baz" => Array,
  // }
  let grp = hierarchy.root(); // Group
  let foo = hierarchy.open("/foo", { kind: "array" }); // Array
  let baz = hierarchy.open(grp.resolve("bar/baz"), { kind: "array" }); // Array
  let bar = hierarchy.open(baz.resolve(".."), { kind: "group" }); // Group
  ```

- feat: Support reading ZEP0002 sharded indexing ([#94](https://github.com/manzt/zarrita.js/pull/94))

- Updated dependencies [[`b90fd33`](https://github.com/manzt/zarrita.js/commit/b90fd339c748084caeccfed017accbcebc7cbafe)]:
  - @zarrita/storage@0.0.2

## 0.0.1

### Patch Changes

- feat: prefer camelCase for public API ([#83](https://github.com/manzt/zarrita.js/pull/83))

- feat: Support v2 string data types with builtin indexing ([#75](https://github.com/manzt/zarrita.js/pull/75))

- Updated dependencies [[`eee6a0e`](https://github.com/manzt/zarrita.js/commit/eee6a0ee80a045efb7bbcb8d6a96740ec8f3ea95), [`0f37caa`](https://github.com/manzt/zarrita.js/commit/0f37caa89a125c92e8d8b812acb2b79b2cb257e8)]:
  - @zarrita/typedarray@0.0.1
  - @zarrita/storage@0.0.1
