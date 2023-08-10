import type { TypedArray, DataType, Scalar, Chunk } from "@zarrita/core";

export type Indices = [start: number, stop: number, step: number];

export interface Slice {
	start: number | null;
	stop: number | null;
	step: number | null;
	indices: (length: number) => Indices;
}

export type Projection =
	| { from: null; to: number }
	| { from: number; to: null }
	| {
		from: Indices;
		to: Indices;
	};

export type Prepare<D extends DataType, NdArray extends Chunk<D>> = (
	data: TypedArray<D>,
	shape: number[],
	stride: number[],
) => NdArray;

export type SetScalar<
	D extends DataType,
	NdArray extends Chunk<D>,
> = (
	target: NdArray,
	selection: (Indices | number)[],
	value: Scalar<D>,
) => void;

export type SetFromChunk<
	D extends DataType,
	NdArray extends Chunk<D>,
> = (
	a: NdArray,
	b: NdArray,
	proj: Projection[],
) => void;

export type Setter<D extends DataType, Arr extends Chunk<D>> = {
	prepare: Prepare<D, Arr>;
	set_from_chunk: SetFromChunk<D, Arr>;
	set_scalar: SetScalar<D, Arr>;
};

export type Options = {
	create_queue?: () => ChunkQueue;
};

export type GetOptions<O> = Options & { opts?: O; order?: "C" | "F" };

export type SetOptions = Options;

// Compatible with https://github.com/sindresorhus/p-queue
export type ChunkQueue = {
	add(fn: () => Promise<void>): void;
	onIdle(): Promise<void[]>;
};
