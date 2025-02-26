export * from "@zarrita/core";
export { get, set, slice, type Slice, type Indices } from "@zarrita/indexing";
export { default as FetchStore } from "@zarrita/storage/fetch";
// re-export all the storage interface types
export type * from "@zarrita/storage";
