# Supported Types

Zarr has a wide range of supported datatypes. zarrita translates these into an appropriate classes in Javascript, either using built in typed arrays, the Array class, or a zarrita class. Not all zarr datatypes are supported.

|type|zarrita array type|
|----|------------------|
|`int8`|Int8Array|
|`int16`|Int16Array|
|`int32`|Int32Array|
|`int64`|BigInt64Array|
|`uint8`|Uint8Array|
|`uint16`|Uint16Array|
|`uint32`|Uint32Array|
|`uint64`|BigUint64Array|
|`float16`|Float16Array|
|`float32`|Float32Array|
|`float64`|Float64Array|
|`bool`|BoolArray|
|[`string`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/string)|Array<string>|


[Zarr V2 types](https://zarr.readthedocs.io/en/stable/user-guide/data_types/#data-types-in-zarr-version-2) are mapped to the above, with some specific additional cases.

|V2 type|zarrita array type|
|-------|------------------|
|`<U`<em>\<length\></em> and `>U`<em>\<length\></em> |UnicodeStringArray|
|`<S`<em>\<length\></em> and `>S`<em>\<length\></em>|ByteStringArray|
|`\|O`|Array|