# Jabr Mathcad-Style Worksheet — Development Plan

> **Architecture baseline (2026-11-18):** Jabr-UI owns the complete worksheet UI and authored BlockSuite/Yjs document. MathLive remains the sole mathematical input editor. Jabr Math owns parsing, AST, values, quantities, units, dimensional rules and expression evaluation. Jabr-engine (planned; repository not yet created) owns worksheet node mapping, dependency graph construction, bindings, recalculation scheduling and calculation-result lifecycle. Kernel provides generic NodeId/Port, Revision, Snapshot<T>, ResultStore<V>, graph, diagnostic and span primitives. Table owns table structure, stable identities and typed values. A dedicated authored formula-source contract remains pending; Math parses expressions.

> The current UI WorksheetController uses conservative positional invalidation as a prototype because the Engine graph is not connected. Keep it only as a temporary adapter behavior. Once Engine is available, UI must consume revisioned Engine snapshots/updates and stop inferring dependencies from worksheet position. The UI result store remains a transient rendering cache, not the calculation source of truth. BlockSuite/Yjs continues to own authored document history and undo/redo; calculation results are never persisted there.

## Purpose and ownership

Jabr-UI is the BlockSuite/MathLive worksheet presentation and host-integration layer. Jabr Math owns parsing, AST, language-level symbols, expression dependencies, quantities, units, dimensional analysis and calculation. Jabr-engine owns cross-block worksheet bindings, graph construction, scheduling and recalculation. MathLive remains the sole mathematical input editor. BlockSuite/Yjs owns document structure, persistence, collaboration, and undo/redo.

Computed results and diagnostics are transient UI state, never Yjs block properties. The future AFFiNE integration should adapt Jabr's worksheet model to the host's BlockSuite document model; it should not require a private Yjs fork.

## Current implementation

- MathLive structured placeholders and native cursor/placeholder navigation.
- Dual-zone source/result row and display-unit preference.
- Worksheet controller with source-revision tracking, ordered invalidation, and stale-response protection.
- Transient result store.
- Opt-in deterministic mock evaluator using exact source fixtures only. It does not parse or calculate.
- Chromium E2E coverage for the real BlockSuite model/Yjs UndoManager bridge, read-only result rendering, Yjs persistence isolation, authored LaTeX and `displayUnit` persistence, reload hydration, and lazy MathLive inspector refresh behavior.
- Evaluation is initiated explicitly with the block's Evaluate action; `=` remains ordinary authored mathematical input.
- MathLive key handling ignores IME composition and Alt/Ctrl/Meta-modified input; external model-to-field synchronization is guarded against feedback writes.

## Milestone 4 — Worksheet controller and mock evaluation

1. [x] Subscribe to math model `propsUpdated` and worksheet `childrenUpdated`.
2. [x] Invalidate edited and later math blocks conservatively.
3. [x] Keep results and request metadata outside Yjs.
4. [x] Reject stale and mismatched responses.
5. [x] Provide an opt-in, deterministic fixture adapter; unknown source is an explicit mock error.
6. [x] Test pending, success, error, unavailable, and stale-response states.
7. [x] Exercise actual Yjs UndoManager undo/redo and verify that model update events invalidate the controller state.
8. [x] Verify the real BlockSuite model-to-Yjs UndoManager bridge in Chromium; undo/redo advances source revisions and invalidates derived output.
9. [x] Verify read-only result rendering, exclusion of derived state from Yjs, and authored LaTeX persistence across IndexedDB reload.

## Validation checklist

Run and record:

- `pnpm test:controller`
- `pnpm test:e2e`
- `pnpm typecheck`
- `pnpm build`
- Chromium E2E: enable mock evaluator, click the explicit Evaluate action on the default sample, update the actual BlockSuite model, then call the real `doc.undo()`/`doc.redo()` history methods and verify controller revisions and result invalidation.
- Chromium E2E: confirm result-zone output is read-only and result/diagnostic state is absent from the persisted Yjs block.
- Chromium E2E: confirm MathLive-authored LaTeX and `displayUnit` survive IndexedDB reload while transient result state resets; wait independently for BlockSuite model hydration and MathLive field synchronization.
- Chromium E2E: verify `displayUnit` is authored Yjs state and follows undo/redo, while result and diagnostic fields remain transient.
- Chromium E2E: verify inspector prompt values remain unchanged while collapsed after source edits and refresh when expanded; assert no prompt reads occur during the collapsed edit.
- Chromium E2E: verify `/` inserts a native MathLive fraction, toolbar insertion covers square roots, indexed roots, integrals and 2×2 matrices, and repeated templates never reuse prompt IDs.
- Chromium E2E: verify the MathLive inspector reads prompt data only while expanded.

## Explicit non-goals

- No calculation engine, worksheet dependency graph, or recalculation scheduler in Jabr-UI.
- No local expression parsing or unit interpretation.
- No private Yjs fork for ordinary AFFiNE integration.
- Do not begin the evaluation-contract/controller follow-up until the MathLive editor interactions and the browser validation checklist pass.
