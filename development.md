# Jabr Mathcad-Style Worksheet — Development Plan

> **Architecture baseline (2026-11-18):** Jabr-UI owns the complete worksheet UI and authored BlockSuite/Yjs document. MathLive remains the sole mathematical input editor. Jabr Math owns parsing, AST, values, quantities, units, dimensional rules and expression evaluation. Jabr-engine (planned; repository not yet created) owns worksheet node mapping, dependency graph construction, bindings, recalculation scheduling and calculation-result lifecycle. Kernel provides generic NodeId/Port, Revision, Snapshot<T>, ResultStore<V>, graph, diagnostic and span primitives. Table owns table structure, stable identities and typed values. A dedicated authored formula-source contract remains pending; Math parses expressions.

> The current WorksheetController delegates invalidation and evaluation to a replaceable CalculationProvider. The standalone LocalOrderedCalculationProvider uses conservative positional invalidation only as a prototype because the Engine graph is not connected. Keep that provider temporary; Engine will replace it with graph-aware invalidation and scheduling without changing BlockSuite views. Once Engine is available, UI must consume revisioned Engine snapshots/updates and stop inferring dependencies from worksheet position. The UI result store remains a transient rendering cache, not the calculation source of truth. BlockSuite/Yjs continues to own authored document history and undo/redo; calculation results are never persisted there.

## Purpose and ownership

Jabr-UI is the BlockSuite/MathLive worksheet presentation and host-integration layer. Jabr Math owns parsing, AST, language-level symbols, expression dependencies, quantities, units, dimensional analysis and calculation. Jabr-engine owns cross-block worksheet bindings, graph construction, scheduling and recalculation. MathLive remains the sole mathematical input editor. BlockSuite/Yjs owns document structure, persistence, collaboration, and undo/redo.

Computed results and diagnostics are transient UI state, never Yjs block properties. The future AFFiNE integration should adapt Jabr's worksheet model to the host's BlockSuite document model; it should not require a private Yjs fork.

## Current implementation

- MathLive structured placeholders and native cursor/placeholder navigation.
- Dual-zone source/result row and display-unit preference.
- Worksheet controller delegating to a replaceable CalculationProvider; the local provider supplies source revisions and temporary ordered invalidation. The versioned Engine bridge client validates Kernel envelopes and drops stale responses.
- Transient result store.
- Opt-in deterministic mock Engine transport through the real versioned bridge client. It exercises protocol/revision/diagnostic handling only; it does not parse or calculate.
- Real Yjs UndoManager regression test bridged through a model-like propsUpdated event.

## Milestone 4 — Worksheet controller, CalculationProvider, and mock Engine bridge

1. [x] Subscribe to BlockSuite store updates for authored math source and worksheet structure.
2. [x] Isolate temporary ordered invalidation in LocalOrderedCalculationProvider behind CalculationProvider.
3. [x] Keep results and request metadata outside Yjs.
4. [x] Validate protocol/envelope/correlation fields and discard stale or mismatched responses.
5. [x] Provide an opt-in, deterministic fixture adapter; unknown source is an explicit mock error.
6. [x] Test pending, success, error, unavailable, and stale-response states.
7. [x] Exercise actual Yjs UndoManager undo/redo and verify that model update events invalidate the controller state.
8. [ ] Verify the real BlockSuite model-to-Yjs UndoManager bridge in a browser session.
9. [ ] Verify result-zone rendering and editing/persistence behavior in a browser.

## Validation checklist

Run and record:

- `pnpm test:controller`
- `pnpm test:bridge`
- `pnpm typecheck`
- `pnpm build`
- Chromium E2E: enable mock evaluator, press `=` on the default sample, update the actual BlockSuite model, then call the real `doc.undo()`/`doc.redo()` history methods and verify controller revisions and result invalidation.
- Chromium E2E: confirm result-zone output is read-only and result/diagnostic state is absent from the persisted Yjs block.
- Chromium E2E: confirm authored LaTeX survives IndexedDB reload while transient result state resets.

## Explicit non-goals

- No calculation engine, worksheet dependency graph, or recalculation scheduler in Jabr-UI.
- No local expression parsing or unit interpretation.
- No private Yjs fork for ordinary AFFiNE integration.
- No merge until browser verification and all agreed worksheet interactions are complete.
