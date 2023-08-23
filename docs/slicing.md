# Slicing and indexing

Slicing and indexing are standard operations for those familiar with
multidimensional array data. In Zarr, these operations are applied over
"chunked" array storage, enabling users to efficiently access subsets of data,
even when the data size exceeds memory capacity.

While slicing and indexing are foundational concepts as in Zarr, they are
presented through a higher-level (optional) API in **zarrita**. This choice
caters to applications that might prefer direct interaction with chunks.

You can use either **@zarrita/indexing** or **@zarrita/ndarray** to conveniently
access specific data subsets without thinking about chunking details.

## How to slice

To slice a `zarr.Array`, you must define a _selection_ across each dimension of
your data. A dimension selection can be either:

- `null`: all elements of the dimension.
- `number`: a specific (integer) index within the dimension.
- `Slice`: a specific subset within a dimension.

Concretely, if you have an `zarr.Array` of shape `[512, 256, 3]` and want to
access 10 elements from the first dimension, all from the second, and the first
from the third (resulting in a 2D array shaped `[10, 256]`), you'd use:

```javascript
import { get, slice } from "@zarrita/indexing";
const region = await get(arr, [slice(10, 20), null, 0]);
```

::: info

The `slice` utility supports:

- `slice(end)`
- `slice(start, end)`
- `slice(start, end, step)`

Note that `slice(null)` and `null` are equivalent selections.

:::

To draw a parallel, this operation in Python would look like:

```python
region = arr[10:20, ..., 0]
```
