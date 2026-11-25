import type { AbsolutePath, GetOptions, Readable } from "@zarrita/storage";
import { createShardedChunkGetter } from "./codecs/sharding.js";
import { createCodecPipeline } from "./codecs.js";
import type {
	ArrayMetadata,
	Attributes,
	Chunk,
	CodecMetadata,
	DataType,
	GroupMetadata,
	Scalar,
	TypedArray,
	TypedArrayConstructor,
} from "./metadata.js";
import {
	assertSharedArrayBufferAvailable,
	createBuffer,
	createChunkKeyEncoder,
	type DataTypeQuery,
	ensureCorrectScalar,
	getCtr,
	getStrides,
	isDataType,
	isShardingCodec,
	type NarrowDataType,
} from "./util.js";

export class Location<Store> {
	constructor(
		public readonly store: Store,
		public readonly path: AbsolutePath = "/",
	) {}

	resolve(path: string): Location<Store> {
		// reuse URL resolution logic built into the browser
		// handles relative paths, absolute paths, etc.
		let root = new URL(
			`file://${this.path.endsWith("/") ? this.path : `${this.path}/`}`,
		);
		return new Location(
			this.store,
			decodeURIComponent(new URL(path, root).pathname) as AbsolutePath,
		);
	}
}

export function root<Store>(store: Store): Location<Store>;
export function root(): Location<Map<string, Uint8Array>>;
export function root<Store>(
	store?: Store,
): Location<Store | Map<string, Uint8Array>> {
	return new Location(store ?? new Map());
}

export class Group<Store extends Readable> extends Location<Store> {
	readonly kind = "group";
	#metadata: GroupMetadata;
	constructor(store: Store, path: AbsolutePath, metadata: GroupMetadata) {
		super(store, path);
		this.#metadata = metadata;
	}
	get attrs(): Attributes {
		return this.#metadata.attributes;
	}
}

function getArrayOrder(
	codecs: CodecMetadata[],
): "C" | "F" | globalThis.Array<number> {
	const maybeTransposeCodec = codecs.find((c) => c.name === "transpose");
	// @ts-expect-error - TODO: Should validate?
	return maybeTransposeCodec?.configuration?.order ?? "C";
}

/**
 * Project a full-rank axis permutation onto a subset of axes, preserving the
 * relative order of the surviving axes. `axes` lists the original axis indices
 * that survive (ascending, matching the output shape). For order `[2, 1, 0]`
 * and surviving axes `[1, 2]` (axis 0 dropped) this yields `[1, 0]`: of the
 * kept axes, axis 2 comes before axis 1 in the original order.
 */
function projectOrder(
	order: globalThis.Array<number>,
	axes: number[],
): number[] {
	let rank = new Map(axes.map((axis, i) => [axis, i]));
	return order.filter((axis) => rank.has(axis)).map((axis) => rank.get(axis)!);
}

function makeStrideGetter(
	nativeOrder: "C" | "F" | globalThis.Array<number>,
): (shape: number[], axes?: number[]) => number[] {
	return (shape, axes) => {
		// An explicit transpose order is defined over the array's full rank.
		// A selection that drops dimensions (e.g. integer indexing) yields an
		// output of lower rank; project the order onto the surviving axes so
		// the output keeps the array's native order rather than silently
		// reverting to C-contiguous. See #427.
		let order =
			globalThis.Array.isArray(nativeOrder) && axes
				? projectOrder(nativeOrder, axes)
				: nativeOrder;
		return getStrides(shape, order);
	};
}

const CONTEXT_MARKER = Symbol("zarrita.context");

export function getContext<T>(obj: { [CONTEXT_MARKER]: T }): T {
	return obj[CONTEXT_MARKER];
}

function createContext<D extends DataType>(
	location: Location<Readable>,
	metadata: ArrayMetadata<D>,
): ArrayContext<D> {
	let { configuration } = metadata.codecs.find(isShardingCodec) ?? {};
	let sharedContext = {
		encodeChunkKey: createChunkKeyEncoder(metadata.chunk_key_encoding),
		TypedArray: getCtr(metadata.data_type),
		fillValue: metadata.fill_value,
	};

	if (configuration) {
		let nativeOrder = getArrayOrder(configuration.codecs);
		return {
			...sharedContext,
			kind: "sharded",
			chunkShape: configuration.chunk_shape,
			codec: createCodecPipeline({
				dataType: metadata.data_type,
				shape: configuration.chunk_shape,
				codecs: configuration.codecs,
				fillValue: metadata.fill_value,
			}),
			getStrides: makeStrideGetter(nativeOrder),
			getChunkBytes: createShardedChunkGetter(
				location,
				metadata.chunk_grid.configuration.chunk_shape,
				sharedContext.encodeChunkKey,
				configuration,
			),
		};
	}

	let nativeOrder = getArrayOrder(metadata.codecs);
	return {
		...sharedContext,
		kind: "regular",
		chunkShape: metadata.chunk_grid.configuration.chunk_shape,
		codec: createCodecPipeline({
			dataType: metadata.data_type,
			shape: metadata.chunk_grid.configuration.chunk_shape,
			codecs: metadata.codecs,
			fillValue: metadata.fill_value,
		}),
		getStrides: makeStrideGetter(nativeOrder),
		async getChunkBytes(chunkCoords, options) {
			let chunkKey = sharedContext.encodeChunkKey(chunkCoords);
			let chunkPath = location.resolve(chunkKey).path;
			return location.store.get(chunkPath, options);
		},
		getChunkRows: createChunkRowReader(location, metadata, sharedContext),
	};
}

/**
 * For an uncompressed array whose store supports range requests, return a
 * function that reads rows `[first, stop)` of a chunk along its first axis
 * without fetching the rest of the chunk. An uncompressed chunk is stored in
 * C order, so those rows are one contiguous run of bytes. Returns undefined
 * when the array has any codec besides `bytes`, the data type has no fixed
 * size, or the store cannot serve ranges.
 *
 * An array with no codecs is also uncompressed: that is how a little-endian
 * v2 array with no compressor or filters is represented.
 */
function createChunkRowReader<D extends DataType>(
	location: Location<Readable>,
	metadata: ArrayMetadata<D>,
	shared: {
		encodeChunkKey(chunkCoords: number[]): string;
		TypedArray: TypedArrayConstructor<D>;
	},
): ArrayContext<D>["getChunkRows"] {
	let store = location.store;
	if (typeof store.getRange !== "function") return undefined;
	let codecs = metadata.codecs;
	if (codecs.length > 1 || codecs.some((codec) => codec.name !== "bytes")) {
		return undefined;
	}
	let chunkShape = metadata.chunk_grid.configuration.chunk_shape;
	let itemSize = (new shared.TypedArray(0) as { BYTES_PER_ELEMENT?: number })
		.BYTES_PER_ELEMENT;
	if (chunkShape.length === 0 || !itemSize) return undefined;
	let rowShape = chunkShape.slice(1);
	let rowBytes = itemSize * rowShape.reduce((a, b) => a * b, 1);
	let chunkBytes = chunkShape[0] * rowBytes;
	return async (chunkCoords, first, stop, options) => {
		let chunkPath = location.resolve(shared.encodeChunkKey(chunkCoords)).path;
		let offset = first * rowBytes;
		let length = (stop - first) * rowBytes;
		let bytes = await store.getRange?.(chunkPath, { offset, length }, options);
		if (!bytes) return undefined;
		// A store may not honor the range it was given. The length of what it
		// sent tells which bytes those are.
		if (bytes.length === length) {
			// The requested range.
		} else if (bytes.length === chunkBytes) {
			// The whole chunk, as an HTTP server that ignores the Range header sends.
			bytes = bytes.subarray(offset, offset + length);
		} else if (bytes.length === chunkBytes - offset) {
			// Everything from the start of the range to the end of the chunk.
			bytes = bytes.subarray(0, length);
		} else {
			throw new Error(
				`Requested ${length} bytes at offset ${offset} of a ${chunkBytes} byte chunk, but the store returned ${bytes.length} bytes.`,
			);
		}
		return createCodecPipeline({
			dataType: metadata.data_type,
			shape: [stop - first, ...rowShape],
			codecs: metadata.codecs,
			fillValue: metadata.fill_value,
		}).decode(bytes);
	};
}

/** For internal use only, and is subject to change. */
interface ArrayContext<D extends DataType> {
	kind: "sharded" | "regular";
	/** The codec pipeline for this array. */
	codec: ReturnType<typeof createCodecPipeline<D>>;
	/** Encode a chunk key from chunk coordinates. */
	encodeChunkKey(chunkCoords: number[]): string;
	/** The TypedArray constructor for this array chunks. */
	TypedArray: TypedArrayConstructor<D>;
	/**
	 * Get the strides for a given output shape, using the array's native order.
	 * `axes` lists the original axis indices the shape corresponds to (used to
	 * project a transpose order onto a dimension-reducing selection); omit it
	 * for a full-rank shape.
	 */
	getStrides(shape: number[], axes?: number[]): number[];
	/** The fill value for this array. */
	fillValue: Scalar<D> | null;
	/** A function to get the bytes for a given chunk. */
	getChunkBytes(
		chunkCoords: number[],
		options?: GetOptions,
	): Promise<Uint8Array | undefined>;
	/** The chunk shape for this array. */
	chunkShape: number[];
	/**
	 * Read rows `[first, stop)` of a chunk along its first axis, for arrays
	 * whose chunks can be read in part. Resolves to undefined for a chunk
	 * that was never written.
	 */
	getChunkRows?(
		chunkCoords: number[],
		first: number,
		stop: number,
		options?: GetOptions,
	): Promise<Chunk<D> | undefined>;
}

export class Array<
	Dtype extends DataType,
	Store extends Readable = Readable,
> extends Location<Store> {
	readonly kind = "array";
	#metadata: ArrayMetadata<Dtype>;
	[CONTEXT_MARKER]: ArrayContext<Dtype>;

	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: ArrayMetadata<Dtype>,
	) {
		super(store, path);
		this.#metadata = {
			...metadata,
			fill_value: ensureCorrectScalar(metadata),
		};
		this[CONTEXT_MARKER] = createContext(this, this.#metadata);
	}

	get attrs(): Attributes {
		return this.#metadata.attributes;
	}

	get dimensionNames(): string[] | undefined {
		return this.#metadata.dimension_names;
	}

	get fillValue(): Scalar<Dtype> | null {
		return this.#metadata.fill_value;
	}

	get shape(): number[] {
		return this.#metadata.shape;
	}

	get chunks(): number[] {
		return this[CONTEXT_MARKER].chunkShape;
	}

	get dtype(): Dtype {
		return this.#metadata.data_type;
	}

	async getChunk(
		chunkCoords: number[],
		options?: GetOptions,
		opts?: { useSharedArrayBuffer?: boolean },
	): Promise<Chunk<Dtype>> {
		if (opts?.useSharedArrayBuffer) {
			assertSharedArrayBufferAvailable();
		}
		let context = this[CONTEXT_MARKER];
		let maybeBytes = await context.getChunkBytes(chunkCoords, options);
		if (!maybeBytes) {
			let size = context.chunkShape.reduce((a, b) => a * b, 1);
			let data: TypedArray<Dtype>;
			if (opts?.useSharedArrayBuffer) {
				let sample = new context.TypedArray(0);
				if (!("BYTES_PER_ELEMENT" in sample)) {
					console.warn(
						"zarrita: useSharedArrayBuffer is not supported for non-buffer-backed data types.",
					);
					data = new context.TypedArray(size);
				} else {
					let buffer = createBuffer(size * sample.BYTES_PER_ELEMENT, true);
					data = new context.TypedArray(buffer, 0, size);
				}
			} else {
				data = new context.TypedArray(size);
			}
			// @ts-expect-error: TS can't infer that `fillValue` is union (assumes never) but this is ok
			data.fill(context.fillValue);
			return {
				data,
				shape: context.chunkShape,
				stride: context.getStrides(context.chunkShape),
			};
		}
		return context.codec.decode(maybeBytes);
	}

	/**
	 * A helper method to narrow `zarr.Array` Dtype.
	 *
	 * ```typescript
	 * let arr: zarr.Array<DataType, FetchStore> = zarr.open(store, { kind: "array" });
	 *
	 * // Option 1: narrow by scalar type (e.g. "bool", "raw", "bigint", "number")
	 * if (arr.is("bigint")) {
	 *   // zarr.Array<"int64" | "uint64", FetchStore>
	 * }
	 *
	 * // Option 3: exact match
	 * if (arr.is("float32")) {
	 *   // zarr.Array<"float32", FetchStore, "/">
	 * }
	 * ```
	 */
	is<Query extends DataTypeQuery>(
		query: Query,
	): this is Array<NarrowDataType<Dtype, Query>, Store> {
		return isDataType(this.dtype, query);
	}
}
