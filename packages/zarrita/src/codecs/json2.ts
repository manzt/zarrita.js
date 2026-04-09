// Adapted from https://github.com/hms-dbmi/vizarr/blob/5b0e3ea6fbb42d19d0e38e60e49bb73d1aca0693/src/utils.ts#L26
import type { Chunk, ObjectType } from "../metadata.js";
import { assert, getStrides, jsonDecodeObject } from "../util.js";

type EncoderConfig = {
	encoding?: "utf-8";
	skipkeys?: boolean;
	ensure_ascii?: boolean;
	check_circular?: boolean;
	allow_nan?: boolean;
	sort_keys?: boolean;
	indent?: number;
	separators?: [string, string];
};
type DecoderConfig = {
	strict?: boolean;
};

type JsonCodecConfig = EncoderConfig & DecoderConfig;

// TODO: Correctly type the replacer function
// biome-ignore lint/suspicious/noExplicitAny: Really complex type
type ReplacerFunction = (key: string | number, value: any) => any;

// Reference: https://stackoverflow.com/a/21897413
function throwOnNanReplacer(_key: string | number, value: number): number {
	assert(
		!Number.isNaN(value),
		"JsonCodec allow_nan is false but NaN was encountered during encoding.",
	);
	assert(
		value !== Number.POSITIVE_INFINITY,
		"JsonCodec allow_nan is false but Infinity was encountered during encoding.",
	);
	assert(
		value !== Number.NEGATIVE_INFINITY,
		"JsonCodec allow_nan is false but -Infinity was encountered during encoding.",
	);
	return value;
}

// Reference: https://gist.github.com/davidfurlong/463a83a33b70a3b6618e97ec9679e490
function sortKeysReplacer(
	_key: string | number,
	value: Record<string, unknown>,
) {
	return value instanceof Object && !Array.isArray(value)
		? Object.keys(value)
				.sort()
				.reduce(
					(sorted, key: string | number) => {
						sorted[key] = value[key];
						return sorted;
					},
					{} as Record<string, unknown>,
				)
		: value;
}

export class JsonCodec {
	kind = "array_to_bytes";

	#encoderConfig: EncoderConfig;
	#decoderConfig: DecoderConfig;

	constructor(public configuration: JsonCodecConfig = {}) {
		// Reference: https://github.com/zarr-developers/numcodecs/blob/0878717a3613d91a453fe3d3716aa9c67c023a8b/numcodecs/json.py#L36
		const {
			encoding = "utf-8",
			skipkeys = false,
			ensure_ascii = true,
			check_circular = true,
			allow_nan = true,
			sort_keys = true,
			indent,
			strict = true,
		} = configuration;

		let separators = configuration.separators;
		if (!separators) {
			// ensure separators are explicitly specified, and consistent behaviour across
			// Python versions, and most compact representation if indent is None
			if (!indent) {
				separators = [",", ":"];
			} else {
				separators = [", ", ": "];
			}
		}

		this.#encoderConfig = {
			encoding,
			skipkeys,
			ensure_ascii,
			check_circular,
			allow_nan,
			indent,
			separators,
			sort_keys,
		};
		this.#decoderConfig = { strict };
	}
	static fromConfig(configuration: JsonCodecConfig) {
		return new JsonCodec(configuration);
	}

	encode(buf: Chunk<ObjectType>): Uint8Array {
		const {
			indent,
			encoding,
			ensure_ascii,
			check_circular,
			allow_nan,
			sort_keys,
		} = this.#encoderConfig;
		assert(
			encoding === "utf-8",
			"JsonCodec does not yet support non-utf-8 encoding.",
		);
		const replacerFunctions: ReplacerFunction[] = [];

		// By default, for JSON.stringify,
		// a TypeError will be thrown if one attempts to encode an object with circular references
		assert(
			check_circular,
			"JsonCodec does not yet support skipping the check for circular references during encoding.",
		);

		if (!allow_nan) {
			// Throw if NaN/Infinity/-Infinity are encountered during encoding.
			replacerFunctions.push(throwOnNanReplacer);
		}
		if (sort_keys) {
			// We can ensure keys are sorted but not really the opposite since
			// there is no guarantee of key ordering in JS.
			replacerFunctions.push(sortKeysReplacer);
		}

		const items = Array.from(buf.data);
		items.push("|O");
		items.push(buf.shape);

		let replacer: ReplacerFunction | undefined;
		if (replacerFunctions.length) {
			replacer = (key, value) => {
				let newValue = value;
				for (let subReplacer of replacerFunctions) {
					newValue = subReplacer(key, newValue);
				}
				return newValue;
			};
		}
		let jsonStr = JSON.stringify(items, replacer, indent);

		if (ensure_ascii) {
			// If ensure_ascii is true (the default), the output is guaranteed
			// to have all incoming non-ASCII characters escaped.
			// If ensure_ascii is false, these characters will be output as-is.
			// Reference: https://stackoverflow.com/a/31652607
			jsonStr = jsonStr.replace(/[\u007F-\uFFFF]/g, (chr) => {
				const fullStr = `0000${chr.charCodeAt(0).toString(16)}`;
				const subStr = fullStr.substring(fullStr.length - 4);
				return `\\u${subStr}`;
			});
		}
		return new TextEncoder().encode(jsonStr);
	}

	decode(bytes: Uint8Array): Chunk<ObjectType> {
		const { strict } = this.#decoderConfig;
		// (i.e., allowing control characters inside strings)
		assert(strict, "JsonCodec does not yet support non-strict decoding.");

		const items = jsonDecodeObject(bytes);
		const shape = items.pop();
		items.pop(); // Pop off dtype (unused)

		// O-d case
		assert(shape, "0D not implemented for JsonCodec.");
		const stride = getStrides(shape, "C");
		const data = items;
		return { data, shape, stride };
	}
}
