# Dual-Zone Block Architecture

**Status:** M0 UX/architecture draft — revised for Architecture A  
**Owner:** Jabr-UI  
**First implementation target:** Math worksheet block  
**Host:** AFFiNE / BlockSuite / Yjs  
**Target contract:** `dual-zone-v1`  
**Freeze rule:** Proposal until reviewed and explicitly accepted.

## 1. Purpose

Separate what the user authors from what Jabr derives and presents:

1. **Authoring zone:** editable, user-authored content and preferences; durable document state.
2. **Derived zone:** calculated output, diagnostics or rendered preview; derived state associated with the exact authored inputs that produced it.

The zones are logically distinct even when displayed side-by-side, stacked or integrated into a specialized editor/preview. The first implementation target is the Math block source/result row.

## 2. Architecture A — normative ownership

| Responsibility | Owner |
|---|---|
| Block structure, identity, authored persistence, collaboration and authored undo/redo | BlockSuite / Yjs through Jabr-UI |
| Product UI, focus routing, visual block behavior and transient rendering cache | Jabr-UI |
| Mathematical editing and LaTeX serialization | MathLive |
| Parsing, AST, symbols, references, values, quantities, units, dimensional rules and evaluation | Jabr Math |
| Worksheet node mapping, authored/derived calculation records, revisions, fingerprints, result cache, calculation snapshots, dirty policy, scheduling and recalculation | Planned Jabr Engine |
| Generic NodeId/Port, graph primitives/algorithms, spans, diagnostic envelope and generic versioned envelope | `jabr-kernel-api`, implemented by `jabr-kernel` |
| Table structure, stable row/column/cell identity and typed data | Jabr Table |
| Figure model, geometry and SVG rendering | Jabr Diagram |

Kernel does **not** own variable/cell state, document or node revisions, snapshots/history, result storage/cache or recalculation triggers. Engine owns worksheet calculation lifecycle. UI owns authored document persistence/history through BlockSuite/Yjs.

### 2.1 Data flow

```text
BlockSuite/Yjs authored document
       |
       v
Jabr-UI (authoring + presentation)
       | source + block identity
       v
Jabr Engine (worksheet state, graph mapping, revisions,
             scheduling and result lifecycle)
       |                         |
       v                         v
Kernel generic graph/API       Jabr Math
                                |
                         value + diagnostics
       <-------------------------+
       |
       v
Jabr-UI transient derived presentation
```

Engine uses Kernel graph primitives but owns graph contents and worksheet scheduling. Math receives explicit owned evaluation inputs, not direct access to Kernel state or implementation.

## 3. Core invariants

1. MathLive remains the sole mathematical input editor.
2. BlockSuite owns authored block structure, document identity, persistence, collaboration and authored undo/redo.
3. Jabr-UI owns product UI, block presentation, focus routing and transient rendering.
4. Jabr Math owns mathematical semantics and evaluation.
5. Jabr Engine owns worksheet calculation records, revisions, dependency mapping, scheduling and result lifecycle.
6. Kernel remains generic infrastructure only.
7. Authored source and user-selected display preferences are persisted in the authored document.
8. Calculated values, statuses, diagnostics, request IDs and derived render caches are not persisted as authored Yjs block properties.
9. UI does not parse expressions, infer mathematical dependencies or implement a local calculation engine.
10. Every derived result is associated with the exact source/input identity that produced it.
11. Recalculation never overwrites authored source.
12. Undo/redo restores authored content; Engine observes the new input state and recalculates. Revisions do not rewind.
13. Late responses cannot replace results for newer inputs.
14. A display preference change is not automatically a mathematical dependency change.

## 4. Logical block model

```text
WorksheetBlock (BlockSuite/Yjs authored model)
  identity, flavour
  authored_state
    source / table data / diagram parameters
    display and presentation preferences

Engine calculation record (not a Yjs authored property)
  block identity
  authored/source revision
  calculation generation
  dependency/input fingerprint
  status: not-calculated | pending | current | stale | error
  derived payload
  diagnostics
  compatible engine/math version metadata

Jabr-UI transient presentation cache
  rendered result / SVG preview
  loading and visual state
  editor-specific selection mapping
```

The calculation record is Engine-owned, not a Kernel `CellState`. UI may mirror only the data needed to render the result; it is not the authority for validity or cache lifecycle.

### 4.1 Authoring zone

Contains user-authored or user-selected data:
- mathematical source entered through MathLive;
- preferred display unit and explicit display settings;
- table structure, authored cell text and user-entered data;
- diagram parameters, authored geometry and constraints;
- block-level user preferences.

Authored data is serialized in BlockSuite/Yjs and participates in normal collaboration and undo/redo.

### 4.2 Derived zone

Displays outputs produced by Engine/Math/Table/Diagram:
- calculated mathematical values;
- evaluation status and structured diagnostics;
- table-derived values, summaries or lookup results;
- rendered SVG/diagram preview and calculated annotations;
- pending, stale, unavailable or error state.

It is read-only unless a block explicitly defines a separate domain-authoring interaction. It must not become a second MathLive editor or replace the authored domain model.

## 5. Math block interaction

The initial Math block contains editable MathLive source, an evaluate trigger, a read-only result zone and an optional preferred display-unit control.

The trigger submits source and stable block identity through the UI adapter to Engine. UI does not parse or evaluate the expression.

MathLive owns structured editing (fractions, scripts, roots, fences, matrices, cursor movement, selection and LaTeX serialization). Jabr must not implement a second equation editor or cursor model.

A result or error never replaces source. The authoring zone remains editable while an evaluation is pending; a response for older source is rejected.

## 6. Request/result lifecycle

```text
current / not-calculated
        |
authored source or relevant input changes
        v
stale
        |
Engine schedules evaluation
        v
pending
    /       \
   v         v
current     error
   |
newer source/input revision
   v
stale -> pending
```

Rules:
- Source edits invalidate the old result immediately.
- Engine assigns/advances authoritative source and calculation revisions.
- Pending, current, stale, error and unavailable states are visibly distinct.
- A failed evaluation displays diagnostics without changing authored source.
- An unavailable Engine/Math service is not a successful empty result.
- Requests carry source identity/revision and an input fingerprint or equivalent validation token.
- Engine rejects stale results before publication; UI also ignores responses whose request/source identity no longer matches the active block.
- Deleting/disposing a block cancels or ignores outstanding requests.
- A display-unit-only change may request reformatting/conversion but must not invalidate unrelated dependency nodes.
- Engine owns cache validity. UI's transient cache is disposable and may be cleared/repopulated at any time.

## 7. Revisions, snapshots and authored/derived lifecycle

### 7.1 Ownership

- BlockSuite/Yjs owns authored document history and undo/redo.
- Jabr Engine owns monotonic document/source/node revisions, calculation generations, dependency/input fingerprints, result snapshots and cache validity.
- Kernel supplies generic identity and graph primitives only; it does not supply worksheet revision or snapshot lifecycle.
- Jabr-UI associates displayed output with Engine-provided source/input identity and does not invent a second revision authority.

### 7.2 Coexisting authored and derived state

Authored source and derived output coexist as separate records. A calculation record is conceptually:

```rust
pub struct CalculationRecord {
    pub authored_source_ref: SourceIdentity,
    pub source_revision: EngineRevision,
    pub calculation_generation: CalculationGeneration,
    pub input_fingerprint: InputFingerprint,
    pub status: CalculationStatus,
    pub result: Option<OpaqueMathPayload>,
    pub diagnostics: Vec<OpaqueDiagnosticPayload>,
}
```

This is illustrative, Engine-owned and not a Kernel API type. Recalculation must never overwrite authored content.

The authored BlockSuite/Yjs document is the source of truth on reopen. Derived results are reproducible output and may be cached by Engine. A cached result is reusable only when source identity/revision, dependency/input fingerprint, relevant calculation configuration and compatible engine versions match. A document schema match alone is insufficient.

On restore:
1. Load authored document state from BlockSuite/Yjs.
2. Engine rebuilds/resolves worksheet bindings and validates cached results.
3. Reuse only cache entries proven valid by Engine's cache contract.
4. Recompute missing or invalid results.
5. UI displays results associated with the restored authored inputs.

### 7.3 Undo/redo

Undo/redo operates on authored BlockSuite/Yjs state. Engine observes the restored/reapplied source as a new input state, advances its monotonic revision/generation and recalculates. Derived results are not directly undone; Engine revisions never rewind.

## 8. Focus, selection and keyboard ownership

| Interaction | Owner |
|---|---|
| Mathematical character input, placeholders, cursor navigation and source selection | MathLive |
| Outer block selection/movement, insertion/deletion and authored history | BlockSuite / Jabr-UI |
| Result display and diagnostic presentation | Jabr-UI |
| Dependency and calculation behavior | Jabr Engine / Math |
| Table-specific editing | Jabr Table adapter hosted by Jabr-UI |
| Diagram-specific editing | Jabr Diagram adapter hosted by Jabr-UI |

Rules:
- Clicking the authoring zone focuses its domain editor.
- Clicking the derived zone never places a caret in mathematical source.
- Outer block selection remains available without stealing active editor input.
- Table/diagram pointer gestures are handled by that editor only in explicit edit mode.
- Do not globally intercept keys owned by MathLive while its field is focused.
- Block shortcuts are active only outside active MathLive editing or when MathLive delegates the event.
- Result-zone shortcuts must not mutate authored source.
- Escape precedence between nested editor mode and outer selection must be documented and tested.
- Exact shortcuts live in the Jabr-UI keyboard map and must be checked against MathLive and AFFiNE.

## 9. Layout and visual behavior

The default Math block is a coordinated source/result row on sufficiently wide screens:
- authoring zone is visibly editable;
- derived zone is visibly read-only/output;
- both zones share one stable outer block identity and selection frame;
- long equations and diagnostics do not cause uncontrolled layout shifts;
- pending/error/unavailable states remain visually distinct;
- narrow screens may stack the zones without changing logical ownership;
- typography, theme, equation baseline, spacing and selection align with the host.

Exact dimensions and tokens belong to UI implementation and should be validated in the actual AFFiNE/BlockSuite host, not frozen here.

## 10. Persistence and collaboration

Persist in BlockSuite/Yjs: block identity/flavour, authored mathematical source, preferred display unit, authored table data/cell source, authored diagram model/parameters and explicit user-selected presentation preferences.

Do not persist as authored Yjs properties: calculated values, calculation status, request IDs/generations, transient diagnostics, derived SVG/render caches, Engine graph internals, cache fingerprints or scheduling state.

On reload, UI restores authored state and Engine rebuilds/validates calculation state. Collaboration synchronizes authored changes; Engine determines the corresponding calculation lifecycle.

## 11. Extension to other block flavours

### Table block
- Authored zone: table structure, stable row/column/cell identities, authored cell text and typed source data.
- Derived zone: Engine/Math-derived values, validation, summaries and lookup results.
- Table owns its model and deterministic table operations; Math parses/evaluates formulas; Engine owns cross-block graph and recalculation.
- A dedicated formula-source contract remains a separate Table/Math/Engine integration decision.

### Diagram block
- Authored zone: renderer-independent figure model, geometry, constraints and authored parameters.
- Derived zone: rendered SVG/preview and calculated annotations.
- Diagram owns figure model, geometry and rendering; Engine supplies bindings and calculation lifecycle.
- Rendered SVG is derived and never replaces the authored figure model.

The dual-zone principle is logical, not a mandate for identical two-column layouts in every block.

## 12. Testing and acceptance criteria

### Component/controller tests
- Authored source updates invalidate prior results.
- Display-unit preference persists independently of result state.
- Result zone is read-only.
- Result/diagnostic/request metadata never appears in serialized Yjs authored properties.
- Pending/current/error/unavailable/stale states render distinctly.
- Late, mismatched and older-generation responses are rejected.
- Block deletion/disposal ignores late responses.
- Focus and keyboard events respect MathLive/BlockSuite ownership.
- Undo/redo changes authored state and requests fresh Engine calculation.

### Browser integration tests
- Real BlockSuite model updates flow to the worksheet adapter.
- Real Yjs UndoManager undo/redo updates authored source and invalidates derived state.
- Authored LaTeX survives IndexedDB save/reload.
- Transient result state resets on reload and is repopulated by Engine.
- Result-zone rendering creates no editable caret and does not alter source.
- Selection, copy/paste, pointer interaction and shortcuts work in the actual host.
- Responsive layout preserves logical separation.

### Cross-engine tests
- Source identity/revision survives UI → Engine → Math → Engine → UI.
- Engine validates source revision, dependency fingerprint and calculation generation before publication.
- Math diagnostics preserve UTF-8 byte spans; UI maps them to editor offsets.
- Display-unit changes update presentation without invalidating unrelated graph nodes.
- Native and WASM Math paths produce equivalent normalized outputs for the same authored fixture.

## 13. Current implementation and known gaps

The existing prototype includes MathLive input, dual-zone presentation, a worksheet-controller prototype, transient result storage and deterministic mock fixtures. The mock evaluator is not a real parser or calculation engine.

Known gaps:
- Real BlockSuite model-to-Yjs UndoManager browser behavior requires validation.
- Read-only result rendering and Yjs persistence exclusion require browser verification.
- Positional invalidation is temporary and must be replaced by Engine graph updates.
- Planned Jabr Engine is not yet connected.
- Prototype revisions/request IDs are local UI adapter details, not the final cross-engine revision authority.
- Production result snapshots and cache lifecycle must be defined by Engine.

Do not claim browser verification or real calculation behavior without test evidence.

## 14. Open decisions before freeze

1. Final Engine request/result DTO and source identity fields.
2. Exact Engine revision/generation/fingerprint and cache-validity rules.
3. Whether UI receives push notifications, request responses or both (Engine remains authority).
4. MathLive display-unit control interaction and keyboard mapping.
5. Table formula-source and Diagram parameter-binding contracts.
6. Browser acceptance environment and persistence test coverage.

## 15. Explicit non-goals

- A second mathematical editor alongside MathLive.
- Parsing/evaluating expressions in Jabr-UI.
- Worksheet graph construction or recalculation scheduling in UI or Kernel.
- Kernel-owned revisions, snapshots, result store or variable state.
- Persisting calculated values/diagnostics as Yjs authored properties.
- Forcing every block flavour into the same visual layout.
- Moving production BlockSuite block ownership into Math, Table or Diagram repositories.
- Requiring a private Yjs fork for ordinary AFFiNE integration.
- Implementing product code as part of this specification-only change.
