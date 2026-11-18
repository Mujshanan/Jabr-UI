# Jabr UI

Jabr UI is the complete BlockSuite-based worksheet product UI. It is developed independently from Jabr Math and the planned Jabr-engine repository, and is designed for eventual integration into an AFFiNE-based editor.

## Calculation ownership

The UI sends authored source and its current document/source revision to the Engine boundary. Engine owns graph construction, dependency resolution and recalculation; Math parses/evaluates; Kernel provides generic storage and revision/snapshot primitives. The UI may keep a transient presentation cache, but it must not become a second calculation-result authority. Calculated values, diagnostics and request metadata must never be persisted as Yjs authored block properties.

## Current worksheet blocks

The standalone document uses a small, explicit block tree:

- `jabr:root`: document root and title.
- `jabr:worksheet`: hub/container that owns ordered worksheet content.
- `jabr:math`: editable MathLive input with a separate read-only result zone.
- `jabr:text`: editable prose/note block.

The hub block is intentional: BlockSuite 0.19.5 does not allow content blocks to be direct children of a root block. The worksheet hub provides the valid parent for math and text content.

## MathLive input and Mathcad-style interaction

MathLive is the sole mathematical input editor. It owns structured mathematical editing: fractions, scripts, roots, fences, matrices, cursor movement, selection, and LaTeX serialization. Jabr does not implement a second equation editor or cursor model.

The math block provides named structural placeholders, a slash-to-fraction shortcut, native MathLive placeholder traversal, engineering unit insertion shortcuts, and LaTeX persistence.

### Dual-zone calculation row

Each math block has an editable MathLive source, an equals trigger, a read-only result zone, and an optional display-unit request field. Pressing `=` dispatches an evaluation request to the worksheet controller.

Computed results, statuses, diagnostics, request IDs, and source revisions remain in an in-memory store outside BlockSuite/Yjs. Only authored LaTeX and the user-selected display unit are persisted.

## Mock evaluator

The standalone prototype includes an opt-in **Enable mock evaluator** control. It uses exact, pre-authored fixtures only; it does not parse expressions, resolve symbols, evaluate arithmetic, or interpret units. The default sample source has a canned mock result. The exact source `MOCK_ERROR` demonstrates an intentional error, while unregistered source strings return an explicit “No mock fixture” error. Disable the mock to restore the unavailable-Engine/Math state.

Mock results are UI fixtures, not engineering calculations and must never be used for design decisions.

## Architecture ownership

- BlockSuite/Yjs owns document structure, block identity, persistence, collaboration, and undo/redo.
- MathLive owns structured mathematical editing and LaTeX serialization.
- Jabr-UI owns the complete product interface, authored BlockSuite/Yjs document, editing interactions, presentation, and transient rendering state.
- Jabr Math owns mathematical syntax, parsing, AST, values, quantities, units, dimensional validation, and expression evaluation.
- Jabr-engine (planned; repository not yet created) owns worksheet graph construction, dependency resolution, recalculation scheduling, and calculation-result lifecycle.
- Jabr-kernel owns generic infrastructure only: NodeId/Port, Revision, Snapshot<T>, ResultStore<V>, graph primitives, diagnostics and spans.
- Jabr-table owns table structure and authored cell text; Math parses cell text.

Jabr-UI, Jabr Math, Jabr-table, Jabr Diagram and Kernel remain independently developable. The future AFFiNE integration should adapt Jabr's worksheet blocks to the host's BlockSuite document model rather than introduce a private Yjs fork.

## Requirements and run

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.34.5`

```sh
pnpm install
pnpm dev
```

Use Add math block or Add text block to append worksheet content. Press `=` in a math block to request an evaluation. Enable the mock evaluator to see registered fixture behavior. Actual calculation remains unavailable until the Jabr-engine and Jabr Math integration is connected.

## Validation

```sh
pnpm test:controller
pnpm typecheck
pnpm build
```

See [development.md](./development.md) for the detailed milestone plan and verification checklist.
