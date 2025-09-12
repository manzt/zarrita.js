cd fixtures

# Cleanup existing zip files
rm v2/data.zipped_from_within.zarr.zip
rm v2/data.zipped_from_parent.zarr.zip
rm v3/data.zipped_from_within.zarr.zip
rm v3/data.zipped_from_parent.zarr.zip

# Zip the data.zarr directories for v2 and v3.

# v2
cd v2/data.zarr && zip -r ../data.zipped_from_within.zarr.zip . && cd -
cd v2 && zip -r ./data.zipped_from_parent.zarr.zip ./data.zarr && cd -
# v3
cd v3/data.zarr && zip -r ../data.zipped_from_within.zarr.zip . && cd -
cd v3 && zip -r ./data.zipped_from_parent.zarr.zip ./data.zarr && cd -