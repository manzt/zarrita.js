import type { AbsolutePath } from "@zarrita/core/types";

function range_header(offset: number, size: number) {
	return {
		Range: `bytes=${offset}-${offset + size - 1}`,
	};
}

export function strip_prefix<Path extends AbsolutePath>(
	path: Path,
): Path extends AbsolutePath<infer Rest> ? Rest : never {
	return path.slice(1) as any;
}

export function uri2href(url: string | URL) {
	let [protocol, rest] = (typeof url === "string" ? url : url.href).split("://");
	if (protocol === "https" || protocol === "http") {
		return url;
	}
	if (protocol === "gc") {
		return `https://storage.googleapis.com/${rest}`;
	}
	if (protocol === "s3") {
		return `https://s3.amazonaws.com/${rest}`;
	}
	throw Error("Protocol not supported, got: " + JSON.stringify(protocol));
}

type FetchConfig = { url: string | URL; offset?: number; size?: number };

export function fetch_range(
	config: FetchConfig,
	opts: RequestInit = {},
) {
	if (config.offset !== undefined && config.size !== undefined) {
		// merge request opts
		opts = {
			...opts,
			headers: {
				...opts.headers,
				...range_header(config.offset, config.size),
			},
		};
	}
	return fetch(config.url as string, opts);
}
