# Jabr Mathcad-Style Worksheet — Development Plan

> **Architecture baseline (2026-11-18):** Jabr-UI owns the complete worksheet UI and authored BlockSuite/Yjs document. MathLive remains the sole mathematical input editor. Jabr Math owns mathematical parsing, AST, values, quantities, units, dimensional rules and individual expression evaluation. The planned Jabr Engine owns the sequential worksheet interpreter, execution order, variable environment, assignment lifecycle, scopes/control flow, revisions, execution generations, immutable snapshots and result lifecycle. V1 executes top to bottom, prohibits forward references, uses a fresh environment per run and reruns from the top after authored changes. Kernel provides generic infrastructure only; its graph primitives are not the V1 worksheet scheduler. Table owns table structure, stable identities and typed values.

> The current UI WorksheetController uses ordered invalidation as a prototype adapter, not as the production execution engine. The production V1 Engine executes the full worksheet from the top in document order using a fresh environment. The UI result store remains a transient rendering cache, not the calculation source of truth. BlockSuite/Yjs continues to own authored document history and undo/redo; calculation results are never persisted there.

## Purpose and ownership

Jabr-UI is the BlockSuite/MathLive worksheet presentation and host-integration layer. Jabr Math owns mathematical parsing, AST, symbols, quantities, units, dimensional analysis and individual expression evaluation. Jabr-engine owns sequential worksheet interpretation, execution order, variable bindings, assignment updates, scope/control flow, snapshots and recalculation. MathLive remains the sole mathematical input editor. BlockSuite/Yjs owns document structure, persistence, collaboration, and undo/redo.

Computed results and diagnostics are transient UI state, never Yjs block properties. The future AFFiNE integration should adapt Jabr's worksheet model to the host's BlockSuite document model; it should not require a private Yjs fork.

## Current implementation

- MathLive structured placeholders and native cursor/placeholder navigation.
- Dual-zone source/result row and display-unit preference.
- Worksheet controller with source-revision tracking, ordered invalidation, and stale-response protection.
- Transient result store.
- Opt-in deterministic mock evaluator using exact source fixtures only. It does not parse or calculate.
- Real Yjs UndoManager regression test bridged through a model-like propsUpdated event.

## Milestone 4 — Worksheet controller and mock evaluation

1. [x] Subscribe to math model `propsUpdated` and worksheet `childrenUpdated`.
2. [x] Invalidate edited and later math blocks conservatively.
3. [x] Keep results and request metadata outside Yjs.
4. [x] Reject stale and mismatched responses.
5. [x] Provide an opt-in, deterministic fixture adapter; unknown source is an explicit mock error.
6. [x] Test pending, success, error, unavailable, and stale-response states.
7. [x] Exercise actual Yjs UndoManager undo/redo and verify that model update events invalidate the controller state.
8. [ ] Verify the real BlockSuite model-to-Yjs UndoManager bridge in a browser session.
9. [ ] Verify result-zone rendering and editing/persistence behavior in a browser.

## Validation checklist

Run and record:

- `pnpm test:controller`
- `pnpm typecheck`
- `pnpm build`
- Chromium E2E: enable mock evaluator, press `=` on the default sample, update the actual BlockSuite model, then call the real `doc.undo()`/`doc.redo()` history methods and verify controller revisions and result invalidation.
- Chromium E2E: confirm result-zone output is read-only and result/diagnostic state is absent from the persisted Yjs block.
- Chromium E2E: confirm authored LaTeX survives IndexedDB reload while transient result state resets.

## Explicit non-goals

- No calculation engine, worksheet interpreter, variable environment or recalculation scheduler in Jabr-UI.
- No local expression parsing or unit interpretation.
- No private Yjs fork for ordinary AFFiNE integration.
- No merge until browser verification and all agreed worksheet interactions are complete.


## Revised ecosystem roadmap and specification gate

This section is the cross-repository product roadmap. Repository-local milestones remain responsible for their own implementation and validation details.

### M0 — Repository and architecture audit

- Confirm actual repository names and ownership boundaries.
- Preserve independent builds and tests.
- Record current implementation versus planned capabilities.
- Audit the Kernel public API implementation against the accepted `jabr-kernel-api` contract target.
- Confirm the separate Jabr Engine orchestration subsystem is planned and does not yet have a repository.

### M0.5 — Specification and contract freeze (mandatory gate)

Complete and review all three specifications before starting M1:

1. [Math–Kernel Integration Specification](https://github.com/Mujshanan/Jabr-kernel/blob/docs/math-kernel-integration-spec/docs/specs/math-kernel-integration-spec.md)
2. [Jabr Unit System Specification](https://github.com/Mujshanan/Jabr-math/blob/docs/unit-system-spec/docs/specs/jabr-unit-system-spec.md)
3. [Dual-Zone Block Architecture](docs/specs/dual-zone-block-architecture.md)

Also freeze:

- Generic JSON Envelope v1, diagnostic taxonomy and source-span conventions for the Kernel contract.
- Math-owned expression-analysis/evaluation DTOs and the Engine adapter contract, with no worksheet dependency-request protocol.
- Engine-owned sequential execution contract: source revisions, execution generations, variable environment, assignment semantics, per-block outcomes, immutable snapshots, result cache and stale-result policy; these are explicitly outside Kernel.
- Draw figure schema v1, owned by Jabr Diagram.
- Canonical cross-repository smoke fixture contract.
- Provisional performance targets and benchmark methodology.

**Accepted baseline (2026-11-19):** the user approved all three specifications as the M0.5 baseline. Preserve the dedicated `jabr-kernel-api` public-contract crate direction; Kernel implementation internals remain private. Under Architecture A, Kernel freezes only generic identity/port, graph, span, diagnostic and envelope contracts; the Engine lifecycle contract is a separate Engine-owned deliverable.

### M1 — Document Model and Persistent Identity (JABR-ARCH-CE-001)

This is the M1 milestone of the approved Calculation Engine Block Taxonomy. It is a cross-cutting document-model milestone owned primarily by Jabr-UI, not the separate Math repository's M1 label below.

- Define the versioned authored document schema and supported block discriminants.
- Preserve stable block IDs and declaration IDs independently of display names and array positions.
- Model the seven calculation categories; keep heading/text informational blocks separate.
- Define stable Table row/column/cell identities and Matrix entry identities.
- Define Logic lexical-scope/branch identities and Func parameter/declaration identities without implementing their execution semantics.
- Model ColumnLayoutBlock as composition only, with rows top-to-bottom and cells left-to-right within each row.
- Validate identity uniqueness, table references, matrix dimensions, schema versions and layout order.
- Keep authored source and preferences in BlockSuite/Yjs; reject derived results and execution metadata from authored serialization.
- Add round-trip, migration-boundary, identity-preservation and row-major reading-order tests.

Implementation: [Jabr Authored Document Model v1](docs/specs/jabr-authored-document-model-v1.md). The initial model contract and validation functions are implemented; live BlockSuite adapter and browser persistence/undo-redo verification remain exit requirements.

### Math repository M1 — Math foundation

- Stabilize the Math facade and AST/value contracts.
- Implement the unit system through U0–U7 as defined by its specification.
- Add parser, quantity, dimensional, and native/WASM parity fixtures.
- Keep worksheet interpretation and sequential execution in Jabr Engine; generic Kernel graph APIs are not used as the V1 worksheet scheduler.

### M2 — Table engine, split into independently verifiable increments

| Increment | Scope | Exit evidence |
|---|---|---|
| M2a | Table model, stable identities, typed data and validation | Model/serialization tests |
| M2b | Matrix and vector primitives/conversion | Numerical fixtures and dimension checks |
| M2c | Lookup and aggregation operations | Exact-match and edge-case tests |
| M2d | Excel/XLSX interoperability evaluation and import/export scope | Compatibility fixtures; explicitly not a full Excel clone |

Reuse already implemented table capabilities; do not rebuild them merely to match milestone labels. CSV/TSV/JSON/XML support and existing lookup/matrix work must be audited before adding scope.

### M3 — Diagram engine with an early host-validation spike

- **D0:** renderer-independent figure schema v1, owned by Jabr Diagram.
- **D1:** coordinate model and SVG renderer.
- **D1.5:** immediately after D1, integrate one rectangle into the existing BlockSuite/AFFiNE development host; verify render, resize, persist, reload, and selection.
- **D2:** free-body diagrams.
- **D3:** shear-force and bending-moment diagrams.
- **D4:** structural cross-sections.
- **D5:** Math/Engine data bindings.
- **D6:** production BlockSuite Page/Edgeless adapters in Jabr-UI.

Preserve the existing square Gfx prototype. The D1.5 spike validates the model/host boundary before advanced figure types are developed; it does not move production block ownership out of Jabr-UI.

### M4 — Jabr-UI worksheet foundation

- Complete the worksheet controller against the versioned Engine contract.
- Implement the reviewed dual-zone block architecture.
- Keep MathLive as the sole mathematical input editor.
- Keep authored state in BlockSuite/Yjs and derived results outside Yjs.
- Validate focus, keyboard ownership, undo/redo, stale-result rejection, and browser persistence.

### M5 — Unified integration

- Integrate Math, Table, and Diagram blocks through stable adapters.
- Validate cross-block references and recalculation in one document.
- Run the canonical smoke fixture through the full stack.

### M6 — Persistence and lifecycle

- Validate save/reopen, revisions, snapshots, undo/redo, and derived-result regeneration.
- Verify compatibility and recovery behavior across schema versions.

### M7 — Jabr Studio

- Complete the unified engineering worksheet experience.
- Validate real engineering workflows, reliability, performance, and release readiness.

## Provisional performance targets

These are initial acceptance targets, not measured claims. Record hardware, OS, dataset, warm/cold state, and p50/p95 latency before treating them as release gates.

| Workload | Provisional target |
|---|---:|
| Recalculate a representative 100-statement worksheet from the top | < 100 ms |
| Scroll a 10,000-row table | 60 FPS |
| Render a 50-element SVG figure | < 50 ms |
| Save a 1 MB worksheet document | < 500 ms |
| Reopen a 1 MB worksheet document | < 500 ms |

Benchmark computation separately from rendering and persistence. Use representative sequential worksheet programs and realistic table/figure fixtures.

## Canonical cross-repository smoke fixture

Target fixture: `tests/fixtures/jabr-smoke.json` in the unified Jabr-UI integration test suite.

It must include:

- A Math expression with variables and a unit-bearing result.
- A Table with authored cells and a matrix/vector view.
- A Diagram figure with at least one parameter bound to a calculated value.
- Sequential variable assignments and references to earlier definitions, with explicit expected outputs.
- Schema versions and expected diagnostics.

Required regression: serialize → deserialize → evaluate/recalculate → compare normalized values, units, diagnostics, and figure geometry. Each engine should test its own fixture section independently; Jabr-UI runs the complete round trip.

## Specification and implementation authorization

The three M0.5 specifications have been accepted as the architecture baseline. This M1 implementation is scoped to the authored document model in Jabr-UI. It does not authorize Kernel source changes, API-crate implementation/extraction, unrelated repository migrations, or merging any existing pull request.
