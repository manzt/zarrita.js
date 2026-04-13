import type { AsyncReadable } from "@zarrita/storage";
import { applyExtensions, type MaybeAsync } from "./extend.js";

export function extendStore<S extends AsyncReadable>(store: S): S;
export function extendStore<S extends AsyncReadable, R1>(
	store: S,
	m1: (store: S) => R1,
): MaybeAsync<R1, [R1]>;
export function extendStore<S extends AsyncReadable, R1, R2>(
	store: S,
	m1: (store: S) => R1,
	m2: (store: Awaited<R1>) => R2,
): MaybeAsync<R2, [R1, R2]>;
export function extendStore<S extends AsyncReadable, R1, R2, R3>(
	store: S,
	m1: (store: S) => R1,
	m2: (store: Awaited<R1>) => R2,
	m3: (store: Awaited<R2>) => R3,
): MaybeAsync<R3, [R1, R2, R3]>;
export function extendStore<S extends AsyncReadable, R1, R2, R3, R4>(
	store: S,
	m1: (store: S) => R1,
	m2: (store: Awaited<R1>) => R2,
	m3: (store: Awaited<R2>) => R3,
	m4: (store: Awaited<R3>) => R4,
): MaybeAsync<R4, [R1, R2, R3, R4]>;
export function extendStore<S extends AsyncReadable, R1, R2, R3, R4, R5>(
	store: S,
	m1: (store: S) => R1,
	m2: (store: Awaited<R1>) => R2,
	m3: (store: Awaited<R2>) => R3,
	m4: (store: Awaited<R3>) => R4,
	m5: (store: Awaited<R4>) => R5,
): MaybeAsync<R5, [R1, R2, R3, R4, R5]>;
export function extendStore(
	store: AsyncReadable,
	...extensions: ((store: unknown) => unknown)[]
): unknown {
	return applyExtensions(store, extensions);
}
