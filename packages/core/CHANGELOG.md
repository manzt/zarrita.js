# @zarrita/core

## 0.1.0-next.18

### Patch Changes

- Updated dependencies [[`6080fb9`](https://github.com/manzt/zarrita.js/commit/6080fb954b6dbd5390802e500081e7c4bc5bb706)]:
  - @zarrita/storage@0.1.0-next.9

## 0.1.0-next.17

### Patch Changes

- Fix TypedArray types for TypeScript < 5.7 ([#239](https://github.com/manzt/zarrita.js/pull/239))

  TypeScript changed the typing behavior of all `TypedArray` objects to now be generic over the underlying `ArrayBufferLike` type. In order to have our types be consistent with these changes, we needed to specify the `ArrayBuffer` explicitly, but that breaks for older versions of TypeScript. This PR fixes the version of TypeScript to 5.6. We will need to bump again when we want to support 5.7.

- Updated dependencies [[`7756cdc`](https://github.com/manzt/zarrita.js/commit/7756cdc9f7dfc5a1fdfaed04d8f473b3d25a4e4e)]:
  - @zarrita/storage@0.1.0-next.8
  - @zarrita/typedarray@0.1.0-next.4

## 0.1.0-next.16

### Patch Changes

- Support read-only `bitround` codec ([#234](https://github.com/manzt/zarrita.js/pull/234))

  Introduces `BitroundCodec` with a no-op for decoding because bit-rounding is lossy, and precision cannot be restored. Encoding is not yet implemented, reflecting zarrita's current focus on read-heavy contexts. Open an issue if encoding support is needed.

## 0.1.0-next.15

### Patch Changes

- Updated dependencies [[`361a7aa0a038317fe469c1ca62385cc3dfdc28b1`](https://github.com/manzt/zarrita.js/commit/361a7aa0a038317fe469c1ca62385cc3dfdc28b1)]:
  - @zarrita/storage@0.1.0-next.7

## 0.1.0-next.14

### Patch Changes

- Updated dependencies [[`00bebf9a3adbdeca0e0fab52a7440b34d5e22314`](https://github.com/manzt/zarrita.js/commit/00bebf9a3adbdeca0e0fab52a7440b34d5e22314)]:
  - @zarrita/storage@0.1.0-next.6

## 0.1.0-next.13

### Patch Changes

- fix: Allow omitting codec configuration ([#199](https://github.com/manzt/zarrita.js/pull/199))

## 0.1.0-next.12

### Patch Changes

- Fix: Handle missing v3 chunk_key_encoding.configuration ([#188](https://github.com/manzt/zarrita.js/pull/188))

## 0.1.0-next.11

### Patch Changes

- Fix codec mapping ([#180](https://github.com/manzt/zarrita.js/pull/180))

## 0.1.0-next.10

### Patch Changes

- Export `Listable` type ([#176](https://github.com/manzt/zarrita.js/pull/176))

## 0.1.0-next.9

### Patch Changes

- Remove use of public any from API in favor of unknown ([#173](https://github.com/manzt/zarrita.js/pull/173))

- Updated dependencies [[`cf7524cbaf04940b92896b9053970a196d82ecea`](https://github.com/manzt/zarrita.js/commit/cf7524cbaf04940b92896b9053970a196d82ecea)]:
  - @zarrita/typedarray@0.1.0-next.3
  - @zarrita/storage@0.1.0-next.5

## 0.1.0-next.8

### Patch Changes

- Updated dependencies [[`511dbdc008fffc5f26b0aa2e116f91d720d34f16`](https://github.com/manzt/zarrita.js/commit/511dbdc008fffc5f26b0aa2e116f91d720d34f16), [`35047471d3d79d0a98dd8226e2e1f6fad01e8923`](https://github.com/manzt/zarrita.js/commit/35047471d3d79d0a98dd8226e2e1f6fad01e8923)]:
  - @zarrita/storage@0.1.0-next.4

## 0.1.0-next.7

### Patch Changes

- Add json2 codec. ([#153](https://github.com/manzt/zarrita.js/pull/153))

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
