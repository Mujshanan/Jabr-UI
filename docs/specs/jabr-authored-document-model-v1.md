# Jabr Authored Document Model v1

**Status:** M1 implementation baseline  
**Owner:** Jabr-UI  
**Schema identifier:** `jabr-document-v1`  
**Persistence owner:** BlockSuite / Yjs through Jabr-UI  
**Calculation owner:** Planned Jabr Engine

## 1. Purpose

Define a durable, renderer-independent representation of authored worksheet content and the identities needed to preserve it across edits, movement, reloads and future engine integration.

This model describes what the user authored. It is not a calculation runtime, dependency graph, result cache or execution snapshot.

## 2. Ownership and persistence boundary

- BlockSuite/Yjs remains the canonical live document store and owns authored persistence, collaboration and undo/redo.
- Jabr-UI owns the document schema, BlockSuite adapters and schema migration entry points.
- A BlockSuite block's persisted `model.id` is the source of its `BlockId`; the adapter must preserve it rather than regenerate it during serialization, movement or reload.
- A `DeclarationId` is generated once when a declaration is authored and persisted with that declaration. Renaming a variable or function does not replace its identity.
- Table row, column and cell IDs; matrix-entry IDs; function-parameter IDs; scope IDs; and layout row/column IDs are authored identities, not array indexes.
- JSON serialization in `src/document/model.ts` is a validated interchange/fixture representation. It does not replace Yjs as the live collaborative store.

The authored document may contain source, typed table input, matrix entry source, structural metadata, layout, and user-selected presentation preferences. It must not contain calculated values, evaluation statuses, diagnostics, request IDs, execution generations, snapshots, cache fingerprints or rendered result caches. Those belong to Engine or transient UI presentation.

## 3. Schema v1

The root document contains:

- `schemaVersion: 1`
- stable `documentId`
- authored `title`
- ordered top-level `blocks`

Every block has a stable `id` and a discriminant `type`.

### Calculation block taxonomy

| Type | Authored payload |
|---|---|
| `table` | Stable columns, rows and cells; typed column metadata; authored cell source |
| `matrix` | Explicit row/column dimensions and row-major authored entry source |
| `assign` | Stable declaration ID, identifier and literal/expression initializer source |
| `expr` | Expression source and optional stable named-result declaration identity |
| `logic` | Stable lexical scope identity, ordered branches, child blocks and explicit exported declaration IDs |
| `func` | Stable function declaration identity, ordered parameter identities and body blocks |
| `check` | Check kind, label and authored check expression |

Structural/informational blocks are `heading` and `text`. They are document content, not calculation nodes.

`column-layout` is a separate composition container, not an eighth calculation category. It has stable column and row identities, ordered rows, and cells that contain authored child blocks.

## 4. Identity invariants

1. Block IDs are unique within a document tree and survive edit, move, reorder, save/reload and undo/redo.
2. Declaration IDs are unique within a document. Editing a declaration changes its authored revision/content but does not create a new declaration identity.
3. A named expression result has its own declaration identity.
4. Table rows, columns and cells retain identity when unrelated rows/columns are inserted or reordered. Cell identity must not be derived from its current row/column array indexes.
5. Matrix entries retain identity when the matrix is edited; a dimension-changing operation must explicitly define which entries are retained, created or removed.
6. Function parameters and lexical scopes have stable IDs; parameter order is represented by array order, not by identity.
7. IDs are opaque strings. UUID generation is the default for new Jabr-owned identities. Existing BlockSuite IDs are preserved as-is by the adapter.
8. Display names are not identities. Renaming must not invalidate references solely because an identifier string changed; semantic binding is an Engine concern.

## 5. Document order and multicolumn layout

Top-level block order and nested child arrays are authored order.

For `ColumnLayoutBlock`:

- Rows are stored top-to-bottom.
- Cells within each row are stored in strictly increasing `columnIndex` order (left-to-right).
- Blocks within a cell preserve their authored order.
- Reading order traverses row 1 left-to-right, then row 2 left-to-right, continuing downward.
- The layout container creates neither a calculation node nor a lexical scope.
- Resizing columns or responsive reflow must not silently change row/cell membership or semantic order. A user-authored move that changes rows/cells is an explicit document edit.

The model validates left-to-right cell ordering rather than silently sorting malformed persisted input. Rendering may adapt widths or stack columns on narrow screens, but must retain the stored reading order.

## 6. Validation and serialization

The M1 model implementation provides:

- discriminated TypeScript block contracts for all seven calculation categories and the composition container;
- branded ID types and secure UUID factories for new Jabr-owned identities;
- validation for supported schema version, unique block/declaration/auxiliary identities, required fields, table references, matrix dimensions and layout ordering;
- recursive document reading-order traversal;
- validated JSON serialization/deserialization.

Unknown schema versions fail explicitly. A migration must be a separately named, version-to-version adapter; deserialization must not guess or silently coerce a future version.

Known derived-state properties are rejected recursively by the authored serializer. The UI adapter must also keep calculation results out of Yjs block props; serializer validation is a second boundary, not a substitute for correct storage ownership.

## 7. Deliberate non-goals

M1 does not implement:

- expression parsing, evaluation, unit semantics or identifier resolution;
- declaration visibility, duplicate-name rules, lexical name lookup or assignment execution;
- worksheet execution IDs, source revisions, calculation generations, snapshots or result storage;
- dependency graph construction or scheduling;
- Table/Matrix calculation operations;
- function invocation or Logic execution;
- Check compliance evaluation;
- visual editors for block types not yet implemented in Jabr-UI.

These are owned by Math, Table, Engine or later UI milestones. The model stores authored source and stable identities only.

## 8. Acceptance tests

The M1 document model tests must demonstrate:

- all seven calculation block types and the separate layout container survive serialize/deserialize unchanged;
- duplicate block and declaration IDs are rejected;
- table cells cannot reference undeclared columns;
- matrix dimensions match the row-major entry count;
- column layout order is top-to-bottom and left-to-right within each row;
- malformed column order is rejected, not silently normalized;
- unsupported schema versions fail explicitly;
- derived evaluation properties cannot enter authored serialization.

## 9. M1 implementation status

Implemented in this branch:

- `src/document/model.ts`: schema v1 types, identity factories, validation, reading order and JSON round-trip functions;
- `tests/document-model.test.mjs`: schema, identity, layout-order and authored/derived-boundary tests;
- `test:document`: dedicated test command.

The live BlockSuite integration remains the next adapter-level verification: ensure native model IDs are preserved and add declaration IDs as persisted authored props when Assign/Func/Expr block schemas are introduced. Browser persistence/undo-redo verification remains required before treating the complete M1 milestone as closed.
