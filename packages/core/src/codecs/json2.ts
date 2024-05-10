// Adapted from https://github.com/hms-dbmi/vizarr/blob/5b0e3ea6fbb42d19d0e38e60e49bb73d1aca0693/src/utils.ts#L26
import type { Chunk, ObjectType } from "../metadata.js";
import { get_strides, json_decode_object } from "../util.js";

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

// Reference: https://stackoverflow.com/a/21897413
function throw_on_nan_replacer(_key: string | number, value: any): any {
	if (value !== value) {
		throw new Error(
			"JsonCodec allow_nan is false but NaN was encountered during encoding.",
		);
	}

	if (value === Infinity) {
		throw new Error(
			"JsonCodec allow_nan is false but Infinity was encountered during encoding.",
		);
	}

	if (value === -Infinity) {
		throw new Error(
			"JsonCodec allow_nan is false but -Infinity was encountered during encoding.",
		);
	}
	return value;
}

// Reference: https://gist.github.com/davidfurlong/463a83a33b70a3b6618e97ec9679e490
function sort_keys_replacer(_key: string | number, value: any): any {
	return value instanceof Object && !(value instanceof Array)
		? Object.keys(value)
				.sort()
				.reduce((sorted: any, key: string | number) => {
					sorted[key] = value[key];
					return sorted;
				}, {})
		: value;
}

export class JsonCodec {
	kind = "array_to_bytes";

	#encoder_config: EncoderConfig;
	#decoder_config: DecoderConfig;

	constructor(public configuration: JsonCodecConfig) {
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

		this.#encoder_config = {
			encoding,
			skipkeys,
			ensure_ascii,
			check_circular,
			allow_nan,
			indent,
			separators,
			sort_keys,
		};
		this.#decoder_config = { strict };
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
		} = this.#encoder_config;
		if (encoding !== "utf-8") {
			throw new Error("JsonCodec does not yet support non-utf-8 encoding.");
		}
		const replacer_functions: Function[] = [];
		if (!check_circular) {
			// By default, for JSON.stringify,
			// a TypeError will be thrown if one attempts to encode an object with circular references
			throw new Error(
				"JsonCodec does not yet support skipping the check for circular references during encoding.",
			);
		}
		if (!allow_nan) {
			// Throw if NaN/Infinity/-Infinity are encountered during encoding.
			replacer_functions.push(throw_on_nan_replacer);
		}
		if (sort_keys) {
			// We can ensure keys are sorted but not really the opposite since
			// there is no guarantee of key ordering in JS.
			replacer_functions.push(sort_keys_replacer);
		}

		const items = Array.from(buf.data);
		items.push("|O");
		items.push(buf.shape);

		let replacer = undefined;
		if (replacer_functions.length) {
			replacer = function (key: string | number, value: any): any {
				let new_value = value;
				replacer_functions.forEach((sub_replacer) => {
					new_value = sub_replacer(key, new_value);
				});
				return new_value;
			};
		}
		let json_str = JSON.stringify(items, replacer, indent);

		if (ensure_ascii) {
			// If ensure_ascii is true (the default), the output is guaranteed
			// to have all incoming non-ASCII characters escaped.
			// If ensure_ascii is false, these characters will be output as-is.
			// Reference: https://stackoverflow.com/a/31652607
			json_str = json_str.replace(/[\u007F-\uFFFF]/g, function (chr) {
				const full_str = "0000" + chr.charCodeAt(0).toString(16);
				const sub_str = full_str.substring(full_str.length - 4);
				return "\\u" + sub_str;
			});
		}
		return new TextEncoder().encode(json_str);
	}

	decode(bytes: Uint8Array): Chunk<ObjectType> {
		const { strict } = this.#decoder_config;
		if (!strict) {
			// (i.e., allowing control characters inside strings)
			throw new Error("JsonCodec does not yet support non-strict decoding.");
		}
		const items = json_decode_object(bytes);
		const shape = items.pop();
		items.pop(); // Pop off dtype (unused)
		if (!shape) {
			// O-d case
			throw new Error("0D not implemented for JsonCodec.");
		} else {
			const stride = get_strides(shape, "C");
			const data = items;
			return { data, shape, stride };
		}
	}
}
