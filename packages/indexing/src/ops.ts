import type { Mutable, Readable } from "@zarrita/storage";
import type * as core from "@zarrita/core";
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";
import { get as get_with_setter } from "./get.js";
import { set as set_with_setter } from "./set.js";
import type {
	GetOptions,
	Indices,
	Projection,
	SetOptions,
	Slice,
} from "./types.js";

type CompatDataType<D extends core.DataType> = D extends core.Bool ? core.Uint8
	: D;

type TypedArrayProxy<D extends core.DataType> = {
	[prop: number]: core.Scalar<D>;
	subarray(from: number, to?: number): TypedArrayProxy<D>;
	set(source: TypedArrayProxy<D>, offset: number): void;
	fill(value: core.Scalar<D>, start: number, end: number): void;
};

type CompatChunk<D extends core.DataType> = {
	data: TypedArrayProxy<CompatDataType<D>>;
	stride: number[];
};

function object_array_proxy<T extends core.DataType>(
	arr: T[],
	offset = 0,
	lengthArg?: number,
): TypedArrayProxy<T> {
	let length = lengthArg ?? arr.length - offset;
	return new Proxy(arr, {
		get(target, prop: string) {
			let idx = +prop;
			if (!Number.isNaN(idx)) {
				return target[offset + idx];
			}
			if (prop === "subarray") {
				return (from: number, to: number = length) => {
					return object_array_proxy(target, offset + from, to - from);
				};
			}
			if (prop === "set") {
				return (source: typeof target, start: number) => {
					for (let i = 0; i < source.length; i++) {
						target[offset + start + i] = source[i];
					}
				};
			}
			return Reflect.get(target, prop);
		},
		set(target, idx: string, value: T) {
			target[offset + Number(idx)] = value;
			return true;
		},
	}) as any;
}

function string_array_proxy<D extends core.ByteStr | core.UnicodeStr>(
	arr: core.TypedArray<D>,
): TypedArrayProxy<D> {
	const StringArrayConstructor = arr.constructor.bind(null, arr.chars);
	return new Proxy(arr, {
		get(target, prop: string) {
			let idx = +prop;
			if (!Number.isNaN(idx)) {
				return target.get(idx);
			}
			if (prop === "subarray") {
				return (from: number, to: number = arr.length) => {
					return string_array_proxy(
						new StringArrayConstructor(
							target.buffer,
							target.byteOffset + arr.BYTES_PER_ELEMENT * from,
							to - from,
						),
					);
				};
			}
			if (prop === "set") {
				return (source: typeof target, offset: number) => {
					for (let i = 0; i < source.length; i++) {
						target.set(offset + i, source.get(i));
					}
				};
			}
			if (prop === "fill") {
				return (value: string, start: number, end: number) => {
					for (let i = start; i < end; i++) {
						target.set(i, value);
					}
				};
			}
			return Reflect.get(target, prop);
		},
		set(target, idx: string, value: string) {
			target.set(Number(idx), value);
			return true;
		},
	}) as any;
}

function compat<D extends core.DataType>(arr: core.Chunk<D>): CompatChunk<D> {
	let data: any = arr.data;

	if (arr.data instanceof BoolArray) {
		data = new Uint8Array(arr.data.buffer);
	} else if (
		arr.data instanceof ByteStringArray ||
		arr.data instanceof UnicodeStringArray
	) {
		data = string_array_proxy(arr.data);
	} else if (arr.data instanceof globalThis.Array) {
		data = object_array_proxy(arr.data);
	}
	return {
		data,
		stride: arr.stride,
	};
}

type CompatScalar<D extends core.DataType> = core.Scalar<CompatDataType<D>>;

function cast_scalar<D extends core.DataType>(
	arr: core.Chunk<D>,
	value: core.Scalar<D>,
): CompatScalar<D> {
	if (arr.data instanceof BoolArray) {
		return (value ? 1 : 0) as any;
	}
	return value as any;
}

export const setter = {
	prepare<D extends core.DataType>(
		data: core.TypedArray<D>,
		shape: number[],
		stride: number[],
	) {
		return { data, shape, stride };
	},
	set_scalar<D extends core.DataType>(
		dest: core.Chunk<D>,
		sel: (number | Indices)[],
		value: core.Scalar<D>,
	) {
		set_scalar(compat(dest), sel, cast_scalar(dest, value));
	},
	set_from_chunk<D extends core.DataType>(
		dest: core.Chunk<D>,
		src: core.Chunk<D>,
		mapping: Projection[],
	) {
		set_from_chunk(compat(dest), compat(src), mapping);
	},
};

/** @category Utility */
export async function get<
	D extends core.DataType,
	Store extends Readable,
	Sel extends (null | Slice | number)[],
>(
	arr: core.Array<D, Store>,
	selection: Sel | null = null,
	opts: GetOptions<Parameters<Store["get"]>[1]> = {},
) {
	return get_with_setter<D, Store, core.Chunk<D>, Sel>(
		arr,
		selection,
		opts,
		setter,
	);
}

/** @category Utility */
export async function set<
	D extends core.DataType,
>(
	arr: core.Array<D, Mutable>,
	selection: (null | Slice | number)[] | null,
	value: core.Scalar<D> | core.Chunk<D>,
	opts: SetOptions = {},
) {
	return set_with_setter<D, core.Chunk<D>>(arr, selection, value, opts, setter);
}

function indices_len(start: number, stop: number, step: number) {
	if (step < 0 && stop < start) {
		return Math.floor((start - stop - 1) / -step) + 1;
	}
	if (start < stop) return Math.floor((stop - start - 1) / step) + 1;
	return 0;
}

function set_scalar<D extends core.DataType>(
	out: CompatChunk<D>,
	out_selection: (Indices | number)[],
	value: CompatScalar<D>,
) {
	if (out_selection.length === 0) {
		out.data[0] = value;
		return;
	}
	const [slice, ...slices] = out_selection;
	const [curr_stride, ...stride] = out.stride;

	if (typeof slice === "number") {
		const data = out.data.subarray(curr_stride * slice);
		set_scalar({ data, stride } as unknown as CompatChunk<D>, slices, value);
		return;
	}

	const [from, to, step] = slice;
	const len = indices_len(from, to, step);
	if (slices.length === 0) {
		if (step === 1 && curr_stride === 1) {
			out.data.fill(value, from, from + len);
		} else {
			for (let i = 0; i < len; i++) {
				out.data[curr_stride * (from + step * i)] = value;
			}
		}
		return;
	}
	for (let i = 0; i < len; i++) {
		const data = out.data.subarray(curr_stride * (from + step * i));
		set_scalar({ data, stride } as unknown as CompatChunk<D>, slices, value);
	}
}

function set_from_chunk<D extends core.DataType>(
	dest: CompatChunk<D>,
	src: CompatChunk<D>,
	projections: Projection[],
) {
	const [proj, ...projs] = projections;
	const [dstride, ...dstrides] = dest.stride;
	const [sstride, ...sstrides] = src.stride;

	if (proj.from === null) {
		if (projs.length === 0) {
			dest.data[proj.to] = src.data[0];
			return;
		}
		set_from_chunk(
			{
				data: dest.data.subarray(dstride * proj.to),
				stride: dstrides,
			},
			src,
			projs,
		);
		return;
	}

	if (proj.to === null) {
		if (projs.length === 0) {
			dest.data[0] = src.data[proj.from];
			return;
		}
		let view = {
			data: src.data.subarray(sstride * proj.from),
			stride: sstrides,
		};
		set_from_chunk(dest, view, projs);
		return;
	}

	const [from, to, step] = proj.to;
	const [sfrom, _, sstep] = proj.from;
	const len = indices_len(from, to, step);

	if (projs.length === 0) {
		if (
			step === 1 && sstep === 1 && dstride === 1 && sstride === 1
		) {
			dest.data.set(src.data.subarray(sfrom, sfrom + len), from);
		} else {
			for (let i = 0; i < len; i++) {
				dest.data[dstride * (from + step * i)] =
					src.data[sstride * (sfrom + sstep * i)];
			}
		}
		return;
	}

	for (let i = 0; i < len; i++) {
		set_from_chunk(
			{
				data: dest.data.subarray(dstride * (from + i * step)),
				stride: dstrides,
			},
			{
				data: src.data.subarray(sstride * (sfrom + i * sstep)),
				stride: sstrides,
			},
			projs,
		);
	}
}
