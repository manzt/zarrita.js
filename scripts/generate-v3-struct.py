# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "zarr>=3.4.0",
# ]
#
# [tool.uv]
# exclude-newer = "2026-10-01T00:00:00Z"
# ///

# Arrays with the `struct` data type, added to the fixtures that
# generate-v3.py writes. This needs a newer zarr-python than that script
# pins: the pinned one writes the earlier form, `structured`.

import shutil
import pathlib

import zarr
import zarr.codecs
import zarr.storage
import numpy as np

SELF_DIR = pathlib.Path(__file__).parent
ROOT = SELF_DIR / ".." / "fixtures" / "v3" / "data.zarr"

store = zarr.storage.LocalStore(ROOT)

record = np.dtype(
    [
        ("id", "<i4"),
        ("flag", "?"),
        ("value", "<f8"),
        ("big", "<i8"),
        ("label", "<U3"),
        ("tag", "S4"),
        ("point", [("x", "<f4"), ("y", "<f4")]),
    ]
)
records = np.array(
    [
        (1, True, 1.5, 2**40, "ab", b"xy", (1.0, 2.0)),
        (2, False, -2.5, -5, "cd\u00e9", b"wxyz", (3.0, 4.0)),
        (3, True, np.nan, 7, "", b"", (5.0, 6.0)),
    ],
    dtype=record,
)

# 1d.chunked.struct and 1d.chunked.struct.be
for name, endian in [("1d.chunked.struct", "little"), ("1d.chunked.struct.be", "big")]:
    shutil.rmtree(ROOT / name, ignore_errors=True)
    a = zarr.create_array(
        store,
        name=name,
        dtype=record,
        chunks=(2,),
        shape=(5,),
        serializer=zarr.codecs.BytesCodec(endian=endian),
        compressors=None,
    )
    # The last chunk is left unwritten, so that it reads as the fill value.
    a[:3] = records

# 2d.chunked.compressed.struct
shutil.rmtree(ROOT / "2d.chunked.compressed.struct", ignore_errors=True)
pair = np.dtype([("a", "<u2"), ("b", "<f4")])
a = zarr.create_array(
    store,
    name="2d.chunked.compressed.struct",
    dtype=pair,
    chunks=(2, 2),
    shape=(3, 4),
    fill_value=(7, np.nan),
    serializer=zarr.codecs.BytesCodec(endian="little"),
    compressors=[zarr.codecs.ZstdCodec()],
)
a[:2, :3] = np.array(
    [[(10 * i + j, i + j / 4) for j in range(3)] for i in range(2)], dtype=pair
)
