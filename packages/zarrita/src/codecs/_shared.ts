import { UnsupportedError } from "../errors.js";

export function unimplementedEncode(codecName: string): (_: never) => never {
	return () => {
		throw new UnsupportedError(`${codecName} encode`);
	};
}
