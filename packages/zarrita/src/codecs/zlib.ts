import { decompress } from "../util.js";
import { unimplementedEncode } from "./_shared.js";

interface ZlibCodecConfig {
	level: number;
}

export class ZlibCodec {
	kind = "bytes_to_bytes";

	static fromConfig(_: ZlibCodecConfig) {
		return new ZlibCodec();
	}

	encode = unimplementedEncode("zlib");

	async decode(bytes: Uint8Array): Promise<Uint8Array> {
		const buffer = await decompress(bytes, { format: "deflate" });
		return new Uint8Array(buffer);
	}
}
