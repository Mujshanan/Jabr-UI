# MathLive Interactivity — Architecture and Implementation Specification

**Date:** 2026-11-19  
**Repository:** `Mujshanan/Jabr-UI`  
**Target:** `jabr-math-block` (BlockSuite + Lit + MathLive)

## 1. Architecture review and decisions

Jabr-UI is the authoring and presentation boundary. MathLive owns interactive mathematical layout, cursor navigation, and placeholder editing. BlockSuite/Yjs owns authored worksheet structure, `latex`, `displayUnit`, persistence, collaboration, and undo/redo. Jabr Math owns parsing, AST, mathematical symbols, quantities, units, dimensional analysis, and expression evaluation. Jabr Orchestrator/Engine owns worksheet execution order, block-to-node mapping, dependencies, scheduling, revisioned snapshots, and result lifecycle. Kernel owns generic graph/state contracts such as NodeId and Port.

The UI must not parse or calculate expressions, infer mathematical dependencies, or treat editor prompt IDs as calculation identities. The current positional invalidation in `WorksheetController` is explicitly temporary and must be replaced by Engine revisioned updates when the integration contract is ready.

### Accepted state ownership

| Data | Owner | Persisted in Yjs |
|---|---|---|
| Authored LaTeX | MathLive + Math block model | Yes |
| Display-unit preference | Math block model | Yes |
| Prompt/placeholder inspection | MathLive UI | No separate state |
| Evaluation results and diagnostics | Orchestrator; transient UI cache for rendering | No |
| Dependency graph and execution identity | Orchestrator/Kernel | No UI-owned graph identity |

### Evaluation trigger

The editor must not consume `=` as an evaluation command. It is ordinary mathematical input used in equations and assignments. Phase 1 uses an explicit Evaluate button that dispatches the existing bubbling/composed `jabr-evaluate-request` event with `{ blockId }`. A keyboard evaluation shortcut is deferred until its interaction with MathLive navigation, accessibility, and platform conventions is separately specified.

### Input and synchronization

- Ignore key handling while `KeyboardEvent.isComposing` is true (and the legacy IME key code 229 is observed).
- Ignore shortcut handling when Alt, Ctrl, or Meta is held.
- The slash fraction shortcut is handled only by the MathLive field and only outside composition/modifier states.
- External `model.latex` changes synchronize the field under a `syncingFromModel` guard. Input events caused by model-to-field synchronization must not write the same value back to BlockSuite.
- Attach model/result subscriptions and DOM listeners once per attached field; detach and dispose them on disconnect or field replacement. A delayed attach after disconnect must be a no-op.
- Detailed LaTeX and prompt inspection remains lazy: do not call `getPrompts()` or `getPromptValue()` while the inspector is collapsed.

## 2. Placeholder identity contract (Phase 2)

A template slot has two distinct identities:

- `baseId`: stable semantic role in a template, such as `numerator`, `mass`, or `acceleration`.
- `instanceId`: unique identity for one concrete slot in one MathLive field.

Use a reserved delimiter and a slot index, for example `numerator__jabr_12_0`. The sequence identifies an insertion; the slot index distinguishes repeated semantic roles within the same template. Prefer an insertion-time `instanceId -> baseId` mapping over reverse-parsing IDs where practical.

Insertion algorithm:
1. Snapshot existing prompt IDs using `new Set(mathField.getPrompts())`.
2. Generate an instance ID for every placeholder occurrence in the template, including duplicate base IDs.
3. Check candidates against existing IDs and each other.
4. Advance the field-local monotonic sequence until all candidates are unique.
5. Insert the rewritten template with MathLive's placeholder selection mode.
6. Commit the sequence only after insertion succeeds.

Undo/redo, paste, and external LaTeX synchronization may restore IDs unknown to the counter; therefore the live field scan is mandatory. IDs remain field-local strings and are never Math variables, Kernel NodeIds, Ports, or persisted calculation state.

### Incomplete placeholders

An empty `\\placeholder[id]{}` is incomplete authored input, not a variable. Before dispatching a normal evaluation request, the UI should detect unresolved prompts and show a block-level incomplete-input diagnostic while preserving authored LaTeX. The diagnostic may identify the missing semantic roles. Once prompts are complete, Math still independently validates syntax and semantics. This validation boundary must not turn the UI into a parser.

## 3. Result and display-unit contract

The result MathLive field remains read-only. Result state transitions are rendered from transient state: idle/stale, pending/evaluating, success, error/diagnostic, and unavailable. Source edits and undo/redo invalidate prior results immediately; stale output must not appear current.

`displayUnit` is an authored presentation preference. Editing it must not mutate `latex`. The UI forwards it with evaluation input; unit resolution, dimensional validation, and conversion belong to Jabr Math and the Orchestrator integration, not the UI.

## 4. Phased implementation

### Phase 1 — Input and synchronization hardening
- Guard IME composition and modifier keys.
- Keep `=` available as authored input.
- Add explicit Evaluate action using the existing event contract.
- Add model-to-field re-entrancy protection.
- Preserve listener cleanup and guard delayed attach.
- Add Playwright coverage for equals authoring, explicit evaluation, composition/modifier handling, and external model synchronization.

### Phase 2 — Templates and placeholder identity
- Implement semantic base IDs and collision-safe instance IDs with per-slot identity.
- Verify repeated/nested templates, duplicate roles, undo/redo, paste, and external sync.
- Resolve prompt hints through semantic identity.
- Define and test incomplete-input behavior.
- Keep prompt inspection lazy while collapsed.

### Phase 3 — Engineering template and unit ergonomics
- Expand and verify common SI unit shortcuts.
- Complete high-frequency structured templates.
- Verify display-unit persistence across undo/redo/reload.
- Keep unit parsing, dimensional analysis, and conversion outside the UI.

### Phase 4 — Orchestrator and Math integration
- Define a versioned request carrying document/block identity, authored source revision, and display-unit preference.
- Route requests to the Orchestrator/Engine adapter.
- Reject stale/mismatched responses.
- Replace UI positional invalidation with Engine revisioned snapshots/updates.
- Keep result data transient in the UI and out of Yjs.

## 5. Phase 1 acceptance criteria
- Typing `=` inserts authored mathematical content and does not dispatch evaluation.
- Clicking Evaluate dispatches one `jabr-evaluate-request` for the owning block.
- Slash does not trigger during IME composition or with Alt/Ctrl/Meta held.
- External `model.latex` changes update the MathLive field without redundant document writes.
- Listener cleanup is deterministic, including delayed attach after disconnect.
- Existing Yjs persistence, undo/redo, result isolation, and stale-response behavior remains intact.

## 6. Explicit non-goals
- No UI expression parser, unit engine, dimensional analysis, dependency graph, or recalculation scheduler.
- No Kernel identity reuse for MathLive prompts.
- No persistence of computed result/diagnostic state.
- No Orchestrator integration in Phase 1.
