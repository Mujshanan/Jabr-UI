# Jabr UI

BlockSuite-based calculation-sheet blocks. Jabr UI is intended to remain independently developable and will later be integrated into an AFFiNE-based editor alongside Jabr-CLI.

## First implementation: `jabr:math`

This repository currently contains a minimal BlockSuite host and one custom math block:

- `jabr:root`: a small document root used by the standalone prototype.
- `jabr:text`: a minimal editable plain-text block for testing BlockSuite schema registration, rendering, model updates, and persistence.\n- `jabr:math`: a content block embedding MathLive's `<math-field>`.
- LaTeX source is stored in the BlockSuite document model; rendered DOM is never persisted.
- The initial interaction uses MathLive's fill-in-the-blank mode: the surrounding expression is read-only while named placeholders remain editable.
- MathLive input updates the BlockSuite model, and external model changes are reflected back into the field.\n- The math block includes an output inspector for complete LaTeX, LaTeX with placeholders expanded, and each individual prompt value.
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

Open the local Vite URL. Use **Add text block** to test plain-text document updates and **Add math block** to insert another expression. Each math block starts with editable numerator, denominator, and variable placeholders. Expand **Inspect MathLive output** beneath a math field to inspect its LaTeX and prompt values.

## Build

```sh
pnpm typecheck
pnpm build
```

## Current scope

- One custom block flavour: `jabr:math`.
- MathLive owns mathematical input and LaTeX editing within the placeholders.
- BlockSuite owns block identity, document state, and updates.
- Jabr-CLI is not a dependency. The future CLI integration should consume a stable expression/AST contract rather than coupling this block to the parser's internal implementation.

## Notes

The first prototype uses a small custom BlockSuite root and `EditorHost`, so it can run without AFFiNE. The eventual AFFiNE integration should register `JabrMathBlockSpec` and `JabrMathSchema` in the host editor's existing spec and schema collections.

This is an initial integration prototype. Dependency installation, type-checking, and browser interaction still need to be run locally before treating it as verified.
