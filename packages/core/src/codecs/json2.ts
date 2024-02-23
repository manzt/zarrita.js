// Adapted from https://github.com/hms-dbmi/vizarr/blob/5b0e3ea6fbb42d19d0e38e60e49bb73d1aca0693/src/utils.ts#L26
import type { Chunk, ObjectType } from "../metadata.js";
import {
	get_strides,
	json_decode_object,
	json_encode_object,
} from "../util.js";

type EncoderConfig = {
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

type JsonCodecConfig =
	& {
		encoding?: string;
	}
	& EncoderConfig
	& DecoderConfig;

export class JsonCodec {
	kind = "array_to_bytes";

	_indent: JsonCodecConfig["indent"];

	constructor(
		public configuration: JsonCodecConfig,
	) {
		// Reference: https://github.com/zarr-developers/numcodecs/blob/0878717a3613d91a453fe3d3716aa9c67c023a8b/numcodecs/json.py#L36
		const {
			// encoding = 'utf-8',
			// skipkeys = false,
			// ensure_ascii = true,
			// check_circular = true,
			// allow_nan = true,
			// sort_keys = true,
			indent,
			// strict = true,
		} = configuration;
		this._indent = indent;
	}
	static fromConfig(
		configuration: JsonCodecConfig,
	) {
		return new JsonCodec(configuration);
	}

	encode(buf: Chunk<ObjectType>): Uint8Array {
		const items = Array.from(buf.data);
		items.push("|O");
		items.push(buf.shape);
		// By default, json_encode_object uses 2 spaces plus newline,
		// but we want to ensure an undefined indent corresponds to a 0-spacing.
		const space = this._indent ?? 0;
		return json_encode_object(items, space);
	}

	decode(bytes: Uint8Array): Chunk<ObjectType> {
		const items = json_decode_object(bytes);
		const shape = items.pop();
		const dtype = items.pop();
		if (!shape) {
			// O-d case?
			throw new Error("0D not implemented for JsonCodec.");
		} else {
			const stride = get_strides(shape, "C");
			const data = items;
			return { data, shape, stride };
		}
	}
}
