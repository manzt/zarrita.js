declare module "ndarray" {
	declare function ndarray<D extends ndarray.Data = ndarray.Data<number>>(
		data: D,
		shape?: number[],
		stride?: number[],
		offset?: number,
	): ndarray.NdArray<D>;

	declare namespace ndarray {
		interface NdArray<D extends Data = Data<number>> {
			data: D;
			shape: number[];
			stride: number[];
			offset: number;
			dtype: DataType<D>;
			size: number;
			order: number[];
			dimension: number;
			get(...args: number[]): Value<D>;
			set(...args: number[]): Value<D>;
			index(...args: number[]): Value<D>;
			lo(...args: number[]): NdArray<D>;
			hi(...args: number[]): NdArray<D>;
			step(...args: number[]): NdArray<D>;
			transpose(...args: number[]): NdArray<D>;
			pick(...args: Array<number | null>): NdArray<D>;
			T: NdArray<D>;
		}

		interface GenericArray<T> {
			get(idx: number): T;
			set(idx: number, value: T): void;
			length: number;
		}

		// Conditionally resolves Float16Array type if it exists on globalThis (determined by end-user TS version)
		type MaybeFloat16Array = InstanceType<
			typeof globalThis extends { Float16Array: infer T } ? T : never
		>;

		// biome-ignore lint/suspicious/noExplicitAny: not our library
		type Data<T = any> = T extends number
			? GenericArray<T> | T[] | TypedArray
			: T extends bigint
				? GenericArray<T> | T[] | BigInt64Array | BigUint64Array
				: GenericArray<T> | T[];

		type TypedArray =
			| Int8Array
			| Int16Array
			| Int32Array
			| Uint8Array
			| Uint8ClampedArray
			| Uint16Array
			| Uint32Array
			| MaybeFloat16Array
			| Float32Array
			| Float64Array;

		type Value<D extends Data> = D extends
			| GenericArray<infer T>
			// biome-ignore lint/suspicious/noRedeclare: not our library
			| Record<number, infer T>
			? T
			: never;

		// biome-ignore format: avoids indentation
		type DataType<D extends Data = Data> = D extends Int8Array
			? "int8"
			: D extends Int16Array
			? "int16"
			: D extends Int32Array
			? "int32"
			: D extends Uint8Array
			? "uint8"
			: D extends Uint8ClampedArray
			? "uint8_clamped"
			: D extends Uint16Array
			? "uint16"
			: D extends Uint32Array
			? "uint32"
			: D extends MaybeFloat16Array
			? "float16"
			: D extends Float32Array
			? "float32"
			: D extends Float64Array
			? "float64"
			: D extends BigInt64Array
			? "bigint64"
			: D extends BigUint64Array
			? "biguint64"
			: D extends GenericArray<unknown>
			? "generic"
			: "array";
	}

	export = ndarray;
}
