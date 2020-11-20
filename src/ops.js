// private utitlites to fill strided output array
export function set(out, out_selection, value, value_selection) {
  if (typeof value === 'number') {
    return set_scalar(out, out_selection, value);
  }
  return set_from_chunk(out, out_selection, value, value_selection);
}

function indices_len(start, stop, step) {
  if (step < 0 && stop < start) return Math.floor((start - stop - 1) / (-step) + 1);
  if (start < stop) return Math.floor((stop - start - 1) / step) + 1;
  return 0;
}

function set_scalar(out, out_selection, value) {
  const [slice, ...slices] = out_selection;
  const [stride, ...strides] = out.strides;
  const [out_len, ...shape] = out.shape;
  const [from, to, step] = slice.indices(out_len);
  const len = indices_len(from, to, step);
  if (slices.length === 1) {
    if (step === 1 && stride === 1) {
      out.data.fill(value, from, from + len);
    } else {
      for (let i = 0; i < len; i++) {
        out.data[stride * (from + (step * i))] = value;
      }
    }
    return;
  }
  for (let i = 0; i < len; i++) {
    const data = out.data.subarray(stride * (from + (step * i)));
    set_scalar({ data, strides, shape }, slices, value);
  }
}

function set_from_chunk(out, out_selection, chunk, chunk_selection) {
  if (chunk_selection.length === 0) {
    // Case when last chunk dim is squeezed
    out.data.set(chunk.data.subarray(0, out.data.length));
    return;
  }
  // Get current indicies and strides for both destination and source arrays
  const [out_slice, ...out_slices] = out_selection;
  const [chunk_slice, ...chunk_slices] = chunk_selection;

  const [chunk_stride, ...chunk_strides] = chunk.strides;
  const [chunk_len, ...chunk_shape] = chunk.shape;

  // This source dimension is squeezed
  if (typeof chunk_slice === 'number') {
    /*
    Sets dimension offset for squeezed dimension.
    Ex. if 0th dimension is squeezed to 2nd index (numpy : arr[2,i])
        sourceArr[stride[0]* 2 + i] --> sourceArr.subarray(stride[0] * 2)[i] (sourceArr[i] in next call)
    Thus, subsequent squeezed dims are appended to the source offset.
    */
    // Don't update destination offset/slices, just source
    const chunk_view = {
      data: chunk.data.subarray(chunk_stride * chunk_slice),
      shape: chunk_shape, 
      strides: chunk_strides,
    };
    set_from_chunk(out, out_selection, chunk_view, chunk_slices);
    return;
  }

  const [out_stride, ...out_strides] = out.strides;
  const [out_len, ...out_shape] = out.shape;

  const [from, to, step] = out_slice.indices(out_len); // only need len of out slice since chunk subset
  const [cfrom, _to, cstep] = chunk_slice.indices(chunk_len); // eslint-disable-line no-unused-vars

  const len = indices_len(from, to, step);
  if (out_slices.length === 0 && chunk_slices.length === 0) {
    if (step === 1 && out_stride === 1 && cstep === 1 && chunk_stride === 1) {
      out.data.set(chunk.data.subarray(cfrom, cfrom + len), from);
    } else {
      for (let i = 0; i < len; i++) {
        out.data[out_stride * (from + (step * i))] = chunk.data[chunk_stride * (cfrom + (cstep * i))];
      }
    }
    return;
  }
  for (let i = 0; i < len; i++) {
    const out_view = {
      data: out.data.subarray(out_stride * (from + (i * step))),
      shape: out_shape,
      strides: out_strides,
    };
    const chunk_view = {
      data: chunk.data.subarray(chunk_stride * (cfrom + (i * cstep))),
      shape: chunk_shape,
      strides: chunk_strides,
    };
    set_from_chunk(out_view, out_slices, chunk_view, chunk_slices);
  }
}