import shutil

import zarrita
import numpy as np

shutil.rmtree("data.zarr", ignore_errors=True)

store = zarrita.LocalStore("data.zarr")
zarrita.Group.create(store)

# 1d.contiguous.gzip.i2
a = zarrita.Array.create(
    store / "1d.contiguous.gzip.i2",
    dtype="int16",
    shape=(4,),
    chunk_shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.gzip_codec(),
    ],
)
a[:] = [1, 2, 3, 4]

# 1d.contiguous.blosc.i2
a = zarrita.Array.create(
    store / "1d.contiguous.blosc.i2",
    dtype="int16",
    shape=(4,),
    chunk_shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [1, 2, 3, 4]

# 1d.contiguous.raw.i2
a = zarrita.Array.create(
    store / "1d.contiguous.raw.i2",
    dtype="int16",
    shape=(4,),
    chunk_shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
    ],
)
a[:] = [1, 2, 3, 4]


# 1d.contiguous.i4
a = zarrita.Array.create(
    store / "1d.contiguous.i4",
    dtype="int32",
    chunk_shape=(4,),
    shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [1, 2, 3, 4]


# 1d.contiguous.u1
a = zarrita.Array.create(
    store / "1d.contiguous.u1",
    dtype="uint8",
    chunk_shape=(4,),
    shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [255, 0, 255, 0]


# 1d.contiguous.<f4
a = zarrita.Array.create(
    store / "1d.contiguous.f4.le",
    dtype="float32",
    chunk_shape=(4,),
    shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [-1000.5, 0, 1000.5, 0]

# 1d.contiguous.>f4
a = zarrita.Array.create(
    store / "1d.contiguous.f4.be",
    dtype="float32",
    chunk_shape=(4,),
    shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(endian="big"),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [-1000.5, 0, 1000.5, 0]

# 1d.contiguous.f8
a = zarrita.Array.create(
    store / "1d.contiguous.f8",
    dtype="float64",
    chunk_shape=(4,),
    shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [1.5, 2.5, 3.5, 4.5]


# 1d.contiguous.b1
a = zarrita.Array.create(
    store / "1d.contiguous.b1",
    dtype="bool",
    chunk_shape=(4,),
    shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [True, False, True, False]


# 1d.chunked.i2
a = zarrita.Array.create(
    store / "1d.chunked.i2",
    dtype="int16",
    chunk_shape=(2,),
    shape=(4,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [1, 2, 3, 4]

# 1d.chunked.ragged.i2
a = zarrita.Array.create(
    store / "1d.chunked.ragged.i2",
    dtype="int16",
    chunk_shape=(2,),
    shape=(5,),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [1, 2, 3, 4, 5]

# 2d.contiguous.i2
a = zarrita.Array.create(
    store / "2d.contiguous.i2",
    dtype="int16",
    chunk_shape=(2, 2),
    shape=(2, 2),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [[1, 2], [3, 4]]

# 2d.chunked.i2
a = zarrita.Array.create(
    store / "2d.chunked.i2",
    dtype="int16",
    chunk_shape=(1, 1),
    shape=(2, 2),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [[1, 2], [3, 4]]

# 2d.chunked.ragged.i2
a = zarrita.Array.create(
    store / "2d.chunked.ragged.i2",
    dtype="int16",
    chunk_shape=(2, 2),
    shape=(3, 3),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

# 3d.contiguous.i2
a = zarrita.Array.create(
    store / "3d.contiguous.i2",
    dtype="int16",
    chunk_shape=(3, 3, 3),
    shape=(3, 3, 3),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = np.arange(27).reshape(3, 3, 3)

# 3d.chunked.i2
a = zarrita.Array.create(
    store / "3d.chunked.i2",
    dtype="int16",
    chunk_shape=(1, 1, 1),
    shape=(3, 3, 3),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = np.arange(27).reshape(3, 3, 3)

# 3d.chunked.mixed.i2.C
a = zarrita.Array.create(
    store / "3d.chunked.mixed.i2.C",
    dtype="int16",
    chunk_shape=(3, 3, 1),
    shape=(3, 3, 3),
    codecs=[
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = np.arange(27).reshape(3, 3, 3)

# 3d.chunked.mixed.i2.F
a = zarrita.Array.create(
    store / "3d.chunked.mixed.i2.F",
    dtype="int16",
    chunk_shape=(3, 3, 1),
    shape=(3, 3, 3),
    codecs=[
        zarrita.codecs.transpose_codec(order="F"),
        zarrita.codecs.endian_codec(),
        zarrita.codecs.blosc_codec(typesize=4),
    ],
)
a[:] = np.arange(27).reshape(3, 3, 3)
