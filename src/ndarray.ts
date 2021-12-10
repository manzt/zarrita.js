import ndarray from "ndarray";
// @ts-ignore
import ops from "ndarray-ops";

import { register as registerGet } from "./lib/get";
import { register as registerSet } from "./lib/set";

import type { DataType, Indices, Scalar, TypedArray } from "./types";

const setter = {
	prepare: ndarray,
	set_scalar<D extends DataType>(
		target: ndarray.NdArray<TypedArray<D>>,
		selection: (number | Indices)[],
		value: Scalar<D>,
	) {
		ops.assigns(view(target, selection), value);
	},
	set_from_chunk<D extends DataType>(
		target: ndarray.NdArray<TypedArray<D>>,
		target_selection: (number | Indices)[],
		chunk: ndarray.NdArray<TypedArray<D>>,
		chunk_selection: (number | Indices)[],
	) {
		ops.assign(
			view(target, target_selection),
			view(chunk, chunk_selection),
		);
	},
};

export const set = registerSet.ndarray(setter);
export const get = registerGet.ndarray(setter);

/** Convert zarrita selection to ndarray view. */
function view<D extends DataType>(
	arr: ndarray.NdArray<TypedArray<D>>,
	sel: (number | Indices)[],
) {
	const lo: number[] = [];
	const hi: number[] = [];
	const step: number[] = [];
	const pick: (number | null)[] = [];

	sel.forEach((s, i) => {
		if (typeof s === "number") {
			lo.push(0);
			hi.push(arr.shape[i]);
			step.push(1);
			pick.push(s);
			return;
		}
		lo.push(s[0]);
		hi.push(s[1]);
		step.push(s[2]);
		pick.push(null);
	});

	return arr.hi(...hi).lo(...lo).step(...step).pick(...pick);
}
