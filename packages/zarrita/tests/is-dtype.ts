import { test, assert } from "vitest";
import { is_dtype } from "../src/lib/util";

test("is number", () => {
	assert.ok(is_dtype("|i1", "number"));
	assert.ok(is_dtype("<i2", "number"));
	assert.ok(is_dtype(">i2", "number"));
	assert.ok(is_dtype("<i4", "number"));
	assert.ok(is_dtype(">i4", "number"));

	assert.ok(is_dtype("|u1", "number"));
	assert.ok(is_dtype("<u2", "number"));
	assert.ok(is_dtype(">u2", "number"));
	assert.ok(is_dtype("<u4", "number"));
	assert.ok(is_dtype(">u4", "number"));

	assert.ok(is_dtype("<f4", "number"));
	assert.ok(is_dtype(">f4", "number"));
	assert.ok(is_dtype("<f8", "number"));
	assert.ok(is_dtype(">f8", "number"));
});

test("is not number (bigint)", () => {
	assert.notOk(is_dtype(">i8", "number"));
	assert.notOk(is_dtype("<i8", "number"));
	assert.notOk(is_dtype(">u8", "number"));
	assert.notOk(is_dtype("<u8", "number"));
});

test("is not number (string)", () => {
	assert.notOk(is_dtype("<U8", "number"));
	assert.notOk(is_dtype("|S1", "number"));
	assert.notOk(is_dtype("|S1", "number"));
	assert.notOk(is_dtype("|S24", "number"));
});

test("is bigint", () => {
	assert.ok(is_dtype(">i8", "bigint"));
	assert.ok(is_dtype("<i8", "bigint"));
	assert.ok(is_dtype(">u8", "bigint"));
	assert.ok(is_dtype("<u8", "bigint"));
});

test("is not bigint (number)", () => {
	assert.notOk(is_dtype("|i1", "bigint"));
	assert.notOk(is_dtype("<i2", "bigint"));
	assert.notOk(is_dtype(">i2", "bigint"));
	assert.notOk(is_dtype("<i4", "bigint"));
	assert.notOk(is_dtype(">i4", "bigint"));

	assert.notOk(is_dtype("|u1", "bigint"));
	assert.notOk(is_dtype("<u2", "bigint"));
	assert.notOk(is_dtype(">u2", "bigint"));
	assert.notOk(is_dtype("<u4", "bigint"));
	assert.notOk(is_dtype(">u4", "bigint"));

	assert.notOk(is_dtype("<f4", "bigint"));
	assert.notOk(is_dtype(">f4", "bigint"));
	assert.notOk(is_dtype("<f8", "bigint"));
	assert.notOk(is_dtype(">f8", "bigint"));
});

test("is not bigint (string)", () => {
	assert.notOk(is_dtype("<U8", "bigint"));
	assert.notOk(is_dtype(">U43", "bigint"));
	assert.notOk(is_dtype("|S1", "bigint"));
	assert.notOk(is_dtype("|S24", "bigint"));
});

test("is exact", () => {
	assert.ok(is_dtype("<U8", "<U8"));
	assert.ok(is_dtype(">f4", ">f4"));
	assert.ok(is_dtype("|u1", "|u1"));
	assert.ok(is_dtype("<i2", "<i2"));
	assert.ok(is_dtype("|b1", "|b1"));
});

test("is not exact", () => {
	assert.notOk(is_dtype("<U8", "<U88"));
	assert.notOk(is_dtype("<i2", ">i2"));
	assert.notOk(is_dtype("|S22", "|S225"));
});

test("is fuzzy", () => {
	// number
	assert.ok(is_dtype("|i1", "i1"));
	assert.ok(is_dtype("<i2", "i2"));
	assert.ok(is_dtype(">i2", "i2"));
	assert.ok(is_dtype("<i4", "i4"));
	assert.ok(is_dtype(">i4", "i4"));
	assert.ok(is_dtype("|u1", "u1"));
	assert.ok(is_dtype("<u2", "u2"));
	assert.ok(is_dtype(">u2", "u2"));
	assert.ok(is_dtype("<u4", "u4"));
	assert.ok(is_dtype(">u4", "u4"));
	assert.ok(is_dtype("<f4", "f4"));
	assert.ok(is_dtype(">f4", "f4"));
	assert.ok(is_dtype("<f8", "f8"));
	assert.ok(is_dtype(">f8", "f8"));

	// bigint
	assert.ok(is_dtype(">i8", "i8"));
	assert.ok(is_dtype("<i8", "i8"));
	assert.ok(is_dtype(">u8", "u8"));
	assert.ok(is_dtype("<u8", "u8"));

	// string
	assert.ok(is_dtype(">U8", "U8"));
	assert.ok(is_dtype("<U8", "U8"));
	assert.ok(is_dtype("|S4", "S4"));

	// boolean
	assert.ok(is_dtype("|b1", "b1"));
});
