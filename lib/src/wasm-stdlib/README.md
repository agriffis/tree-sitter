# Tree-sitter Wasm standard library

Wasm language modules are compiled without a C standard library. Their
external scanners may import the functions listed in `imports.txt`, and the
environment loading the language must provide those functions.

This directory contains a shared implementation of that standard-library
subset:

- `libc/` contains sources vendored from the `wasi-libc` revision used by the
  repository's pinned WASI SDK.
- `external_scanner_allocator.c` is the resettable allocator used for isolated
  Wasm language modules.
- `external_scanner_stdlib.h` is a generated Wasm module containing the
  libc functions listed in `imports.txt` and the resettable allocator.

When the Tree-sitter Rust library is compiled for `wasm32-unknown-unknown`, the
same vendored libc sources are linked directly into the application. `stdio.c`
provides the additional internal functions needed by the Tree-sitter core;
these functions are not part of the external-scanner API. Allocation is
provided by Rust's application-selected global allocator.

To refresh the vendored sources and regenerate the embedded module, run:

```sh
cargo xtask vendor-wasm-stdlib
cargo xtask build-wasm-stdlib
```
