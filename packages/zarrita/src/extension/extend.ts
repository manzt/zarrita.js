/**
 * Walk a list of extensions, calling each synchronously until one returns a
 * `Promise`. From that point on, chain the remaining extensions with `.then`
 * so the caller only pays the cost of a Promise if any step actually needs
 * one. This is the shared runtime used by `extendStore` and `extendArray`.
 */
export function applyExtensions(
	value: unknown,
	extensions: readonly ((value: unknown) => unknown)[],
): unknown {
	let result = value;
	for (let ext of extensions) {
		if (result instanceof Promise) {
			result = result.then((v) => ext(v));
		} else {
			result = ext(result);
		}
	}
	return result;
}

/** True if any type in the tuple is a Promise. */
export type AnyPromise<Rs extends readonly unknown[]> = [
	Extract<Rs[number], Promise<unknown>>,
] extends [never]
	? false
	: true;

/**
 * Wrap `Final` in `Promise` iff any of the extension results in `Rs` was a
 * Promise, otherwise return the unwrapped value type.
 */
export type MaybeAsync<Final, Rs extends readonly unknown[]> =
	AnyPromise<Rs> extends true ? Promise<Awaited<Final>> : Awaited<Final>;
