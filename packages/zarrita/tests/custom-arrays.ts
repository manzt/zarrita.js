import { test, assert } from "vitest";

import { BoolArray, ByteStringArray, UnicodeStringArray } from "../index.ts";

test("BoolArray", () => {
	let arr = new BoolArray(5);
	assert.equal(arr.length, 5);
	assert.equal([false, false, false, false, false], Array.from(arr));
	assert.equal(arr.get(1), false);
	arr.set(1, true);
	assert.equal(arr.get(1), true);
	arr.set(3, true);
	assert.equal([false, true, false, true, false], Array.from(arr));

	let bytes = new Uint8Array([1, 1, 0, 0]);
	arr = new BoolArray(bytes.buffer);
	assert.equal(arr.length, 4);
	assert.equal(arr.get(0), true);
	assert.equal(arr.get(3), false);
	assert.equal([true, true, false, false], Array.from(arr));

	arr.fill(true);
	assert.equal([true, true, true, true], Array.from(arr));
});

test("ByteStringArray", () => {
	let data = new TextEncoder().encode(
		"Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
	);
	let arr = new ByteStringArray(data, 6);
	assert.equal(arr.length, 5);
	assert.equal(["Hello", "world!", "", "", ""], Array.from(arr));
	arr.set(4, "test");
	assert.equal(["Hello", "world!", "", "", "test"], Array.from(arr));
	assert.equal(
		new TextDecoder().decode(arr.buffer),
		"Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00test\x00\x00",
	);
	assert.throws(() => arr.set(3, "too-long"));
});

test("UnicodeStringArray", () => {
	// deno-fmt-ignore
	let data = new Int32Array([ 72, 101, 108, 108, 111, 0, 0, 0, 0, 0, 119, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	let arr = new UnicodeStringArray(data.buffer, 10);
	assert.equal(arr.length, 3);
	assert.equal(["Hello", "world!", ""], Array.from(arr));
	arr.set(2, "test");
	assert.equal(["Hello", "world!", "test"], Array.from(arr));
});

test("UnicodeStringArray - special characters", () => {
	// deno-fmt-ignore
	let data = new Int32Array([161, 72, 111, 108, 97, 32, 109, 117, 110, 100, 111, 33, 0, 0, 0, 0, 0, 0, 0, 0, 72, 101, 106, 32, 86, 228, 114, 108, 100, 101, 110, 33, 0, 0, 0, 0, 0, 0, 0, 0, 88, 105, 110, 32, 99, 104, 224, 111, 32, 116, 104, 7871, 32, 103, 105, 7899, 105, 0, 0, 0]);
	let arr = new UnicodeStringArray(data.buffer, 20);
	assert.equal(arr.length, 3);
	assert.equal(["¡Hola mundo!", "Hej Världen!", "Xin chào thế giới"], Array.from(arr));
	arr.set(2, "test");
	assert.equal(["¡Hola mundo!", "Hej Världen!", "test"], Array.from(arr));
});
