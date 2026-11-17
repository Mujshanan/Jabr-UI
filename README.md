# Jabr UI

BlockSuite-based calculation-sheet blocks. Jabr UI is intended to remain independently developable and will later be integrated into an AFFiNE-based editor alongside Jabr-CLI.

## First prototype: `jabr:math`

This prototype establishes a minimal standalone BlockSuite host and one custom content block:

- `jabr:root`: minimal document root required by the standalone host.
- `jabr:math`: MathLive-powered mathematical fill-in-the-blank block.

The math block uses MathLive's fill-in-the-blank mode. The surrounding expression is read-only while named placeholder slots remain editable. The initial expression contains variable, numerator, and denominator placeholders.

The block's canonical document property is `latex`. Rendered DOM and MathLive's internal state are not persisted. On each MathLive input event, the LaTeX source is written to the BlockSuite model. Model updates are reflected back into the field without resetting it when the value is already synchronized.

The prototype also exposes a small output inspector showing the complete LaTeX, LaTeX with placeholder commands expanded, and each placeholder's current value.

The document is persisted locally in the browser using IndexedDB through `y-indexeddb`.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.34.5`

## Run

```sh
pnpm install
pnpm dev
```

Open the local Vite URL. Use **Add math block** to insert another expression. Fill the named placeholders directly in the mathfield. Expand **Inspect MathLive output** to inspect the source and prompt values.

## Build

```sh
pnpm typecheck
pnpm build
```

## Architecture

- BlockSuite owns block identity, document state, updates, and the document tree.
- MathLive owns mathematical input, placeholder interaction, and LaTeX editing.
- `jabr:math` stores LaTeX source only; rendered HTML is never stored.
- Jabr-CLI is deliberately not a dependency. A future integration will define a stable expression/AST contract without coupling the UI block to parser internals.

The standalone root and host are prototype scaffolding, not a general block framework. The first implementation pins BlockSuite `0.19.5`, which uses the standalone `Doc` / `EditorHost` / `BlockSpec` API. This keeps the prototype small and independently runnable; compatibility with the newer BlockSuite extension API used by current AFFiNE must be handled explicitly during final integration.

## Verification status

The source is written against BlockSuite `0.19.5` and MathLive `0.111.4`. Dependency installation, TypeScript checking, production build, and browser interaction still need to be run in a local development environment before this prototype can be considered verified.
