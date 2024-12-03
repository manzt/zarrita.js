# zarrita

## 0.4.0-next.19

### Patch Changes

- Fix TypedArray types for TypeScript < 5.7 ([#239](https://github.com/manzt/zarrita.js/pull/239))

  TypeScript changed the typing behavior of all `TypedArray` objects to now be generic over the underlying `ArrayBufferLike` type. In order to have our types be consistent with these changes, we needed to specify the `ArrayBuffer` explicitly, but that breaks for older versions of TypeScript. This PR fixes the version of TypeScript to 5.6. We will need to bump again when we want to support 5.7.

- Updated dependencies [[`7756cdc`](https://github.com/manzt/zarrita.js/commit/7756cdc9f7dfc5a1fdfaed04d8f473b3d25a4e4e)]:
  - @zarrita/core@0.1.0-next.17
  - @zarrita/indexing@0.1.0-next.19
  - @zarrita/storage@0.1.0-next.8

## 0.4.0-next.18

### Patch Changes

- Updated dependencies [[`4276c3b`](https://github.com/manzt/zarrita.js/commit/4276c3ba8db92062868982f4e64b22fb4ade45bb)]:
  - @zarrita/core@0.1.0-next.16
  - @zarrita/indexing@0.1.0-next.18

## 0.4.0-next.17

### Patch Changes

- Updated dependencies [[`361a7aa0a038317fe469c1ca62385cc3dfdc28b1`](https://github.com/manzt/zarrita.js/commit/361a7aa0a038317fe469c1ca62385cc3dfdc28b1)]:
  - @zarrita/storage@0.1.0-next.7
  - @zarrita/core@0.1.0-next.15
  - @zarrita/indexing@0.1.0-next.17

## 0.4.0-next.16

### Patch Changes

- Updated dependencies [[`00bebf9a3adbdeca0e0fab52a7440b34d5e22314`](https://github.com/manzt/zarrita.js/commit/00bebf9a3adbdeca0e0fab52a7440b34d5e22314)]:
  - @zarrita/storage@0.1.0-next.6
  - @zarrita/core@0.1.0-next.14
  - @zarrita/indexing@0.1.0-next.16

## 0.4.0-next.15

### Patch Changes

- Updated dependencies [[`1deb39aacdc0db42ce099f726e8e9a3fd989d1b2`](https://github.com/manzt/zarrita.js/commit/1deb39aacdc0db42ce099f726e8e9a3fd989d1b2)]:
  - @zarrita/core@0.1.0-next.13
  - @zarrita/indexing@0.1.0-next.15

## 0.4.0-next.14

### Patch Changes

- Updated dependencies [[`02e7855c5049e4ee7ae3fb18affd719eefe44b49`](https://github.com/manzt/zarrita.js/commit/02e7855c5049e4ee7ae3fb18affd719eefe44b49)]:
  - @zarrita/core@0.1.0-next.12
  - @zarrita/indexing@0.1.0-next.14

## 0.4.0-next.13

### Patch Changes

- Updated dependencies [[`8bda5817246064faadeb29beb0d3b669a6cd561b`](https://github.com/manzt/zarrita.js/commit/8bda5817246064faadeb29beb0d3b669a6cd561b)]:
  - @zarrita/core@0.1.0-next.11
  - @zarrita/indexing@0.1.0-next.13

## 0.4.0-next.12

### Patch Changes

- Updated dependencies [[`095577f0a1f643f80cf90a439d9e346c64947df0`](https://github.com/manzt/zarrita.js/commit/095577f0a1f643f80cf90a439d9e346c64947df0)]:
  - @zarrita/core@0.1.0-next.10
  - @zarrita/indexing@0.1.0-next.12

## 0.4.0-next.11

### Patch Changes

- Updated dependencies [[`cf7524cbaf04940b92896b9053970a196d82ecea`](https://github.com/manzt/zarrita.js/commit/cf7524cbaf04940b92896b9053970a196d82ecea)]:
  - @zarrita/indexing@0.1.0-next.11
  - @zarrita/storage@0.1.0-next.5
  - @zarrita/core@0.1.0-next.9

## 0.4.0-next.10

### Patch Changes

- Updated dependencies [[`511dbdc008fffc5f26b0aa2e116f91d720d34f16`](https://github.com/manzt/zarrita.js/commit/511dbdc008fffc5f26b0aa2e116f91d720d34f16), [`35047471d3d79d0a98dd8226e2e1f6fad01e8923`](https://github.com/manzt/zarrita.js/commit/35047471d3d79d0a98dd8226e2e1f6fad01e8923)]:
  - @zarrita/storage@0.1.0-next.4
  - @zarrita/core@0.1.0-next.8
  - @zarrita/indexing@0.1.0-next.10

## 0.4.0-next.9

### Patch Changes

- Updated dependencies [[`b90f16b77bc665d21f572b0790d1a0070d709f41`](https://github.com/manzt/zarrita.js/commit/b90f16b77bc665d21f572b0790d1a0070d709f41)]:
  - @zarrita/core@0.1.0-next.7
  - @zarrita/indexing@0.1.0-next.9

## 0.4.0-next.8

### Patch Changes

- Updated dependencies [[`dad2e4e40509f53ffd25ff44f6454776fd52d723`](https://github.com/manzt/zarrita.js/commit/dad2e4e40509f53ffd25ff44f6454776fd52d723)]:
  - @zarrita/core@0.1.0-next.6
  - @zarrita/indexing@0.1.0-next.8

## 0.4.0-next.7

### Minor Changes

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

### Patch Changes

- Updated dependencies [[`191d95c77d2c7902344cd0175ae0044f740d19ba`](https://github.com/manzt/zarrita.js/commit/191d95c77d2c7902344cd0175ae0044f740d19ba), [`4d177d825f7bc241e0906a1b2890cad93f22d8a6`](https://github.com/manzt/zarrita.js/commit/4d177d825f7bc241e0906a1b2890cad93f22d8a6)]:
  - @zarrita/core@0.1.0-next.5
  - @zarrita/indexing@0.1.0-next.7

## 0.4.0-next.6

### Patch Changes

- Updated dependencies []:
  - @zarrita/core@0.1.0-next.4
  - @zarrita/indexing@0.1.0-next.6

## 0.4.0-next.5

### Patch Changes

- Updated dependencies [[`42eaa70`](https://github.com/manzt/zarrita.js/commit/42eaa707f4baed360c2a2475cbec3870418714a8)]:
  - @zarrita/indexing@0.1.0-next.5

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
