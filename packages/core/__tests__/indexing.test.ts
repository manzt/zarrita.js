import { describe, expect, it } from "vitest";
import type { Slice } from "../src/types.js";
import {
	BasicIndexer,
	normalize_integer_selection,
	normalize_selection,
} from "../src/indexing.js";
import { slice } from "../src/util.js";

describe("normalize_selection", () => {
	// null !== null, so need custom compare
	let eq = (a: (Slice | number)[], b: (Slice | number)[]) => {
		expect(
			a.map((s) => s.toString()),
		).toStrictEqual(
			b.map((s) => s.toString()),
		);
	};
	it("handles complete selection", () => {
		eq(
			normalize_selection(null, [2, 3, 4]),
			[slice(null), slice(null), slice(null)],
		);
	});
	it("handles partial complete selection", () => {
		eq(
			normalize_selection([slice(2), null, 3], [2, 3, 4]),
			[slice(2), slice(null), 3],
		);
	});
	it("throws when dimensions don't match", () => {
		expect(() => normalize_selection([slice(2), null, 3, 4], [2, 3, 4]))
			.toThrowError();
	});
});

describe("normalize_integer_selection", () => {
	it.each([
		[2, 5, 2],
		[-1, 5, 4],
		[-2, 5, 3],
		[-2.2, 5, 3],
		[4.3, 5, 4],
	])(`(dim_selection=%i, dim_length=%i) -> %i`, (dim_selection, dim_length, expected) => {
		expect(normalize_integer_selection(dim_selection, dim_length)).toBe(expected);
	});
	it.each([
		[5, 5],
		[6, 5],
		[-6, 5],
	])(`(dim_selection=%i, dim_length=%i) -> throws`, (dim_selection, dim_length) => {
		expect(() => normalize_integer_selection(dim_selection, dim_length)).toThrowError();
	});
});

describe("BasicIndexer", () => {
	it("handles identical shape and chunk_shape", () => {
		let indexer = new BasicIndexer({
			selection: null,
			shape: [3, 4, 5],
			chunk_shape: [3, 4, 5],
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

	it("handles complete multi-dim chunking", () => {
		let indexer = new BasicIndexer({
			selection: null,
			shape: [3, 4, 5],
			chunk_shape: [1, 2, 5],
		});
		expect(Array.from(indexer)).toMatchInlineSnapshot(`
			[
			  {
			    "chunk_coords": [
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
			    "chunk_coords": [
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
			    "chunk_coords": [
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
			    "chunk_coords": [
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
			    "chunk_coords": [
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
			    "chunk_coords": [
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

	it("handles squeezed dimension", () => {
		let indexer = new BasicIndexer({
			selection: [null, 0],
			shape: [3, 4],
			chunk_shape: [1, 4],
		});
		expect(indexer.shape).toStrictEqual([3]);
		expect(Array.from(indexer)).toMatchInlineSnapshot(`
			[
			  {
			    "chunk_coords": [
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
			    "chunk_coords": [
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
			    "chunk_coords": [
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
