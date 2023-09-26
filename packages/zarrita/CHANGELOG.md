# zarrita

## 0.4.0-next.4

### Patch Changes

- Updated dependencies [[`29ef4b5`](https://github.com/manzt/zarrita.js/commit/29ef4b5771744e116aa5a33a3e0cad744877de88)]:
  - @zarrita/storage@0.1.0-next.3
  - @zarrita/core@0.1.0-next.3
  - @zarrita/indexing@0.1.0-next.4

## 0.4.0-next.3

### Patch Changes

- Updated dependencies [[`3ec6538`](https://github.com/manzt/zarrita.js/commit/3ec6538d308198f6d0ad256c308013d17fd120dd)]:
  - @zarrita/storage@0.1.0-next.2
  - @zarrita/core@0.1.0-next.2
  - @zarrita/indexing@0.1.0-next.3

## 0.4.0-next.2

### Patch Changes

- Add licenses and READMES to packages ([#107](https://github.com/manzt/zarrita.js/pull/107))

- Updated dependencies [[`9b76a33`](https://github.com/manzt/zarrita.js/commit/9b76a331605be7d7d53188c069cf2dbb8463baec)]:
  - @zarrita/indexing@0.1.0-next.2
  - @zarrita/storage@0.1.0-next.1
  - @zarrita/core@0.1.0-next.1

## 0.4.0-next.1

### Patch Changes

- Updated dependencies [[`eb840b9`](https://github.com/manzt/zarrita.js/commit/eb840b9b856894abda9512625b963bcd002fb8a9)]:
  - @zarrita/indexing@0.1.0-next.1

## 0.4.0-next.0

### Minor Changes

- chore: prepare preleases ([`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5))

### Patch Changes

- fix: correctly export types from package.json ([#98](https://github.com/manzt/zarrita.js/pull/98))

- Updated dependencies [[`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5)]:
  - @zarrita/core@0.1.0-next.0
  - @zarrita/indexing@0.1.0-next.0
  - @zarrita/storage@0.1.0-next.0

## 0.3.2

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

- Updated dependencies [[`97e7df1`](https://github.com/manzt/zarrita.js/commit/97e7df188efa5e6ef343edca35c3d16862149920)]:
  - @zarrita/indexing@0.0.3
  - @zarrita/core@0.0.3

## 0.3.1

### Patch Changes

- feat: eagerly read attributes for v2 ([`6e7df4f`](https://github.com/manzt/zarrita.js/commit/6e7df4fe887cabae81e4e0e842628894082d9c27))

  Replaces the lazy `.attrs()` method on `zarr.Array` and `zarr.Group` with `.attrs` attribute.
  Instead for v2, `.zattrs` (JSON) is eagerly loaded when opening a node.

  ```javascript
  // loads .zattrs by default
  (await zarr.open.v2(store)).attrs; // { answer: 42 }

  // can be disabled
  (await zarr.open.v2(store, { attrs: false })).attrs; // {}
  ```

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

- Updated dependencies [[`6e7df4f`](https://github.com/manzt/zarrita.js/commit/6e7df4fe887cabae81e4e0e842628894082d9c27), [`89a2744`](https://github.com/manzt/zarrita.js/commit/89a27449076c63d176695e53e72bedfb97160f19), [`b90fd33`](https://github.com/manzt/zarrita.js/commit/b90fd339c748084caeccfed017accbcebc7cbafe)]:
  - @zarrita/core@0.0.2
  - @zarrita/storage@0.0.2
  - @zarrita/indexing@0.0.2

## 0.3.0

### Minor Changes

- feat!: Re-export `@zarrita/*` under `zarrita`. ([#89](https://github.com/manzt/zarrita.js/pull/89))

  This is a BREAKING change. The `zarrita` package is now a wrapper around the `@zarrita/*` modules.

  ```javascript
  import * as zarr from "zarrita";

  const store = new zarr.FetchStore("http://localhost:8080/data.zarr");
  const arr = await zarr.open(store, { kind: "array" });
  const region = await zarr.get(arr, [null, null, 0]);
  ```
