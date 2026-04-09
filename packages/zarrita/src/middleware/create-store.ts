import type { AsyncReadable } from "@zarrita/storage";

export function createStore<S extends AsyncReadable>(store: S): Promise<S>;
export function createStore<S extends AsyncReadable, A>(
	store: S,
	m1: (store: S) => A,
): Promise<Awaited<A>>;
export function createStore<S extends AsyncReadable, A, B>(
	store: S,
	m1: (store: S) => A,
	m2: (store: Awaited<A>) => B,
): Promise<Awaited<B>>;
export function createStore<S extends AsyncReadable, A, B, C>(
	store: S,
	m1: (store: S) => A,
	m2: (store: Awaited<A>) => B,
	m3: (store: Awaited<B>) => C,
): Promise<Awaited<C>>;
export function createStore<S extends AsyncReadable, A, B, C, D>(
	store: S,
	m1: (store: S) => A,
	m2: (store: Awaited<A>) => B,
	m3: (store: Awaited<B>) => C,
	m4: (store: Awaited<C>) => D,
): Promise<Awaited<D>>;
export function createStore<S extends AsyncReadable, A, B, C, D, E>(
	store: S,
	m1: (store: S) => A,
	m2: (store: Awaited<A>) => B,
	m3: (store: Awaited<B>) => C,
	m4: (store: Awaited<C>) => D,
	m5: (store: Awaited<D>) => E,
): Promise<Awaited<E>>;
export async function createStore(
	store: AsyncReadable,
	...middlewares: ((store: unknown) => unknown)[]
): Promise<unknown> {
	let result: unknown = store;
	for (let m of middlewares) {
		result = await m(result);
	}
	return result;
}
