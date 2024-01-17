# @zarrita/core

## 0.1.0-next.6

### Patch Changes

- fix: Use blanket storage export to avoid including @zarrita/storage in bundle ([`dad2e4e40509f53ffd25ff44f6454776fd52d723`](https://github.com/manzt/zarrita.js/commit/dad2e4e40509f53ffd25ff44f6454776fd52d723))

## 0.1.0-next.5

### Minor Changes

- feat: Add `tryWithConsolidated` store helper ([#141](https://github.com/manzt/zarrita.js/pull/141))

  Provides a convenient way to open a store that may or may not have consolidated
  metadata. Ideal for usage senarios with known access paths, since store with
  consolidated metadata do not incur additional network requests when accessing
  underlying groups and arrays.

  ```js
  import * as zarr from "zarrita";

  let store = await zarr.tryWithConsolidated(
    new zarr.FetchStore("https://localhost:8080/data.zarr");
  );

  // The following do not read from the store
  // (make network requests) if it is consolidated.
  let grp = await zarr.open(store, { kind: "group" });
  let foo = await zarr.open(grp.resolve("foo"), { kind: "array" });
  ```

- feat: Add `withConsolidated` store utility ([#119](https://github.com/manzt/zarrita.js/pull/119))

  **BREAKING**: Replaces [`openConsolidated`](https://github.com/manzt/zarrita.js/pull/91)
  to provide a consistent interface for accessing consolidated and non-consolidated stores.

  ```javascript
  import * as zarr from "zarrita";

  // non-consolidated
  let store = new zarr.FetchStore("https://localhost:8080/data.zarr");
  let grp = await zarr.open(store); // network request for .zgroup/.zattrs
  let foo = await zarr.open(grp.resolve("/foo"), { kind: array }); // network request for .zarray/.zattrs

  // consolidated
  let store = new zarr.FetchStore("https://localhost:8080/data.zarr");
  let consolidatedStore = await zarr.withConsolidated(store); // opens ./zmetadata
  let contents = consolidatedStore.contents(); // [ {path: "/", kind: "group" }, { path: "/foo", kind: "array" }, ...]
  let grp = await zarr.open(consolidatedStore); // no network request
  let foo = await zarr.open(grp.resolve(contents[1].path), {
    kind: contents[1].kind,
  }); // no network request
  ```

## 0.1.0-next.4

### Patch Changes

- Updated dependencies [[`e542463`](https://github.com/manzt/zarrita.js/commit/e5424632a6fb69f87308f075b822a0d0ac675577)]:
  - @zarrita/typedarray@0.1.0-next.2

## 0.1.0-next.3

### Patch Changes

- Updated dependencies [[`29ef4b5`](https://github.com/manzt/zarrita.js/commit/29ef4b5771744e116aa5a33a3e0cad744877de88)]:
  - @zarrita/storage@0.1.0-next.3

## 0.1.0-next.2

### Patch Changes

- Use a counter to prioritize v2/v3 when opening. ([#109](https://github.com/manzt/zarrita.js/pull/109))

- Updated dependencies [[`3ec6538`](https://github.com/manzt/zarrita.js/commit/3ec6538d308198f6d0ad256c308013d17fd120dd)]:
  - @zarrita/storage@0.1.0-next.2

## 0.1.0-next.1

### Patch Changes

- Add licenses and READMES to packages ([#107](https://github.com/manzt/zarrita.js/pull/107))

- Updated dependencies [[`9b76a33`](https://github.com/manzt/zarrita.js/commit/9b76a331605be7d7d53188c069cf2dbb8463baec)]:
  - @zarrita/typedarray@0.1.0-next.1
  - @zarrita/storage@0.1.0-next.1

## 0.1.0-next.0

### Minor Changes

- chore: prepare preleases ([`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5))

### Patch Changes

- Updated dependencies [[`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5)]:
  - @zarrita/storage@0.1.0-next.0
  - @zarrita/typedarray@0.1.0-next.0

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
