import type { AbsolutePath } from "./types.js";

export function strip_prefix<Path extends AbsolutePath>(
	path: Path,
): Path extends AbsolutePath<infer Rest> ? Rest : never {
	// @ts-expect-error - TS can't infer this type correctly
	return path.slice(1);
}

export function uri2href(url: string | URL) {
	let [protocol, rest] = (typeof url === "string" ? url : url.href).split(
		"://",
	);
	if (protocol === "https" || protocol === "http") {
		return url;
	}
	if (protocol === "gc") {
		return `https://storage.googleapis.com/${rest}`;
	}
	if (protocol === "s3") {
		return `https://s3.amazonaws.com/${rest}`;
	}
	throw Error(`Protocol not supported, got: ${JSON.stringify(protocol)}`);
}

export function fetch_range(
	url: string | URL,
	offset?: number,
	length?: number,
	opts: RequestInit = {},
) {
	if (offset !== undefined && length !== undefined) {
		// merge request opts
		opts = {
			...opts,
			headers: {
				...opts.headers,
				Range: `bytes=${offset}-${offset + length - 1}`,
			},
		};
	}
	return fetch(url, opts);
}

export function merge_init(
	storeOverrides: RequestInit,
	requestOverrides: RequestInit,
) {
	// Request overrides take precedence over storeOverrides.
	return {
		...storeOverrides,
		...requestOverrides,
		headers: {
			...storeOverrides.headers,
			...requestOverrides.headers,
		},
	};
}
