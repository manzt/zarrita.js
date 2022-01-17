import { suite } from "uvu";
import * as assert from "uvu/assert";
import ndarray from "ndarray";

import type { Chunk } from "../src/types";

import * as ops from "../src/ops";
import * as nd from "../src/ndarray";
import { get_strides, range, slice } from "../src/lib/util";
// import { BoolArray } from '../src/lib/custom-arrays";

function test_setter(name: string, setter: typeof ops.setter | typeof nd.setter) {
	let test = suite(name);
	let { prepare, set_from_chunk, set_scalar } = setter as typeof ops.setter;

	test("set_scalar - fill", async () => {
		let shape = [2, 3, 4];
		let a = prepare(
			new Float32Array(2 * 3 * 4),
			shape,
			get_strides(shape, "C"),
		) as Chunk<"<f4">;
		set_scalar(
			a,
			shape.map((size) => slice(null).indices(size)),
			1,
		);
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

	test("set_scalar - number", async () => {
		let shape = [2, 3, 4];
		let a = prepare(
			new Float32Array(2 * 3 * 4),
			shape,
			get_strides(shape, "C"),
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

	test("set_scalar - number", async () => {
		let shape = [2, 3, 4];
		let a = prepare(
			new Float32Array(2 * 3 * 4),
			shape,
			get_strides(shape, "C"),
		) as Chunk<"<f4">;
		set_scalar(
			a,
			[slice(null).indices(2), slice(2).indices(3), 0],
			1,
		);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
			
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
		]));

		set_scalar(
			a,
			[0, slice(null).indices(3), slice(null).indices(4)],
			2,
		);
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

	test("set_from_chunk - dest squeezed", async () => {
	});

	test("set_from_chunk - src squeezed", async () => {
	});

	return test;
}

test_setter("builtin", ops.setter).run();
test_setter("ndarray", nd.setter).run();
