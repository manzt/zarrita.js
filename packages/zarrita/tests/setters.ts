import * as uvu from "uvu";
import * as assert from "uvu/assert";

import ndarray from "ndarray";
// @ts-ignore
import { assign } from "ndarray-ops";

import type { Chunk, Projection } from "../src/types";

import * as ops from "../src/ops";
import * as nd from "../src/ndarray";
import { get_strides, slice } from "../src/lib/util";

function to_c({ data, shape, stride }: Chunk<"<f4">) {
	let size = shape.reduce((a, b) => a * b, 1);
	let out = ndarray(new (data as any).constructor(size), shape);
	assign(out, ndarray(data, shape, stride));
	return out;
}

function suite(name: string, setter: typeof ops.setter | typeof nd.setter) {
	let test = uvu.suite<typeof ops.setter>(name);

	test.before((ctx) => {
		ctx.prepare = setter.prepare;
		ctx.set_from_chunk = setter.set_from_chunk;
		ctx.set_scalar = setter.set_scalar;
	});

	test("ctx.set_scalar - fill", async (ctx) => {
		let a = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let sel = [2, 3, 4].map((size) => slice(null).indices(size));
		ctx.set_scalar(a, sel, 1);
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

	test("ctx.set_scalar - point", async (ctx) => {
		let a = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		ctx.set_scalar(a, [0, 0, 0], 1);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));

		ctx.set_scalar(a, [1, 1, 1], 2);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 0, 0,
		]));

		ctx.set_scalar(a, [1, 2, 3], 3);
		// deno-fmt-ignore
		assert.equal(a.data, new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 0, 3,
		]));

		ctx.set_scalar(a, [1, 2, 2], 4);
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

	test("ctx.set_scalar - mixed", async (ctx) => {
		let a = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let sel = [slice(null).indices(2), slice(2).indices(3), 0];
		ctx.set_scalar(a, sel, 1);
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
		ctx.set_scalar(a, sel, 2);

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

	test("ctx.set_scalar - mixed F order", async (ctx) => {
		let f = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "F"),
		) as Chunk<"<f4">;

		let sel = [slice(null).indices(2), slice(2).indices(3), 0];
		ctx.set_scalar(f, sel, 1);
		// deno-fmt-ignore
		assert.equal(f.data, new Float32Array([
			1, 1, 1, 1, 0, 0,
			0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0,
		]));

		sel = [0, slice(null).indices(3), slice(null).indices(4)];
		ctx.set_scalar(f, sel, 2);

		// deno-fmt-ignore
		assert.equal(f.data, new Float32Array([
			2, 1, 2, 1, 2, 0,
			2, 0, 2, 0, 2, 0,
			2, 0, 2, 0, 2, 0,
			2, 0, 2, 0, 2, 0,
		]));

		// deno-fmt-ignore
		assert.equal(to_c(f).data, new Float32Array([
			2, 2, 2, 2,
			2, 2, 2, 2,
			2, 2, 2, 2,
			
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	test("set_from_chunk - complete", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
			new Float32Array(2 * 2 * 2).fill(1),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
		];

		ctx.set_from_chunk(dest, src, mapping);
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

	test("set_from_chunk - from complete to strided", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
			new Float32Array(2 * 2 * 2).fill(2),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 3, 2] },
			{ from: [0, 2, 1], to: [0, 4, 2] },
		];

		ctx.set_from_chunk(dest, src, mapping);
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

	test("set_from_chunk - from strided to complete", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 2 * 2),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
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

		ctx.set_from_chunk(dest, src, mapping);
		assert.equal(dest.data, new Float32Array(2 * 2 * 2).fill(2));
	});

	test("set_from_chunk - src squeezed", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
			new Float32Array([2, 0, 0, 2]),
			[4],
			get_strides([4], "C"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ to: 0, from: null },
			{ to: [0, 3, 2], from: [0, 4, 3] },
			{ to: 1, from: null },
		];

		ctx.set_from_chunk(dest, src, mapping);
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

	test("set_from_chunk - dest squeezed", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(4),
			[4],
			get_strides([4], "C"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
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

		ctx.set_from_chunk(dest, src, mapping);
		assert.equal(dest.data, new Float32Array([2, 0, 0, 2]));
	});

	test("set_from_chunk - complete F order", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "F"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
			new Float32Array(2 * 2 * 2).fill(1),
			[2, 2, 2],
			get_strides([2, 2, 2], "F"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
		];

		ctx.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		assert.equal(to_c(dest).data, new Float32Array([
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
			
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
		]));
	});

	// TODO(2022-01-17): fix the following tests to work for "builtin" as well;
	let maybe_skip = name === "builtin" ? test.skip : test;

	maybe_skip("set_from_chunk - F order", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "F"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
			new Float32Array([2, 0, 0, 2]),
			[4],
			get_strides([4], "F"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ to: 0, from: null },
			{ to: [0, 3, 2], from: [0, 4, 3] },
			{ to: 1, from: null },
		];

		ctx.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		assert.equal(to_c(dest).data, new Float32Array([
			0, 2, 0, 0,
			0, 0, 0, 0,
			0, 2, 0, 0,

			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	maybe_skip("set_from_chunk - dest=F order, src=C order", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "F"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
			new Float32Array([2, 0, 0, 2]),
			[4],
			get_strides([4], "C"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ to: 0, from: null },
			{ to: [0, 3, 2], from: [0, 4, 3] },
			{ to: 1, from: null },
		];

		ctx.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		assert.equal(to_c(dest).data, new Float32Array([
			0, 2, 0, 0,
			0, 0, 0, 0,
			0, 2, 0, 0,

			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	maybe_skip("set_from_chunk - dest=C order, src=F order", async (ctx) => {
		let dest = ctx.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		) as Chunk<"<f4">;

		let src = ctx.prepare(
			new Float32Array([2, 0, 0, 2]),
			[4],
			get_strides([4], "F"),
		) as Chunk<"<f4">;

		let mapping: Projection[] = [
			{ to: 0, from: null },
			{ to: [0, 3, 2], from: [0, 4, 3] },
			{ to: 1, from: null },
		];

		ctx.set_from_chunk(dest, src, mapping);
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

	return test;
}

suite("builtin", ops.setter).run();
suite("ndarray", nd.setter).run();
