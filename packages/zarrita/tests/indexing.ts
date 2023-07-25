import { test, assert } from "vitest";

import type { Slice } from "../src/types";

import {
	BasicIndexer,
	normalize_integer_selection,
	normalize_selection,
} from "../src/lib/indexing";
import { slice } from "../src/lib/util";

test("normalize_selection", () => {
	// null !== null, so need custom compare
	let eq = (a: (Slice | number)[], b: (Slice | number)[]) => {
		assert.equal(a.map((s) => s.toString()), b.map((s) => s.toString()));
	};
	eq(
		normalize_selection(null, [2, 3, 4]),
		[slice(null), slice(null), slice(null)],
	);
	eq(
		normalize_selection([slice(2), null, 3], [2, 3, 4]),
		[slice(2), slice(null), 3],
	);
	eq(
		normalize_selection([slice(2), null, 3], [2, 3, 4]),
		[slice(2), slice(null), 3],
	);
	assert.throws(() => normalize_selection([slice(2), null, 3, 4], [2, 3, 4]));
});

test("normalize_integer_selection", () => {
	assert.equal(normalize_integer_selection(2, 5), 2);
	assert.equal(normalize_integer_selection(-1, 5), 4);
	assert.equal(normalize_integer_selection(-2, 5), 3);
	assert.equal(normalize_integer_selection(-2.2, 5), 3);
	assert.equal(normalize_integer_selection(4.3, 5), 4);
	assert.throws(() => normalize_integer_selection(5, 5));
	assert.throws(() => normalize_integer_selection(6, 5));
	assert.throws(() => normalize_integer_selection(-6, 5));
});

test("BasicIndexer - chunk_shape === shape", () => {
	let indexer = new BasicIndexer({
		selection: null,
		shape: [3, 4, 5],
		chunk_shape: [3, 4, 5],
	});
	assert.equal(indexer.shape, [3, 4, 5]);
	assert.equal(
		Array.from(indexer).map((i) => i.mapping)[0],
		[[0, 3, 1], [0, 4, 1], [0, 5, 1]].map((to) => ({ from: to, to })),
	);
});

test("BasicIndexer - complete multichunk", () => {
	let indexer = new BasicIndexer({
		selection: null,
		shape: [3, 4, 5],
		chunk_shape: [1, 2, 5],
	});

	assert.equal(indexer.shape, [3, 4, 5]);

	let iter = indexer[Symbol.iterator]();

	let p = iter.next().value;
	assert.equal(p.chunk_coords, [0, 0, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [0, 1, 1] },
		{ from: [0, 2, 1], to: [0, 2, 1] },
		{ from: [0, 5, 1], to: [0, 5, 1] },
	]);

	p = iter.next().value;
	assert.equal(p.chunk_coords, [1, 0, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [1, 2, 1] },
		{ from: [0, 2, 1], to: [0, 2, 1] },
		{ from: [0, 5, 1], to: [0, 5, 1] },
	]);

	p = iter.next().value;
	assert.equal(p.chunk_coords, [2, 0, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [2, 3, 1] },
		{ from: [0, 2, 1], to: [0, 2, 1] },
		{ from: [0, 5, 1], to: [0, 5, 1] },
	]);

	p = iter.next().value;
	assert.equal(p.chunk_coords, [0, 1, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [0, 1, 1] },
		{ from: [0, 2, 1], to: [2, 4, 1] },
		{ from: [0, 5, 1], to: [0, 5, 1] },
	]);

	p = iter.next().value;
	assert.equal(p.chunk_coords, [1, 1, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [1, 2, 1] },
		{ from: [0, 2, 1], to: [2, 4, 1] },
		{ from: [0, 5, 1], to: [0, 5, 1] },
	]);

	p = iter.next().value;
	assert.equal(p.chunk_coords, [2, 1, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [2, 3, 1] },
		{ from: [0, 2, 1], to: [2, 4, 1] },
		{ from: [0, 5, 1], to: [0, 5, 1] },
	]);
});

test("BasicIndexer - squeezed dim", () => {
	let indexer = new BasicIndexer({
		selection: [null, 0],
		shape: [3, 4],
		chunk_shape: [1, 4],
	});

	assert.equal(indexer.shape, [3]);

	let iter = indexer[Symbol.iterator]();

	let p = iter.next().value;
	assert.equal(p.chunk_coords, [0, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [0, 1, 1] },
		{ from: 0, to: null },
	]);

	p = iter.next().value;
	assert.equal(p.chunk_coords, [1, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [1, 2, 1] },
		{ from: 0, to: null },
	]);

	p = iter.next().value;
	assert.equal(p.chunk_coords, [2, 0]);
	assert.equal(p.mapping, [
		{ from: [0, 1, 1], to: [2, 3, 1] },
		{ from: 0, to: null },
	]);
});
