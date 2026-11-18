# Dual-Zone Block Architecture

**Status:** UX and architecture specification draft for review  
**Owner:** Jabr-UI  
**First implementation target:** Math worksheet block  
**Host foundation:** AFFiNE / BlockSuite

## 1. Purpose

Define a reusable block architecture that separates what the user authors from what Jabr derives and presents.

The two zones are:

1. **Authoring zone:** editable, user-authored content and preferences. This is durable document state.
2. **Derived zone:** calculated output, diagnostics, or a rendered preview. This is derived state and is not written into the authored Yjs document.

The zones are logically distinct even when a particular block layout places them side by side, stacks them, or combines them into a specialized presentation.

The first concrete implementation is the Math block's source/result row. This specification does not require every future block to use identical visual controls.

## 2. Architectural invariants

1. MathLive remains the sole mathematical input editor.
2. BlockSuite owns block lifecycle, selection, document structure, persistence, collaboration, and authored undo/redo.
3. Jabr-UI owns the visual block, focus routing, worksheet controller adapter, and transient result rendering.
4. Jabr Math owns parsing, AST, quantities, units, dimensional semantics, and evaluation.
5. Jabr Engine owns cross-block bindings, graph construction, scheduling, recalculation orchestration, and calculation-result lifecycle.
6. Kernel provides generic identity, revision, snapshot, result-store, graph, diagnostic, and span primitives through its public contract.
7. Authored source and user-selected display preferences are persisted. Calculated values and transient diagnostics are not persisted in Yjs.
8. The UI does not parse expressions, infer mathematical dependencies, or implement a local calculation engine.
9. A derived result is always associated with the exact authored source/input revision that produced it.
10. Undo/redo changes authored state; it does not rewind monotonic calculation revisions or restore stale derived results as current.

## 3. Logical block model

~~~text
WorksheetBlock
  identity
  flavour
  authored_state
    source / table data / diagram parameters
    display and presentation preferences
  derived_state (external to authored Yjs document)
    status
    result / rendered preview
    diagnostics
    input revision
    request identity
~~~

### 3.1 Authoring zone

The authoring zone contains only user-authored or user-selected state, such as:

- Mathematical source entered through MathLive.
- Preferred display unit.
- Explicit block settings.
- Table source data and authored cell text.
- Diagram parameters and authored geometry.

It must be serializable as part of the BlockSuite/Yjs document. Changes participate in normal document history and collaboration.

### 3.2 Derived zone

The derived zone displays outputs produced by Math, Table, Diagram, or Engine. Depending on block flavour, it may contain:

- Calculated mathematical result.
- Evaluation status.
- Structured diagnostics.
- Table-derived values.
- A rendered SVG/diagram preview.
- A stale/pending/error indicator.

It is a read-only presentation surface unless a block explicitly defines a separate authoring interaction for a domain object. It must not become an alternative editor for MathLive source.

Derived state lives in the Engine result lifecycle and a transient UI rendering cache. It is not stored as authored Yjs properties.

### 3.3 Do not force identical layouts

The invariant is separation of ownership and persistence, not a mandatory two-column layout for every block.

- Math: source zone and read-only result zone.
- Table: authored table structure/cell content remains distinct from any Engine-derived cell values or summaries.
- Diagram: authored diagram model/parameters remain distinct from the derived SVG rendering and calculated annotations.
- Text/code blocks may not need a derived zone at all.

A block flavour may use side-by-side zones, stacked zones, tabs, or an integrated view where appropriate, provided the authored/derived boundary remains explicit.

## 4. Math block: first concrete realization

### 4.1 Authored state

The initial Math block authored model includes:

| Field | Meaning | Persistence |
|---|---|---|
| block identity | Stable BlockSuite block ID | Yjs/document |
| \`latex\` | MathLive-authored structured mathematical source | Yjs/document |
| \`displayUnit\` | User's preferred result display unit | Yjs/document |
| presentation settings | Explicit user-selected block display options | Yjs/document |

Do not store evaluated values, pending status, diagnostics, request IDs, or source-revision counters as durable Yjs properties.

### 4.2 Derived state

The transient result store may contain:

| Field | Meaning |
|---|---|
| status | pending, success, error, unavailable, or stale |
| result | Structured Math result / renderer-ready representation |
| diagnostics | Structured diagnostics and source spans |
| source revision | Exact authored source revision evaluated |
| input revision | Engine snapshot/revision used for evaluation |
| request ID | Identity of the outstanding evaluation request |

The result zone renders this state but does not own its calculation semantics.

### 4.3 MathLive ownership

- MathLive is the only component that edits mathematical source.
- Preserve MathLive's structured placeholders, cursor movement, selection, and mathfield editing behavior.
- Do not add a second contenteditable mathematical editor.
- Do not parse or normalize mathematical source in the UI.
- The UI may retain the exact authored LaTeX/source representation and pass it to the Engine/Math adapter.
- The result zone is read-only. Copying a result may be supported, but editing the result must not mutate source.

### 4.4 Display-unit preference

The preferred display unit is authored state because it represents a user choice.

Changing it must not change the underlying physical value or the authored mathematical expression. The Engine/Math boundary may request a new formatting/conversion result without rebuilding unrelated worksheet dependencies.

If the requested display unit is dimensionally incompatible, preserve the preference and display a structured diagnostic rather than silently selecting another unit.

## 5. Evaluation request/response contract

The current UI prototype uses the following adapter shape:

~~~ts
type EvaluationRequest = {
  documentId: string;
  blockId: string;
  requestId: number;
  sourceRevision: number;
  latex: string;
  displayUnit: string;
};

type EvaluationResponse = {
  blockId: string;
  requestId: number;
  sourceRevision: number;
  status: 'success' | 'error' | 'unavailable';
  resultLatex?: string;
  diagnostic?: string;
};
~~~

This is a prototype adapter contract, not the final cross-repository wire protocol. The production Engine contract must carry the relevant Engine input/document revision and structured result/diagnostic DTOs. Full-width Rust revisions must cross JSON as decimal strings; do not rely on JavaScript number precision for u64 revisions.

### 5.1 Request identity

A response may update the derived zone only if all of the following match the latest request:

- Document identity.
- Block identity.
- Request identity.
- Authored source revision.
- Engine input/document revision.

A result for an older source or input revision is stale and must be discarded.

### 5.2 Request lifecycle

~~~text
idle/current
    |
source or relevant input changes
    v
invalidated
    |
evaluation requested
    v
pending
  /   |    \
 v    v     v
success error unavailable
  |
newer source/input revision
  v
stale -> invalidated -> pending
~~~

Rules:

- Source changes invalidate the old result immediately.
- A pending result is visibly distinct from a successful result.
- A failed evaluation displays diagnostics without replacing authored source.
- An unavailable evaluator is not a successful empty result.
- A late response cannot overwrite a newer result.
- Disposing a block/document cancels or ignores outstanding responses.
- A display-unit-only change requests a new presentation/conversion result when needed; it must not be treated as a change to the mathematical dependency graph unless the unit preference affects an explicitly defined calculation semantic.

## 6. Revision and undo/redo semantics

The current UI controller maintains local numeric source revisions as a prototype. This is not the final shared revision authority.

Target behavior:

- BlockSuite/Yjs owns authored history and undo/redo.
- Engine owns monotonic calculation/document revisions.
- Kernel supplies generic revision/snapshot primitives.
- A source edit, undo, or redo is observed as a new authored state and causes Engine to advance the relevant revision.
- Revisions never move backwards when the user undoes an edit.
- The UI rejects results associated with earlier source/input revisions.
- Derived results are recomputed; they are not restored from Yjs history.
- The transient UI result cache may be cleared on reload and repopulated by Engine evaluation.

The current conservative positional invalidation in the UI controller is temporary. It is not a dependency graph. Once Engine provides symbol-aware graph updates and revisioned result snapshots, the UI must stop invalidating later worksheet rows by position.

## 7. Focus, selection, and keyboard ownership

### 7.1 Ownership

| Interaction | Owner |
|---|---|
| Mathematical character input | MathLive |
| Math placeholders and cursor navigation | MathLive |
| Math source selection/copy/paste | MathLive |
| Outer block selection and movement | BlockSuite |
| Block insertion/deletion and document history | BlockSuite/Jabr-UI |
| Result display and diagnostic presentation | Jabr-UI |
| Calculation and dependency behavior | Jabr Engine / Math |

### 7.2 Focus rules

- A click in the authoring zone focuses MathLive.
- A click in the derived zone must not place a caret in mathematical source.
- Outer block selection remains available without stealing active MathLive text input.
- Pointer gestures inside an interactive diagram/table editor are handled by that editor only while its explicit edit mode is active; otherwise normal BlockSuite selection and movement remain available.
- Focus leaving the block returns keyboard ownership to BlockSuite/host navigation.

### 7.3 Keyboard rules

- Do not globally intercept keys that MathLive already owns while its field is focused.
- Block-level shortcuts are active only when focus is outside an active MathLive editing session or when MathLive explicitly delegates the event.
- Result-zone shortcuts must not insert or mutate mathematical source.
- Escape exits a nested block-edit mode before clearing outer selection, according to a documented precedence order.
- Exact shortcut assignments are maintained in the Jabr-UI keyboard map and must be tested for conflicts with MathLive and AFFiNE.

## 8. Layout and visual behavior

The default Math block layout is a coordinated source/result row on sufficiently wide screens:

- Authoring zone is visually identified as editable.
- Derived zone is visually identified as output/read-only.
- Both zones share a stable block identity and outer selection frame.
- Result width must accommodate ordinary equations without changing source layout.
- Long diagnostics wrap and remain associated with the originating source span.
- Pending/error/unavailable states must not cause large layout jumps.
- On narrow screens, the zones may stack while preserving their logical separation.
- Theme, typography, equation baseline, spacing, and selection states must align with the host AFFiNE/BlockSuite theme.

Exact dimensions and visual tokens belong to the UI design implementation and should be validated in the real host rather than frozen in this architecture document.

## 9. Persistence and collaboration

Persist in BlockSuite/Yjs:

- Block identity and flavour.
- Authored mathematical source.
- Display-unit preference.
- Explicit user-authored presentation settings.

Do not persist in Yjs:

- Calculated values.
- Evaluation status.
- Pending request metadata.
- Transient diagnostics.
- Derived SVG/render caches.
- Engine graph internals or dependency scheduling state.

On document reload, the UI restores authored state and requests or receives fresh derived results. Collaboration synchronizes authored changes; Engine determines the resulting recalculation lifecycle.

## 10. Extension to other block flavours

The dual-zone principle is reusable, but each engine owns its domain model.

### Table block

- Authored zone: table structure, stable row/column/cell identity, and authored cell text/data.
- Derived zone: Engine/Math-derived values, validation, summaries, or lookup results.
- Table owns structure and deterministic data operations; it does not parse Math expressions or own the worksheet graph.

### Diagram block

- Authored zone: renderer-independent figure model, geometry, constraints, and user-authored parameters.
- Derived zone: SVG/rendered preview and any calculated annotations.
- Diagram owns its figure model and geometry; Engine supplies calculation bindings where required.
- Rendered SVG is derived and must not replace the authored figure model.

A block may have an integrated editor/preview rather than literal source and result columns. The authored/derived ownership boundary remains mandatory.

## 11. Testing and acceptance criteria

### Unit/component tests

- Authored source updates increment the appropriate source revision.
- Display-unit preference persists independently of result state.
- Result zone is read-only.
- Result/diagnostic/request metadata never appears in serialized Yjs block properties.
- Pending, success, error, unavailable, and stale states render distinctly.
- Late and mismatched responses are rejected.
- Block deletion/disposal clears transient state and ignores late responses.
- Focus and keyboard events respect MathLive/BlockSuite ownership.

### Browser integration tests

- Real BlockSuite model updates trigger controller invalidation.
- Real Yjs UndoManager undo/redo changes authored source and invalidates derived state.
- Authored LaTeX survives IndexedDB save/reload.
- Transient result state resets on reload and can be recomputed.
- Result-zone rendering does not create an editable caret or alter source.
- Selection, copy/paste, pointer interaction, and keyboard shortcuts work in the actual AFFiNE/BlockSuite host.
- Responsive layout preserves both logical zones.

### Cross-engine tests

- A source revision is preserved through UI → Engine → Math → Engine → UI.
- Engine input revision is checked before result publication.
- Math diagnostics preserve UTF-8 byte spans; UI maps them to editor offsets.
- A display-unit change updates presentation without invalidating unrelated graph nodes.
- The same authored fixture produces the same normalized derived result in native and WASM paths.

## 12. Current implementation and known gaps

The Jabr-UI development plan records a working prototype with:

- MathLive structured placeholders and native cursor/placeholder navigation.
- Dual-zone source/result row and display-unit preference.
- WorksheetController with source-revision tracking, conservative ordered invalidation, and stale-response protection.
- Transient result store.
- Opt-in deterministic fixture adapter; it does not parse or calculate.
- Yjs UndoManager regression test using a model-like update event.

Known gaps:

- The real BlockSuite model-to-Yjs UndoManager browser bridge still requires validation.
- Result-zone read-only rendering and persistence behavior still require browser verification.
- The controller's positional invalidation is a temporary approximation.
- The production Engine graph and revisioned result contract are not yet connected.
- The prototype's numeric request/source revisions must be adapted to the final versioned cross-engine protocol.

Do not describe the mock evaluator as a calculation engine or mark browser validation complete without observed test evidence.

## 13. Explicit non-goals

- A second mathematical editor alongside MathLive.
- Parsing or evaluating mathematical expressions in Jabr-UI.
- A worksheet dependency graph or recalculation scheduler in Jabr-UI.
- Persisting calculated values or diagnostics as Yjs authored properties.
- Forcing every block flavour into the same two-column layout.
- Moving production BlockSuite block ownership into the Math, Table, or Diagram repositories.
- Requiring a private Yjs fork for ordinary AFFiNE integration.
