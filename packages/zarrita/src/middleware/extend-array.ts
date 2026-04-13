import type { Readable } from "@zarrita/storage";
import type { Array } from "../hierarchy.js";
import type { DataType } from "../metadata.js";

type AnyArray = Array<DataType, Readable>;

export function extendArray<A extends AnyArray>(array: A): Promise<A>;
export function extendArray<A extends AnyArray, R1>(
	array: A,
	m1: (array: A) => R1,
): Promise<Awaited<R1>>;
export function extendArray<A extends AnyArray, R1, R2>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
): Promise<Awaited<R2>>;
export function extendArray<A extends AnyArray, R1, R2, R3>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
	m3: (array: Awaited<R2>) => R3,
): Promise<Awaited<R3>>;
export function extendArray<A extends AnyArray, R1, R2, R3, R4>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
	m3: (array: Awaited<R2>) => R3,
	m4: (array: Awaited<R3>) => R4,
): Promise<Awaited<R4>>;
export function extendArray<A extends AnyArray, R1, R2, R3, R4, R5>(
	array: A,
	m1: (array: A) => R1,
	m2: (array: Awaited<R1>) => R2,
	m3: (array: Awaited<R2>) => R3,
	m4: (array: Awaited<R3>) => R4,
	m5: (array: Awaited<R4>) => R5,
): Promise<Awaited<R5>>;
export async function extendArray(
	array: AnyArray,
	...middlewares: ((array: unknown) => unknown)[]
): Promise<unknown> {
	let result: unknown = array;
	for (let m of middlewares) {
		result = await m(result);
	}
	return result;
}
