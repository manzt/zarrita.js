import { suite } from "uvu";
import * as assert from "uvu/assert";

import type { Chunk, Projection } from "../src/types";

import * as ops from "../src/ops";
import * as nd from "../src/ndarray";
import { get_strides, range, slice } from "../src/lib/util";

function test_setter(name: string, setter: typeof ops.setter | typeof nd.setter) {
	let test = suite(name);
	let { prepare, set_from_chunk, set_scalar } = setter as typeof ops.setter;

	test("set_scalar - fill", async () => {
		let a = prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let sel = [2, 3, 4].map((size) => slice(null).indices(size));
		set_scalar(a, sel, 1);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 1, 1, 1,
			1, 1, 1, 1,
			1, 1, 1, 1,
			
			1, 1, 1, 1,
			1, 1, 1, 1,
			1, 1, 1, 1,
		]));
	});

	test("set_scalar - point", async () => {
		let a = prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		set_scalar(a, [0, 0, 0], 1);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));

		set_scalar(a, [1, 1, 1], 2);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 0, 0,
		]));

		set_scalar(a, [1, 2, 3], 3);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 0, 3,
		]));

		set_scalar(a, [1, 2, 2], 4);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 4, 3,
		]));
	});

	test("set_scalar - mixed", async () => {
		let a = prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let sel = [slice(null).indices(2), slice(2).indices(3), 0];
		set_scalar(a, sel, 1);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
			
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
		]));

		sel = [0, slice(null).indices(3), slice(null).indices(4)];
		set_scalar(a, sel, 2);

		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			2, 2, 2, 2,
			2, 2, 2, 2,
			2, 2, 2, 2,
			
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	test("set_from_chunk - complete", async () => {
		let dest = prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let src = prepare(
			new Float32Array(2 * 2 * 2).fill(1),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
		];

		set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		assert.equal(dest.data, new Float32Array([
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
			
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
		]));

	});

	test("set_from_chunk - from complete to strided", async () => {
		let dest = prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let src = prepare(
			new Float32Array(2 * 2 * 2).fill(2),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 3, 2] },
			{ from: [0, 2, 1], to: [0, 4, 2] },
		];

		set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		assert.equal(dest.data, new Float32Array([
			2, 0, 2, 0,
			0, 0, 0, 0,
			2, 0, 2, 0,
			
			2, 0, 2, 0,
			0, 0, 0, 0,
			2, 0, 2, 0,
		]));

	});

	test("set_from_chunk - from strided to complete", async () => {
		let dest = prepare(
			new Float32Array(2 * 2 * 2),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		) as Chunk<"<f4">;

		let src = prepare(
			// deno-fmt-ignore
			new Float32Array([
				2, 0, 2, 0,
				0, 0, 0, 0,
				2, 0, 2, 0,
				
				2, 0, 2, 0,
				0, 0, 0, 0,
				2, 0, 2, 0,
			]),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;


		let mapping: Projection[] = [
			{ to: [0, 2, 1], from: [0, 2, 1] },
			{ to: [0, 2, 1], from: [0, 3, 2] },
			{ to: [0, 2, 1], from: [0, 4, 2] },
		];

		set_from_chunk(dest, src, mapping);
		assert.equal(dest.data, new Float32Array(2 * 2 * 2).fill(2));

	});

	test("set_from_chunk - src squeezed", async () => {

		let dest = prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let src = prepare(
			new Float32Array([2, 0, 0, 2]),
			[4],
			get_strides([4], "C"),
		) as Chunk<"<f4">;
		
		let mapping: Projection[] = [
			{ to: 0, from: null },
			{ to: [0, 3, 2], from: [0, 4, 3] },
			{ to: 1, from: null },
		];
		
		set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		assert.equal(dest.data, new Float32Array([
			0, 2, 0, 0,
			0, 0, 0, 0,
			0, 2, 0, 0,
			
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	test("set_from_chunk - dest squeezed", async () => {

		let dest = prepare(
			new Float32Array(4),
			[4],
			get_strides([4], "C"),
		) as Chunk<"<f4">;

		let src = prepare(
			// deno-fmt-ignore
			new Float32Array([
				0, 2, 0, 0,
				0, 0, 0, 0,
				0, 2, 0, 0,
				
				0, 0, 0, 0,
				0, 0, 0, 0,
				0, 0, 0, 0,
			]),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		
		let mapping: Projection[] = [
			{ from: 0, to: null },
			{ from: [0, 3, 2], to: [0, 4, 3] },
			{ from: 1, to: null },
		];
		
		set_from_chunk(dest, src, mapping);
		assert.equal(dest.data, new Float32Array([2, 0, 0, 2]));
	});

	return test;
}

test_setter("builtin", ops.setter).run();
test_setter("ndarray", nd.setter).run();
