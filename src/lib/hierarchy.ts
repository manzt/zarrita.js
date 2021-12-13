import { KeyError, NotImplementedError } from "./errors";
import { byte_swap_inplace, get_ctr, should_byte_swap } from "./util";

import type {
	AbsolutePath,
	Async,
	Chunk,
	DataType,
	Deref,
	Readable,
	Scalar,
	TypedArray,
	TypedArrayConstructor,
} from "../types";
import type { Codec } from "numcodecs";

export class Node<Store, Path extends AbsolutePath> {
	constructor(public readonly store: Store, public readonly path: Path) {}
	get name() {
		return this.path.split("/").pop() ?? "";
	}
}

export class Group<Store, Path extends AbsolutePath = AbsolutePath>
	extends Node<Store, Path> {
	constructor(props: { store: Store; path: Path }) {
		super(props.store, props.path);
	}

	deref<P extends string>(path: P): Deref<P, Path> {
		if (path[0] !== "/") {
			// treat as relative path
			if ((this.path as any) === "/") {
				// special case root group
				path = `/${path}` as any;
			} else {
				path = `${this.path}/${path}` as any;
			}
		}
		return path as Deref<P, Path>;
	}
}

export interface ArrayProps<
	Dtype extends DataType,
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
> {
	store: Store;
	shape: number[];
	path: Path;
	chunk_shape: number[];
	dtype: Dtype;
	fill_value: Scalar<Dtype> | null;
	chunk_separator: "." | "/";
	compressor?: Codec;
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
	Path extends AbsolutePath = AbsolutePath,
> extends Node<Store, Path> {
	readonly shape: number[];
	readonly dtype: Dtype;
	readonly chunk_shape: number[];
	readonly compressor?: Codec;
	readonly fill_value: Scalar<Dtype> | null;
	readonly TypedArray: TypedArrayConstructor<Dtype>;
	readonly chunk_separator: "." | "/";

	constructor(props: ArrayProps<Dtype, Store, Path>) {
		super(props.store, props.path);
		this.shape = props.shape;
		this.dtype = props.dtype;
		this.chunk_shape = props.chunk_shape;
		this.compressor = props.compressor;
		this.fill_value = props.fill_value;
		this.chunk_separator = props.chunk_separator;
		this.TypedArray = get_ctr(props.dtype);
	}

	get ndim() {
		return this.shape.length;
	}

	_chunk_key(_chunk_coords: number[]): AbsolutePath {
		throw new NotImplementedError("_chunk_key must be implemented on zarr.Array");
	}

	async _decode_chunk(bytes: Uint8Array): Promise<TypedArray<Dtype>> {
		if (this.compressor) {
			bytes = await this.compressor.decode(bytes);
		}

		const data = new this.TypedArray(bytes.buffer);

		if (should_byte_swap(this.dtype)) {
			byte_swap_inplace(data);
		}

		return data;
	}

	async _encode_chunk(data: TypedArray<Dtype>): Promise<Uint8Array> {
		if (should_byte_swap(this.dtype)) {
			byte_swap_inplace(data);
		}
		let bytes = new Uint8Array(data.buffer);
		if (this.compressor) {
			bytes = await this.compressor.encode(bytes);
		}
		return bytes;
	}

	async get_chunk(chunk_coords: number[]): Promise<Chunk<Dtype>> {
		const chunk_key = this._chunk_key(chunk_coords);
		const buffer = await this.store.get(chunk_key);
		if (!buffer) throw new KeyError(chunk_key);
		const data = await this._decode_chunk(buffer);
		return { data, shape: this.chunk_shape };
	}
}
