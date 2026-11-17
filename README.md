# Jabr UI

BlockSuite-based calculation-sheet blocks. Jabr UI is intended to remain independently developable and will later be integrated into an AFFiNE-based editor alongside Jabr-CLI.

## First prototype: editable MathLive expression block

This prototype establishes a minimal standalone BlockSuite host and one custom content block:

- `jabr:root`: minimal document root required by the standalone host.
- `jabr:math`: MathLive-powered editable mathematical expression.

The math block is a normal editable MathLive field, not a read-only expression with only a few active slots. Users can type and navigate through the complete expression. MathLive owns structured mathematical editing: fractions, scripts, roots, fences, cursor movement, selection, and LaTeX serialization.

### Mathcad-style quantity placeholders

The starter expression is:

`F = [mass] · [acceleration]`

Each named placeholder represents a complete quantity, including its numeric expression and unit. For example, the mass prompt can contain `5 kg`, and the acceleration prompt can contain `9.81 m/s²`. A quantity is not split into separate number and unit boxes.

Prompt IDs are semantic identifiers (`mass`, `acceleration`, `force`) rather than display labels. This allows Jabr to associate each slot with an expected physical dimension, show a relevant input hint, and later validate the entered quantity.

The MathLive field also defines a small set of engineering unit inline shortcuts. After a number or space, typing `kg`, `mm`, `cm`, `kN`, `MPa`, `GPa`, `mps`, or `mps2` inserts an upright unit expression. For example, `9.81 mps2` inserts `9.81\,\mathrm{m/s^2}`. Tab and Shift+Tab move between named prompts using MathLive's placeholder navigation.

**Current limitation:** the shortcuts only improve unit notation and readability. This prototype does not yet parse units, convert quantities, or check dimensional consistency. Those behaviors belong in a separate Jabr quantity/unit layer and eventually the Jabr-CLI calculation contract. MathLive is the structured input surface, not the unit engine.

### Persistence

The block's canonical document property is `latex`. Rendered DOM and MathLive's internal state are not persisted. On each MathLive input event, the LaTeX source is written to the BlockSuite model. Model updates are reflected back into the field without resetting it when the value is already synchronized.

The expression inspector exposes the LaTeX source and current values for named prompts. The document is persisted locally in the browser using IndexedDB through `y-indexeddb`.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.34.5`

## Run

```sh
pnpm install
pnpm dev
```

Open the local Vite URL. Use **Add math block** to insert another expression. Edit anywhere in the equation; each named placeholder accepts a complete mathematical quantity, including its unit. Use Tab / Shift+Tab to move between placeholders. Expand **Inspect expression inputs** to inspect the LaTeX and prompt values.

## Build

```sh
pnpm typecheck
pnpm build
```

## Architecture

- BlockSuite owns block identity, document state, updates, and the document tree.
- MathLive owns mathematical input, placeholder interaction, cursor/selection behavior, and LaTeX editing.
- `jabr:math` stores LaTeX source only; rendered HTML is never stored.
- Jabr-specific quantity parsing, unit catalog, conversion, and dimensional validation are separate from MathLive.
- Jabr-CLI is deliberately not a dependency. A future integration will define a stable expression/AST and quantity contract without coupling the UI block to parser internals.

The standalone root and host are prototype scaffolding, not a general block framework. The first implementation pins BlockSuite `0.19.5`, which uses the standalone `Doc` / `EditorHost` / `BlockSpec` API. This keeps the prototype small and independently runnable; compatibility with the newer BlockSuite extension API used by current AFFiNE must be handled explicitly during final integration.

## Verification status

The source is written against BlockSuite `0.19.5` and MathLive `0.111.4`. Dependency installation, TypeScript checking, production build, and browser interaction still need to be run in a local development environment before this prototype can be considered verified.
