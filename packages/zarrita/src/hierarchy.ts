import type { AbsolutePath, Readable } from "@zarrita/storage";
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
	isDtype,
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

const CONTEXT_MARKER = Symbol("zarrita.context");

export function getContext<T>(obj: { [CONTEXT_MARKER]: T }): T {
	return obj[CONTEXT_MARKER];
}

function createContext<Store extends Readable, D extends DataType>(
	location: Location<Readable>,
	metadata: ArrayMetadata<D>,
): ArrayContext<Store, D> {
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
			}),
			getStrides(shape: number[]) {
				return getStrides(shape, nativeOrder);
			},
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
		}),
		getStrides(shape: number[]) {
			return getStrides(shape, nativeOrder);
		},
		async getChunkBytes(chunkCoords, options) {
			let chunkKey = sharedContext.encodeChunkKey(chunkCoords);
			let chunkPath = location.resolve(chunkKey).path;
			return location.store.get(chunkPath, options);
		},
	};
}

/** For internal use only, and is subject to change. */
interface ArrayContext<Store extends Readable, D extends DataType> {
	kind: "sharded" | "regular";
	/** The codec pipeline for this array. */
	codec: ReturnType<typeof createCodecPipeline<D>>;
	/** Encode a chunk key from chunk coordinates. */
	encodeChunkKey(chunkCoords: number[]): string;
	/** The TypedArray constructor for this array chunks. */
	TypedArray: TypedArrayConstructor<D>;
	/** A function to get the strides for a given shape, using the array order */
	getStrides(shape: number[]): number[];
	/** The fill value for this array. */
	fillValue: Scalar<D> | null;
	/** A function to get the bytes for a given chunk. */
	getChunkBytes(
		chunkCoords: number[],
		options?: Parameters<Store["get"]>[1],
	): Promise<Uint8Array | undefined>;
	/** The chunk shape for this array. */
	chunkShape: number[];
}

export class Array<
	Dtype extends DataType,
	Store extends Readable = Readable,
> extends Location<Store> {
	readonly kind = "array";
	#metadata: ArrayMetadata<Dtype>;
	[CONTEXT_MARKER]: ArrayContext<Store, Dtype>;

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
		options?: Parameters<Store["get"]>[1],
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
		return isDtype(this.dtype, query);
	}
}
