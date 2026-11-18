import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true },
  appType: 'custom',
});

after(async () => { await vite.close(); });

const {
  assertValidDocument,
  blockIdFromBlockSuiteModelId,
  deserializeDocument,
  getDocumentReadingOrder,
  serializeDocument,
} = await vite.ssrLoadModule('/src/document/model.ts');

test('BlockSuite model identity is preserved by the document adapter boundary', () => {
  const nativeId = 'blocksuite-native-model-id';
  assert.equal(blockIdFromBlockSuiteModelId(nativeId), nativeId);
  assert.throws(() => blockIdFromBlockSuiteModelId('  '), /non-empty string/);
});

function fixture() {
  return {
    schemaVersion: 1,
    documentId: 'document-1',
    title: 'M1 fixture',
    blocks: [
      { id: 'heading-1', type: 'heading', level: 1, text: 'Beam design' },
      { id: 'text-1', type: 'text', markdown: 'Authored engineering note.' },
      {
        id: 'table-1', type: 'table',
        columns: [{ id: 'column-1', name: 'Length', valueType: 'quantity', unitSymbol: 'm' }],
        rows: [{ id: 'row-1', cells: [{ id: 'cell-1', columnId: 'column-1', source: '6.0' }] }],
      },
      {
        id: 'matrix-1', type: 'matrix', rowCount: 1, columnCount: 2,
        entries: [{ id: 'entry-1', source: '1' }, { id: 'entry-2', source: '2' }],
      },
      {
        id: 'assign-1', type: 'assign', declarationId: 'decl-1', identifier: 'L',
        initializer: { kind: 'literal', source: '6.0 m' },
      },
      {
        id: 'expr-1', type: 'expr', source: 'L / 2',
        resultBinding: { declarationId: 'decl-2', identifier: 'a' },
      },
      {
        id: 'logic-1', type: 'logic', scopeId: 'scope-1', kind: 'if', exports: [],
        branches: [{ id: 'branch-1', conditionSource: 'L > 0', blocks: [
          {
            id: 'assign-inner', type: 'assign', declarationId: 'decl-3', identifier: 'halfL',
            initializer: { kind: 'expression', source: 'L / 2' },
          },
        ] }],
      },
      {
        id: 'func-1', type: 'func', declarationId: 'decl-4', scopeId: 'func-scope-1', name: 'area',
        parameters: [{ id: 'parameter-1', name: 'width' }],
        body: [{ id: 'expr-inner', type: 'expr', source: 'L * width' }],
      },
      { id: 'check-1', type: 'check', checkKind: 'capacity', label: 'Bending', expressionSource: 'MEd <= MRd' },
      {
        id: 'layout-1', type: 'column-layout',
        columns: [{ id: 'layout-col-1' }, { id: 'layout-col-2' }],
        rows: [
          { id: 'layout-row-1', cells: [
            { id: 'layout-cell-1', columnId: 'layout-col-1', blocks: [{ id: 'left-top', type: 'text', markdown: 'Left top' }] },
            { id: 'layout-cell-2', columnId: 'layout-col-2', blocks: [{ id: 'right-top', type: 'text', markdown: 'Right top' }] },
          ] },
          { id: 'layout-row-2', cells: [
            { id: 'layout-cell-3', columnId: 'layout-col-1', blocks: [{ id: 'left-bottom', type: 'text', markdown: 'Left bottom' }] },
            { id: 'layout-cell-4', columnId: 'layout-col-2', blocks: [{ id: 'right-bottom', type: 'text', markdown: 'Right bottom' }] },
          ] },
        ],
      },
    ],
  };
}

test('all seven calculation categories and the layout container serialize round-trip', () => {
  const document = fixture();
  assert.doesNotThrow(() => assertValidDocument(document));
  const restored = deserializeDocument(serializeDocument(document));
  assert.deepEqual(restored, document);
  assert.equal(restored.schemaVersion, 1);
});

test('column layout reading order is top-to-bottom, then left-to-right within each row', () => {
  const document = fixture();
  const layoutOrder = getDocumentReadingOrder(document)
    .filter(block => ['layout-1', 'left-top', 'right-top', 'left-bottom', 'right-bottom'].includes(block.id))
    .map(block => block.id);
  assert.deepEqual(layoutOrder, ['layout-1', 'left-top', 'right-top', 'left-bottom', 'right-bottom']);
});

test('duplicate block identities are rejected', () => {
  const document = fixture();
  document.blocks.push({ ...document.blocks[0] });
  assert.throws(() => assertValidDocument(document), /must be unique/);
});

test('duplicate declaration identities are rejected', () => {
  const document = fixture();
  document.blocks.push({
    id: 'assign-duplicate', type: 'assign', declarationId: 'decl-1', identifier: 'P',
    initializer: { kind: 'literal', source: '10 kN' },
  });
  assert.throws(() => assertValidDocument(document), /declarationId must be unique/);
});

test('derived evaluation data cannot enter the authored document', () => {
  const document = fixture();
  document.blocks[4].resultLatex = 'stale-result';
  assert.throws(() => serializeDocument(document), /derived state and cannot be persisted/);
});

test('unsupported schema versions fail explicitly', () => {
  const document = fixture();
  document.schemaVersion = 2;
  assert.throws(() => assertValidDocument(document), /Unsupported document schema version/);
});

test('matrix dimensions must agree with row-major entry count', () => {
  const document = fixture();
  document.blocks[3].entries.pop();
  assert.throws(() => assertValidDocument(document), /entries length must equal/);
});

test('column layout rejects cells that are not stored left-to-right', () => {
  const document = fixture();
  document.blocks[9].rows[0].cells.reverse();
  assert.throws(() => assertValidDocument(document), /ordered left-to-right/);
});

test('table cells must reference a declared column and retain stable cell IDs', () => {
  const document = fixture();
  document.blocks[2].rows[0].cells[0].columnId = 'missing-column';
  assert.throws(() => assertValidDocument(document), /unknown column/);
});
