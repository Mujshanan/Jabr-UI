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

The math block currently provides:

- Named structural placeholders for fractions, square roots, indexed roots, integrals, and 2×2 matrices.
- A slash shortcut that inserts a structured fraction.
- Native MathLive Tab / Shift+Tab placeholder traversal and spatial arrow-key navigation.
- Engineering unit inline shortcuts such as kg, mm, cm, kN, MPa, GPa, mps, and mps2.
- LaTeX persistence in the BlockSuite model.

### Dual-zone calculation row

Each math block is presented as an editable input zone, an equals separator, and a result zone:

- Left: editable MathLive expression.
- Middle: equals delimiter.
- Right: read-only MathLive result display.
- Far right: optional display-unit request field.

Pressing `=` dispatches a `jabr-evaluate-request` event containing the block ID and LaTeX source. The current UI marks the request as pending; it does not calculate anything. The result LaTeX and status are presentation properties that a future worksheet controller/CLI adapter can update. The display-unit field records the requested output unit but does not perform conversion.

### Text blocks

Text blocks are separate BlockSuite content blocks with their own persisted text property. They are created using the Add text block control. Automatic Spacebar conversion between math and prose is not implemented yet.

## Persistence

The document schema and block views are registered through the BlockSuite 0.19.5 `BlockStdScope` / `BlockViewExtension` API. The local IndexedDB setup persists both the collection metadata and the worksheet document using y-indexeddb.

The canonical mathematical source is the `latex` property. Rendered DOM and MathLive's internal editing state are not persisted.

## Architecture ownership

- BlockSuite owns block identity, schema validation, document order, persistence, and model updates.
- MathLive owns mathematical input, placeholders, cursor/selection behavior, and LaTeX editing.
- Jabr-UI owns block presentation, worksheet flow, evaluation-request events, and result display.
- Jabr-CLI will later own parsing, assignment/evaluation semantics, variable scope, dependency DAG, quantities, units, and dimensional validation.
- Jabr-UI must not duplicate calculation or unit semantics while those CLI capabilities are being developed.

The dependency versions are aligned to the published BlockSuite 0.19.5 packages. This is a standalone prototype API; compatibility with current AFFiNE/BlockSuite versions will be handled during integration.

## Requirements

- Node.js ^20.19.0 || >=22.12.0
- pnpm 10.34.5

## Run

```sh
pnpm install
pnpm dev
```

Use Add math block or Add text block to append worksheet content. In a math block, use the template toolbar or `/` to insert structured mathematical groups. Press `=` to dispatch an evaluation request. Fill placeholders using MathLive's native Tab / Shift+Tab navigation. Expand Inspect expression and placeholders to inspect the LaTeX and prompt values.

## Build

```sh
pnpm typecheck
pnpm build
```

## Verification

The feature branch has GitHub Actions CI configured to install dependencies, typecheck, and build. Browser interaction testing is still required for placeholder traversal, persistence, read-only result rendering, and text editing. See [development.md](./development.md) for the milestone plan and acceptance criteria.
