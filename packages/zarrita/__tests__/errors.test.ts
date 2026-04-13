import { expectType } from "tintype";
import { describe, expect, test } from "vitest";
import {
	CodecPipelineError,
	InvalidMetadataError,
	InvalidSelectionError,
	NotFoundError,
	UnknownCodecError,
	UnsupportedError,
} from "../src/errors.js";
import * as zarr from "../src/index.js";

describe("isZarritaError", () => {
	test("returns false for non-zarrita errors", () => {
		expect(zarr.isZarritaError(new Error("nope"))).toBe(false);
		expect(zarr.isZarritaError("string")).toBe(false);
		expect(zarr.isZarritaError(null)).toBe(false);
		expect(zarr.isZarritaError(undefined)).toBe(false);
		expect(zarr.isZarritaError({ _tag: "NotFoundError" })).toBe(false);
	});

	test("returns true for any zarrita error when no tag given", () => {
		expect(zarr.isZarritaError(new NotFoundError("v3 array"))).toBe(true);
		expect(zarr.isZarritaError(new InvalidMetadataError("bad json"))).toBe(
			true,
		);
		expect(zarr.isZarritaError(new UnknownCodecError("wat"))).toBe(true);
		expect(
			zarr.isZarritaError(
				new CodecPipelineError({
					direction: "decode",
					codec: "blosc",
					cause: new Error("boom"),
				}),
			),
		).toBe(true);
		expect(zarr.isZarritaError(new InvalidSelectionError("oob"))).toBe(true);
		expect(zarr.isZarritaError(new UnsupportedError("sharded set"))).toBe(true);
	});

	test("filters by single tag", () => {
		const err = new NotFoundError("v3 array", { path: "/foo" });
		expect(zarr.isZarritaError(err, "NotFoundError")).toBe(true);
		expect(zarr.isZarritaError(err, "InvalidSelectionError")).toBe(false);
	});

	test("filters by multiple tags", () => {
		const err = new InvalidSelectionError("oob");
		expect(
			zarr.isZarritaError(err, "NotFoundError", "InvalidSelectionError"),
		).toBe(true);
		expect(
			zarr.isZarritaError(err, "UnknownCodecError", "UnsupportedError"),
		).toBe(false);
	});

	test("narrows to NotFoundError with typed path + found fields", () => {
		const err: unknown = new NotFoundError("array at /foo", {
			path: "/foo",
			found: "group",
		});
		if (zarr.isZarritaError(err, "NotFoundError")) {
			expectType<NotFoundError>(err);
			expect(err.path).toBe("/foo");
			expect(err.found).toBe("group");
			expect(err._tag).toBe("NotFoundError");
		} else {
			throw new Error("expected narrowing to succeed");
		}
	});

	test("narrows to UnknownCodecError with typed codec field", () => {
		const err: unknown = new UnknownCodecError("exotic");
		if (zarr.isZarritaError(err, "UnknownCodecError")) {
			expectType<UnknownCodecError>(err);
			expect(err.codec).toBe("exotic");
		} else {
			throw new Error("expected narrowing to succeed");
		}
	});

	test("narrows to CodecPipelineError with typed direction + cause", () => {
		const cause = new Error("gzip boom");
		const err: unknown = new CodecPipelineError({
			direction: "decode",
			codec: "gzip",
			cause,
		});
		if (zarr.isZarritaError(err, "CodecPipelineError")) {
			expectType<CodecPipelineError>(err);
			expect(err.direction).toBe("decode");
			expect(err.codec).toBe("gzip");
			expect(err.cause).toBe(cause);
		} else {
			throw new Error("expected narrowing to succeed");
		}
	});

	test("narrows to UnsupportedError with feature field", () => {
		const err: unknown = new UnsupportedError("sharded set");
		if (zarr.isZarritaError(err, "UnsupportedError")) {
			expectType<UnsupportedError>(err);
			expect(err.feature).toBe("sharded set");
		} else {
			throw new Error("expected narrowing to succeed");
		}
	});

	test("narrows to union when multiple tags given", () => {
		const err: unknown = new InvalidSelectionError("oob");
		if (zarr.isZarritaError(err, "InvalidSelectionError", "UnsupportedError")) {
			expectType<InvalidSelectionError | UnsupportedError>(err);
			expect(
				err._tag === "InvalidSelectionError" || err._tag === "UnsupportedError",
			).toBe(true);
		} else {
			throw new Error("expected narrowing to succeed");
		}
	});
});
