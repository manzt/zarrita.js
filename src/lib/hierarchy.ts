import { KeyError } from "./errors";
import { byte_swap_inplace, get_ctr, should_byte_swap } from "./util";

import type {
	AbsolutePath,
	Async,
	Attrs,
	DataType,
	Hierarchy,
	Readable,
	Scalar,
	TypedArray,
	TypedArrayConstructor,
} from "../types";
import type { Codec } from "numcodecs";

export class Node<Store extends Readable | Async<Readable>, Path extends AbsolutePath> {
	constructor(public readonly store: Store, public readonly path: Path) {}

	get name() {
		return this.path.split("/").pop() ?? "";
	}
}

export class Group<
	Store extends Readable | Async<Readable>,
	Owner extends Hierarchy<Store>,
	Path extends AbsolutePath = AbsolutePath,
> extends Node<Store, Path> {
	readonly owner: Owner;
	constructor(props: { store: Store; path: Path; owner: Owner }) {
		super(props.store, props.path);
		this.owner = props.owner;
	}

	async get_children() {
		return this.owner.get_children(this.path);
	}

	_deref<P extends string>(
		path: P,
	): P extends AbsolutePath ? P : Path extends "/" ? `/${P}` : `${Path}/${P}` {
		if (path[0] !== "/") {
			// treat as relative path
			if ((this.path as any) === "/") {
				// special case root group
				path = `/${path}` as any;
			} else {
				path = `${this.path}/${path}` as any;
			}
		}
		return path as any;
	}

	get<P extends string>(path: P) {
		return this.owner.get(this._deref(path));
	}

	has<P extends string>(path: P) {
		return this.owner.has(this._deref(path));
	}

	create_group<P extends string>(path: P, props: { attrs?: Attrs } = {}) {
		return this.owner.create_group(this._deref(path), props);
	}

	create_array<P extends string>(
		path: P,
		props: Parameters<Owner["create_array"]>[1],
	) {
		return this.owner.create_array(this._deref(path), props);
	}

	get_array<P extends string>(path: P) {
		return this.owner.get_array(this._deref(path));
	}

	get_group<P extends string>(path: P) {
		return this.owner.get_group(this._deref(path));
	}

	get_implicit_group<P extends string>(path: P) {
		return this.owner.get_implicit_group(this._deref(path));
	}
}

interface ExplicitGroupProps<
	Store extends Readable | Async<Readable>,
	Owner extends Hierarchy<Store>,
	Path extends AbsolutePath,
> {
	store: Store;
	path: Path;
	owner: Owner;
	attrs: Attrs | (() => Promise<Attrs>);
}

export class ExplicitGroup<
	Store extends Readable | Async<Readable>,
	Owner extends Hierarchy<Store>,
	Path extends AbsolutePath = AbsolutePath,
> extends Group<Store, Owner, Path> {
	private _attrs: Attrs | (() => Promise<Attrs>);

	constructor(props: ExplicitGroupProps<Store, Owner, Path>) {
		super(props);
		this._attrs = props.attrs || {};
	}

	get attrs(): Promise<Attrs> {
		if (typeof this._attrs === "object") {
			return Promise.resolve(this._attrs);
		}
		return this._attrs().then((attrs) => {
			this._attrs = attrs;
			return attrs;
		});
	}
}

export class ImplicitGroup<
	Store extends Readable | Async<Readable>,
	Owner extends Hierarchy<Store>,
	Path extends AbsolutePath = AbsolutePath,
> extends Group<Store, Owner, Path> {}

export interface ZarrArrayProps<
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
	attrs: Attrs | (() => Promise<Attrs>);
	chunk_key: (chunk_coords: number[]) => AbsolutePath;
	compressor?: import("numcodecs").Codec;
}

export class ZarrArray<
	Dtype extends DataType,
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath = AbsolutePath,
> extends Node<Store, Path> {
	readonly shape: number[];
	readonly dtype: Dtype;
	readonly chunk_shape: number[];
	readonly compressor?: Codec;
	readonly fill_value: Scalar<Dtype> | null;
	readonly chunk_key: ZarrArrayProps<Dtype, Store, Path>["chunk_key"];
	readonly TypedArray: TypedArrayConstructor<Dtype>;
	private _attrs: Attrs | (() => Promise<Attrs>);

	constructor(props: ZarrArrayProps<Dtype, Store, Path>) {
		super(props.store, props.path);
		this.shape = props.shape;
		this.dtype = props.dtype;
		this.chunk_shape = props.chunk_shape;
		this.compressor = props.compressor;
		this.fill_value = props.fill_value;
		this.chunk_key = props.chunk_key;
		this.TypedArray = get_ctr(props.dtype);
		this._attrs = props.attrs;
	}

	get attrs() {
		if (typeof this._attrs === "object") {
			return Promise.resolve(this._attrs);
		}
		return this._attrs().then((attrs) => {
			// cache the result
			this._attrs = attrs;
			return attrs;
		});
	}

	get ndim() {
		return this.shape.length;
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

	async get_chunk(
		chunk_coords: number[],
	): Promise<{ data: TypedArray<Dtype>; shape: number[] }> {
		const chunk_key = this.chunk_key(chunk_coords);
		const buffer = await this.store.get(chunk_key);
		if (!buffer) throw new KeyError(chunk_key);
		const data = await this._decode_chunk(buffer);
		return { data, shape: this.chunk_shape };
	}
}
