import { unimplementedEncode } from "./_shared.js";

export class Crc32cCodec {
	readonly kind = "bytes_to_bytes";
	static fromConfig() {
		return new Crc32cCodec();
	}
	encode = unimplementedEncode("crc32c");
	decode(arr: Uint8Array): Uint8Array {
		return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength - 4);
	}
}
