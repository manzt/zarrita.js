/**
 * Walk a list of middlewares, calling each synchronously until one returns a
 * `Promise`. From that point on, chain the remaining middlewares with `.then`
 * so the caller only pays the cost of a Promise if any step actually needs
 * one. This is the shared runtime used by `extendStore` and `extendArray`.
 */
export function applyMiddlewares(
	value: unknown,
	middlewares: readonly ((value: unknown) => unknown)[],
): unknown {
	let result = value;
	for (let m of middlewares) {
		if (result instanceof Promise) {
			result = result.then((v) => m(v));
		} else {
			result = m(result);
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
 * Wrap `Final` in `Promise` iff any of the middleware results in `Rs` was a
 * Promise, otherwise return the unwrapped value type.
 */
export type MaybeAsync<Final, Rs extends readonly unknown[]> =
	AnyPromise<Rs> extends true ? Promise<Awaited<Final>> : Awaited<Final>;
