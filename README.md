# Jabr UI

BlockSuite-based calculation-sheet blocks. Jabr UI is intended to remain independently developable and will later be integrated into an AFFiNE-based editor alongside Jabr-CLI.

## First prototype: structured MathLive input

This prototype establishes a minimal standalone BlockSuite host and one custom content block:

- jabr:root: minimal document root required by the standalone host.
- jabr:math: MathLive-powered editable mathematical expression.

MathLive is the sole mathematical input editor. It owns structured mathematical editing: fractions, scripts, roots, fences, matrices, cursor movement, selection, and LaTeX serialization. Jabr does not implement a second equation editor or cursor model.

### Mathcad-style placeholders and templates

The default expression is an assignment-shaped example:

F := [force]

Each named placeholder represents a complete mathematical quantity, including its numeric expression and unit. For example, the force prompt can contain 100 N. Prompt identifiers are editor metadata, not worksheet variables.

The math block provides structural insertion templates:

- Fraction: separate numerator and denominator placeholders.
- Square root: radicand placeholder.
- Indexed root: index and radicand placeholders.
- Integral: lower limit, upper limit, integrand, and differential variable placeholders.
- 2×2 matrix: four independent cell placeholders.

Typing / in the math field inserts a structured fraction rather than a literal slash. Template prompt identifiers are made unique for each insertion. Subscript and superscript entry remains native to MathLive through _ and ^.

MathLive's native Tab and Shift+Tab placeholder navigation and spatial arrow-key navigation are preserved. The host does not install a competing Tab handler inside the math field.

The field also defines a small set of engineering unit inline shortcuts. After a number or space, typing kg, mm, cm, kN, MPa, GPa, mps, or mps2 inserts upright unit notation. These are input conveniences only; they do not parse units or perform conversions.

### Persistence

The block's canonical document property is latex. Rendered DOM and MathLive's internal state are not persisted. On each MathLive input event, the LaTeX source is written to the BlockSuite model. Model updates are reflected back into the field without resetting it when the value is already synchronized.

The expression inspector exposes the LaTeX source and current values for named prompts. The document is persisted locally in the browser using IndexedDB through y-indexeddb.

## Requirements

- Node.js ^20.19.0 || >=22.12.0
- pnpm 10.34.5

## Run

```sh
pnpm install
pnpm dev
```

Open the local Vite URL. Use Add math block to insert another expression. Edit anywhere in the equation. Use the template toolbar or / to insert structured mathematical groups, then fill their placeholders with the keyboard. Use Tab / Shift+Tab to move between placeholders. Expand Inspect expression and placeholders to inspect the LaTeX and prompt values.

## Build

```sh
pnpm typecheck
pnpm build
```

## Architecture

- BlockSuite owns block identity, document state, updates, and the document tree.
- MathLive owns mathematical input, placeholder interaction, cursor/selection behavior, and LaTeX editing.
- jabr:math stores LaTeX source only; rendered HTML is never stored.
- The worksheet controller will own document flow, block lifecycle, and evaluation orchestration.
- Jabr-CLI will own parsing, assignment/evaluation semantics, symbol scope, dependency DAG, quantities, units, and dimensional validation.
- Jabr-CLI is deliberately not a dependency of this prototype. A future integration will define a stable expression/worksheet contract without coupling the UI block to parser internals.

The standalone root and host are prototype scaffolding, not a general block framework. The first implementation pins BlockSuite 0.19.5, which uses the standalone Doc / EditorHost / BlockSpec API. Compatibility with the newer BlockSuite extension API used by current AFFiNE must be handled explicitly during final integration.

## Verification status

The source is written against BlockSuite 0.19.5 and MathLive 0.111.4. The structural templates and shortcut behavior are implemented on the feature branch, but dependency installation, TypeScript checking, production build, and browser interaction still need to be run in a local development environment before this prototype can be considered verified. See development.md for the full plan and acceptance criteria.
