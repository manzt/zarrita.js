/**
 * Custom array-like views (i.e., TypedArrays) for Zarr binary data buffers.
 *
 * @module
 */

import { InvalidMetadataError } from "./errors.js";
import type { Struct, StructFieldDataType, StructScalar } from "./metadata.js";

function isArrayBufferLike(x: unknown): x is ArrayBufferLike {
	return x instanceof ArrayBuffer || x instanceof SharedArrayBuffer;
}

/**
 * An array-like view of a fixed-length boolean buffer.
 *
 * Encoded as 1 byte per value.
 */
export class BoolArray<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike> {
	#bytes: Uint8Array<TArrayBuffer>;

	constructor(size: number);
	constructor(arr: Iterable<boolean>);
	constructor(buffer: TArrayBuffer, byteOffset?: number, length?: number);
	constructor(
		x: number | Iterable<boolean> | TArrayBuffer,
		byteOffset?: number,
		length?: number,
	) {
		if (typeof x === "number") {
			this.#bytes = new Uint8Array(x) as Uint8Array<TArrayBuffer>;
		} else if (isArrayBufferLike(x)) {
			this.#bytes = new Uint8Array(
				x,
				byteOffset,
				length,
			) as Uint8Array<TArrayBuffer>;
		} else {
			this.#bytes = new Uint8Array(
				Array.from(x, (v) => (v ? 1 : 0)),
			) as Uint8Array<TArrayBuffer>;
		}
	}

	get BYTES_PER_ELEMENT(): 1 {
		return 1;
	}

	get byteOffset(): number {
		return this.#bytes.byteOffset;
	}

	get byteLength(): number {
		return this.#bytes.byteLength;
	}

	get buffer(): TArrayBuffer {
		return this.#bytes.buffer;
	}

	get length(): number {
		return this.#bytes.length;
	}

	get(idx: number): boolean {
		let value = this.#bytes[idx];
		return typeof value === "number" ? value !== 0 : value;
	}

	set(idx: number, value: boolean): void {
		this.#bytes[idx] = value ? 1 : 0;
	}

	fill(value: boolean): void {
		this.#bytes.fill(value ? 1 : 0);
	}

	*[Symbol.iterator](): IterableIterator<boolean> {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

/**
 * An array-like view of a fixed-length byte buffer.
 *
 * Encodes a raw byte sequences without enforced encoding.
 */
export class ByteStringArray<
	TArrayBuffer extends ArrayBufferLike = ArrayBufferLike,
> {
	_data: Uint8Array<TArrayBuffer>;
	chars: number;
	#encoder: TextEncoder;

	constructor(chars: number, size: number);
	constructor(
		chars: number,
		buffer: TArrayBuffer,
		byteOffset?: number,
		length?: number,
	);
	constructor(chars: number, arr: Iterable<string>);
	constructor(
		chars: number,
		x: number | TArrayBuffer | Iterable<string>,
		byteOffset?: number,
		length?: number,
	) {
		this.chars = chars;
		this.#encoder = new TextEncoder();
		if (typeof x === "number") {
			this._data = new Uint8Array(x * chars) as Uint8Array<TArrayBuffer>;
		} else if (isArrayBufferLike(x)) {
			if (length) length = length * chars;
			this._data = new Uint8Array(
				x,
				byteOffset,
				length,
			) as Uint8Array<TArrayBuffer>;
		} else {
			let values = Array.from(x);
			this._data = new Uint8Array(
				values.length * chars,
			) as Uint8Array<TArrayBuffer>;
			for (let i = 0; i < values.length; i++) {
				this.set(i, values[i]);
			}
		}
	}

	get BYTES_PER_ELEMENT(): number {
		return this.chars;
	}

	get byteOffset(): number {
		return this._data.byteOffset;
	}

	get byteLength(): number {
		return this._data.byteLength;
	}

	get buffer(): TArrayBuffer {
		return this._data.buffer;
	}

	get length(): number {
		return this.byteLength / this.BYTES_PER_ELEMENT;
	}

	get(idx: number): string {
		const view = new Uint8Array(
			this.buffer,
			this.byteOffset + this.chars * idx,
			this.chars,
		);
		// biome-ignore lint/suspicious/noControlCharactersInRegex: necessary for null byte removal
		return new TextDecoder().decode(view).replace(/\x00/g, "");
	}

	set(idx: number, value: string): void {
		const view = new Uint8Array(
			this.buffer,
			this.byteOffset + this.chars * idx,
			this.chars,
		);
		view.fill(0); // clear current
		view.set(this.#encoder.encode(value));
	}

	fill(value: string): void {
		const encoded = this.#encoder.encode(value);
		for (let i = 0; i < this.length; i++) {
			this._data.set(encoded, i * this.chars);
		}
	}

	*[Symbol.iterator](): IterableIterator<string> {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

/**
 * An array-like view of a fixed-length Unicode string buffer.
 *
 * Encoded as UTF-32 code points.
 */
export class UnicodeStringArray<
	TArrayBuffer extends ArrayBufferLike = ArrayBufferLike,
> {
	#data: Int32Array<TArrayBuffer>;
	chars: number;

	constructor(chars: number, size: number);
	constructor(
		chars: number,
		buffer: TArrayBuffer,
		byteOffset?: number,
		length?: number,
	);
	constructor(chars: number, arr: Iterable<string>);
	constructor(
		chars: number,
		x: number | TArrayBuffer | Iterable<string>,
		byteOffset?: number,
		length?: number,
	) {
		this.chars = chars;
		if (typeof x === "number") {
			this.#data = new Int32Array(x * chars) as Int32Array<TArrayBuffer>;
		} else if (isArrayBufferLike(x)) {
			if (length) length *= chars;
			this.#data = new Int32Array(
				x,
				byteOffset,
				length,
			) as Int32Array<TArrayBuffer>;
		} else {
			const values = x as Iterable<string>;
			const d = new UnicodeStringArray(chars, 1);
			this.#data = new Int32Array(
				(function* () {
					for (let str of values) {
						d.set(0, str);
						yield* d.#data;
					}
				})(),
			) as Int32Array<TArrayBuffer>;
		}
	}

	get BYTES_PER_ELEMENT(): number {
		return this.#data.BYTES_PER_ELEMENT * this.chars;
	}

	get byteLength(): number {
		return this.#data.byteLength;
	}

	get byteOffset(): number {
		return this.#data.byteOffset;
	}

	get buffer(): TArrayBuffer {
		return this.#data.buffer;
	}

	get length(): number {
		return this.#data.length / this.chars;
	}

	get(idx: number): string {
		const offset = this.chars * idx;
		let result = "";
		for (let i = 0; i < this.chars; i++) {
			result += String.fromCodePoint(this.#data[offset + i]);
		}
		// biome-ignore lint/suspicious/noControlCharactersInRegex: necessary for null byte removal
		return result.replace(/\u0000/g, "");
	}

	set(idx: number, value: string): void {
		const offset = this.chars * idx;
		const view = this.#data.subarray(offset, offset + this.chars);
		view.fill(0); // clear current
		for (let i = 0; i < this.chars; i++) {
			view[i] = value.codePointAt(i) ?? 0;
		}
	}

	fill(value: string): void {
		// encode once
		this.set(0, value);
		// copy the encoded values to all other elements
		let encoded = this.#data.subarray(0, this.chars);
		for (let i = 1; i < this.length; i++) {
			this.#data.set(encoded, i * this.chars);
		}
	}

	*[Symbol.iterator](): IterableIterator<string> {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

type StructValue = StructScalar[string];

/** How one field of a struct is laid out and converted. */
type FieldLayout = {
	name: string;
	/** Where the field starts in a record. */
	offset: number;
	size: number;
	get(view: DataView, at: number): StructValue;
	set(view: DataView, at: number, value: StructValue): void;
};

type StructLayout = {
	fields: FieldLayout[];
	/** The size of a record: the fields are packed, with no padding. */
	size: number;
	/**
	 * The multi-byte values in a record, as `[offset, width, count]`. These
	 * are what a change of byte order reverses.
	 */
	words: [offset: number, width: number, count: number][];
};

// biome-ignore format: easier to read this way
const NUMBER_FIELDS: Record<string, [size: number, get: keyof DataView, set: keyof DataView]> = {
	int8: [1, "getInt8", "setInt8"],
	uint8: [1, "getUint8", "setUint8"],
	int16: [2, "getInt16", "setInt16"],
	uint16: [2, "getUint16", "setUint16"],
	int32: [4, "getInt32", "setInt32"],
	uint32: [4, "getUint32", "setUint32"],
	int64: [8, "getBigInt64", "setBigInt64"],
	uint64: [8, "getBigUint64", "setBigUint64"],
	float16: [2, "getFloat16" as keyof DataView, "setFloat16" as keyof DataView],
	float32: [4, "getFloat32", "setFloat32"],
	float64: [8, "getFloat64", "setFloat64"],
};

function fieldLayout(
	dataType: StructFieldDataType,
): Omit<FieldLayout, "name" | "offset"> & { words: StructLayout["words"] } {
	if (typeof dataType === "string" && dataType in NUMBER_FIELDS) {
		let [size, getter, setter] = NUMBER_FIELDS[dataType];
		if (!(getter in DataView.prototype)) {
			throw new InvalidMetadataError(
				`This runtime cannot read a struct field of data type ${dataType}`,
			);
		}
		return {
			size,
			words: size > 1 ? [[0, size, 1]] : [],
			// @ts-expect-error - the getter and setter are DataView methods
			get: (view, at) => view[getter](at, true),
			// @ts-expect-error - the getter and setter are DataView methods
			set: (view, at, value) => view[setter](at, value, true),
		};
	}
	if (dataType === "bool") {
		return {
			size: 1,
			words: [],
			get: (view, at) => view.getUint8(at) !== 0,
			set: (view, at, value) => view.setUint8(at, value ? 1 : 0),
		};
	}
	if (typeof dataType === "object" && dataType !== null) {
		if (dataType.name === "struct") {
			let layout = structLayout(dataType);
			return {
				size: layout.size,
				words: layout.words,
				get: (view, at) => getRecord(layout, view, at),
				set: (view, at, value) =>
					setRecord(layout, view, at, value as StructScalar),
			};
		}
		let size = dataType.configuration?.length_bytes;
		if (dataType.name === "fixed_length_utf32" && size % 4 === 0) {
			let chars = size / 4;
			return {
				size,
				words: [[0, 4, chars]],
				get(view, at) {
					let result = "";
					for (let i = 0; i < chars; i++) {
						let point = view.getUint32(at + 4 * i, true);
						if (point !== 0) result += String.fromCodePoint(point);
					}
					return result;
				},
				set(view, at, value) {
					let points = Array.from(String(value), (c) => c.codePointAt(0) ?? 0);
					for (let i = 0; i < chars; i++) {
						view.setUint32(at + 4 * i, points[i] ?? 0, true);
					}
				},
			};
		}
		if (dataType.name === "null_terminated_bytes" && size > 0) {
			return {
				size,
				words: [],
				get(view, at) {
					let bytes = new Uint8Array(view.buffer, view.byteOffset + at, size);
					// biome-ignore lint/suspicious/noControlCharactersInRegex: necessary for null byte removal
					return new TextDecoder().decode(bytes).replace(/\x00/g, "");
				},
				set(view, at, value) {
					let bytes = new Uint8Array(view.buffer, view.byteOffset + at, size);
					bytes.fill(0);
					bytes.set(new TextEncoder().encode(String(value)).subarray(0, size));
				},
			};
		}
	}
	throw new InvalidMetadataError(
		`Unknown or unsupported struct field data type: ${JSON.stringify(dataType)}`,
	);
}

function structLayout(dataType: Struct): StructLayout {
	let declared = dataType.configuration?.fields;
	if (!globalThis.Array.isArray(declared) || declared.length === 0) {
		throw new InvalidMetadataError("A struct data type needs fields");
	}
	let fields: FieldLayout[] = [];
	let words: StructLayout["words"] = [];
	let offset = 0;
	for (let { name, data_type } of declared) {
		if (fields.some((field) => field.name === name)) {
			throw new InvalidMetadataError(
				`Struct field names must be unique: ${JSON.stringify(name)}`,
			);
		}
		let field = fieldLayout(data_type);
		for (let [at, width, count] of field.words) {
			words.push([offset + at, width, count]);
		}
		fields.push({
			name,
			offset,
			size: field.size,
			get: field.get,
			set: field.set,
		});
		offset += field.size;
	}
	return { fields, size: offset, words };
}

function getRecord(layout: StructLayout, view: DataView, at: number) {
	let record: StructScalar = {};
	for (let field of layout.fields) {
		record[field.name] = field.get(view, at + field.offset);
	}
	return record;
}

function setRecord(
	layout: StructLayout,
	view: DataView,
	at: number,
	value: StructScalar,
) {
	for (let field of layout.fields) {
		if (!(field.name in value)) {
			throw new TypeError(`Missing struct field: ${field.name}`);
		}
		field.set(view, at + field.offset, value[field.name]);
	}
}

/**
 * Reverse the byte order of every multi-byte value in a buffer of struct
 * records. Each field is reversed on its own, since a record is not one value.
 */
export function byteswapStructInplace(
	bytes: Uint8Array,
	dataType: Struct,
): void {
	let layout = structLayout(dataType);
	for (
		let record = 0;
		record + layout.size <= bytes.length;
		record += layout.size
	) {
		for (let [offset, width, count] of layout.words) {
			for (let i = 0; i < count; i++) {
				bytes
					.subarray(record + offset + i * width)
					.subarray(0, width)
					.reverse();
			}
		}
	}
}

/**
 * An array-like view of a buffer of fixed-size records with named fields,
 * for the `struct` data type.
 *
 * A record is the packed bytes of its fields in the order they are declared,
 * with multi-byte values in little-endian order. Each element reads as an
 * object with a value for every field.
 */
export class StructArray<
	TArrayBuffer extends ArrayBufferLike = ArrayBufferLike,
> {
	dtype: Struct;
	#layout: StructLayout;
	#bytes: Uint8Array<TArrayBuffer>;
	#view: DataView<TArrayBuffer>;

	constructor(dtype: Struct, size: number);
	constructor(
		dtype: Struct,
		buffer: TArrayBuffer,
		byteOffset?: number,
		length?: number,
	);
	constructor(dtype: Struct, arr: Iterable<StructScalar>);
	constructor(
		dtype: Struct,
		x: number | TArrayBuffer | Iterable<StructScalar>,
		byteOffset?: number,
		length?: number,
	) {
		this.dtype = dtype;
		this.#layout = structLayout(dtype);
		let size = this.#layout.size;
		let values: StructScalar[] = [];
		if (typeof x === "number") {
			this.#bytes = new Uint8Array(x * size) as Uint8Array<TArrayBuffer>;
		} else if (isArrayBufferLike(x)) {
			if (length !== undefined) length = length * size;
			this.#bytes = new Uint8Array(
				x,
				byteOffset,
				length,
			) as Uint8Array<TArrayBuffer>;
		} else {
			values = Array.from(x);
			this.#bytes = new Uint8Array(
				values.length * size,
			) as Uint8Array<TArrayBuffer>;
		}
		this.#view = new DataView(
			this.#bytes.buffer,
			this.#bytes.byteOffset,
			this.#bytes.byteLength,
		);
		for (let i = 0; i < values.length; i++) {
			this.set(i, values[i]);
		}
	}

	get BYTES_PER_ELEMENT(): number {
		return this.#layout.size;
	}

	get byteOffset(): number {
		return this.#bytes.byteOffset;
	}

	get byteLength(): number {
		return this.#bytes.byteLength;
	}

	get buffer(): TArrayBuffer {
		return this.#bytes.buffer;
	}

	get length(): number {
		return Math.floor(this.byteLength / this.BYTES_PER_ELEMENT);
	}

	get(idx: number): StructScalar {
		return getRecord(this.#layout, this.#view, idx * this.#layout.size);
	}

	set(idx: number, value: StructScalar): void {
		setRecord(this.#layout, this.#view, idx * this.#layout.size, value);
	}

	fill(value: StructScalar): void {
		if (this.length === 0) return;
		// encode once
		this.set(0, value);
		// copy the encoded record to all other elements
		let encoded = this.#bytes.subarray(0, this.#layout.size);
		for (let i = 1; i < this.length; i++) {
			this.#bytes.set(encoded, i * this.#layout.size);
		}
	}

	*[Symbol.iterator](): IterableIterator<StructScalar> {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}
