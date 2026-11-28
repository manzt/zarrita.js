//! pcodec's standalone format (what numcodecs.PCodec writes) as a small WebAssembly module.
//!
//! The interface is plain C ABI, so the JavaScript side needs no generated glue:
//!   alloc(n) / dealloc(ptr, n)     memory for inputs
//!   decompress(dtype, ptr, n)      -> 0 on success, -1 on error
//!   compress(dtype, level, delta, delta_order, mode, max_page_n, ptr, n) -> 0 / -1
//!   result_ptr() / result_len()    the output bytes (or the UTF-8 error message after -1)
//!   free_result()                  release the output
//!
//! dtype codes: 0 u8, 1 i8, 2 u16, 3 i16, 4 u32, 5 i32, 6 u64, 7 i64, 8 f16, 9 f32, 10 f64
//! delta codes: 0 auto, 1 no_op, 2 try_consecutive(delta_order), 3 try_lookback
//! mode codes:  0 auto, 1 classic

use std::alloc::{alloc as std_alloc, dealloc as std_dealloc, Layout};
use std::cell::RefCell;

use half::f16;
use pco::standalone::{simple_compress, simple_decompress};
use pco::{ChunkConfig, DeltaSpec, ModeSpec, PagingSpec};

const ALIGN: usize = 8;

thread_local! {
  static RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn set_result(bytes: Vec<u8>) {
  RESULT.with(|r| *r.borrow_mut() = bytes);
}

fn fail(msg: String) -> i32 {
  set_result(msg.into_bytes());
  -1
}

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
  if len == 0 {
    return ALIGN as *mut u8;
  }
  unsafe { std_alloc(Layout::from_size_align_unchecked(len, ALIGN)) }
}

#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
  if len != 0 {
    std_dealloc(ptr, Layout::from_size_align_unchecked(len, ALIGN));
  }
}

#[no_mangle]
pub extern "C" fn result_ptr() -> *const u8 {
  RESULT.with(|r| r.borrow().as_ptr())
}

#[no_mangle]
pub extern "C" fn result_len() -> usize {
  RESULT.with(|r| r.borrow().len())
}

#[no_mangle]
pub extern "C" fn free_result() {
  set_result(Vec::new());
}

fn to_bytes<T: Copy>(v: Vec<T>) -> Vec<u8> {
  let n = v.len() * std::mem::size_of::<T>();
  let mut out = vec![0u8; n];
  unsafe { std::ptr::copy_nonoverlapping(v.as_ptr() as *const u8, out.as_mut_ptr(), n) };
  out
}

fn decode<T: pco::data_types::Number>(src: &[u8]) -> i32 {
  match simple_decompress::<T>(src) {
    Ok(v) => {
      set_result(to_bytes(v));
      0
    }
    Err(e) => fail(format!("pcodec decompress: {e}")),
  }
}

#[no_mangle]
pub unsafe extern "C" fn decompress(dtype: u32, ptr: *const u8, len: usize) -> i32 {
  let src = std::slice::from_raw_parts(ptr, len);
  match dtype {
    0 => decode::<u8>(src),
    1 => decode::<i8>(src),
    2 => decode::<u16>(src),
    3 => decode::<i16>(src),
    4 => decode::<u32>(src),
    5 => decode::<i32>(src),
    6 => decode::<u64>(src),
    7 => decode::<i64>(src),
    8 => decode::<f16>(src),
    9 => decode::<f32>(src),
    10 => decode::<f64>(src),
    _ => fail(format!("pcodec: unsupported dtype code {dtype}")),
  }
}

fn encode<T: pco::data_types::Number>(ptr: *const u8, len: usize, config: &ChunkConfig) -> i32 {
  let size = std::mem::size_of::<T>();
  if len % size != 0 {
    return fail(format!("pcodec compress: {len} bytes is not a whole number of {size}-byte values"));
  }
  // the JavaScript side copies the input into memory from alloc(), aligned to 8 bytes
  let src = unsafe { std::slice::from_raw_parts(ptr as *const T, len / size) };
  match simple_compress(src, config) {
    Ok(v) => {
      set_result(v);
      0
    }
    Err(e) => fail(format!("pcodec compress: {e}")),
  }
}

#[no_mangle]
pub unsafe extern "C" fn compress(
  dtype: u32,
  level: u32,
  delta: u32,
  delta_order: u32,
  mode: u32,
  max_page_n: u32,
  ptr: *const u8,
  len: usize,
) -> i32 {
  let delta_spec = match delta {
    0 => DeltaSpec::Auto,
    1 => DeltaSpec::NoOp,
    2 => DeltaSpec::TryConsecutive(delta_order as usize),
    3 => DeltaSpec::TryLookback,
    _ => return fail(format!("pcodec: unsupported delta code {delta}")),
  };
  let mode_spec = match mode {
    0 => ModeSpec::Auto,
    1 => ModeSpec::Classic,
    _ => return fail(format!("pcodec: unsupported mode code {mode}")),
  };
  let config = ChunkConfig::default()
    .with_compression_level(level as usize)
    .with_delta_spec(delta_spec)
    .with_mode_spec(mode_spec)
    .with_paging_spec(PagingSpec::EqualPagesUpTo(max_page_n as usize))
    .with_enable_8_bit(matches!(dtype, 0 | 1));
  match dtype {
    0 => encode::<u8>(ptr, len, &config),
    1 => encode::<i8>(ptr, len, &config),
    2 => encode::<u16>(ptr, len, &config),
    3 => encode::<i16>(ptr, len, &config),
    4 => encode::<u32>(ptr, len, &config),
    5 => encode::<i32>(ptr, len, &config),
    6 => encode::<u64>(ptr, len, &config),
    7 => encode::<i64>(ptr, len, &config),
    8 => encode::<f16>(ptr, len, &config),
    9 => encode::<f32>(ptr, len, &config),
    10 => encode::<f64>(ptr, len, &config),
    _ => fail(format!("pcodec: unsupported dtype code {dtype}")),
  }
}
