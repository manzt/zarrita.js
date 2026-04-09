import { describe, expect, test } from "vitest";

import {
	BasicIndexer,
	normalizeIntegerSelection,
	normalizeSelection,
} from "../../src/indexing/indexer.js";
import type { Slice } from "../../src/indexing/types.js";
import { slice } from "../../src/indexing/util.js";

describe("normalizeSelection", () => {
	// null !== null, so need custom compare
	let eq = (a: (Slice | number)[], b: (Slice | number)[]) => {
		expect(a.map((s) => s.toString())).toStrictEqual(
			b.map((s) => s.toString()),
		);
	};
	test("handles complete selection", () => {
		eq(normalizeSelection(null, [2, 3, 4]), [
			slice(null),
			slice(null),
			slice(null),
		]);
	});
	test("handles partial complete selection", () => {
		eq(normalizeSelection([slice(2), null, 3], [2, 3, 4]), [
			slice(2),
			slice(null),
			3,
		]);
	});
	test("throws when dimensions don't match", () => {
		expect(() =>
			normalizeSelection([slice(2), null, 3, 4], [2, 3, 4]),
		).toThrowError();
	});
});

describe("normalizeIntegerSelection", () => {
	test.each([
		[2, 5, 2],
		[-1, 5, 4],
		[-2, 5, 3],
		[-2.2, 5, 3],
		[4.3, 5, 4],
	])("normalizeIntegerSelection(%i, %i) -> %i", (dim_selection, dim_length, expected) => {
		expect(normalizeIntegerSelection(dim_selection, dim_length)).toBe(expected);
	});
	test.each([
		[5, 5],
		[6, 5],
		[-6, 5],
	])("normalizeIntegerSelection(%i, %i) -> throws", (dim_selection, dim_length) => {
		expect(() =>
			normalizeIntegerSelection(dim_selection, dim_length),
		).toThrowError();
	});
});

describe("BasicIndexer", () => {
	test("handles identical shape and chunk_shape", () => {
		let indexer = new BasicIndexer({
			selection: null,
			shape: [3, 4, 5],
			chunkShape: [3, 4, 5],
		});
		expect(indexer.shape).toStrictEqual([3, 4, 5]);
		expect(Array.from(indexer).map((i) => i.mapping)).toMatchInlineSnapshot(`
			[
			  [
			    {
			      "from": [
			        0,
			        3,
			        1,
			      ],
			      "to": [
			        0,
			        3,
			        1,
			      ],
			    },
			    {
			      "from": [
			        0,
			        4,
			        1,
			      ],
			      "to": [
			        0,
			        4,
			        1,
			      ],
			    },
			    {
			      "from": [
			        0,
			        5,
			        1,
			      ],
			      "to": [
			        0,
			        5,
			        1,
			      ],
			    },
			  ],
			]
		`);
	});

	test("handles complete multi-dim chunking", () => {
		let indexer = new BasicIndexer({
			selection: null,
			shape: [3, 4, 5],
			chunkShape: [1, 2, 5],
		});
		expect(Array.from(indexer)).toMatchInlineSnapshot(`
			[
			  {
			    "chunkCoords": [
			      0,
			      0,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          0,
			          1,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          2,
			          1,
			        ],
			        "to": [
			          0,
			          2,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          5,
			          1,
			        ],
			        "to": [
			          0,
			          5,
			          1,
			        ],
			      },
			    ],
			  },
			  {
			    "chunkCoords": [
			      1,
			      0,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          1,
			          2,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          2,
			          1,
			        ],
			        "to": [
			          0,
			          2,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          5,
			          1,
			        ],
			        "to": [
			          0,
			          5,
			          1,
			        ],
			      },
			    ],
			  },
			  {
			    "chunkCoords": [
			      2,
			      0,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          2,
			          3,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          2,
			          1,
			        ],
			        "to": [
			          0,
			          2,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          5,
			          1,
			        ],
			        "to": [
			          0,
			          5,
			          1,
			        ],
			      },
			    ],
			  },
			  {
			    "chunkCoords": [
			      0,
			      1,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          0,
			          1,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          2,
			          1,
			        ],
			        "to": [
			          2,
			          4,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          5,
			          1,
			        ],
			        "to": [
			          0,
			          5,
			          1,
			        ],
			      },
			    ],
			  },
			  {
			    "chunkCoords": [
			      1,
			      1,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          1,
			          2,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          2,
			          1,
			        ],
			        "to": [
			          2,
			          4,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          5,
			          1,
			        ],
			        "to": [
			          0,
			          5,
			          1,
			        ],
			      },
			    ],
			  },
			  {
			    "chunkCoords": [
			      2,
			      1,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          2,
			          3,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          2,
			          1,
			        ],
			        "to": [
			          2,
			          4,
			          1,
			        ],
			      },
			      {
			        "from": [
			          0,
			          5,
			          1,
			        ],
			        "to": [
			          0,
			          5,
			          1,
			        ],
			      },
			    ],
			  },
			]
		`);
	});

	test("handles squeezed dimension", () => {
		let indexer = new BasicIndexer({
			selection: [null, 0],
			shape: [3, 4],
			chunkShape: [1, 4],
		});
		expect(indexer.shape).toStrictEqual([3]);
		expect(Array.from(indexer)).toMatchInlineSnapshot(`
			[
			  {
			    "chunkCoords": [
			      0,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          0,
			          1,
			          1,
			        ],
			      },
			      {
			        "from": 0,
			        "to": null,
			      },
			    ],
			  },
			  {
			    "chunkCoords": [
			      1,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          1,
			          2,
			          1,
			        ],
			      },
			      {
			        "from": 0,
			        "to": null,
			      },
			    ],
			  },
			  {
			    "chunkCoords": [
			      2,
			      0,
			    ],
			    "mapping": [
			      {
			        "from": [
			          0,
			          1,
			          1,
			        ],
			        "to": [
			          2,
			          3,
			          1,
			        ],
			      },
			      {
			        "from": 0,
			        "to": null,
			      },
			    ],
			  },
			]
		`);
	});
});
