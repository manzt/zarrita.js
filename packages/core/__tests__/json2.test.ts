import { describe, expect, test } from "vitest";

import { JsonCodec } from "../src/codecs/json2.js";

describe("JsonCodec", () => {
	test("can decode", () => {
		// from numcodecs.json import JSON
		// import numpy as np
		// json_codec = JSON()
		// json_codec.encode(np.array(['ASC1', 'ASC2', 'END', 'GABA1', 'GABA2', 'MG', 'NSC', 'ODC1', 'OPC', 'Unclassified', 'exCA1', 'exCA3', 'exDG', 'exPFC1', 'exPFC2'], dtype=object))
		const encodedStr =
			`["ASC1","ASC2","END","GABA1","GABA2","MG","NSC","ODC1","OPC","Unclassified","exCA1","exCA3","exDG","exPFC1","exPFC2","|O",[15]]`;
		const encodedBytes = new TextEncoder().encode(encodedStr);
		const jsonCodec = new JsonCodec({ encoding: "utf-8" });
		const decodedResult = jsonCodec.decode(encodedBytes);
		expect(decodedResult).toStrictEqual({
			data: [
				"ASC1",
				"ASC2",
				"END",
				"GABA1",
				"GABA2",
				"MG",
				"NSC",
				"ODC1",
				"OPC",
				"Unclassified",
				"exCA1",
				"exCA3",
				"exDG",
				"exPFC1",
				"exPFC2",
			],
			shape: [15],
			stride: [1],
		});
	});
	test("can encode", () => {
		const encodedStr =
			`["ASC1","ASC2","END","GABA1","GABA2","MG","NSC","ODC1","OPC","Unclassified","exCA1","exCA3","exDG","exPFC1","exPFC2","|O",[15]]`;
		const encodedBytes = new TextEncoder().encode(encodedStr);

		const chunk = {
			data: [
				"ASC1",
				"ASC2",
				"END",
				"GABA1",
				"GABA2",
				"MG",
				"NSC",
				"ODC1",
				"OPC",
				"Unclassified",
				"exCA1",
				"exCA3",
				"exDG",
				"exPFC1",
				"exPFC2",
			],
			shape: [15],
			stride: [1],
		};
		const jsonCodec = new JsonCodec({ encoding: "utf-8" });
		const encodedResult = jsonCodec.encode(chunk);
		expect(encodedResult).toStrictEqual(encodedBytes);
	});
});
