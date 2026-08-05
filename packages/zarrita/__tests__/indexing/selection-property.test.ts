import { describe, expect, it } from "vitest";

import * as zarr from "../../src/index.js";
import { cStride, filled, toLogical } from "../helpers.js";

/**
 * Reading a selection agrees with reading the whole array and then indexing
 * that by coordinates. Writing a selection changes those coordinates and no
 * others. The tests below check both against generated shapes, chunkings,
 * transpose orders and selections, rather than against hand-picked cases.
 *
 * The read test compares two reads, so a decoded layout that is wrong the
 * same way everywhere agrees with itself and passes. The write test does
 * catch that, because a write decodes and encodes again. Neither pins the
 * layout against bytes from another implementation; `transpose.test.ts`
 * does that with a stored fixture.
 */

const CASES = 400;

/** Deterministic, so a failure reproduces from the seed. */
function rng(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
	};
}

type Axis = number | null | { start: number; stop: number; step: number };

function permutation(rand: () => number, rank: number) {
	const order = Array.from({ length: rank }, (_, i) => i);
	for (let i = rank - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
}

/** An integer index, a whole axis, or a strided slice, per dimension. */
function selection(rand: () => number, shape: number[]): Axis[] {
	return shape.map((len) => {
		const kind = rand();
		if (kind < 0.45) return Math.floor(rand() * len);
		if (kind < 0.7) return null;
		const start = Math.floor(rand() * len);
		const stop = start + 1 + Math.floor(rand() * (len - start));
		return { start, stop, step: 1 + Math.floor(rand() * 2) };
	});
}

/** The axes an integer index does not drop, and the output length of each. */
function surviving(sel: Axis[], shape: number[]) {
	const axes: number[] = [];
	const lengths: number[] = [];
	sel.forEach((axis, d) => {
		if (typeof axis === "number") return;
		axes.push(d);
		lengths.push(
			axis === null
				? shape[d]
				: Math.ceil((axis.stop - axis.start) / axis.step),
		);
	});
	return { axes, lengths };
}

/**
 * The flat C-order offsets the selection addresses, in output order. This is
 * the oracle: it is coordinate arithmetic, and never calls into the indexing
 * code under test.
 */
function offsets(sel: Axis[], shape: number[]) {
	const stride = cStride(shape);
	const { axes, lengths } = surviving(sel, shape);
	let base = 0;
	sel.forEach((axis, d) => {
		if (typeof axis === "number") base += axis * stride[d];
		else if (axis !== null) base += axis.start * stride[d];
	});
	const steps = axes.map((d) => {
		const axis = sel[d];
		return axis === null || typeof axis === "number" ? 1 : axis.step;
	});
	const total = lengths.reduce((a, b) => a * b, 1);
	const index = new globalThis.Array(lengths.length).fill(0);
	const out: number[] = [];
	for (let n = 0; n < total; n++) {
		let offset = base;
		for (let i = 0; i < axes.length; i++) {
			offset += index[i] * steps[i] * stride[axes[i]];
		}
		out.push(offset);
		for (let i = lengths.length - 1; i >= 0; i--) {
			if (++index[i] < lengths[i]) break;
			index[i] = 0;
		}
	}
	return out;
}

function toSelection(sel: Axis[]) {
	return sel.map((axis) =>
		axis === null || typeof axis === "number"
			? axis
			: zarr.slice(axis.start, axis.stop, axis.step),
	);
}

/** Everything needed to turn a failure back into a focused test. */
function label(
	shape: number[],
	chunkShape: number[],
	order: number[],
	sel: Axis[],
) {
	return JSON.stringify({ shape, chunkShape, order, sel });
}

function generate(rand: () => number) {
	const rank = 2 + Math.floor(rand() * 3);
	const shape = Array.from({ length: rank }, () => 2 + Math.floor(rand() * 4));
	// chunks that do not divide the shape, so boundaries fall mid-selection
	const chunkShape = shape.map((len) => 1 + Math.floor(rand() * len));
	return { shape, chunkShape, order: permutation(rand, rank) };
}

describe("selections agree with coordinate arithmetic", () => {
	it("reads what the full read holds at those coordinates", async () => {
		const rand = rng(0x5eed);
		for (let n = 0; n < CASES; n++) {
			const { shape, chunkShape, order } = generate(rand);
			const sel = selection(rand, shape);
			const arr = await filled(shape, chunkShape, order);

			const whole = toLogical(await zarr.get(arr, null));
			const want = offsets(sel, shape).map((offset) => whole[offset]);

			const actual: unknown = await zarr.get(arr, toSelection(sel));
			const got =
				surviving(sel, shape).lengths.length === 0
					? [actual]
					: toLogical(actual as zarr.Chunk<"int32">);

			expect(got, label(shape, chunkShape, order, sel)).toStrictEqual(want);
		}
	});

	it("writes to those coordinates and no others", async () => {
		const rand = rng(0xc0ffee);
		for (let n = 0; n < CASES; n++) {
			const { shape, chunkShape, order } = generate(rand);
			const sel = selection(rand, shape);
			const arr = await filled(shape, chunkShape, order);

			const targets = offsets(sel, shape);
			const want = toLogical(await zarr.get(arr, null));
			targets.forEach((offset, i) => {
				want[offset] = -(i + 1);
			});

			const { lengths } = surviving(sel, shape);
			if (lengths.length === 0) {
				await zarr.set(arr, toSelection(sel), -1);
			} else {
				const data = new Int32Array(targets.length).map((_, i) => -(i + 1));
				await zarr.set(arr, toSelection(sel), {
					data,
					shape: lengths,
					stride: cStride(lengths),
				});
			}

			const got = toLogical(await zarr.get(arr, null));
			expect(got, label(shape, chunkShape, order, sel)).toStrictEqual(want);
		}
	});
});
