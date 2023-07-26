import { test, expect } from "vitest";

import { BoolArray, ByteStringArray, UnicodeStringArray } from "../index.js";

test("BoolArray", () => {
	let arr = new BoolArray(5);
	expect(arr.length).toBe(5);
	expect([false, false, false, false, false]).toStrictEqual(Array.from(arr));
	expect(arr.get(1)).toBe(false);
	arr.set(1, true);
	expect(arr.get(1)).toBe(true);
	arr.set(3, true);
	expect([false, true, false, true, false]).toStrictEqual(Array.from(arr));

	let bytes = new Uint8Array([1, 1, 0, 0]);
	arr = new BoolArray(bytes.buffer);
	expect(arr.length).toBe(4);
	expect(arr.get(0)).toBe(true);
	expect(arr.get(3)).toBe(false);
	expect([true, true, false, false]).toStrictEqual(Array.from(arr));

	arr.fill(true);
	expect([true, true, true, true]).toStrictEqual(Array.from(arr));
});

test("ByteStringArray", () => {
	let data = new TextEncoder().encode(
		"Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
	);
	let arr = new ByteStringArray(data, 6);
	expect(arr.length).toBe(5);
	expect(["Hello", "world!", "", "", ""]).toStrictEqual(Array.from(arr));
	arr.set(4, "test");
	expect(["Hello", "world!", "", "", "test"]).toStrictEqual(Array.from(arr));
	expect(new TextDecoder().decode(arr.buffer)).toBe("Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00test\x00\x00");
	expect(() => arr.set(3, "too-long")).toThrow();
});

test("UnicodeStringArray", () => {
	// deno-fmt-ignore
	let data = new Int32Array([ 72, 101, 108, 108, 111, 0, 0, 0, 0, 0, 119, 111, 114, 108, 100, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	let arr = new UnicodeStringArray(data.buffer, 10);
	expect(arr.length).toBe(3);
	expect(["Hello", "world!", ""]).toStrictEqual(Array.from(arr));
	arr.set(2, "test");
	expect(["Hello", "world!", "test"]).toStrictEqual(Array.from(arr));
});

test("UnicodeStringArray - special characters", () => {
	// deno-fmt-ignore
	let data = new Int32Array([161, 72, 111, 108, 97, 32, 109, 117, 110, 100, 111, 33, 0, 0, 0, 0, 0, 0, 0, 0, 72, 101, 106, 32, 86, 228, 114, 108, 100, 101, 110, 33, 0, 0, 0, 0, 0, 0, 0, 0, 88, 105, 110, 32, 99, 104, 224, 111, 32, 116, 104, 7871, 32, 103, 105, 7899, 105, 0, 0, 0]);
	let arr = new UnicodeStringArray(data.buffer, 20);
	expect(arr.length).toBe(3);
	expect(["¡Hola mundo!", "Hej Världen!", "Xin chào thế giới"]).toStrictEqual(Array.from(arr));
	arr.set(2, "test");
	expect(["¡Hola mundo!", "Hej Världen!", "test"]).toStrictEqual(Array.from(arr));
});
