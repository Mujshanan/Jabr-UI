# Jabr Rust Dependency Policy

**Policy version:** 1.0.0  
**Status:** Proposed baseline for repository adoption  
**Reviewed:** 2026-11-18  
**Owner:** Jabr architecture / engine maintainers  
**Scope:** Jabr-kernel, Jabr Math (currently Jabr-cli), Jabr Diagram (Jabr-draw / Jabr-diagram), Jabr Table (Jabr-table), and the Jabr-UI Rust/WASM/native integration boundary.

This is a dependency admission policy, not a request to add every listed crate. A crate marked *conditional* must not be added until its stated capability is part of an approved milestone. Package availability and published documentation were checked against the crates.io package entries on the review date; links below point to the canonical registry entries. Published API documentation and feature metadata were also inspected where available. Registry availability is not proof that a crate compiles for Jabr's exact target/feature matrix: target compilation and transitive-license checks remain mandatory before adoption.

## 1. Governing principles

1. **Keep Jabr-kernel nearly dependency-free.** Kernel dependencies are inherited by every engine and are therefore subject to the strictest admission test.
2. **Keep engine ownership separate.** Math, Diagram, and Table own their internal dependencies. One engine must not impose its implementation dependencies on another through the kernel.
3. **Treat browser WASM as a first-class target.** Any dependency compiled into a browser-facing engine must build for `wasm32-unknown-unknown` with the exact production feature set.
4. **Keep host integration at the edge.** CLI, REPL, Tauri, JavaScript bindings, and browser panic reporting belong in host/adapter crates, not in engine cores.
5. **Prefer explicit features.** Disable default features when they pull in multithreading, native system libraries, unnecessary serialization, or other capabilities not required by the target.
6. **Do not optimize speculatively.** Interning, specialized collections, parallel execution, arbitrary precision, and large data frameworks require a measured use case.
7. **Audit the complete dependency graph.** A permissively licensed direct crate can still pull in a transitive dependency with an unacceptable license or target requirement.
8. **Do not mistake a registry listing or docs.rs build for a Jabr build.** Native and WASM CI checks are required before adoption.

### Status meanings

- **Baseline / approved in principle:** suitable for the stated narrow role; still subject to version, license, feature, and target checks in the consuming repository.
- **Conditional:** use only when the named feature is implemented and the benefit is demonstrated.
- **Alternative:** choose one option after a small technical comparison; do not add both by default.
- **Reference only:** useful to study, but not a dependency for the current runtime model.
- **Hold / exclude:** do not add without an explicit architecture or licensing decision.

## 2. Repository ownership

| Repository / layer | Owns | Dependency rule |
|---|---|---|
| **Jabr-kernel** | Shared primitive types, stable IDs, source spans, normalized diagnostics, small common contracts, and (where approved) shared state primitives | Optional Serde only; no general-purpose utility stack |
| **Jabr Math** (`Jabr-cli` today) | Lexing, parsing, AST, evaluation, numeric semantics, runtime-defined units/dimensions, scopes, dependencies, math diagnostics and CLI workbench | Own parser, numeric and CLI dependencies |
| **Jabr Diagram** (`Jabr-draw` / `Jabr-diagram`) | Diagram document model, geometry, transforms, constraints, hit-test data, validation and export | Own geometry and export dependencies; browser renderer remains TypeScript unless measured otherwise |
| **Jabr Table** (`Jabr-table`) | Typed table model, stable row/column identity, cell references, ranges, lookup/aggregation and file interchange | Own table/file-format dependencies; no formula evaluator |
| **Jabr-UI** | AFFiNE/BlockSuite custom blocks, presentation, worksheet orchestration, document persistence/collaboration integration and TypeScript adapters | No engine implementation dependencies; consume versioned engine DTOs |
| **WASM adapter** | Rust↔JavaScript ABI, DTO conversion, generated TS declarations, browser-specific panic/reporting hooks | Separate crate/target layer; never a kernel dependency |
| **Native host / Tauri app** | Desktop shell, filesystem, native commands and lifecycle | Native-only application layer; never a dependency of browser engine cores |

The existing Jabr bridge contract remains authoritative for UI-facing DTOs, protocol versioning, request IDs, source/input revisions, diagnostics, and separation of authored document data from transient calculation state.

## 3. Jabr-kernel

### Admission policy

| Crate | Decision | Rule |
|---|---|---|
| [serde](https://crates.io/crates/serde) | **Baseline, optional** | Expose behind a non-default `serde` feature. Prefer `default-features = false`; enable `derive` only if kernel-owned types actually need derives. |
| [serde_json](https://crates.io/crates/serde_json) | **Dev-only** | Use for kernel tests/fixtures only. Do not make JSON a kernel runtime representation. |
| [thiserror](https://crates.io/crates/thiserror) | **Exclude from kernel** | Use manual error enums/implementations for small shared types. A consuming engine may adopt it if it materially reduces boilerplate. |
| [indexmap](https://crates.io/crates/indexmap) | **Exclude from kernel** | Ordered maps belong to the engine that needs them. Prefer `Vec` plus a lookup structure when that is sufficient. |
| [smallvec](https://crates.io/crates/smallvec) | **Exclude from kernel** | Add only to a consuming engine after profiling proves allocation pressure justifies it. |

The default kernel feature set must compile without third-party dependencies. The optional Serde feature must not be enabled implicitly by the default feature set.

Kernel diagnostics must remain renderer-neutral. Do not add `ariadne`, `codespan-reporting`, terminal styling, or browser APIs to represent or render a kernel `Diagnostic`.

## 4. Jabr Math

### 4.1 Lexing, parsing and diagnostics

| Crate | Decision | Intended use |
|---|---|---|
| [logos](https://crates.io/crates/logos) | **Preferred baseline** | Tokenization with explicit spans; pair with a handwritten Pratt parser. |
| [chumsky](https://crates.io/crates/chumsky) | **Alternative** | Consider if parser-combinator ergonomics/error recovery outweigh compile-time and tuning costs. Do not add alongside Logos without a demonstrated split in responsibility. |
| [ariadne](https://crates.io/crates/ariadne) | **CLI-only, conditional** | Human-readable terminal diagnostics. |
| [codespan-reporting](https://crates.io/crates/codespan-reporting) | **CLI-only alternative** | Choose instead of Ariadne if its file/span model fits better. |
| [thiserror](https://crates.io/crates/thiserror) | **Conditional, Math only** | Optional derive helper for Math-specific error types; never re-export its types through kernel contracts. |

The parser owns AST and source-span semantics. Kernel `Diagnostic` is the normalized boundary type. CLI formatting is an adapter; the browser UI renders structured diagnostics itself.

**Parser default:** `logos` + handwritten Pratt parser. Reconsider `chumsky` only against representative Jabr expressions, recovery behavior, compile time, and source-span requirements.

### 4.2 Numerics and linear algebra

| Crate | Decision | Intended use / constraint |
|---|---|---|
| [num-traits](https://crates.io/crates/num-traits) | **Conditional baseline for Math** | Numeric abstractions when generic algorithms need them. Supports `no_std` configurations; disable default `std` when appropriate. |
| [num-complex](https://crates.io/crates/num-complex) | **Conditional** | Add only when complex values are part of the supported language semantics. |
| [num-rational](https://crates.io/crates/num-rational) | **Conditional** | Exact rational values where required by the numeric model. |
| [num-bigint](https://crates.io/crates/num-bigint) | **Conditional** | Arbitrary-sized integer representation; not a substitute for rational arithmetic. |
| [nalgebra](https://crates.io/crates/nalgebra) | **Matrix/linear-algebra candidate** | Preferred candidate for matrix/vector operations if its API fits. Compile the selected features for WASM before adoption. |
| [ndarray](https://crates.io/crates/ndarray) | **Alternative to nalgebra** | Choose for array-oriented APIs/workloads. Do not add both without separate, concrete use cases. |
| [malachite](https://crates.io/crates/malachite) | **Hold / conditional** | Arbitrary precision only after precision requirements, license metadata, transitive dependencies, binary size and WASM builds are reviewed. |
| [dashu](https://crates.io/crates/dashu) | **Preferred arbitrary-precision candidate to evaluate** | Pure-Rust, `no_std`-oriented library set with MIT/Apache-2.0 licensing indicated by its documentation. Still requires a Jabr WASM compile and performance evaluation. |
| [rug](https://crates.io/crates/rug) | **Exclude from shared/WASM engine** | Uses GMP/MPFR/MPC through native FFI and is LGPL-3.0-or-later. Consider only for a separately packaged native tool after build and license review. |

**Version compatibility warning:** the reviewed `num-rational` 0.4 line declares an optional `num-bigint` 0.4 dependency, while the separately reviewed current `num-bigint` line is 0.5. Do not assume those versions interoperate. If Math needs `BigRational`, select a compatible `num-bigint` 0.4 release or verify a compatible newer `num-rational` release; prove the resolved graph with Cargo before committing the manifest.

Do not select arbitrary precision merely because it is available. First define the required exactness model (integer, rational, decimal, approximate floating point), serialization form, rounding rules, and supported operations.

### 4.3 Units and symbolic mathematics

| Crate | Decision | Rule |
|---|---|---|
| [uom](https://crates.io/crates/uom) | **Reference only** | Study its unit abstractions, but compile-time quantity types do not directly model user-defined units and dimensions parsed at runtime. |
| [dimensioned](https://crates.io/crates/dimensioned) | **Reference only** | Same limitation: compile-time dimensional typing is not the runtime dimension-vector model Math requires. |
| [symbolica](https://crates.io/crates/symbolica) | **Hold — licensing and architecture review** | The registry/docs entry points to separate licensing/support terms. Its published dependency graph includes components such as `rayon` and `libloading`; it is not an assumed permissive, minimal, browser-WASM CAS dependency. Obtain explicit license approval and target evidence before reconsideration. |

Math owns the runtime dimension-vector model, unit registry, conversion rules, and dimensional validation. Do not add `uom` or `dimensioned` as a shortcut for runtime-defined engineering units.

No external CAS is approved as a core dependency in this policy. Begin with the symbolic operations Jabr actually requires and evaluate a dedicated CAS only against a concrete feature and license requirement.

### 4.4 Internal performance helpers

| Crate | Decision | Rule |
|---|---|---|
| [rustc-hash](https://crates.io/crates/rustc-hash) | **Conditional** | Non-cryptographic fast hashing only after profiling. Never use it where adversarial collision resistance is required. |
| [lasso](https://crates.io/crates/lasso) | **Conditional** | String interning only after profiling allocation/lookup costs and selecting the single-threaded or threaded model intentionally. |

Neither crate belongs in Jabr-kernel by default.

### 4.5 CLI and REPL

| Crate | Decision | Rule |
|---|---|---|
| [clap](https://crates.io/crates/clap) | **CLI-only baseline** | Command-line argument parsing in the Math CLI binary. |
| [rustyline](https://crates.io/crates/rustyline) | **REPL alternative** | Native terminal input only. |
| [reedline](https://crates.io/crates/reedline) | **REPL alternative** | Native terminal input only. Choose one; neither may enter a WASM engine dependency graph. |

CLI and REPL dependencies must live in a binary/host crate or target-specific dependency section, not in the reusable Math library.

## 5. Jabr Diagram

### 5.1 Geometry and computational geometry

| Crate | Decision | Intended use / constraint |
|---|---|---|
| [kurbo](https://crates.io/crates/kurbo) | **Preferred geometry candidate** | 2D curves, paths and geometric primitives. It has its own transitive dependencies; keep them within Diagram. |
| [glam](https://crates.io/crates/glam) | **Conditional** | Vectors and transforms where its lightweight value types fit the model. |
| [nalgebra](https://crates.io/crates/nalgebra) | **Alternative** | Use instead of Glam if Diagram needs broader linear algebra and Math has already selected it for a compatible shared numeric contract. Do not couple the repos merely to share a crate. |
| [geo](https://crates.io/crates/geo) | **Conditional** | Computational geometry algorithms when the diagram model needs them. |
| [geo-types](https://crates.io/crates/geo-types) | **Conditional** | Use when interoperating with the Geo ecosystem; do not adopt solely for a few local structs. |
| [i_overlay](https://crates.io/crates/i_overlay) | **Conditional** | Polygon Boolean operations after required operations and version compatibility are established. |
| [rstar](https://crates.io/crates/rstar) | **Conditional** | Spatial index for hit-testing/snapping only when simple scans no longer meet measured performance targets. |
| [lyon](https://crates.io/crates/lyon) | **Defer** | Tessellation only if Jabr itself needs triangle meshes. Browser SVG/Canvas rendering does not require it by default. |

**Geo feature warning:** the reviewed `geo` 0.33 line enables `multithreading` by default, and that feature forwards multithreading into related dependencies. Disable default features and enable only the algorithms/features required by the browser target. Also check the selected `geo` release's `i_overlay` requirement: the reviewed Geo 0.33 manifest uses the 4.5.x line, whereas the current standalone `i_overlay` registry release is a newer major line. Do not add an incompatible direct version and accidentally compile two major versions.

### 5.2 SVG, CAD and text

| Crate | Decision | Intended use / constraint |
|---|---|---|
| [usvg](https://crates.io/crates/usvg) | **Conditional** | SVG parsing/normalization if importing or validating arbitrary SVG is required. |
| [resvg](https://crates.io/crates/resvg) | **Defer** | Rasterization only when a Rust raster output is actually required. |
| [tiny-skia](https://crates.io/crates/tiny-skia) | **Defer** | Raster backend paired with a demonstrated rasterization requirement. |
| [dxf](https://crates.io/crates/dxf) | **Conditional** | DXF import/export for engineering/CAD workflows after format coverage, maintenance, license, and target support are verified. |
| [ttf-parser](https://crates.io/crates/ttf-parser) | **Defer** | Font metrics/parsing only if Rust must measure text. |
| [rustybuzz](https://crates.io/crates/rustybuzz) | **Defer** | Text shaping only if Rust owns text layout. |

For initial SVG export, prefer a small deterministic writer over a full SVG rendering stack. The production renderer remains in TypeScript/SVG/Canvas inside Jabr-UI unless profiling or a native export requirement justifies Rust rendering.

Text measurement and browser font layout should remain in TypeScript by default. Add `ttf-parser`/ `rustybuzz` only if the Rust geometry/export engine must produce measured text layout independently of the browser.

## 6. Jabr Table

| Crate | Decision | Intended use / constraint |
|---|---|---|
| [calamine](https://crates.io/crates/calamine) | **Conditional baseline for import** | Reads XLSX, XLS and ODS. It is a reader; it does not provide XLSX writing. Verify browser-target compilation before using it in a WASM import path. |
| [rust_xlsxwriter](https://crates.io/crates/rust_xlsxwriter) | **Conditional baseline for XLSX export** | Writes XLSX. Its explicit `wasm` feature enables wasm/JavaScript compilation; opt into it only in the WASM adapter/export build. It is not an existing-workbook editing API. |
| [csv](https://crates.io/crates/csv) | **Baseline when CSV interchange is implemented** | CSV import/export; keep file parsing in Table rather than Kernel. |
| [indexmap](https://crates.io/crates/indexmap) | **Conditional** | Ordered columns only if the table model cannot meet its ordering contract with `Vec` plus lookup. |
| [smallvec](https://crates.io/crates/smallvec) | **Conditional** | Small cell/collection optimization only after profiling. |
| [compact_str](https://crates.io/crates/compact_str) | **Defer** | Small-string optimization only after memory profiling demonstrates a benefit over `String`. |
| [polars](https://crates.io/crates/polars) | **Defer / likely overkill initially** | Consider only for a real large-dataframe/analytics requirement with acceptable binary size and WASM support. |
| [arrow](https://crates.io/crates/arrow) | **Defer / likely overkill initially** | Consider only for an explicit columnar interchange or analytics requirement. |

Table owns the cell/data model, stable row and column identities, A1-style reference parsing, ranges, lookup and aggregation. Start with a small hand-written A1/range parser; do not add a regex dependency for this.

**Formula ownership:** Table does not implement a second formula language or evaluator. If cell formulas are introduced, their parsing/evaluation ownership must be explicitly assigned to Jabr Math and connected through a typed contract.

## 7. WASM, JavaScript and native boundary

| Crate | Decision | Intended use / constraint |
|---|---|---|
| [wasm-bindgen](https://crates.io/crates/wasm-bindgen) | **Adapter baseline** | Rust↔JavaScript ABI in a dedicated WASM adapter. |
| [serde-wasm-bindgen](https://crates.io/crates/serde-wasm-bindgen) | **Adapter baseline** | Convert Serde DTOs directly to/from JavaScript values. |
| [serde_json](https://crates.io/crates/serde_json) | **Conditional at boundary** | Use only when JSON text/files are actually part of the protocol. It is not required just to pass JS objects through serde-wasm-bindgen. |
| [tsify](https://crates.io/crates/tsify) | **Preferred TS type generator to evaluate** | If selected, configure `default-features = false, features = ["js"]`; its default `json` feature selects serde_json serialization. |
| [ts-rs](https://crates.io/crates/ts-rs) | **Alternative to tsify** | Consider for build-time TypeScript declaration generation. Select one generator and test generated output against the versioned bridge DTOs. |
| [console_error_panic_hook](https://crates.io/crates/console_error_panic_hook) | **Conditional, WASM-only** | Development diagnostics for browser panics; keep optional/target-specific and never treat panic text as a stable user diagnostic. |
| [tauri](https://crates.io/crates/tauri) | **Native host only** | Desktop application shell. Never add it to engine cores or the browser/WASM dependency set. |

Use versioned, JSON-compatible DTO shapes at the architectural boundary, but do not require JSON string serialization for every call. The browser adapter may use `serde-wasm-bindgen` to exchange ordinary JS objects. Preserve exact engineering values with canonical decimal/rational strings or explicitly tagged representations; do not rely on JavaScript `number` for arbitrary-precision values.

The adapter must isolate generated bindings from BlockSuite view components. UI code calls a TypeScript adapter; it does not call raw wasm-bindgen exports directly. Native and WASM adapters must implement the same engine-facing contract.

## 8. Testing, benchmarks and CI

| Crate/tool | Decision | Placement |
|---|---|---|
| [proptest](https://crates.io/crates/proptest) | **Approved test candidate** | Dev dependency for parser properties, round-trips, graph invariants and randomized model tests. |
| [insta](https://crates.io/crates/insta) | **Approved test candidate** | Dev dependency for diagnostics, AST, fixture and serialized-output snapshots. |
| [criterion](https://crates.io/crates/criterion) | **Approved benchmark candidate** | Benchmark-only dependency; do not pull into production builds. |
| [cargo-deny](https://crates.io/crates/cargo-deny) | **Approved CI tool** | CI tool for licenses, advisories, bans and source policy; not a runtime dependency. |
| [rayon](https://crates.io/crates/rayon) | **Avoid in shared/browser engine cores** | Do not enable by default. Browser parallelism requires explicit threading/Worker deployment support and cross-origin isolation considerations. |
| [getrandom](https://crates.io/crates/getrandom) | **Transitive dependency requiring target review** | Do not add directly unless the engine has a real randomness requirement. Configure the browser backend only at the application/adapter boundary when needed. |

Testing rules:

- Keep `proptest`, `insta`, and `criterion` in dev/benchmark dependency sections only.
- Do not make tests' random-number requirements leak into normal library builds.
- Test parsing and evaluation properties against deterministic seeds/fixtures where practical.
- Snapshot normalized diagnostics and stable serialized contracts, not nondeterministic memory addresses or transient request IDs.
- Benchmark only workloads that reflect actual worksheet, geometry, and table sizes.

## 9. WASM-specific rules

1. **Required target:** `wasm32-unknown-unknown` for every Rust engine that is shipped to the browser.
2. **Exact feature matrix:** CI must compile each engine with the same features used by the production WASM adapter. A default-feature-only check is insufficient.
3. **No host-only dependencies in engine cores:** CLI/REPL, Tauri, filesystem-only adapters, and native rendering must be isolated behind host crates or target-specific sections.
4. **No implicit parallelism:** do not enable Rayon or a dependency's multithreading feature by default. In particular, review `geo` defaults before enabling it.
5. **Randomness backend is version-specific:** the reviewed `getrandom` 0.4 documentation names the JavaScript backend feature `wasm_js`; older 0.2 releases used `js`. Never copy a feature name across major versions without checking that exact release. The `getrandom` documentation recommends against enabling the JS backend unconditionally in reusable libraries because it can break non-Web WASM targets and expands the dependency graph. Configure it in the top-level browser adapter/test target when required.
6. **Time is injected:** do not make core calculation semantics depend on `std::time::Instant::now()`. Inject a clock/timing abstraction or keep elapsed-time measurement in the host adapter; the `wasm32-unknown-unknown` target does not provide the same native timing facilities.
7. **No browser APIs in the kernel:** `wasm-bindgen`, `web-sys`, `js-sys`, Workers, DOM access, and panic hooks stay in the adapter layer.
8. **No JSON requirement by accident:** use serde-wasm-bindgen for JS values; enable serde_json only for explicit JSON text/file requirements.
9. **No unverified claims:** docs.rs target listings and crate feature declarations are useful evidence, not substitutes for compiling Jabr's actual target/feature graph.

## 10. License and supply-chain policy

- Every direct and transitive runtime dependency must have a reviewed SPDX license expression.
- The project must maintain a `deny.toml` policy and run `cargo deny check` in CI.
- Prefer permissive licenses compatible with the project's distribution model (typically MIT, Apache-2.0, BSD-family, or similarly approved licenses).
- Any LGPL, GPL, AGPL, SSPL, source-available, commercial, custom, or unclear license requires explicit review before adoption. Do not infer licensing from a crate's name or GitHub popularity.
- Review optional dependencies too: enabling a feature can materially change the license and target graph.
- Record accepted license exceptions with the exact crate/version, reason, affected binaries, obligations, and approver.
- Audit advisories, yanked versions, duplicate major versions, unmaintained packages, and unexpected registry/git sources.
- Re-run the audit when versions/features change and before a release.

Specific holds from this review:

- **`rug`:** LGPL-3.0-or-later plus GMP/MPFR/MPC native FFI/build requirements; excluded from the shared browser engine baseline.
- **`symbolica`:** registry documentation directs users to separate licensing/support terms; hold until those terms are reviewed and approved. Its current dependency graph is also unsuitable as an assumed minimal WASM dependency.
- **`malachite` and `dxf`:** do not treat their license/target status as cleared by this document; verify exact package metadata and transitive graph when a concrete feature requires them.

## 11. Initial dependency profile (not a Cargo manifest)

This is the intentionally small starting profile. It does not mean all crates must be added immediately.

| Component | Initial profile |
|---|---|
| Jabr-kernel | No mandatory third-party dependencies; optional Serde feature; `serde_json` dev-only |
| Jabr Math | `logos` + handwritten Pratt parser; add `num-traits` only when generic numeric abstractions are needed |
| Jabr Diagram | Begin with owned geometry types and a minimal geometry dependency set; evaluate `kurbo` and `glam` against actual model needs |
| Jabr Table | Owned table model and hand-written cell-reference parser; add `csv` when interchange is implemented |
| WASM adapter | `wasm-bindgen`, `serde-wasm-bindgen`; evaluate `tsify` with the `js` feature or `ts-rs` |
| CLI | `clap`; add one REPL crate only if a REPL milestone is approved |
| Tests/CI | `proptest`, `insta`, `criterion` as dev/benchmark dependencies; `cargo-deny` in CI |

## 12. Required checks before adding a dependency

For every proposed dependency:

1. Confirm the exact package, current release, maintenance state, Rust version requirement, features, license expression, and target support at its registry/source.
2. Inspect default features and the transitive dependency changes caused by the features being enabled.
3. Explain which Jabr-owned capability requires it and why the standard library or a smaller existing dependency is insufficient.
4. Add it to the owning engine/adapter only; do not route it through Jabr-kernel for convenience.
5. Run native checks and tests on the supported development platforms.
6. Run the production-feature WASM compile for `wasm32-unknown-unknown` when the crate is part of a browser engine.
7. Run `cargo tree -e features` and `cargo deny check`; review new licenses, advisories, duplicate versions, and target-specific dependencies.
8. Record the decision and rationale in the owning repository's dependency/architecture notes when the dependency is significant.

Suggested CI commands (run from the relevant Rust workspace):

```sh
cargo check --workspace
cargo test --workspace
cargo tree --workspace -e features
cargo deny check
rustup target add wasm32-unknown-unknown
cargo check --workspace --target wasm32-unknown-unknown
```

The WASM command must be adapted to the production feature set and the actual crate layout. If a workspace contains native-only CLI/Tauri packages, check the browser engine/adapter packages explicitly rather than forcing native hosts to compile for WASM.

## 13. Registry review index

Every candidate below has a direct crates.io package entry. The registry is the authority for published versions and package metadata; re-check it at the time of adoption because versions and feature graphs change.

### Kernel and Math

- [serde](https://crates.io/crates/serde) · [serde_json](https://crates.io/crates/serde_json) · [thiserror](https://crates.io/crates/thiserror) · [indexmap](https://crates.io/crates/indexmap) · [smallvec](https://crates.io/crates/smallvec)
- [logos](https://crates.io/crates/logos) · [chumsky](https://crates.io/crates/chumsky) · [ariadne](https://crates.io/crates/ariadne) · [codespan-reporting](https://crates.io/crates/codespan-reporting)
- [num-traits](https://crates.io/crates/num-traits) · [num-complex](https://crates.io/crates/num-complex) · [num-rational](https://crates.io/crates/num-rational) · [num-bigint](https://crates.io/crates/num-bigint)
- [nalgebra](https://crates.io/crates/nalgebra) · [ndarray](https://crates.io/crates/ndarray) · [malachite](https://crates.io/crates/malachite) · [dashu](https://crates.io/crates/dashu) · [rug](https://crates.io/crates/rug)
- [uom](https://crates.io/crates/uom) · [dimensioned](https://crates.io/crates/dimensioned) · [symbolica](https://crates.io/crates/symbolica) · [rustc-hash](https://crates.io/crates/rustc-hash) · [lasso](https://crates.io/crates/lasso)
- [clap](https://crates.io/crates/clap) · [rustyline](https://crates.io/crates/rustyline) · [reedline](https://crates.io/crates/reedline)

### Diagram and Table

- [kurbo](https://crates.io/crates/kurbo) · [glam](https://crates.io/crates/glam) · [geo](https://crates.io/crates/geo) · [geo-types](https://crates.io/crates/geo-types) · [i_overlay](https://crates.io/crates/i_overlay) · [rstar](https://crates.io/crates/rstar) · [lyon](https://crates.io/crates/lyon)
- [usvg](https://crates.io/crates/usvg) · [resvg](https://crates.io/crates/resvg) · [tiny-skia](https://crates.io/crates/tiny-skia) · [dxf](https://crates.io/crates/dxf) · [ttf-parser](https://crates.io/crates/ttf-parser) · [rustybuzz](https://crates.io/crates/rustybuzz)
- [calamine](https://crates.io/crates/calamine) · [rust_xlsxwriter](https://crates.io/crates/rust_xlsxwriter) · [csv](https://crates.io/crates/csv) · [compact_str](https://crates.io/crates/compact_str) · [polars](https://crates.io/crates/polars) · [arrow](https://crates.io/crates/arrow)

### UI boundary, testing and CI

- [wasm-bindgen](https://crates.io/crates/wasm-bindgen) · [serde-wasm-bindgen](https://crates.io/crates/serde-wasm-bindgen) · [tsify](https://crates.io/crates/tsify) · [ts-rs](https://crates.io/crates/ts-rs) · [console_error_panic_hook](https://crates.io/crates/console_error_panic_hook) · [tauri](https://crates.io/crates/tauri)
- [proptest](https://crates.io/crates/proptest) · [insta](https://crates.io/crates/insta) · [criterion](https://crates.io/crates/criterion) · [cargo-deny](https://crates.io/crates/cargo-deny) · [rayon](https://crates.io/crates/rayon) · [getrandom](https://crates.io/crates/getrandom)

## 14. Change control

This policy is versioned independently of Cargo package versions.

- **MAJOR:** changes to dependency ownership, kernel admission rules, license policy, or WASM boundary requirements.
- **MINOR:** a new approved/conditional dependency, a new capability category, or a materially changed target/feature rule.
- **PATCH:** clarifications, corrected links, wording, or non-substantive metadata refreshes.

Any change from *conditional* or *hold* to *baseline* must include a concrete Jabr use case, exact feature selection, license review, native/WASM validation evidence where applicable, and maintainer approval.

### Changelog

- **1.0.0 — 2026-11-18:** Initial project-wide policy. Establishes the minimal kernel rule, per-engine dependency ownership, conditional crate catalog, WASM feature requirements, licensing gates, and adoption checklist.
