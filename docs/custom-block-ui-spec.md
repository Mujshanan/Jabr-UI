# Jabr Custom Block UI Specification

**Status:** Initial baseline  
**Scope:** Jabr custom blocks and their integration into an AFFiNE-based document  
**Applies to:** Jabr-UI and the UI-facing contracts shared with Jabr-math, Jabr-table, and Jabr-diagram

## 1. Purpose

Jabr custom blocks must read, edit, and behave as native parts of one AFFiNE document. They must not look like independent mini-applications embedded in a page.

AFFiNE is the final product and document host. Jabr-UI develops the block presentation, editing interactions, worksheet orchestration, and integration behavior. This specification establishes the common rules that every custom block follows.

The goal is consistency with the host document, not pixel-for-pixel imitation of every AFFiNE feature.

## 2. Product and repository boundaries

### AFFiNE owns

- Application shell, workspace navigation, page lifecycle, and document-level chrome.
- The production root editor and host document surface.
- Host selection, block handles, slash menu, drag/drop, keyboard routing, and document-level commands where provided by BlockSuite.
- Document persistence, collaboration, undo/redo, and Yjs lifecycle, subject to the agreed integration contract.

### Jabr-UI owns

- Jabr block schemas and authored document data.
- Jabr block views, editing states, and block-specific contextual controls.
- Worksheet-specific orchestration and visual coordination between blocks.
- Integration adapters and compatibility tests for the AFFiNE/BlockSuite host.
- A minimal standalone document harness for developing and testing blocks without requiring the complete AFFiNE application.

### Engine repositories own

- Jabr-math: math engine behavior and the minimum workbench needed to develop/test it.
- Jabr-table: table data and operations engine and its minimum workbench.
- Jabr-diagram: diagram model/rendering engine and its minimum workbench.

Those repositories do not own the final unified document UI. Their workbench styles are not automatically the production design specification.

## 3. Root editor decision

**Decision: do not add or maintain a full AFFiNE root editor in Jabr-UI.**

The current `jabr:root` and `jabr:worksheet` blocks are a lightweight standalone document fixture. They may remain while needed to host the prototype, but they must not grow into a second application editor.

Keep a minimal integration harness with these responsibilities only:

1. Create/load a representative BlockSuite document.
2. Register the Jabr block schemas and views.
3. Render ordinary host-like content alongside Jabr blocks where the available BlockSuite test setup permits.
4. Exercise selection, focus, keyboard, editing, persistence, undo/redo, and mixed-block behavior.
5. Provide deterministic fixtures and test controls that are clearly development-only.

Do not add workspace navigation, page management, a full AFFiNE editor shell, cloud/team features, or duplicate document chrome. When practical, test against the actual AFFiNE host in an integration fixture or dedicated integration environment rather than reimplementing host behavior.

The harness must be replaceable by AFFiNE without changing authored Jabr block data or calculation-engine contracts.

## 4. Document integration principles

1. **Native document flow.** A Jabr block occupies a normal position in the document flow and participates in the host's block ordering and layout.
2. **Host-first behavior.** Use BlockSuite/AFFiNE selection, focus, drag/drop, keyboard, toolbar, and lifecycle mechanisms. Do not create competing global handlers or parallel selection systems.
3. **Content-first appearance.** The default, unselected block should look like document content, not a card, panel, or application window.
4. **Progressive controls.** Show essential editing affordances when focused/selected; keep advanced actions in contextual menus or toolbars.
5. **Authored data only.** Persist user-authored content and durable configuration. Do not persist computed results, transient errors, hover state, focus, open menus, or request metadata in Yjs.
6. **Engine independence.** Block views communicate with engines through stable interfaces. UI styling and document layout must not leak into engine models.
7. **Accessible interaction.** Controls have accessible names, keyboard operation, visible focus, and sensible hit targets.
8. **Responsive layout.** Blocks must remain usable at narrow document widths and must not force page-level horizontal overflow.

## 5. Shared visual system

### 5.1 Host tokens

In production, consume AFFiNE/BlockSuite theme variables and host component primitives wherever available. Do not hardcode a separate palette or typography system inside each block.

For standalone development, provide a small compatibility token layer whose names map to host semantics. The adapter may define fallback values, but block styles should consume semantic tokens rather than literal colors.

Required token categories:

- Text: primary, secondary, muted, disabled, inverse.
- Surface: document, subtle, raised, hover, selected.
- Border: subtle, default, strong, focus.
- Accent: primary, success, warning, danger.
- Spacing: inline gap, compact block gap, standard block gap, section gap.
- Shape: control radius, block radius.
- Typography: document body, small metadata, label, heading, mathematical content.
- Focus: visible focus ring and focus offset.

Do not assume the standalone harness's current colors, shadows, or dimensions are AFFiNE's production tokens.

### 5.2 Typography

- Inherit the host document font and text color for prose and labels.
- Use the host's document hierarchy for headings and explanatory text.
- Use mathematical typography only for mathematical content; do not apply a separate app-wide font.
- Labels, diagnostics, units, and metadata must remain visually subordinate to authored content.
- Avoid block-specific heading scales that compete with document headings.

### 5.3 Spacing and width

- Align block content to the host document's content column.
- Use the host's block spacing rhythm. Do not add large outer margins around every custom block.
- Internal padding is justified only where the content needs a distinct editing surface or spatial canvas.
- Default blocks should be width: 100% of their available content slot, with min-width: 0.
- No custom block may impose a fixed page width.
- Wide tables, matrices, and diagrams must provide a deliberate narrow-screen strategy (wrapping, controlled internal scrolling, or compact presentation) without causing whole-document overflow.

### 5.4 Surfaces and borders

- Default state: transparent or host document surface; avoid decorative cards.
- Hover/selection: use host state styling and block selection conventions.
- Use borders to communicate editable boundaries, table grids, canvas extents, or grouping—not as decoration around every block.
- Avoid nested cards and stacked panels.
- Light and dark themes must both be supported through semantic tokens.

### 5.5 Toolbars and actions

- Prefer host contextual toolbars, menus, and block handles.
- Keep persistent controls inside the block to the minimum needed to understand or edit its content.
- Use the same icon size, button shape, spacing, tooltip, disabled, hover, and focus conventions across block types.
- Do not place a separate always-visible application toolbar above each block.
- Destructive actions require clear labeling and appropriate confirmation/undo behavior.

## 6. Shared block interaction contract

Every custom block must define and test these states:

| State | Required behavior |
|---|---|
| Idle | Content is readable and visually integrated with document flow. |
| Hover | Subtle host-consistent affordance; no layout shift. |
| Selected | Uses host selection indication and remains distinguishable from keyboard focus. |
| Focused/editing | Clear focus; keyboard input is routed to the active editor/control. |
| Read-only | Content remains legible; editing controls are absent or disabled. |
| Disabled | Controls communicate unavailable state and cannot be activated. |
| Loading | Stable geometry and a non-disruptive progress indication. |
| Empty | Useful insertion guidance without looking like an error. |
| Error | Concise, local diagnostic; preserve authored content. |
| Narrow | No page-level overflow; controls remain reachable. |

### Keyboard and focus

- The host editor owns document-level navigation and block selection.
- A block may own keyboard events only while an internal editor/control has focus.
- Escape should return focus/selection to the host according to BlockSuite conventions.
- Tab/Shift+Tab behavior inside structured editors must be documented and must not unexpectedly trap users or break document navigation.
- Do not intercept common editor shortcuts globally.
- Focus transitions must be deterministic when entering, leaving, or deleting a block.

### Selection and drag/drop

- Use BlockSuite's block selection and drag/drop mechanisms.
- Do not emulate selection with independent click-only borders.
- Interactive controls inside a block must not accidentally initiate block dragging.
- Multi-selection and host block operations must remain possible where supported.

### Contextual actions

Each block documents its available actions and whether they are exposed through the host toolbar, a block-local control, or a context menu. Avoid duplicating the same action in multiple places without a clear reason.

## 7. Block-specific requirements

### 7.1 Math block

- MathLive is the sole structured mathematical input editor.
- Editing and displayed/read-only math must be visually distinguishable without creating two competing equation surfaces.
- Preserve MathLive's structured input, selection, cursor, placeholder, and accessibility behavior.
- Placeholder navigation and shortcuts must not conflict with host document navigation.
- The result zone is read-only and visually subordinate/equal only as required by calculation semantics; it must never masquerade as authored source.
- Evaluation status and diagnostics are transient UI state, not persisted block properties.
- The display-unit preference may be persisted if it is explicitly user-authored configuration.
- Pending, unavailable, success, stale, and error states must not cause disruptive block height changes.
- Math blocks must align with surrounding prose and other blocks; display equations may use a controlled alignment mode.

### 7.2 Text block

- Use host-native paragraph/text behavior wherever possible rather than introducing a second rich-text editor.
- Match host body typography, line height, selection, and spacing.
- Text blocks should not be wrapped in a visible panel by default.
- If the current prototype uses a minimal text model, document that limitation and do not claim full AFFiNE paragraph parity.

### 7.3 Table block

- Default table presentation should resemble structured document content, not a spreadsheet application window.
- Cell typography, row height, borders, selection, and focus must use the shared tokens.
- Editing affordances should appear on focus/selection; row/column operations belong in contextual controls.
- Define behavior for empty cells, headers, overflow, resize, paste, and keyboard navigation.
- Keep table data and operations in the table model/engine; the UI adapter owns rendering and interaction only.
- Narrow documents must use internal horizontal scrolling or a deliberate compact layout, never page-level overflow.

### 7.4 Matrix and vector blocks

- Present mathematical notation clearly and compactly.
- Cell/entry editing must have predictable focus and keyboard navigation.
- Dimensions and structural delimiters must remain visible without excessive borders or panel chrome.
- Reuse table interaction primitives only where semantics genuinely match; do not force mathematical notation into a spreadsheet visual model.
- Operations and calculated values must remain distinguishable from authored entries.

### 7.5 Plot block

- The plot is document content with a stable aspect ratio and readable labels.
- Axes, units, legends, gridlines, and series styling must remain legible in both themes and at document width.
- Editing controls belong in a contextual configuration surface, not permanently around the plot.
- Provide empty, loading, invalid-data, and populated states.
- Export/render output must not depend on transient editor selection state.

### 7.6 Diagram block

- Jabr Diagram owns diagram geometry/model semantics; Jabr-UI owns the document block integration and contextual presentation.
- The default view should show the diagram as document content, not a full editor toolbar/canvas application.
- Entering diagram-edit mode may expose a focused editing surface and tools; leaving it returns to the compact document presentation.
- Selection, keyboard ownership, zoom/pan, resize, and escape-to-document behavior must be explicitly defined.
- Diagram bounds and scaling must fit the document column without distorting engineering geometry.
- SVG/export output must remain independent of the host editor chrome.

## 8. Mixed-document acceptance fixture

Maintain one representative document that includes, in order:

1. A native-style document heading and explanatory paragraph.
2. A math block with an authored expression and a result/status state.
3. A paragraph between custom blocks.
4. A table with header, populated cells, and an empty cell.
5. A matrix and a vector.
6. A plot with axes, units, and legend.
7. A diagram with engineering labels and dimensions.
8. A final paragraph.

The fixture must be reviewed at normal document width and a narrow viewport, in light and dark themes, with blocks idle, hovered, selected, and actively edited.

The fixture must demonstrate that ordinary text and custom blocks share a coherent vertical rhythm and that no block introduces unrelated app chrome.

## 9. Acceptance checklist

A block is ready for document integration only when:

- [ ] It uses shared semantic theme tokens and host typography.
- [ ] It aligns with the host document content column and spacing.
- [ ] Its idle state looks like document content, not a standalone app/card.
- [ ] Hover, selection, focus, editing, read-only, empty, loading, and error states are defined.
- [ ] It respects host keyboard, focus, selection, and drag/drop ownership.
- [ ] It works in light and dark themes.
- [ ] It does not cause page-level horizontal overflow at narrow widths.
- [ ] It preserves authored data through reload and undo/redo.
- [ ] Transient results and UI state are not written to Yjs.
- [ ] It coexists with ordinary paragraphs and other Jabr blocks in the mixed-document fixture.
- [ ] It has component-level tests and at least one document-level integration test.
- [ ] It can be hosted by AFFiNE without depending on the standalone harness.

## 10. Implementation sequence

1. Audit current Jabr-UI styles and block views against this specification; classify each rule as shared token, host behavior, or block-specific behavior.
2. Establish the semantic theme-token adapter and remove avoidable per-block hardcoded visual values.
3. Improve the minimal harness so it demonstrates mixed document flow and all shared interaction states. Do not expand it into a root editor.
4. Align the math and text blocks with the shared contract.
5. Integrate table/matrix/vector presentation from Jabr-table.
6. Integrate plot and diagram presentation through their stable UI-facing contracts.
7. Add the mixed-document acceptance fixture and narrow/light/dark regression coverage.
8. Validate against the actual AFFiNE host before declaring production integration ready.

## 11. Explicit non-goals

- Reimplementing AFFiNE's application shell or full root editor.
- Creating a parallel document model or private Yjs fork.
- Forcing every block into identical visual geometry.
- Making engine workbenches the final production UI.
- Persisting computed results, diagnostics, focus, selection, or transient interaction state as authored document data.
- Introducing a new global design system that competes with AFFiNE's theme system.
