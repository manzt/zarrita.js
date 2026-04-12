import type { AbsolutePath } from "./types.js";

export function stripPrefix<Path extends AbsolutePath>(
	path: Path,
): Path extends AbsolutePath<infer Rest> ? Rest : never {
	// @ts-expect-error - TS can't infer this type correctly
	return path.slice(1);
}

/** Maps cloud-storage URI protocols to their HTTPS hosts. */
const PROTOCOL_HOSTS: Record<string, string> = {
	"gs:": "storage.googleapis.com",
	"gcs:": "storage.googleapis.com",
	"s3:": "s3.amazonaws.com",
};

/**
 * Translate cloud-storage URIs (`s3://`, `gs://`, `gcs://`) to HTTPS URLs.
 * HTTP(S) URLs are returned as-is.
 */
export function resolveUri(url: string | URL): string {
	const href = typeof url === "string" ? url : url.href;
	const colon = href.indexOf("://");
	if (colon === -1) return href;
	const protocol = href.slice(0, colon + 1);
	const host = PROTOCOL_HOSTS[protocol];
	if (host) {
		return `https://${host}/${href.slice(colon + 3)}`;
	}
	return href;
}

export function fetchRange(
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

export function mergeInit(
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

/**
 * Make an assertion.
 *
 * Usage
 * @example
 * ```ts
 * const value: boolean = Math.random() <= 0.5;
 * assert(value, "value is greater than than 0.5!");
 * value // true
 * ```
 *
 * @param expression - The expression to test.
 * @param msg - The optional message to display if the assertion fails.
 * @throws an {@link Error} if `expression` is not truthy.
 */
export function assert(
	expression: unknown,
	msg: string | undefined = "",
): asserts expression {
	if (!expression) throw new Error(msg);
}
