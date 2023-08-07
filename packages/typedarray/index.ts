export class BoolArray {
	private _bytes: Uint8Array;

	constructor(size: number);
	constructor(buffer: ArrayBuffer);
	constructor(x: any) {
		this._bytes = new Uint8Array(x);
	}

	get buffer(): ArrayBuffer {
		return this._bytes.buffer;
	}

	get length(): number {
		return this._bytes.length;
	}

	get(idx: number): boolean {
		return this._bytes[idx] === 1;
	}

	set(idx: number, value: boolean): void {
		this._bytes[idx] = value ? 1 : 0;
	}

	fill(value: boolean): void {
		this._bytes.fill(value ? 1 : 0);
	}

	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

export class ByteStringArray {
	private _bytes: Uint8Array;

	constructor(size: number, chars: number);
	constructor(buffer: ArrayBuffer, chars: number);
	constructor(x: number | ArrayBuffer, public chars: number) {
		if (typeof x === "number") {
			this._bytes = new Uint8Array(x * chars);
		} else {
			this._bytes = new Uint8Array(x);
		}
	}

	get buffer(): ArrayBuffer {
		return this._bytes.buffer;
	}

	get length(): number {
		return this._bytes.buffer.byteLength / this.chars;
	}

	private encode(s: string): Uint8Array {
		return new TextEncoder().encode(s);
	}

	get(idx: number): string {
		const view = new Uint8Array(
			this.buffer,
			this.chars * idx,
			this.chars,
		);
		return new TextDecoder().decode(view).replace(/\x00/g, "");
	}

	set(idx: number, value: string): void {
		const view = new Uint8Array(
			this.buffer,
			this.chars * idx,
			this.chars,
		);
		view.fill(0); // clear current
		view.set(this.encode(value));
	}

	fill(value: string): void {
		const encoded = this.encode(value);
		for (let i = 0; i < this.length; i++) {
			this._bytes.set(encoded, i * this.chars);
		}
	}

	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

export class UnicodeStringArray {
	private _data: Int32Array;
	BYTES_PER_ELEMENT = 4;
	byteOffset = 0;

	constructor(size: number, chars: number);
	constructor(buffer: ArrayBuffer, chars: number);
	constructor(x: number | ArrayBuffer, public chars: number) {
		if (typeof x === "number") {
			this._data = new Int32Array(x * chars);
		} else {
			this._data = new Int32Array(x);
		}
	}

	get buffer(): ArrayBuffer {
		return this._data.buffer;
	}

	get length(): number {
		return this._data.length / this.chars;
	}

	#encode(s: string): Int32Array {
		let out = new Int32Array(this.chars);
		for (let i = 0; i < this.chars; i++) {
			out[i] = s.codePointAt(i)!;
		}
		return out;
	}

	get(idx: number): string {
		const offset = this.chars * idx;
		let result = "";
		for (let i = 0; i < this.chars; i++) {
			result += String.fromCodePoint(this._data[offset + i]);
		}
		return result.replace(/\u0000/g, "");
	}

	set(idx: number, value: string): void {
		const offset = this.chars * idx;
		const view = this._data.subarray(offset, offset + this.chars);
		view.fill(0); // clear current
		view.set(this.#encode(value));
	}

	fill(value: string): void {
		const encoded = this.#encode(value);
		for (let i = 0; i < this.length; i++) {
			this._data.set(encoded, i * this.chars);
		}
	}

	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}
