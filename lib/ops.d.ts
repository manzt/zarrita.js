import type { NDArray, Slice } from '../core.js';
declare type Selection = (null | number | Slice)[];
export declare function set(out: NDArray, out_selection: Selection, value: number | NDArray, value_selection?: Selection): void;
export {};
