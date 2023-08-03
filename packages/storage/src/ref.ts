// @ts-expect-error
import { parse } from "reference-spec-reader";
import { fetch_range, strip_prefix, uri2href } from "./util.js";
import type { AbsolutePath, Async, Readable } from "@zarrita/core/types";

interface ReferenceStoreOptions {
	target?: string | URL;
}

/** @experimental */
class ReferenceStore implements Async<Readable<RequestInit>> {
	private target?: string | URL;

	constructor(private refs: ReturnType<typeof parse>, opts: ReferenceStoreOptions = {}) {
		this.target = opts.target;
	}

	async get(key: AbsolutePath, opts: RequestInit = {}) {
		let ref = this.refs.get(strip_prefix(key));

		if (!ref) return;

		if (typeof ref === "string") {
			if (ref.startsWith("base64:")) {
				return to_binary(ref.slice("base64:".length));
			}
			return new TextEncoder().encode(ref);
		}

		let [urlOrNull, offset, size] = ref;
		let url = urlOrNull ?? this.target;
		if (!url) {
			throw Error(`No url for key ${key}, and no target url provided.`);
		}

		let res = await fetch_range({ url: uri2href(url), offset, size }, opts);

		if (res.status === 200 || res.status === 206) {
			return new Uint8Array(await res.arrayBuffer());
		}

		throw new Error(
			`Request unsuccessful for key ${key}. Response status: ${res.status}.`,
		);
	}

	async has(key: AbsolutePath) {
		return this.refs.has(strip_prefix(key));
	}

	static fromSpec(spec: Record<string, any>, opts: ReferenceStoreOptions = {}) {
		let refs = parse(spec);
		return new ReferenceStore(refs, opts);
	}

	static async fromUrl(refUrl: string | URL, opts: ReferenceStoreOptions = {}) {
		let spec = await fetch(refUrl as string).then((res) => res.json());
		return ReferenceStore.fromSpec(spec, opts);
	}
}

/**
 * This is for the "binary" loader (custom code is ~2x faster than "atob") from esbuild.
 * https://github.com/evanw/esbuild/blob/150a01844d47127c007c2b1973158d69c560ca21/internal/runtime/runtime.go#L185
 */
let table = new Uint8Array(128);
for (var i = 0; i < 64; i++) {
	table[i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i * 4 - 205] = i;
}
function to_binary(base64: string): Uint8Array {
	var n = base64.length;
	var bytes = new Uint8Array(
		// @ts-ignore
		(((n - (base64[n - 1] == "=") - (base64[n - 2] == "=")) * 3) / 4) | 0,
	);
	for (var i = 0, j = 0; i < n;) {
		var c0 = table[base64.charCodeAt(i++)],
			c1 = table[base64.charCodeAt(i++)];
		var c2 = table[base64.charCodeAt(i++)],
			c3 = table[base64.charCodeAt(i++)];
		bytes[j++] = (c0 << 2) | (c1 >> 4);
		bytes[j++] = (c1 << 4) | (c2 >> 2);
		bytes[j++] = (c2 << 6) | c3;
	}
	return bytes;
}

export default ReferenceStore;
