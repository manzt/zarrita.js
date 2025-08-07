# /// script
# requires-python = ">=3.13"
# dependencies = ["zarr==3.1.1"]
#
# [tool.uv]
# exclude-newer = "2025-08-06T10:57:26.55032-05:00"
# ///

import shutil
import pathlib
import json

import zarr
import zarr.codecs
import zarr.storage
import numpy as np

SELF_DIR = pathlib.Path(__file__).parent
ROOT = SELF_DIR / ".." / "fixtures" / "v3" / "data.zarr"

np.random.seed(42)

shutil.rmtree(ROOT, ignore_errors=True)

store = zarr.storage.LocalStore(ROOT)
zarr.create_group(store)

# 1d.contiguous.gzip.i2
a = zarr.create_array(
    store,
    name="1d.contiguous.gzip.i2",
    dtype="int16",
    shape=(4,),
    chunks=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = [1, 2, 3, 4]

# 1d.contiguous.blosc.i2
a = zarr.create_array(
    store,
    name="1d.contiguous.blosc.i2",
    dtype="int16",
    shape=(4,),
    chunks=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [1, 2, 3, 4]

# 1d.contiguous.raw.i2
a = zarr.create_array(
    store,
    name="1d.contiguous.raw.i2",
    dtype="int16",
    shape=(4,),
    chunks=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=None,
)
a[:] = [1, 2, 3, 4]


# 1d.contiguous.i4
a = zarr.create_array(
    store,
    name="1d.contiguous.i4",
    dtype="int32",
    chunks=(4,),
    shape=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [1, 2, 3, 4]


# 1d.contiguous.u1
a = zarr.create_array(
    store,
    name="1d.contiguous.u1",
    dtype="uint8",
    chunks=(4,),
    shape=(4,),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [255, 0, 255, 0]

# 1d.contiguous.<f2
a = zarr.create_array(
    store,
    name="1d.contiguous.f2.le",
    dtype="float16",
    chunks=(4,),
    shape=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[
        zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle"),
    ],
)
a[:] = [-1000.5, 0, 1000.5, 0]

# 1d.contiguous.<f4
a = zarr.create_array(
    store,
    name="1d.contiguous.f4.le",
    dtype="float32",
    chunks=(4,),
    shape=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [-1000.5, 0, 1000.5, 0]

# 1d.contiguous.>f4
a = zarr.create_array(
    store,
    name="1d.contiguous.f4.be",
    dtype="float32",
    chunks=(4,),
    shape=(4,),
    serializer=zarr.codecs.BytesCodec(endian="big"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [-1000.5, 0, 1000.5, 0]

# 1d.contiguous.f8
a = zarr.create_array(
    store,
    name="1d.contiguous.f8",
    dtype="float64",
    chunks=(4,),
    shape=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [1.5, 2.5, 3.5, 4.5]


# 1d.contiguous.b1
a = zarr.create_array(
    store,
    name="1d.contiguous.b1",
    dtype="bool",
    chunks=(4,),
    shape=(4,),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [True, False, True, False]


# 1d.chunked.i2
a = zarr.create_array(
    store,
    name="1d.chunked.i2",
    dtype="int16",
    chunks=(2,),
    shape=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [1, 2, 3, 4]


# Just to have an edge case where dimension_names is 'null' in our snapshots
with open(ROOT / "1d.chunked.i2/zarr.json", "r") as f:
    meta = json.load(f)
    meta["dimension_names"] = None

    with open(ROOT / "1d.chunked.i2/zarr.json", "w") as f:
        json.dump(meta, f)

# 1d.chunked.ragged.i2
a = zarr.create_array(
    store,
    name="1d.chunked.ragged.i2",
    dtype="int16",
    chunks=(2,),
    shape=(5,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [1, 2, 3, 4, 5]

# 2d.contiguous.i2
a = zarr.create_array(
    store,
    name="2d.contiguous.i2",
    dtype="int16",
    chunks=(2, 2),
    shape=(2, 2),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [[1, 2], [3, 4]]

# 2d.chunked.i2
a = zarr.create_array(
    store,
    name="2d.chunked.i2",
    dtype="int16",
    chunks=(1, 1),
    shape=(2, 2),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [[1, 2], [3, 4]]

# 2d.chunked.ragged.i2
a = zarr.create_array(
    store,
    name="2d.chunked.ragged.i2",
    dtype="int16",
    chunks=(2, 2),
    shape=(3, 3),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

# 3d.contiguous.i2
a = zarr.create_array(
    store,
    name="3d.contiguous.i2",
    dtype="int16",
    chunks=(3, 3, 3),
    shape=(3, 3, 3),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = np.arange(27).reshape(3, 3, 3)

# 3d.chunked.i2
a = zarr.create_array(
    store,
    name="3d.chunked.i2",
    dtype="int16",
    chunks=(1, 1, 1),
    shape=(3, 3, 3),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = np.arange(27).reshape(3, 3, 3)

# 3d.chunked.mixed.i2.C
a = zarr.create_array(
    store,
    name="3d.chunked.mixed.i2.C",
    dtype="int16",
    chunks=(3, 3, 1),
    shape=(3, 3, 3),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = np.arange(27).reshape(3, 3, 3)

# 3d.chunked.mixed.i2.F
a = zarr.create_array(
    store,
    name="3d.chunked.mixed.i2.F",
    dtype="int16",
    chunks=(3, 3, 1),
    shape=(3, 3, 3),
    filters=[
        zarr.codecs.TransposeCodec(order=[2, 1, 0])  # column major
    ],
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.BloscCodec(typesize=4, shuffle="noshuffle")],
)
a[:] = np.arange(27).reshape(3, 3, 3)

#####

# 1d.contiguous.compressed.sharded.i2
data = np.array([1, 2, 3, 4], dtype="i2")
a = zarr.create_array(
    store,
    name="1d.contiguous.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(4,),
    shards=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data

# 1d.contiguous.compressed.sharded.i4
data = np.array([1, 2, 3, 4], dtype="i4")
a = zarr.create_array(
    store,
    name="1d.contiguous.compressed.sharded.i4",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(4,),
    shards=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data

# 1d.contiguous.compressed.sharded.u1
data = np.array([255, 0, 255, 0], dtype="u1")
a = zarr.create_array(
    store,
    name="1d.contiguous.compressed.sharded.u1",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(4,),
    shards=(4,),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data


# 1d.contiguous.compressed.sharded.<f4
data = np.array([-1000.5, 0, 1000.5, 0], dtype="f4")
a = zarr.create_array(
    store,
    name="1d.contiguous.compressed.sharded.f4",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(4,),
    shards=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data

# 1d.contiguous.compressed.sharded.f8
data = np.array([1.5, 2.5, 3.5, 4.5], dtype="f8")
a = zarr.create_array(
    store,
    name="1d.contiguous.compressed.sharded.f8",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(4,),
    shards=(4,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data


# 1d.contiguous.compressed.sharded.b1
data = np.array([True, False, True, False], dtype="b1")
a = zarr.create_array(
    store,
    name="1d.contiguous.compressed.sharded.b1",
    shape=data.shape,
    dtype="bool",
    chunks=(4,),
    shards=(4,),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data

# 1d.chunked.compressed.sharded.i2
data = np.array([1, 2, 3, 4], dtype="i2")
a = zarr.create_array(
    store,
    name="1d.chunked.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(1,),
    shards=(2,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data

# 1d.chunked.filled.compressed.sharded.i2
data = np.array([1, 2, 0, 0], dtype="i2")
a = zarr.create_array(
    store,
    name="1d.chunked.filled.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(1,),
    shards=(2,),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:] = data

# 1d.chunked.ragged.compressed.sharded.i2 (TypeError: 'int' object is not iterable)
# data = np.array([1, 2, 3, 4, 5], dtype="i2")
# a = zarr.create_array(
#     store,
#     name="1d.chunked.ragged.compressed.sharded.i2",
#     shape=data.shape,
#     dtype=data.dtype,
#     shards=(2,),
#     chunks=(1,),
#     compressors=[zarr.codecs.BloscCodec(typesize=data.dtype.itemsize, cname="gzip")],
# )
# a[:] = data

# 2d.contiguous.compressed.sharded.i2
data = np.arange(1, 5, dtype="i2").reshape(2, 2)
a = zarr.create_array(
    store,
    name="2d.contiguous.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(2, 2),
    shards=(2, 2),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:, :] = data

# 2d.chunked.compressed.sharded.filled.i2
data = np.arange(16, dtype="i2").reshape(4, 4)
a = zarr.create_array(
    store,
    name="2d.chunked.compressed.sharded.filled.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(1, 1),
    shards=(2, 2),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:, :] = data

# 2d.chunked.compressed.sharded.i2
data = np.arange(16, dtype="i2").reshape(4, 4) + 1
a = zarr.create_array(
    store,
    name="2d.chunked.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(1, 1),
    shards=(2, 2),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:, :] = data

# 2d.chunked.ragged.compressed.sharded.i2
data = np.arange(1, 10, dtype="i2").reshape(3, 3)
a = zarr.create_array(
    store,
    name="2d.chunked.ragged.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(1, 1),
    shards=(2, 2),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:, :] = data


# 3d.contiguous.compressed.sharded.i2
data = np.arange(27, dtype="i2").reshape(3, 3, 3)
a = zarr.create_array(
    store,
    name="3d.contiguous.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(3, 3, 3),
    shards=(3, 3, 3),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:, :, :] = data

# 3d.chunked.compressed.sharded.i2
data = np.arange(64, dtype="i2").reshape(4, 4, 4)
a = zarr.create_array(
    store,
    name="3d.chunked.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(1, 1, 1),
    shards=(2, 2, 2),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:, :, :] = data

# 3d.chunked.mixed.compressed.sharded.i2
data = np.arange(27, dtype="i2").reshape(3, 3, 3)
a = zarr.create_array(
    store,
    name="3d.chunked.mixed.compressed.sharded.i2",
    shape=data.shape,
    dtype=data.dtype,
    chunks=(3, 3, 1),
    shards=(3, 3, 3),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.GzipCodec()],
)
a[:, :, :] = data
