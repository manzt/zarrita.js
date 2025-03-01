---
"@zarrita/ndarray": minor
"@zarrita/core": minor
---

Support `float16` in environments with [`Float16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float16Array) typed array. Since `Float16Array` is a new standard and not yet widely supported, some JavaScript runtimes may not support it. If unavailable, you can still use `float16` with `zarrita` by adding a [polyfill](https://github.com/petamoriken/float16).

Support is provided at both the type level (depending on the TypeScript config) and at runtime by checking `globalThis`. TypeScript users should ensure their target environment aligns with the expected types.
