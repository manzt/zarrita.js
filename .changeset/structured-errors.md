---
"zarrita": minor
---

Add structured errors with `isZarritaError` type guard

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
