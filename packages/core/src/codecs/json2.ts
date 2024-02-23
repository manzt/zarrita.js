// Adapted from https://github.com/hms-dbmi/vizarr/blob/5b0e3ea6fbb42d19d0e38e60e49bb73d1aca0693/src/utils.ts#L26
import type { Chunk, ObjectType } from '../metadata.js';
import { get_strides, json_decode_object } from '../util.js';

type EncoderConfig = {
	skipkeys?: boolean,
	ensure_ascii?: boolean,
	check_circular?: boolean,
	allow_nan?: boolean,
	sort_keys?: boolean,
	indent?: number|null,
	separators?: [string, string] | null,
};
type DecoderConfig = {
	strict?: boolean,
};

type JsonCodecConfig = {
  encoding?: string,
} & EncoderConfig & DecoderConfig;

export class JsonCodec {
  kind = "array_to_bytes";
  _text_encoding: JsonCodecConfig["encoding"];
  separators: null|[string, string];
  _encoder_config: EncoderConfig;
  _decoder_config: DecoderConfig;

  constructor(
    public configuration: JsonCodecConfig,
  ) {
	// Reference: https://github.com/zarr-developers/numcodecs/blob/0878717a3613d91a453fe3d3716aa9c67c023a8b/numcodecs/json.py#L36
    const {
      encoding = 'utf-8',
      skipkeys = false,
      ensure_ascii = true,
      check_circular = true,
      allow_nan = true,
      sort_keys = true,
      indent = null,
      strict = true,
    } = configuration;
    let separators = configuration.separators;
    this._text_encoding = encoding;
    if(!separators) {
      // ensure separators are explicitly specified, and consistent behaviour across
      // Python versions, and most compact representation if indent is None
      if(!indent) {
        separators = [',', ':'];
      } else {
        separators = [', ', ': '];
      }
    }
    this.separators = separators;

    this._encoder_config = {
      skipkeys: skipkeys,
      ensure_ascii: ensure_ascii,
      check_circular: check_circular,
      allow_nan: allow_nan,
      indent: indent,
      separators,
      sort_keys: sort_keys
    };
    // self._encoder = _json.JSONEncoder(**self._encoder_config)
    this._decoder_config = { strict: strict };
    // self._decoder = _json.JSONDecoder(**self._decoder_config)
  }
  static fromConfig(
		configuration: JsonCodecConfig,
	) {
		return new JsonCodec(configuration);
	}

	encode(_chunk: Chunk<ObjectType>): Uint8Array {
		throw new Error("Method not implemented.");
	}

	decode(bytes: Uint8Array): Chunk<ObjectType> {
		const items = json_decode_object(bytes);
		const shape = items.pop();
		const dtype = items.pop();
		if(!shape) {
		// O-d case?
		throw new Error("0D not implemented for JsonCodec.");
		} else {
			const stride = get_strides(shape, "C");
			const data = items;
			return { data, shape, stride };
		}
	}
}
