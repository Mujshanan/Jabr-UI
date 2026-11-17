# Jabr Mathcad-Style Worksheet — Development Plan

## Purpose

This document defines the implementation plan for turning Jabr's MathLive-backed expression block into a Mathcad-inspired calculation worksheet. The immediate milestones are **structured MathLive placeholders, the dual-zone math block, and the worksheet block hierarchy**. The worksheet controller now observes BlockSuite model updates and maintains transient result state. The CLI evaluator adapter remains a stub until Jabr-CLI exposes worksheet evaluation.

The goal is to reproduce the interaction model, not Mathcad's proprietary implementation. MathLive remains the sole mathematical input editor. Jabr owns the worksheet, block lifecycle, evaluation requests, and result presentation.

## Product interaction model

### 1. Structured mathematical input

A math block is an editable mathematical structure, not a plain-text input that is parsed after typing.

- MathLive owns the mathematical editing surface and its internal expression model.
- Operators and templates create structured mathematical groups with editable slots.
- Fractions expose numerator and denominator entry points.
- Roots expose radicand (and, when applicable, index) entry points.
- Subscripts and superscripts are navigable as separate mathematical groups.
- Integrals expose lower limit, upper limit, integrand, and differential variable slots.
- Matrices expose individual cell entry points.
- LaTeX is the persisted interchange representation; the rendered DOM and MathLive's internal model are not persisted.

Jabr must not create a second mathematical editor or implement its own cursor/tree model.

### 2. Spatial navigation

- Preserve MathLive's native arrow-key navigation through fractions, scripts, roots, fences, and nested groups.
- Preserve native Tab and Shift+Tab placeholder navigation.
- Do not add duplicate host-level Tab handlers inside a MathLive field.
- The worksheet controller may handle navigation only when MathLive reports that the caret has reached a worksheet boundary and the key should create or move between blocks.
- Tests must verify that the host does not steal keys that belong to mathematical navigation.

### 3. Mathcad assignment and evaluation

The worksheet distinguishes definition from evaluation.

- := represents a definition/assignment.
- = represents evaluation/display.
- A definition is stored as an input expression; the result is displayed in a separate, read-only result zone.
- An expression that references earlier definitions is evaluated through the Jabr-CLI boundary.
- The UI must not infer numeric values or perform calculations in the MathLive component.
- Assignment/evaluation syntax and semantics must be defined by the Jabr-CLI contract, not by ad-hoc LaTeX string manipulation in the view.

### 4. Continuous worksheet flow

- A document is an ordered sequence of content blocks under a worksheet hub block. The root contains the worksheet hub; the hub contains math and text content blocks.
- The host owns insertion, deletion, focus transfer, and block creation.
- Enter/Tab at a worksheet boundary may create or focus the next block, but must not interfere with MathLive's internal placeholder traversal.
- Text and math remain distinct block types. A future smart-switch interaction may convert a fresh block between them without losing typed content.

## Architecture and ownership

### Jabr-UI

Jabr-UI owns:

- BlockSuite schemas, models, views, and document persistence.
- The MathLive component configuration and mathematical input UX.
- Math/text block presentation and host-level keyboard routing.
- The worksheet controller and ordered block lifecycle.
- A dual-zone block view: editable input on the left, read-only result on the right, and a display-unit request field.
- A separate result-unit override control, once supported by the CLI quantity contract.
- Rendering of CLI evaluation status, diagnostics, and serialized results.

Jabr-UI must not own:

- A second mathematical parser or evaluator.
- A duplicate unit registry or dimensional-analysis engine.
- The document-wide symbol table or dependency DAG as an independent calculation implementation.
- Any BlockSuite dependency inside Jabr-CLI.

### Jabr-CLI

Jabr-CLI owns the language and calculation semantics:

- Parsing and normalization of expressions.
- Definition and evaluation semantics.
- Variable scope and top-to-bottom worksheet evaluation.
- Dependency extraction and DAG construction/updates.
- Quantity parsing, unit registry, conversion, and dimensional validation.
- Structured diagnostics and serializable result values.
- A stable host-facing API that can be called by Jabr-UI without importing BlockSuite.

The CLI boundary should be defined before UI code relies on concrete parser internals. Prefer versioned request/response types and stable identifiers over passing BlockSuite models into the engine. **Current repository baseline:** Jabr-CLI currently exposes asynchronous Mathlex parse/LaTeX-serialization functions and AST node types; the inspected main branch does not yet expose worksheet evaluation, variable scope, a dependency DAG, quantity evaluation, or a unit registry. Treat those as future CLI work, not existing capabilities. The worksheet controller can be designed now, but its evaluator adapter must remain an interface/stub until the CLI contract exists.

### MathLive

MathLive owns:

- Structured math input and editing.
- Fractions, roots, scripts, fences, matrices, and other mathematical constructs.
- Cursor movement, selection, and placeholder traversal.
- LaTeX serialization and prompt inspection.
- Its own mathematical keyboard shortcuts and virtual keyboard.

MathLive does not own:

- Worksheet variables, assignment execution, units, or document dependencies.
- Block insertion, text blocks, or result rendering.
- Persistence outside the value that Jabr stores in its BlockSuite model.

## Data model direction

The initial prototype persists latex on jabr:math. Preserve this as the canonical mathematical source while introducing additional properties only when needed.

The current math block persists only authored input and presentation preference:

- `latex`: canonical editable input.
- `displayUnit`: optional user-requested output unit.

Results, diagnostics, request IDs, and source revisions live in an ephemeral UI result store. They are not written into BlockSuite/Yjs. This prevents undo/redo and collaboration history from treating computed output as authored content.

The controller should identify blocks by stable BlockSuite IDs. The CLI should receive a worksheet snapshot or incremental operations keyed by those IDs, not BlockSuite model instances.

## Milestone plan

### Milestone 0 — Baseline and architecture contract

1. Inspect the current Jabr-UI BlockSuite 0.19.5 prototype and MathLive 0.111.4 API usage.
2. Inspect Jabr-CLI's current parser/AST surface and identify what is already implemented versus planned.
3. Record the UI/CLI boundary. Do not duplicate parsing, evaluation, or units in the UI.
4. Keep both repositories independently runnable and independently testable.

**Acceptance:** the ownership split and data exchange are documented; no cross-repository runtime dependency is introduced prematurely.

### Milestone 1 — MathLive placeholders and structured entry

1. Add reusable, named placeholder templates for common engineering/math structures.
2. Add a compact insertion toolbar for fraction, square root, integral, and matrix templates.
3. Add a Mathcad-style / fraction shortcut that inserts a structured fraction and focuses the numerator placeholder.
4. Keep _ and ^ behavior native to MathLive for subscript and superscript entry.
5. Preserve MathLive's native arrow-key and Tab/Shift+Tab navigation.
6. Keep semantic prompt IDs unique within a block and readable for inspection/accessibility.
7. Persist every edit as LaTeX in the BlockSuite model.
8. Provide an inspectable prompt list for development, but keep it out of the normal worksheet presentation.
9. Add tests or a reproducible browser verification checklist for each template and navigation path.

**Acceptance:**
- Fraction insertion produces distinct numerator and denominator slots.
- Root insertion produces an editable radicand slot.
- Integral insertion exposes lower/upper limits, integrand, and differential variable.
- Matrix insertion exposes independently editable cells.
- Typing and editing in any slot updates persisted LaTeX.
- Tab and Shift+Tab move between prompts without the host stealing focus.
- Arrow keys navigate spatially through nested mathematical structures.
- No calculation or unit parsing is performed by the MathLive view.

### Milestone 2 — Mathcad input conventions

1. Define how the assignment operator := is inserted and represented.
2. Define the evaluation operator = as a host/controller action rather than a second editable result field.
3. Add engineering unit shortcuts without treating those shortcuts as unit parsing.
4. Define how a fresh math block may become a text block on a deliberate user action.
5. Verify that shortcuts do not break ordinary MathLive entry, locale behavior, or undo.

**Acceptance:** input conventions are documented, keyboard behavior is deterministic, and the UI does not claim to evaluate expressions locally.

### Milestone 3 — Dual-zone math block (UI foundation implemented)

1. [x] Refactor the math block into an inline input / equals / result layout.
2. [x] Keep the left MathLive field editable.
3. [x] Render the right result zone with a read-only MathLive field.
4. [x] Add initial empty, requested, and error status presentation.
5. [x] Add a separate unit-override input at the result edge.
6. [x] Keep the source expression unchanged when the display unit changes.
7. [x] Dispatch a `jabr-evaluate-request` event when the user presses `=`.

The event is handled by the worksheet controller. The controller currently returns an explicit “Jabr-CLI evaluator is not connected yet” state; it does not calculate the expression. Result LaTeX and diagnostics are held in a transient store. Only `latex` and the user-authored `displayUnit` remain persisted.

**Acceptance:** users can distinguish source from result; results cannot be edited as source; unit overrides do not mutate the input expression.

### Milestone 4 — Worksheet controller (initial invalidation pipeline implemented)

1. [x] Create a controller owned by the Jabr-UI editor/host layer, not by the MathLive view.
2. [x] Subscribe to each math model's `propsUpdated` slot; this also observes programmatic Yjs updates such as undo/redo.
3. [x] Subscribe to the worksheet hub's `childrenUpdated` slot to maintain subscriptions as blocks are inserted or removed.
4. [x] Invalidate the edited math block and all later math blocks in hub order. This is conservative positional invalidation, not a symbol dependency DAG.
5. [x] Keep result LaTeX, status, diagnostics, request IDs, and source revisions in a transient result store outside Yjs.
6. [x] Define versioned, adapter-independent evaluation request/response types and reject stale or mismatched responses.
7. [x] Route the `=` request event through the controller.
8. [ ] Add deterministic mock evaluator fixtures and automated race/undo-redo tests.
9. [ ] Handle block reordering and document-wide evaluation snapshots.
10. [ ] Add host-level keyboard routing for moving between blocks and creating the next block at a true boundary.

The default adapter reports that Jabr-CLI is not connected. No expression parsing, symbol resolution, dependency graph, quantity handling, or calculation is performed in Jabr-UI.

**Acceptance:** source edits and Yjs undo/redo invalidate the edited row and later math rows; stale asynchronous responses cannot overwrite newer source; results never mutate persisted LaTeX.

### Milestone 5 — CLI evaluation and dependency graph

1. Define a stable Jabr-CLI worksheet API for definitions and expressions.
2. Maintain top-to-bottom symbol scope.
3. Extract symbol dependencies and maintain a directed acyclic graph.
4. Re-evaluate affected downstream expressions when a definition changes.
5. Detect unknown symbols, duplicate definitions, cycles, and invalid expressions.
6. Keep unit parsing, dimensional analysis, and conversion inside Jabr-CLI.
7. Return structured results and diagnostics to the UI.

**Acceptance:** changing an upstream definition updates all affected downstream results; independent expressions are not unnecessarily recalculated; cycles and dimension errors are reported explicitly.

### Milestone 6 — Text/math blocks and continuous flow

1. [x] Define a small text block schema and editable view.
2. [ ] Add explicit host-level block type switching for a fresh block.
3. [ ] Preserve typed text during conversion.
4. [ ] Implement Enter/Tab boundary behavior and focus transfer.
5. [ ] Verify document order and persistence remain stable.

**Acceptance:** users can create and navigate a continuous worksheet without interfering with MathLive's internal structural navigation.

### Milestone 7 — Integration hardening

1. Verify compatibility with the intended AFFiNE/BlockSuite version before integration.
2. Keep the standalone Jabr-UI prototype independently runnable.
3. Keep the Jabr-CLI engine independently runnable and testable.
4. Add end-to-end tests for editing, persistence, evaluation, and result updates.
5. Document known limitations and migration requirements.

## Interaction template catalogue

The initial template set should remain intentionally small and extensible:

| Template | Structure | Entry slots |
| --- | --- | --- |
| Fraction | fraction | numerator, denominator |
| Square root | square root | radicand |
| Indexed root | indexed root | index, radicand |
| Integral | integral with limits | lower limit, upper limit, integrand, variable |
| 2×2 matrix | matrix environment | four independent cells |
| Subscript | native subscript | native MathLive group |
| Superscript | native superscript | native MathLive group |

Named prompt identifiers are local editor metadata. They must not be mistaken for Jabr language variables. For example, a placeholder named numerator is a cursor target, not a worksheet symbol.

## Validation strategy

### Unit-level

- Template strings contain the expected number of named prompts.
- Prompt identifiers are unique within each template.
- Shortcut insertion maps to the intended LaTeX structure.
- The UI adapter serializes MathLive values without rewriting source.

### Component/browser-level

- Insert each template from the toolbar.
- Insert a fraction using /.
- Fill all slots with keyboard only.
- Navigate forward/backward using Tab and Shift+Tab.
- Navigate in/out of nested structures with arrow keys.
- Edit a filled prompt and verify BlockSuite persistence.
- Reload the document and verify LaTeX and prompt contents are restored.
- Verify focus and selection survive normal input updates.

### Worksheet/controller-level

- Edit the first math block and verify that it and all later math blocks return to idle with incremented source revisions.
- Edit a later math block and verify that earlier blocks remain unchanged.
- Undo and redo a LaTeX edit through BlockSuite/Yjs and verify that `propsUpdated` triggers the same invalidation path without a DOM input event.
- Change only `displayUnit` and verify that source invalidation is not triggered.
- Resolve a delayed evaluation after a newer edit and verify that the stale response is ignored.
- Remove a math block and verify that its controller subscription and transient result state are disposed.
- Verify that result updates do not mutate input LaTeX or Yjs document history.
- Host-level Tab/Enter behavior only activates at a worksheet boundary.

### Repository checks

Run the repository's actual scripts rather than assuming they exist:

- pnpm typecheck
- pnpm build
- Browser interaction tests when a browser harness is available
- Jabr-CLI tests and type checks before wiring the evaluation adapter

Record commands, environment, and results in the pull request. Do not mark the milestone complete while checks are unrun or failing.

## Explicit non-goals for the current milestone

- Implementing a calculation engine inside Jabr-UI.
- Parsing units or doing dimensional analysis inside MathLive.
- Replacing MathLive with MathQuill, CodeMirror, or another equation editor.
- Building a general-purpose BlockSuite framework.
- Reimplementing a complete Mathcad language.
- Merging the repositories into a monolith.
- Integrating with current AFFiNE internals before the standalone contracts are stable.

## Current implementation status

- [x] Minimal BlockSuite host and jabr:math block.
- [x] MathLive editable expression with LaTeX persistence.
- [x] Initial semantic quantity prompts and engineering unit shortcuts.
- [x] Reusable structural placeholder templates (implementation present; browser verification pending).
- [x] Mathcad-style fraction insertion shortcut (implementation present; browser verification pending).
- [ ] Template keyboard/navigation verification.
- [x] Dual-zone input/result block (presentation and request event only; no calculation).
- [x] Root → worksheet hub → math/text content-block hierarchy.
- [x] Basic persisted text block.
- [x] Worksheet controller source-change observation and ordered cascade invalidation (CLI evaluator remains unavailable).
- [x] Transient result store and stale-response correlation.
- [ ] Deterministic mock evaluator fixtures and automated undo/redo/race tests.
- [ ] Dependency DAG and quantity engine in Jabr-CLI.
- [ ] Math/text switching and continuous worksheet flow.

## Decision log

- **MathLive is the sole math editor.** Jabr must not maintain a parallel mathematical cursor or syntax-tree editor.
- **LaTeX is the persisted input representation.** It is the interchange source for the UI/CLI boundary, not the evaluation engine.
- **The host owns worksheet behavior.** Block lifecycle, document flow, result display, and evaluation orchestration live outside the MathLive component.
- **Computed results are transient.** Result LaTeX, status, diagnostics, and request revisions must not be persisted as BlockSuite/Yjs props.
- **Jabr-CLI owns calculation semantics.** Parsing, symbols, DAG, quantities, and units must not be duplicated in Jabr-UI.
- **Native MathLive navigation is preferred.** Preserve spatial arrow navigation and native placeholder Tab traversal; host handlers act only at worksheet boundaries.
- **Repositories remain independent.** Jabr-UI and Jabr-CLI communicate through a stable contract rather than importing one another's internal implementation.
