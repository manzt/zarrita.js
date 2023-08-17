import { describe, expect, it } from "vitest";
import ndarray, { type TypedArray } from "ndarray";
import { assign } from "ndarray-ops";

import { type Projection, slice } from "@zarrita/indexing";

import { setter } from "../index.js";

/** Compute strides for 'C' or 'F' ordered array from shape */
function get_strides(shape: readonly number[], order: "C" | "F") {
	return (order === "C" ? row_major_stride : col_major_stride)(shape);
}

function row_major_stride(shape: readonly number[]) {
	const ndim = shape.length;
	const stride: number[] = globalThis.Array(ndim);
	for (let i = ndim - 1, step = 1; i >= 0; i--) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

function col_major_stride(shape: readonly number[]) {
	const ndim = shape.length;
	const stride: number[] = globalThis.Array(ndim);
	for (let i = 0, step = 1; i < ndim; i++) {
		stride[i] = step;
		step *= shape[i];
	}
	return stride;
}

function to_c<T extends TypedArray>(
	{ data, shape, stride }: ndarray.NdArray<T>,
) {
	let size = shape.reduce((a, b) => a * b, 1);
	let out = ndarray(new (data as any).constructor(size), shape);
	assign(out, ndarray(data, shape, stride));
	return out;
}

describe("setter", () => {
	it("setter.set_scalar - fill", async () => {
		let a = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		);

		let sel = [2, 3, 4].map((size) => slice(null).indices(size));
		setter.set_scalar(a, sel, 1);
		// deno-fmt-ignore
		expect(a.data).toStrictEqual(new Float32Array([
			1, 1, 1, 1,
			1, 1, 1, 1,
			1, 1, 1, 1,
			
			1, 1, 1, 1,
			1, 1, 1, 1,
			1, 1, 1, 1,
		]));
	});

	it("setter.set_scalar - point", async () => {
		let a = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		);

		setter.set_scalar(a, [0, 0, 0], 1);
		// deno-fmt-ignore
		expect(a.data).toStrictEqual(new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));

		setter.set_scalar(a, [1, 1, 1], 2);
		// deno-fmt-ignore
		expect(a.data).toStrictEqual(new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 0, 0,
		]));

		setter.set_scalar(a, [1, 2, 3], 3);
		// deno-fmt-ignore
		expect(a.data).toStrictEqual(new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 0, 3,
		]));

		setter.set_scalar(a, [1, 2, 2], 4);
		// deno-fmt-ignore
		expect(a.data).toStrictEqual(new Float32Array([
			1, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			
			0, 0, 0, 0,
			0, 2, 0, 0,
			0, 0, 4, 3,
		]));
	});

	it("setter.set_scalar - mixed", async () => {
		let a = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		);

		let sel = [slice(null).indices(2), slice(2).indices(3), 0];
		setter.set_scalar(a, sel, 1);
		// deno-fmt-ignore
		expect(a.data).toStrictEqual(new Float32Array([
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
			
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
		]));

		sel = [0, slice(null).indices(3), slice(null).indices(4)];
		setter.set_scalar(a, sel, 2);

		// deno-fmt-ignore
		expect(a.data).toStrictEqual(new Float32Array([
			2, 2, 2, 2,
			2, 2, 2, 2,
			2, 2, 2, 2,
			
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	it("setter.set_scalar - mixed F order", async () => {
		let f = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "F"),
		);

		let sel = [slice(null).indices(2), slice(2).indices(3), 0];
		setter.set_scalar(f, sel, 1);
		// deno-fmt-ignore
		expect(f.data).toStrictEqual(new Float32Array([
			1, 1, 1, 1, 0, 0,
			0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0,
		]));

		sel = [0, slice(null).indices(3), slice(null).indices(4)];
		setter.set_scalar(f, sel, 2);

		// deno-fmt-ignore
		expect(f.data).toStrictEqual(new Float32Array([
			2, 1, 2, 1, 2, 0,
			2, 0, 2, 0, 2, 0,
			2, 0, 2, 0, 2, 0,
			2, 0, 2, 0, 2, 0,
		]));

		// deno-fmt-ignore
		expect(to_c(f).data).toStrictEqual(new Float32Array([
			2, 2, 2, 2,
			2, 2, 2, 2,
			2, 2, 2, 2,
			
			1, 0, 0, 0,
			1, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	it("set_from_chunk - complete", async () => {
		let dest = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		);

		let src = setter.prepare(
			new Float32Array(2 * 2 * 2).fill(1),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		);

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
		];

		setter.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		expect(dest.data).toStrictEqual(new Float32Array([
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
			
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
		]));
	});

	it("set_from_chunk - from complete to strided", async () => {
		let dest = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		);

		let src = setter.prepare(
			new Float32Array(2 * 2 * 2).fill(2),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		);

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 3, 2] },
			{ from: [0, 2, 1], to: [0, 4, 2] },
		];

		setter.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		expect(dest.data).toStrictEqual(new Float32Array([
			2, 0, 2, 0,
			0, 0, 0, 0,
			2, 0, 2, 0,
			
			2, 0, 2, 0,
			0, 0, 0, 0,
			2, 0, 2, 0,
		]));
	});

	it("set_from_chunk - from strided to complete", async () => {
		let dest = setter.prepare(
			new Float32Array(2 * 2 * 2),
			[2, 2, 2],
			get_strides([2, 2, 2], "C"),
		);

		let src = setter.prepare(
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
		);

		let mapping: Projection[] = [
			{ to: [0, 2, 1], from: [0, 2, 1] },
			{ to: [0, 2, 1], from: [0, 3, 2] },
			{ to: [0, 2, 1], from: [0, 4, 2] },
		];

		setter.set_from_chunk(dest, src, mapping);
		expect(dest.data).toStrictEqual(new Float32Array(2 * 2 * 2).fill(2));
	});

	it("set_from_chunk - src squeezed", async () => {
		let dest = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "C"),
		);

		let src = setter.prepare(
			new Float32Array([2, 0, 0, 2]),
			[4],
			get_strides([4], "C"),
		);

		let mapping: Projection[] = [
			{ to: 0, from: null },
			{ to: [0, 3, 2], from: [0, 4, 3] },
			{ to: 1, from: null },
		];

		setter.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		expect(dest.data).toStrictEqual(new Float32Array([
			0, 2, 0, 0,
			0, 0, 0, 0,
			0, 2, 0, 0,
			
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	it("set_from_chunk - dest squeezed", async () => {
		let dest = setter.prepare(
			new Float32Array(4),
			[4],
			get_strides([4], "C"),
		);

		let src = setter.prepare(
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
		);

		let mapping: Projection[] = [
			{ from: 0, to: null },
			{ from: [0, 3, 2], to: [0, 4, 3] },
			{ from: 1, to: null },
		];

		setter.set_from_chunk(dest, src, mapping);
		expect(dest.data).toStrictEqual(new Float32Array([2, 0, 0, 2]));
	});

	it("set_from_chunk - complete F order", async () => {
		let dest = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "F"),
		);

		let src = setter.prepare(
			new Float32Array(2 * 2 * 2).fill(1),
			[2, 2, 2],
			get_strides([2, 2, 2], "F"),
		);

		let mapping: Projection[] = [
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
			{ from: [0, 2, 1], to: [0, 2, 1] },
		];

		setter.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		expect(to_c(dest).data).toStrictEqual(new Float32Array([
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
			
			1, 1, 0, 0,
			1, 1, 0, 0,
			0, 0, 0, 0,
		]));
	});

	it("set_from_chunk - F order", async () => {
		let dest = setter.prepare(
			new Float32Array(2 * 3 * 4),
			[2, 3, 4],
			get_strides([2, 3, 4], "F"),
		);

		let src = setter.prepare(
			new Float32Array([2, 0, 0, 2]),
			[4],
			get_strides([4], "F"),
		);

		let mapping: Projection[] = [
			{ to: 0, from: null },
			{ to: [0, 3, 2], from: [0, 4, 3] },
			{ to: 1, from: null },
		];

		setter.set_from_chunk(dest, src, mapping);
		// deno-fmt-ignore
		expect(to_c(dest).data).toStrictEqual(new Float32Array([
			0, 2, 0, 0,
			0, 0, 0, 0,
			0, 2, 0, 0,

			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		]));
	});

	it(
		"set_from_chunk - dest=F order, src=C order",
		async () => {
			let dest = setter.prepare(
				new Float32Array(2 * 3 * 4),
				[2, 3, 4],
				get_strides([2, 3, 4], "F"),
			);

			let src = setter.prepare(
				new Float32Array([2, 0, 0, 2]),
				[4],
				get_strides([4], "C"),
			);

			let mapping: Projection[] = [
				{ to: 0, from: null },
				{ to: [0, 3, 2], from: [0, 4, 3] },
				{ to: 1, from: null },
			];

			setter.set_from_chunk(dest, src, mapping);
			// deno-fmt-ignore
			expect(to_c(dest).data).toStrictEqual(new Float32Array([
				0, 2, 0, 0,
				0, 0, 0, 0,
				0, 2, 0, 0,

				0, 0, 0, 0,
				0, 0, 0, 0,
				0, 0, 0, 0,
			]));
		},
	);

	it(
		"set_from_chunk - dest=C order, src=F order",
		async () => {
			let dest = setter.prepare(
				new Float32Array(2 * 3 * 4),
				[2, 3, 4],
				get_strides([2, 3, 4], "C"),
			);

			let src = setter.prepare(
				new Float32Array([2, 0, 0, 2]),
				[4],
				get_strides([4], "F"),
			);

			let mapping: Projection[] = [
				{ to: 0, from: null },
				{ to: [0, 3, 2], from: [0, 4, 3] },
				{ to: 1, from: null },
			];

			setter.set_from_chunk(dest, src, mapping);
			// deno-fmt-ignore
			expect(dest.data).toStrictEqual(new Float32Array([
				0, 2, 0, 0,
				0, 0, 0, 0,
				0, 2, 0, 0,

				0, 0, 0, 0,
				0, 0, 0, 0,
				0, 0, 0, 0,
			]));
		},
	);
});
