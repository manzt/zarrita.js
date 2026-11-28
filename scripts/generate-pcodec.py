# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "zarr==3.4.1",
#     "numcodecs==0.17.0",
#     "pcodec==1.1.0",
#     "numpy==2.5.4",
# ]
# ///
"""Fixtures for the pcodec codec: fixtures/v3/pcodec.zarr and fixtures/v2/pcodec.zarr.

Every pcodec array `<name>` has an uncompressed twin `<name>.expected` holding the same values,
so the tests compare what zarrita decodes with what zarr-python wrote.
"""

import pathlib
import shutil

import numcodecs
import numpy as np
import zarr
import zarr.codecs
import zarr.storage
from zarr.codecs.numcodecs import PCodec

SELF_DIR = pathlib.Path(__file__).parent
V3 = SELF_DIR / ".." / "fixtures" / "v3" / "pcodec.zarr"
V2 = SELF_DIR / ".." / "fixtures" / "v2" / "pcodec.zarr"

rng = np.random.default_rng(20261127)


def signal(n_time, n_chan, dtype):
    """smooth per-channel traces plus noise: what pcodec's delta encoding is for"""
    t = np.arange(n_time)[:, None]
    x = 300 * np.sin(2 * np.pi * t / 97 + np.arange(n_chan)) + rng.normal(0, 20, (n_time, n_chan))
    if np.dtype(dtype).kind == "u":
        x = x + 1000
    return x.astype(dtype)


def pair(store, name, data, chunks, zarr_format=3, **kw):
    a = zarr.create_array(store, name=name, shape=data.shape, dtype=data.dtype, chunks=chunks,
                          zarr_format=zarr_format, **kw)
    a[...] = data
    e = zarr.create_array(store, name=name + ".expected", shape=data.shape, dtype=data.dtype,
                          chunks=data.shape, zarr_format=zarr_format, compressors=None)
    e[...] = data


# ---- v3
shutil.rmtree(V3, ignore_errors=True)
store = zarr.storage.LocalStore(V3)
zarr.create_group(store)

# every data type numcodecs.PCodec accepts, 1-d, chunked with a partial last chunk
for dtype in ["int16", "uint16", "int32", "uint32", "int64", "uint64", "float16", "float32", "float64"]:
    data = signal(1000, 1, dtype)[:, 0]
    pair(store, f"1d.{dtype}", data, chunks=(300,), serializer=PCodec(level=8), compressors=None)

# (time, channel) int16 with a transpose to channel-major in front of pcodec, partial chunks on both axes
pair(store, "2d.transposed.int16", signal(1000, 6, "int16"), chunks=(256, 4),
     filters=[zarr.codecs.TransposeCodec(order=(1, 0))], serializer=PCodec(level=8), compressors=None)

# per-channel inner chunks inside shards
pair(store, "2d.sharded.int16", signal(1000, 6, "int16"), chunks=(250, 1), shards=(500, 6),
     serializer=PCodec(level=8), compressors=None)

# non-default configurations
pair(store, "1d.int32.lookback.level12", signal(1000, 1, "int32")[:, 0], chunks=(1000,),
     serializer=PCodec(level=12, delta_spec="try_lookback"), compressors=None)
pair(store, "1d.float64.classic.nodelta", signal(1000, 1, "float64")[:, 0], chunks=(1000,),
     serializer=PCodec(level=3, mode_spec="classic", delta_spec="no_op"), compressors=None)

# pcodec followed by a bytes-to-bytes codec
pair(store, "1d.int16.then.zstd", signal(1000, 1, "int16")[:, 0], chunks=(400,),
     serializer=PCodec(level=8), compressors=[zarr.codecs.ZstdCodec(level=1)])

# ---- v2 (pcodec as the compressor)
shutil.rmtree(V2, ignore_errors=True)
store = zarr.storage.LocalStore(V2)
zarr.create_group(store, zarr_format=2)
for dtype in ["int16", "float64"]:
    pair(store, f"1d.{dtype}", signal(1000, 1, dtype)[:, 0], chunks=(300,), zarr_format=2,
         compressors=numcodecs.PCodec(level=8))
pair(store, "2d.int16", signal(1000, 6, "int16"), chunks=(256, 4), zarr_format=2,
     compressors=numcodecs.PCodec(level=8))

print("wrote", V3.resolve(), "and", V2.resolve())
