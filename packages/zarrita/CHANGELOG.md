# zarrita

## 0.7.2

### Patch Changes

- Fix `UnknownCodecError` when reading zarr v2 arrays that use the `bitround` or `json2` codec. ([#416](https://github.com/manzt/zarrita.js/pull/416))

## 0.7.1

### Patch Changes

- Drop `FileSystemStore` from the `zarrita` root barrel, which accidentally landed in 0.7.0 as part of #384. Node users who still want `FileSystemStore` can import it directly: ([#411](https://github.com/manzt/zarrita.js/pull/411))

  ```ts
  import { FileSystemStore } from "@zarrita/storage";
  // or
  import FileSystemStore from "@zarrita/storage/fs";
  ```

- Fix `TypeError: Do not know how to serialize a BigInt` when opening an `int64`/`uint64` array from a `withConsolidatedMetadata` store. ([`861b5fb`](https://github.com/manzt/zarrita.js/commit/861b5fbfd046b9090954c11576bf9d6288f07318))

## 0.7.0

### Minor Changes

- Add `AbortSignal` support to `open`, `get`, and `set`. The signal is forwarded to `store.get` calls and checked between async steps for early cancellation. ([#379](https://github.com/manzt/zarrita.js/pull/379))

  ```ts
  const controller = new AbortController();
  const signal = controller.signal;

  await zarr.open(store, { kind: "array", signal });
  await zarr.get(arr, [null], { signal });
  await zarr.set(arr, [null], value, { signal });
  ```

- Add `dimension_names` support to `create()` and expose `dimensionNames` getter on `Array`. For v2 arrays, `_ARRAY_DIMENSIONS` from attributes is automatically mapped to `dimensionNames`. ([#377](https://github.com/manzt/zarrita.js/pull/377))

- Add `fillValue` getter on `Array` to expose the fill value from array metadata. Works uniformly across v2 and v3 arrays, with proper deserialization of IEEE 754 special values (`NaN`, `Infinity`, `-Infinity`). ([#378](https://github.com/manzt/zarrita.js/pull/378))

- Add `select` helper for named-dimension selection. Converts a record of dimension names to the positional selection array that `get` and `set` accept, using the array's `dimensionNames` metadata. Throws for unknown dimension names. ([#382](https://github.com/manzt/zarrita.js/pull/382))

  ```ts
  let arr = await zarr.open(store, { kind: "array" });
  // arr.dimensionNames -> ["time", "lat", "lon"]

  let selection = zarr.select(arr, { lat: zarr.slice(100, 200), time: 0 });
  // -> [0, slice(100, 200), null]

  let result = await zarr.get(arr, selection);
  ```

- Add v3 consolidated metadata support to `withConsolidatedMetadata`. The v3 format reads `consolidated_metadata` from the root `zarr.json`, matching zarr-python's implementation. Note that v3 consolidated metadata is not yet part of the official Zarr v3 spec and should be considered experimental. ([#383](https://github.com/manzt/zarrita.js/pull/383))

  A new `format` option controls which format(s) to try, accepting a single string or an array for fallback ordering. When omitted, format is auto-detected using the store's version history.

  ```ts
  await withConsolidatedMetadata(store); // auto-detect
  await withConsolidatedMetadata(store, { format: "v2" }); // v2 only
  await withConsolidatedMetadata(store, { format: "v3" }); // v3 only
  await withConsolidatedMetadata(store, { format: ["v3", "v2"] }); // try v3, fall back to v2
  ```

- Auto-apply array extensions carried by a store ([#399](https://github.com/manzt/zarrita.js/pull/399))

  A store extension factory may now declare an `arrayExtensions` field on its
  returned overrides. `defineStoreExtension` merges each layer's list with the
  inner store's (inner-first, outer-last), and `zarr.open` applies the resulting
  list to every `zarr.Array` it returns — so downstream consumers don't need to
  call `zarr.extendArray` at each call site.

  This is the primitive for virtual-format adapters (hdf5-as-virtual-zarr,
  tiff-as-virtual-zarr, parquet-as-virtual-zarr) that pair a transport-layer
  store extension (synthesizing metadata keys) with a data-layer array extension
  (supplying decoded chunks) from a single factory with shared closure state:

  ```ts
  const hdf5VirtualZarr = zarr.defineStoreExtension(
    (inner, opts: { root: string }) => {
      let parsed = parseHdf5(opts.root);
      return {
        async get(key, options) {
          if (isVirtualMetadataKey(key, parsed))
            return synthesizeJson(key, parsed);
          return inner.get(key, options);
        },
        arrayExtensions: [
          zarr.defineArrayExtension((_inner) => ({
            async getChunk(coords) {
              return parsed.readChunk(coords);
            },
          })),
        ],
      };
    }
  );

  let store = await zarr.extendStore(raw, (s) =>
    hdf5VirtualZarr(s, { root: "/img" })
  );
  let arr = await zarr.open(store, { kind: "array", path: "/img" }); // auto-wrapped
  ```

  Also exports a new public type `zarr.ArrayExtension` for authoring these lists.

- Accept `bigint` in `slice()` ([#381](https://github.com/manzt/zarrita.js/pull/381))

- **BREAKING**: `zarr.create` options now use camelCase (`chunkShape`, `fillValue`, `chunkSeparator`, `dimensionNames`). ([#387](https://github.com/manzt/zarrita.js/pull/387))

  ```ts
  await zarr.create(store, {
    dtype: "float32", // was data_type
    shape: [100, 100],
    chunkShape: [10, 10], // was chunk_shape
    fillValue: 0, // was fill_value
    dimensionNames: ["y", "x"], // was dimension_names
  });
  ```

- feat: add `withRangeCoalescing` and `withByteCaching` for microtask-tick range batching and composable byte caching ([#347](https://github.com/manzt/zarrita.js/pull/347))

- Add `cast_value` and `scale_offset` v3 codecs ([#395](https://github.com/manzt/zarrita.js/pull/395))

  Implements the [`cast_value`](https://github.com/zarr-developers/zarr-extensions/tree/main/codecs/cast_value) and [`scale_offset`](https://github.com/zarr-developers/zarr-extensions/tree/main/codecs/scale_offset) codecs from zarr-extensions, enabling reads of arrays that use these array-to-array transformations.

- Add `numcodecs.` namespace for v2 codec registry and built-in shuffle/delta codecs ([#385](https://github.com/manzt/zarrita.js/pull/385))

  V2 filters and compressors are now registered under a `numcodecs.` prefix
  (e.g., `numcodecs.blosc`, `numcodecs.zlib`) matching zarr-python's convention.
  This separates v2-specific codecs from the v3 codec namespace.

  Adds built-in `numcodecs.shuffle` and `numcodecs.delta` codecs for reading v2
  data that uses these common numcodecs filters. Both are pure JS with no WASM
  dependencies.

  Custom v2 codecs can be registered under the same namespace:

  ```ts
  zarr.registry.set("numcodecs.my-filter", async () => ({
    fromConfig(config) {
      return {
        kind: "bytes_to_bytes",
        encode(data) {
          /* ... */
        },
        decode(data) {
          /* ... */
        },
      };
    },
  }));
  ```

- Introduce composable store and array extensions ([#398](https://github.com/manzt/zarrita.js/pull/398))

  **New primitives for wrapping stores and arrays:**

  - `zarr.defineStoreExtension(factory)` — define a store extension with automatic `Proxy` delegation. The factory receives an `AsyncReadable` and user options, returning overrides and extension fields. Supports sync and async factories.
  - `zarr.defineArrayExtension(factory)` — define an array extension that intercepts `getChunk` on a `zarr.Array`. Same Proxy-delegation model.
  - `zarr.extendStore(store, ...extensions)` — compose store extensions in a pipeline. Returns a `Promise` so async extensions (e.g. `withConsolidatedMetadata`) can initialize during composition.
  - `zarr.extendArray(array, ...extensions)` — compose array extensions in a pipeline.

  **Store extensions shipped in the box:**

  - `zarr.withConsolidatedMetadata` (and `zarr.withMaybeConsolidatedMetadata`) — short-circuit metadata reads from a pre-fetched consolidated blob, v2 `.zmetadata` or v3 `zarr.json` with the `consolidated_metadata` block. Replaces the previous `withConsolidated` / `tryWithConsolidated`.
  - `zarr.withRangeCoalescing` — microtask-tick range batcher. Concurrent `getRange` calls within a single microtask are grouped by path, coalesced across a byte-gap threshold, and issued as a single fetch per group. Emits `onFlush` callbacks with immutable `FlushReport` objects for observability.
  - `zarr.withByteCaching` — byte cache over `get()` and `getRange()`. By default, caches every request (gets under `path`, ranges under a composite key that encodes `offset`/`length` or `suffixLength`). An optional `keyFor` function (of type `CacheKeyFor`) lets callers narrow or reshape the policy by returning a cache key per call, or `undefined` to skip. The cache container is any object implementing `ByteCache` (`has` / `get` / `set`); a plain `Map` satisfies it and is the default when no `cache` option is supplied.

  **Removed:**

  - `BatchedRangeStore` (class)

  **Example:**

  ```ts
  import * as zarr from "zarrita";

  let store = await zarr.extendStore(
    new zarr.FetchStore("https://example.com/data.zarr"),
    zarr.withConsolidatedMetadata,
    (s) => zarr.withRangeCoalescing(s, { coalesceSize: 32768 }),
    (s) => zarr.withByteCaching(s)
  );

  let arr = await zarr.open(store, { kind: "array" });
  await zarr.get(arr, null);
  ```

  **Defining custom extensions:**

  ```ts
  const withTrace = zarr.defineStoreExtension(
    (store, opts: { log: (key: string) => void }) => ({
      async get(key, options) {
        opts.log(key);
        return store.get(key, options);
      },
    })
  );
  ```

- Add structured errors with `isZarritaError` type guard ([#396](https://github.com/manzt/zarrita.js/pull/396))

  Zarrita now throws a small set of tagged error types from a single internal hierarchy, replacing the ad-hoc mix of plain `Error`s and one-off custom classes (`NodeNotFoundError`, `JsonDecodeError`, `KeyError`, `IndexError`). The classes are exported alongside an `isZarritaError` runtime guard; module documentation steers callers toward the guard so `instanceof` checks aren't load-bearing.

  Six tags cover every distinct failure mode reachable from `zarr.open`, `zarr.get`, and `zarr.set`:

  - `NotFoundError` — store returned nothing, or `open({ kind })` found a different node kind (`found: "array" | "group"`).
  - `InvalidMetadataError` — JSON decode failure, unknown dtype, unknown chunk-key encoding, codec config rejected at load time.
  - `UnknownCodecError` — codec name not in the registry; carries the `codec` name so callers can register and retry.
  - `CodecPipelineError` — codec encode/decode threw at runtime; carries `direction`, `codec`, and the underlying `cause`.
  - `InvalidSelectionError` — bad rank, out-of-bounds, zero step, dimension-name mismatch, scalar-shape mismatch.
  - `UnsupportedError` — capability limit (sharded set, codec encode paths that aren't implemented, runtime missing `DataView.prototype.getFloat16`).

  ```ts
  try {
    await zarr.open(store, { kind: "array" });
  } catch (e) {
    if (zarr.isZarritaError(e, "NotFoundError")) {
      // e.path / e.found are available
    } else if (zarr.isZarritaError(e, "UnknownCodecError")) {
      // e.codec is the unregistered codec name
    }
  }
  ```

  `isZarritaError(e)` with no tag arguments narrows to any zarrita error.

### Patch Changes

- Allow `attrs` option in top-level `open()` to skip loading `.zattrs` for v2 stores ([#372](https://github.com/manzt/zarrita.js/pull/372))

- Add support for the delta codec ([`0ed6f72`](https://github.com/manzt/zarrita.js/commit/0ed6f72164f49195b94e5258d488c20b7485667c))

- Fix `NarrowDataType` to correctly narrow the `"boolean"` query to `Bool` ([#359](https://github.com/manzt/zarrita.js/pull/359))

- Fix `fill_value` serialization and deserialization for `NaN`, `Infinity`, and `-Infinity` per the Zarr v3 spec ([#373](https://github.com/manzt/zarrita.js/pull/373))

- Fix `zarr.open` version autodetection failing in browsers when servers return non-JSON responses for v2 metadata keys ([#374](https://github.com/manzt/zarrita.js/pull/374))

- Fix `get` and `set` for scalar arrays (`shape=[]`) ([#380](https://github.com/manzt/zarrita.js/pull/380))

- Support reading v2 `fixedscaleoffset`-encoded arrays ([#397](https://github.com/manzt/zarrita.js/pull/397))

  Translates the numcodecs `fixedscaleoffset` filter into the native v3 `scale_offset` + `cast_value` codec pair on read. Covers both v2 arrays (via the `filters` field) and v3 arrays produced by zarr-python's `numcodecs.zarr3` wrapper (via the `numcodecs.fixedscaleoffset` codec name). Arrays are exposed with the logical (decoded) data type even though the bytes on disk are quantized.

- Enable `declarationMap` so "go to definition" resolves to `.ts` source instead of `.d.ts` files ([#361](https://github.com/manzt/zarrita.js/pull/361))

- Updated dependencies [[`b2e8698`](https://github.com/manzt/zarrita.js/commit/b2e8698c2e8ef4deb92724de758f446be08400cc), [`e2a0568`](https://github.com/manzt/zarrita.js/commit/e2a0568f308628a8e246f069d9d81dbf053a7a82), [`7a6654c`](https://github.com/manzt/zarrita.js/commit/7a6654ccdfbd29e683ba7f86b7768c619e855cb5), [`5df59fe`](https://github.com/manzt/zarrita.js/commit/5df59fee0c7171c69fe88e99e095d52aa599d7a3)]:
  - @zarrita/storage@0.2.0

## 0.6.2

### Patch Changes

- Fix "Cannot convert 0 to a BigInt" error when reading missing chunks from uint64/int64 arrays ([#342](https://github.com/manzt/zarrita.js/pull/342))

- fix(sharding): deduplicate concurrent shard index fetches ([#346](https://github.com/manzt/zarrita.js/pull/346))

## 0.6.1

### Patch Changes

- Add `getRange()` to `ZipFileStore` for sharding support ([#337](https://github.com/manzt/zarrita.js/pull/337))

  Enables reading sharded arrays from zip files by implementing partial byte-range reads. Uncompressed entries support true partial reads; compressed entries fall back to reading the full entry and slicing.

- Updated dependencies [[`e9cfc57`](https://github.com/manzt/zarrita.js/commit/e9cfc577be4dd5cdf809516b45c63e4c80919c16)]:
  - @zarrita/storage@0.1.4

## 0.6.0

### Minor Changes

- Add support for `data_type: "string"` (Zarr v3). ([`8d5b2a6`](https://github.com/manzt/zarrita.js/commit/8d5b2a65066d9e22c84f8198217a90cc28c675fa))

  From a TypeScript perspective, this is a minor change because narrowing with `arr.is("string")` now expands the container type to `ByteStringArray | UnicodeStringArray | Array<string>`. TypeScript will require handling this new case. In a future version of zarrita, we will likely coerce all string data types to `Array<string>`. In the meantime, you can normalize the result:

  ```ts
  if (arr.is("string")) {
    const chunk = await get(arr);
    const data = Array.from(chunk.data); // Array<string>
  }
  ```

### Patch Changes

- Fix options not being passed through to shard getRange requests ([`ed223a8`](https://github.com/manzt/zarrita.js/commit/ed223a817efdaa708a54df3099a095ab8586ab45))

## 0.5.4

### Patch Changes

- Fix handling of paths with spaces in Zarr stores ([`a06a7e6`](https://github.com/manzt/zarrita.js/commit/a06a7e6a5a5ed64797d61f0fe81f8db46bff6659))

  Paths containing spaces or other special characters in Zarr stores were not being resolved correctly. The internal use of the `URL` for path resolution was inadvertently exposing URL-encoded paths (e.g., converting spaces to `%20`), preventing stores from finding entries with these characters.

  This fix ensures paths are properly decoded after resolution, allowing Zarr arrays and groups with spaces in their names to be accessed correctly in both `ZipFileStore` and consolidated metadata.

- Updated dependencies [[`a06a7e6`](https://github.com/manzt/zarrita.js/commit/a06a7e6a5a5ed64797d61f0fe81f8db46bff6659)]:
  - @zarrita/storage@0.1.3

## 0.5.3

### Patch Changes

- Updated dependencies [[`b4e06c8`](https://github.com/manzt/zarrita.js/commit/b4e06c8475e9b2762b1288cd833d46ce702ad469)]:
  - @zarrita/storage@0.1.2

## 0.5.2

### Patch Changes

- Add support for options.metadataKey in withConsolidated and tryWithConsolidated" ([#283](https://github.com/manzt/zarrita.js/pull/283))

## 0.5.1

### Patch Changes

- Emit and publish [sourcemap files](http://web.dev/articles/source-maps) ([#278](https://github.com/manzt/zarrita.js/pull/278))

- Updated dependencies [[`e6b580c`](https://github.com/manzt/zarrita.js/commit/e6b580c0c8e4c2088cce924236f9a3a7273f522f)]:
  - @zarrita/storage@0.1.1

## 0.5.0

### Minor Changes

- Replace default `gzip`/`zlib` codecs with dependency-less decode-only versions ([#275](https://github.com/manzt/zarrita.js/pull/275))

  This is a **breaking change** since by default **zarrita** no longer supports _encoding_ with these codecs. The new implementation is based on the [`DecompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream) API, preferring a built-in (i.e., dependency-free) solution for the majority use case (read-only) with zarrita.

  Encoding remains supported but must be explicitly enabled with a custom codec from `numcodecs`:

  ```ts
  import * as zarr from "zarrita";

  import GZip from "numcodecs/gzip";
  import Zlib from "numcodecs/zlib";

  zarr.registry.set("gzip", () => GZip);
  zarr.registry.set("zlib", () => Zlib);
  ```

## 0.4.0

### Minor Changes

- Remove explicit `order` from `GetOptions`. ([#274](https://github.com/manzt/zarrita.js/pull/274))

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

- Support `float16` in environments with [`Float16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float16Array) typed array. Since `Float16Array` is a new standard and not yet widely supported, some JavaScript runtimes may not support it. If unavailable, you can still use `float16` with `zarrita` by adding a [polyfill](https://github.com/petamoriken/float16). ([#250](https://github.com/manzt/zarrita.js/pull/250))

  Support is provided at both the type level (depending on the TypeScript config) and at runtime by checking `globalThis`. TypeScript users should ensure their target environment aligns with the expected types.

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

- feat: Remove `.indices` methods from `Slice` interface ([#121](https://github.com/manzt/zarrita.js/pull/121))

  By making `Slice` a more minimal interface, it is easy to allow compatability with ZarrJS `slice`
  (or slices not generated by the `slice` helper function).

### Patch Changes

- Export `Slice` type from `@zarrita/indexing` ([#258](https://github.com/manzt/zarrita.js/pull/258))

- Fix TypedArray types for TypeScript < 5.7 ([#239](https://github.com/manzt/zarrita.js/pull/239))

  TypeScript changed the typing behavior of all `TypedArray` objects to now be generic over the underlying `ArrayBufferLike` type. In order to have our types be consistent with these changes, we needed to specify the `ArrayBuffer` explicitly, but that breaks for older versions of TypeScript. This PR fixes the version of TypeScript to 5.6. We will need to bump again when we want to support 5.7.

- Support read-only `bitround` codec ([#234](https://github.com/manzt/zarrita.js/pull/234))

  Introduces `BitroundCodec` with a no-op for decoding because bit-rounding is lossy, and precision cannot be restored. Encoding is not yet implemented, reflecting zarrita's current focus on read-heavy contexts. Open an issue if encoding support is needed.

- feat: generalize chunk-indexing/slicing operations ([#103](https://github.com/manzt/zarrita.js/pull/103))

  Refactors the internals of `get`/`set` to operate on the raw 1D "bytes" for decompressed chunks.

- fix: Use blanket storage export to avoid including @zarrita/storage in bundle ([`dad2e4e`](https://github.com/manzt/zarrita.js/commit/dad2e4e40509f53ffd25ff44f6454776fd52d723))

- Conslidate `@zarrita/indexing` package into `@zarrita/core` ([#262](https://github.com/manzt/zarrita.js/pull/262))

  Now `@zarrita/indexing` re-exports from `zarrita`. End users should prefer to import from `zarrita`.

- Fix codec mapping ([#180](https://github.com/manzt/zarrita.js/pull/180))

- Remove \`@zarrita/typedarray\` package (now included in zarrita) ([`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59))

- Remove import from `node:assert` ([#263](https://github.com/manzt/zarrita.js/pull/263))

- Use a counter to prioritize v2/v3 when opening. ([#109](https://github.com/manzt/zarrita.js/pull/109))

- Add deprecation notice to @zarrita/indexing ([`59e8cbb`](https://github.com/manzt/zarrita.js/commit/59e8cbb3734475ee77fcbfb3f084d5b6d97dd1f8))

- Export `Listable` type ([#176](https://github.com/manzt/zarrita.js/pull/176))

- Remove use of public any from API in favor of unknown ([#173](https://github.com/manzt/zarrita.js/pull/173))

- Support transpose wiht explicit permutation ([#256](https://github.com/manzt/zarrita.js/pull/256))

- Add json2 codec. ([#153](https://github.com/manzt/zarrita.js/pull/153))

- Export `BoolArray`, `UnicodeStringArray`, and `ByteStringArrary` ([`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59))

- Consolidate @zarrita/core into zarrita ([#269](https://github.com/manzt/zarrita.js/pull/269))

- Fix: Handle missing v3 chunk_key_encoding.configuration ([#188](https://github.com/manzt/zarrita.js/pull/188))

- Enable creation of ReferenceStore via non-async functions. ([#203](https://github.com/manzt/zarrita.js/pull/203))

- fix: correctly export types from package.json ([#98](https://github.com/manzt/zarrita.js/pull/98))

- Deprecate package and move into zarrita ([`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59))

- Propagate getRange support in `Listable` when available ([#252](https://github.com/manzt/zarrita.js/pull/252))

- fix: Allow omitting codec configuration ([#199](https://github.com/manzt/zarrita.js/pull/199))

- Add licenses and READMES to packages ([#107](https://github.com/manzt/zarrita.js/pull/107))

- feat: Make unicode string array data view private ([#123](https://github.com/manzt/zarrita.js/pull/123))

- Add support for passing fetch options to ZipFileStore.fromUrl. ([#156](https://github.com/manzt/zarrita.js/pull/156))

- Re-export all @zarrita/storage types in zarrita ([#248](https://github.com/manzt/zarrita.js/pull/248))

- Updated dependencies [[`7756cdc`](https://github.com/manzt/zarrita.js/commit/7756cdc9f7dfc5a1fdfaed04d8f473b3d25a4e4e), [`3ec6538`](https://github.com/manzt/zarrita.js/commit/3ec6538d308198f6d0ad256c308013d17fd120dd), [`cf7524c`](https://github.com/manzt/zarrita.js/commit/cf7524cbaf04940b92896b9053970a196d82ecea), [`97210f6`](https://github.com/manzt/zarrita.js/commit/97210f64f56f475b9d4f4ee56673d713a5e8e93c), [`6080fb9`](https://github.com/manzt/zarrita.js/commit/6080fb954b6dbd5390802e500081e7c4bc5bb706), [`29ef4b5`](https://github.com/manzt/zarrita.js/commit/29ef4b5771744e116aa5a33a3e0cad744877de88), [`361a7aa`](https://github.com/manzt/zarrita.js/commit/361a7aa0a038317fe469c1ca62385cc3dfdc28b1), [`511dbdc`](https://github.com/manzt/zarrita.js/commit/511dbdc008fffc5f26b0aa2e116f91d720d34f16)]:
  - @zarrita/storage@0.1.0

## 0.4.0-next.27

### Patch Changes

- Consolidate @zarrita/core into zarrita ([#269](https://github.com/manzt/zarrita.js/pull/269))

- Updated dependencies [[`97210f6`](https://github.com/manzt/zarrita.js/commit/97210f64f56f475b9d4f4ee56673d713a5e8e93c)]:
  - @zarrita/storage@0.1.0-next.10

## 0.1.0-next.23

### Patch Changes

- Conslidate `@zarrita/indexing` package into `@zarrita/core` ([#262](https://github.com/manzt/zarrita.js/pull/262))

  Now `@zarrita/indexing` re-exports from `zarrita`. End users should prefer to import from `zarrita`.

- Remove import from `node:assert` ([#263](https://github.com/manzt/zarrita.js/pull/263))

## 0.1.0-next.22

### Minor Changes

- Support `float16` in environments with [`Float16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float16Array) typed array. Since `Float16Array` is a new standard and not yet widely supported, some JavaScript runtimes may not support it. If unavailable, you can still use `float16` with `zarrita` by adding a [polyfill](https://github.com/petamoriken/float16). ([#250](https://github.com/manzt/zarrita.js/pull/250))

  Support is provided at both the type level (depending on the TypeScript config) and at runtime by checking `globalThis`. TypeScript users should ensure their target environment aligns with the expected types.

## 0.1.0-next.21

### Patch Changes

- Support transpose wiht explicit permutation ([#256](https://github.com/manzt/zarrita.js/pull/256))

## 0.1.0-next.20

### Patch Changes

- Remove \`@zarrita/typedarray\` package (now included in zarrita) ([`cbf160a`](https://github.com/manzt/zarrita.js/commit/cbf160a0e9a526d044dbb1909cd5ad190240ba59))

## 0.1.0-next.19

### Patch Changes

- Propagate getRange support in `Listable` when available ([#252](https://github.com/manzt/zarrita.js/pull/252))

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
