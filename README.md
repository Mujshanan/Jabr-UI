# Jabr UI

Jabr UI is the BlockSuite-based worksheet presentation layer. It is developed independently from Jabr-CLI and will later be integrated into an AFFiNE-based editor.

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

The standalone prototype includes an opt-in **Enable mock evaluator** control. It uses exact, pre-authored fixtures only; it does not parse expressions, resolve symbols, evaluate arithmetic, or interpret units. The default sample source has a canned mock result. The exact source `MOCK_ERROR` demonstrates an intentional error, while unregistered source strings return an explicit “No mock fixture” error. Disable the mock to restore the unavailable-Jabr-CLI state.

Mock results are UI fixtures, not engineering calculations and must never be used for design decisions.

## Architecture ownership

- BlockSuite/Yjs owns document structure, block identity, persistence, collaboration, and undo/redo.
- MathLive owns structured mathematical editing and LaTeX serialization.
- Jabr-UI owns presentation, worksheet orchestration, conservative ordered invalidation, transient result state, and rendering.
- Jabr-CLI will own parsing, assignment semantics, variable scope, dependency DAG, quantities, units, dimensional validation, and actual calculation.

Jabr-UI and Jabr-CLI remain independently developable. The future AFFiNE integration should adapt Jabr's worksheet blocks to the host's BlockSuite document model rather than introduce a private Yjs fork.

## Requirements and run

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.34.5`

```sh
pnpm install
pnpm dev
```

Use Add math block or Add text block to append worksheet content. Press `=` in a math block to request an evaluation. Enable the mock evaluator to see registered fixture behavior. All actual calculation remains unavailable until Jabr-CLI is connected.

## Validation

```sh
pnpm test:controller
pnpm typecheck
pnpm build
```

See [development.md](./development.md) for the detailed milestone plan and verification checklist.
