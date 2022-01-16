import { test } from "uvu";
import *  as assert from "uvu/assert";

import { BoolArray, ByteStringArray, UnicodeStringArray } from "../src/lib/custom-arrays";

test('BoolArray', () => {
	let arr = new BoolArray(5);
	assert.is(arr.length, 5);
	assert.equal([false, false, false, false, false], Array.from(arr));
	assert.is(arr.get(1), false);
	arr.set(1, true);
	assert.is(arr.get(1), true);
	arr.set(3, true);
	assert.equal([false, true, false, true, false], Array.from(arr)); 

	let bytes = new Uint8Array([1, 1, 0, 0]);
	arr = new BoolArray(bytes.buffer);
	assert.is(arr.length, 4);
	assert.is(arr.get(0), true);
	assert.is(arr.get(3), false);
	assert.equal([true, true, false, false], Array.from(arr));

	arr.fill(true);
	assert.equal([true, true, true, true], Array.from(arr));
});

test('ByteStringArray', () => {
	let data = new TextEncoder().encode(
		'Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
	);
	let arr = new ByteStringArray(data, 6);
	assert.is(arr.length, 5);
	assert.equal(["Hello", "world!", "", "", ""], Array.from(arr));
	arr.set(4, "test");
	assert.equal(["Hello", "world!", "", "", "test"], Array.from(arr));
	assert.equal(
		new TextDecoder().decode(arr.buffer),
		'Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00test\x00\x00'
	);
	assert.throws(() => arr.set(3, 'too-long'));
});

test('UnicodeStringArray', () => {
	let data = new TextEncoder().encode(
		'H\x00\x00\x00e\x00\x00\x00l\x00\x00\x00l\x00\x00\x00o\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00w\x00\x00\x00o\x00\x00\x00r\x00\x00\x00l\x00\x00\x00d\x00\x00\x00!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
	);
	let arr = new UnicodeStringArray(data, 10);
	assert.is(arr.length, 3);
	assert.equal(["Hello", "world!", ""], Array.from(arr));
	arr.set(2, "test");
	assert.equal(["Hello", "world!", "test"], Array.from(arr));
});

test.run();
