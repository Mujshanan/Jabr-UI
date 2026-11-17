# Jabr UI

BlockSuite-based calculation-sheet blocks. Jabr UI is intended to remain independently developable and will later be integrated into an AFFiNE-based editor alongside Jabr-CLI.

## Current prototype

This repository contains a minimal BlockSuite host and two custom content blocks:

- `jabr:root`: a small document root used by the standalone prototype.
- `jabr:text`: an editable plain-text block for testing schema registration, rendering, model updates, and persistence.
- `jabr:math`: a content block embedding MathLive's `<math-field>`.

The math block currently uses MathLive's fill-in-the-blank mode: the surrounding expression is read-only while named placeholder slots remain editable. Its output inspector displays:

- Complete LaTeX from the MathLive field.
- LaTeX with placeholder commands expanded.
- Each placeholder identifier and its current LaTeX value.

LaTeX source is stored in the BlockSuite document model; rendered DOM is never persisted. MathLive input updates the BlockSuite model, and external model changes are reflected back into the field. The demo document is persisted locally using IndexedDB through `y-indexeddb`.

The root block and demo host are scaffolding for this prototype, not a general block framework.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.34.5`

## Run

```sh
pnpm install
pnpm dev
```

Open the local Vite URL. Use **Add text block** to test plain-text document updates and **Add math block** to insert another expression. Each math block starts with editable numerator, denominator, and variable placeholders. Expand **Inspect MathLive output** beneath a math field to inspect its LaTeX and prompt values.

## Build

```sh
pnpm typecheck
pnpm build
```

## Current scope

- Two custom content block flavours: `jabr:text` and `jabr:math`.
- MathLive owns mathematical input and LaTeX editing within the placeholders.
- BlockSuite owns block identity, document state, and updates.
- Jabr-CLI is not a dependency. The future CLI integration should consume a stable expression/AST contract rather than coupling this block to the parser's internal implementation.

## Notes

The first prototype uses a small custom BlockSuite root and `EditorHost`, so it can run without AFFiNE. The eventual AFFiNE integration should register the Jabr block specs and schemas in the host editor's existing spec and schema collections.

This is an initial integration prototype. Dependency installation, type-checking, and browser interaction still need to be run locally before treating it as verified.
