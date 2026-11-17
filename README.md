# Jabr UI

BlockSuite-based calculation-sheet blocks. Jabr UI is intended to remain independently developable and will later be integrated into an AFFiNE-based editor alongside Jabr-CLI.

## First implementation: `jabr:math`

This repository currently contains a minimal BlockSuite host and one custom math block:

- `jabr:root`: a small document root used by the standalone prototype.
- `jabr:math`: a content block embedding MathLive's editable `<math-field>`.
- LaTeX source is stored in the BlockSuite document model; rendered DOM is never persisted.
- MathLive input updates the BlockSuite model, and model changes (including undo/remote updates) are reflected back into the field.
- The demo document is persisted locally using IndexedDB through `y-indexeddb`.

The root block and demo host are scaffolding for this prototype, not a general block framework.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.34.5`

## Run

```sh
pnpm install
pnpm dev
```

Open the local Vite URL. Use **Add math block** to insert another expression. The initial expression uses MathLive placeholder slots.

## Build

```sh
pnpm typecheck
pnpm build
```

## Current scope

- One custom block flavour: `jabr:math`.
- MathLive owns interactive mathematical input and LaTeX editing.
- BlockSuite owns block identity, document state, and updates.
- Jabr-CLI is not a dependency. The future CLI integration should consume a stable expression/AST contract rather than coupling this block to the parser's internal implementation.

## Notes

The first prototype uses a small custom BlockSuite root and `EditorHost`, so it can run without AFFiNE. The eventual AFFiNE integration should register `JabrMathBlockSpec` and `JabrMathSchema` in the host editor's existing spec and schema collections instead of embedding this demo root.
