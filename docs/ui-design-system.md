# Jabr Shared UI Design System

Status: initial design contract for the three engine workbenches and the Jabr-UI host application.

## Purpose

Jabr Math, Jabr Table, and Jabr Diagram are independently developed engines. Each repository may keep a small workbench for exercising its engine, but none of those workbenches is a second production editor.

Jabr-UI owns the unified production document, BlockSuite blocks, worksheet navigation, persistence, collaboration, and the full user experience. The engine workbenches should share the same visual language so that switching between them feels like using one product.

## Product identity

- Product name: **Jabr**
- Product surfaces: **Math**, **Table**, and **Diagram**
- Workbench label: **ENGINE WORKBENCH**
- Production application: **Jabr Studio / Jabr-UI**
- Tone: technical, quiet, precise, and suitable for engineering calculations.
- Avoid decorative gradients, oversized marketing typography, excessive shadows, and unrelated accent colors.

## Design tokens

Use these values as the shared baseline. A component may add local tokens, but should not redefine the shared brand colors.

| Token | Value | Use |
|---|---|---|
| Brand navy | `#101923` | Product header, high-contrast chrome |
| Deep blue | `#1E4964` | Brand mark, secondary emphasis |
| Primary blue | `#2F7196` | Primary actions, active controls |
| Primary hover | `#3B86AD` | Hover state for primary actions |
| Soft blue | `#EDF6FB` | Selected/active surfaces |
| Main text | `#1B2A38` | Primary text |
| Muted text | `#71818F` | Labels, hints, secondary metadata |
| Border | `#DCE3E9` | Panels, controls and separators |
| Soft border | `#E8EDF1` | Table grid and subtle dividers |
| Surface | `#FFFFFF` | Cards and panels |
| Workspace | `#F2F5F8` | Application background |

CSS custom properties:

```css
:root {
  --jabr-brand-950: #101923;
  --jabr-brand-800: #1e4964;
  --jabr-accent-700: #2f7196;
  --jabr-accent-600: #3b86ad;
  --jabr-accent-100: #edf6fb;
  --jabr-text: #1b2a38;
  --jabr-muted: #71818f;
  --jabr-border: #dce3e9;
  --jabr-border-soft: #e8edf1;
  --jabr-surface: #ffffff;
  --jabr-workspace: #f2f5f8;
  --jabr-radius-sm: 5px;
  --jabr-radius-md: 7px;
  --jabr-radius-lg: 9px;
}
```

## Typography

- Use the system sans-serif stack: Inter when available, then platform UI fonts.
- Body and control text should generally be 11–13px in compact workbenches.
- Section labels use 9–10px, semibold/bold, uppercase, with restrained letter spacing.
- Monospace is reserved for code, tokens, ASTs, XML, and diagnostic output.
- Avoid reducing essential content below 10px.

## Shared application frame

Engine workbenches should use a consistent frame:

1. A 62px navy top bar.
2. A Jabr brand mark and component name on the left.
3. A short workbench/document title in the middle when space permits.
4. A compact status indicator and one primary action on the right.
5. A light neutral workspace beneath the header.
6. White panels with subtle borders and consistent corner radii.

On narrow screens, hide nonessential header metadata before hiding primary controls. Side panels may collapse or become hidden, but the main work surface must remain usable.

## Component-specific workbench layouts

### Math

- Source editor is the primary input surface.
- Keep Run and Tokenize actions explicit.
- Show tokenizer, AST, report and diagnostics as separate result panels.
- The workbench may use the engine's current editor implementation; it must not be mistaken for the production MathLive worksheet block.
- Preserve clear engine readiness and error states.

### Table

- Keep the editable data grid central.
- Table, Matrix and XML are separate workbench views.
- Use a compact formula/value inspection row and a cell inspector.
- Label planned operations as planned; never imply that an unimplemented formula or matrix operation has executed.

### Diagram

- Keep the drawing canvas central.
- Place tools and layers in a left panel, properties in a right inspector, and canvas actions above the work surface.
- Use the same header, border, surface, typography and accent tokens as Math and Table.
- Keep the SVG/canvas engine harness independent of BlockSuite and Yjs.

## Interaction states

- Default controls: white surface, neutral border, dark text.
- Hover: subtle blue border or soft-blue surface.
- Active/selected: soft-blue surface and primary-blue border/text.
- Disabled: reduced contrast and disabled cursor; do not rely on opacity alone.
- Success: restrained green status text/dot.
- Warning or unsaved local state: restrained amber status text/dot.
- Error: restrained red text and pale red surface.
- Always pair color with text or another visible indicator.

## Engineering workbench boundaries

The standalone workbenches are test fixtures, not production editors.

- No BlockSuite or Yjs dependency is required in the engine repositories.
- No production document persistence or collaboration is implemented in the workbench.
- No UI-only mock should be presented as an engine capability.
- Engine APIs, serialization, evaluation, geometry, and data operations remain owned by their respective repositories.
- Jabr-UI consumes those APIs through adapters and renders the production blocks.

## Acceptance checklist

- [ ] All three workbenches use the shared brand colors and typography.
- [ ] All three have a recognizable Jabr header and component identity.
- [ ] Main work surfaces use the same neutral workspace and white panel language.
- [ ] Active, disabled, success, warning, and error states are distinguishable.
- [ ] Layouts remain usable at desktop and narrow viewport widths.
- [ ] Each workbench clearly identifies itself as an engine-testing surface.
- [ ] No workbench duplicates Jabr-UI's production document or collaboration responsibilities.
