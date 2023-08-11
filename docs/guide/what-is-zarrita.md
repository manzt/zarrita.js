# What is zarrita.js?

**zarrita** is a minimal and modular implementation of Zarr in TypeScript.

- Zero dependencies (optionally scijs/ndarray)
- Supports v2 or v3 protocols
- Runs natively in Node, Browsers, and Deno (ESM)
- Supports C-order & F-order arrays
- Handles little endian or big endian data-types
- Handles number, bigint, string, and boolean data-types
- Configurable codes via numcodecs
- Allows very flexible storage
- Provides rich, in-editor type information via template literal types

## Project philosophy

**zarrita**'s API is almost entirely [tree-shakeable](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking), meaning users are able to pick and choose only the features of Zarr which are necessary for an applications. At its core, the zarr.Array class allows reading individual chunks. "Fancy-indexing" and "slicing" are accomplished via (optional) functions which operate on zarr.Array objects, and thus you only "pay" for these features if used (when bundling for the web).

This design choice differs from existing implemenations of Zarr in JavaScript, and allows zarrita to be both minimal and more feature-complete if necessary.
