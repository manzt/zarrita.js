# What is zarrita.js?

**zarrita** is a modular Zarr implementation in TypeScript.

- Runs natively in Node, Browsers, and Deno (ESM)
- Supports v2/v3 protocols, C & F-order arrays, and diverse data-types
- Allows flexible storage backends and compression codecs
- Provides rich, in-editor type information via template literal types

## Zarr building blocks

**zarrita**'s API is almost entirely
[tree-shakeable](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking),
meaning users are able to pick and choose only the features of Zarr which are
necessary for an applications. At its core, the `zarr.Array` class allows
reading individual chunks. "Fancy-indexing" and "slicing" are accomplished via
(optional) functions which operate on `zarr.Array` objects.

Thus, you only _pay_ for these features if used (when bundling for the web).

This design choice differs from existing implemenations of Zarr in JavaScript,
and allows **zarrita** to be both minimal and more feature-complete if
necessary.
