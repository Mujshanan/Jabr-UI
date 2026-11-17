# Jabr Mathcad-Style Worksheet — Development Plan

## Purpose and ownership

Jabr-UI is the BlockSuite/MathLive worksheet presentation and orchestration layer. Jabr-CLI owns parsing, symbols, dependency tracking, quantities, units, dimensional analysis, and calculation. MathLive remains the sole mathematical input editor. BlockSuite/Yjs owns document structure, persistence, collaboration, and undo/redo.

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

- No calculation engine in Jabr-UI.
- No local expression parsing or unit interpretation.
- No private Yjs fork for ordinary AFFiNE integration.
- No merge until browser verification and all agreed worksheet interactions are complete.
