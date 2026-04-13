import type { Readable } from "@zarrita/storage";
import type { Array } from "../hierarchy.js";
import type { DataType } from "../metadata.js";
import { applyExtensions, type MaybeAsync } from "./extend.js";

type AnyArray = Array<DataType, Readable>;

export function extendArray<A extends AnyArray>(array: A): A;
export function extendArray<A extends AnyArray, R1>(
	array: A,
	m1: (array: A) => R1,
): MaybeAsync<R1, [R1]>;
export function extendArray<A extends AnyArray, R1, R2>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
): MaybeAsync<R2, [R1, R2]>;
export function extendArray<A extends AnyArray, R1, R2, R3>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
	m3: (array: Awaited<R2>) => R3,
): MaybeAsync<R3, [R1, R2, R3]>;
export function extendArray<A extends AnyArray, R1, R2, R3, R4>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
	m3: (array: Awaited<R2>) => R3,
	m4: (array: Awaited<R3>) => R4,
): MaybeAsync<R4, [R1, R2, R3, R4]>;
export function extendArray<A extends AnyArray, R1, R2, R3, R4, R5>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
	m3: (array: Awaited<R2>) => R3,
	m4: (array: Awaited<R3>) => R4,
	m5: (array: Awaited<R4>) => R5,
): MaybeAsync<R5, [R1, R2, R3, R4, R5]>;
export function extendArray(
	array: AnyArray,
	...extensions: ((array: unknown) => unknown)[]
): unknown {
	return applyExtensions(array, extensions);
}
