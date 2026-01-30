cd fixtures

# Cleanup existing zip files
rm -f v2/data.zipped_from_within.zarr.zip
rm -f v2/data.zipped_from_parent.zarr.zip
rm -f v3/data.zipped_from_within.zarr.zip
rm -f v3/data.zipped_from_parent.zarr.zip
rm -f v3/data.uncompressed.zarr.zip

# Zip the data.zarr directories for v2 and v3.

# v2
cd v2/data.zarr && zip -r ../data.zipped_from_within.zarr.zip . && cd -
cd v2 && zip -r ./data.zipped_from_parent.zarr.zip ./data.zarr && cd -
# v3
cd v3/data.zarr && zip -r ../data.zipped_from_within.zarr.zip . && cd -
cd v3 && zip -r ./data.zipped_from_parent.zarr.zip ./data.zarr && cd -
# v3 uncompressed (for testing ZipFileStore with sharding)
cd v3/data.zarr && zip -0 -r ../data.uncompressed.zarr.zip . && cd -