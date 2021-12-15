import type { Codec } from "numcodecs";

type Config = Record<string, any>;
type CodecImporter = () => Promise<{ fromConfig: (config: Config) => Codec }>;

export const registry: Map<string, CodecImporter> = new Map();

registry.set(...default_import("blosc"));
registry.set(...default_import("zstd"));
registry.set(...default_import("gzip"));
registry.set(...default_import("zlib"));
registry.set(...default_import("lz4"));

function default_import(id: "blosc" | "zlib" | "zstd" | "gzip" | "lz4", version = "0.2.2") {
	let link: string;
	if (typeof process === "undefined") {
		// browser
		link = `https://cdn.skypack.dev/numcodecs@${version}/${id}`;
	} else {
	    // node
		link = `numcodecs/${id}`;
	}
	return [id, (() => import(/* @vite-ignore */ link).then((m) => m.default)) as CodecImporter] as const;
}
