export class BoolArray {
	private _bytes: Uint8Array;

	constructor(size: number)
	constructor(buffer: ArrayBuffer)
	constructor(x: number | ArrayBuffer) {
		if (typeof x === 'number') {
			this._bytes = new Uint8Array(x);
		} else {
			this._bytes = new Uint8Array(x);
		}
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

function encode_str(str: string, bytes: number, chars: number) {
	const encoded = new TextEncoder().encode(str);
	if (encoded.length > bytes * chars) {
		throw new Error(`UTF-8 encoded string too large: ${str}`);
	}
	return encoded;
}

export class StringArray<Bytes extends number, Chars extends number> {
	private _bytes: Uint8Array;

	constructor(size: number, bytes: Bytes, chars: Chars)
	constructor(buffer: ArrayBuffer, bytes: Bytes, chars: Chars)
	constructor(x: number | ArrayBuffer, public bytes: Bytes, public chars: Chars) {
		if (typeof x === 'number') {
			this._bytes = new Uint8Array(bytes * x * chars);
		} else {
			this._bytes = new Uint8Array(x);
		}
	}

	get buffer(): ArrayBuffer {
		return this._bytes.buffer;
	}

	get length(): number {
		return this._bytes.buffer.byteLength / (this.bytes * this.chars);
	}

	get(idx: number): string {
		const view = new DataView(
			this.buffer,
			this.bytes * this.chars * idx,
			this.bytes * this.chars,
		);
		return new TextDecoder().decode(view).replace(/\x00/g, '');
	}

	set(idx: number, value: string): void {
		const view = new Uint8Array(
			this.buffer,
			this.bytes * this.chars * idx,
			this.bytes * this.chars,
		);
		view.fill(0); // clear current
		view.set(encode_str(value, this.bytes, this.chars));
	}

	fill(value: string): void {
		const encoded = encode_str(value, this.bytes, this.chars);
		for (let i = 0; i < this.length; i++) {
			this._bytes.set(encoded, i * this.bytes * this.chars);
		}
	}

	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

export class ByteStringArray<Chars extends number> extends StringArray<1, Chars> {
	constructor(buffer: ArrayBuffer, chars: Chars)
	constructor(size: number, chars: Chars)
	constructor(x: number | ArrayBuffer, chars: Chars) {
		super(x as any, 1, chars);
	}
}

export class UnicodeStringArray<Chars extends number> extends StringArray<4, Chars> {
	constructor(buffer: ArrayBuffer, chars: Chars)
	constructor(size: number, chars: Chars)
	constructor(x: number | ArrayBuffer, chars: Chars) {
		super(x as any, 4, chars);
	}
}
