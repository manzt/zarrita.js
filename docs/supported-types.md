# Supported Types

Zarr has a wide range of supported datatypes. zarrita translates these into an appropriate classes in Javascript, either using built in typed arrays, the Array class, or a zarrita class. Not all zarr datatypes are supported.

| type                                                                                         | zarrita array type                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`int8`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/int8)       | [`Int8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int8Array)           |
| [`int16`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/int16)     | [`Int16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int16Array)         |
| [`int32`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/int32)     | [`Int32Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int32Array)         |
| [`int64`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/int64)     | [`BigInt64Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array)   |
| [`uint8`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/uint8)     | [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)         |
| [`uint16`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/uint16)   | [`Uint16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array)       |
| [`uint32`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/uint32)   | [`Uint32Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array)       |
| [`uint64`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/uint64)   | [`BigUint64Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigUint64Array) |
| [`float16`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/float16) | [`Float16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float16Array)     |
| [`float32`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/float32) | [`Float32Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array)     |
| [`float64`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/float64) | [`Float64Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array)     |
| [`bool`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/bool)       | `BoolArray`                                                                                                         |
| [`string`](https://github.com/zarr-developers/zarr-extensions/tree/main/data-types/string)   | [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)\<string\>         |


[Zarr V2 types](https://zarr.readthedocs.io/en/stable/user-guide/data_types/#data-types-in-zarr-version-2) are mapped to the above, with some specific additional cases.

| V2 type                           | zarrita array type                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `\<U` _length_ and `\>U` _length_ | `UnicodeStringArray`                                                                                       |
| `\<S` _length_ and `\>S` _length_ | `ByteStringArray`                                                                                          |
| `\|O`                             | [`Array<unknown>`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) |
