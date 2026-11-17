import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as Y from 'yjs';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true },
  appType: 'custom',
});

after(async () => { await vite.close(); });

const { WorksheetController } = await vite.ssrLoadModule('/src/worksheet/controller.ts');
const { worksheetResults } = await vite.ssrLoadModule('/src/worksheet/result-store.ts');
const { MockEvaluationAdapter } = await vite.ssrLoadModule('/src/worksheet/mock-evaluator.ts');

class FakeSlot {
  listeners = new Set();
  on(listener) { this.listeners.add(listener); return { dispose: () => this.listeners.delete(listener) }; }
  emit(value) { for (const listener of [...this.listeners]) listener(value); }
}

function fixture(ids) {
  const blocks = ids.map(id => ({ id, flavour: 'jabr:math', latex: 'x := 0', displayUnit: '', propsUpdated: new FakeSlot() }));
  return { blocks, worksheet: { children: blocks, childrenUpdated: new FakeSlot() } };
}

function successAdapter() {
  return { async evaluate(request) { return { blockId: request.blockId, requestId: request.requestId, sourceRevision: request.sourceRevision, status: 'success', resultLatex: String.raw`\boxed{fixture}` }; } };
}

test('source changes invalidate the edited row and later math rows only', async t => {
  const { blocks, worksheet } = fixture(['cascade-before', 'cascade-edited', 'cascade-after']);
  const controller = new WorksheetController({ documentId: 'controller-cascade-test', worksheet, adapter: successAdapter() });
  t.after(() => controller.dispose());
  await controller.requestEvaluation(blocks[0].id);
  assert.equal(worksheetResults.get(blocks[0].id).status, 'success');
  blocks[1].latex = 'y := 2';
  blocks[1].propsUpdated.emit({ key: 'latex' });
  assert.equal(worksheetResults.get(blocks[0].id).status, 'success');
  assert.equal(worksheetResults.get(blocks[1].id).status, 'idle');
  assert.equal(worksheetResults.get(blocks[1].id).sourceRevision, 1);
  assert.equal(worksheetResults.get(blocks[2].id).status, 'idle');
  assert.equal(worksheetResults.get(blocks[2].id).sourceRevision, 1);
});

test('real Yjs UndoManager undo and redo trigger controller invalidation', t => {
  const { blocks, worksheet } = fixture(['yjs-undo-redo-source']);
  const controller = new WorksheetController({ documentId: 'controller-yjs-undo-redo-test', worksheet });
  t.after(() => controller.dispose());

  const ydoc = new Y.Doc();
  const source = ydoc.getMap('math-source');
  source.set('latex', 'x := 0');
  const undoManager = new Y.UndoManager(source);
  source.observe(event => {
    if (!event.keysChanged.has('latex')) return;
    blocks[0].latex = source.get('latex');
    blocks[0].propsUpdated.emit({ key: 'latex' });
  });

  source.set('latex', 'x := 1');
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 1);
  undoManager.undo();
  assert.equal(blocks[0].latex, 'x := 0');
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 2);
  undoManager.redo();
  assert.equal(blocks[0].latex, 'x := 1');
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 3);

  undoManager.destroy();
  ydoc.destroy();
});

test('display-unit changes do not invalidate source results', t => {
  const { blocks, worksheet } = fixture(['display-unit-source']);
  const controller = new WorksheetController({ documentId: 'controller-display-unit-test', worksheet });
  t.after(() => controller.dispose());
  blocks[0].propsUpdated.emit({ key: 'displayUnit' });
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 0);
  assert.equal(worksheetResults.get(blocks[0].id).status, 'idle');
});

test('a delayed response cannot overwrite a newer source revision', async t => {
  const { blocks, worksheet } = fixture(['stale-response-source']);
  let resolveEvaluation;
  const adapter = { evaluate: () => new Promise(resolve => { resolveEvaluation = resolve; }) };
  const controller = new WorksheetController({ documentId: 'controller-stale-response-test', worksheet, adapter });
  t.after(() => controller.dispose());
  const pending = controller.requestEvaluation(blocks[0].id);
  assert.equal(worksheetResults.get(blocks[0].id).status, 'pending');
  blocks[0].latex = 'newer source';
  blocks[0].propsUpdated.emit({ key: 'latex' });
  resolveEvaluation({ blockId: blocks[0].id, requestId: 1, sourceRevision: 0, status: 'success', resultLatex: String.raw`\boxed{stale}` });
  await pending;
  assert.equal(worksheetResults.get(blocks[0].id).status, 'idle');
  assert.equal(worksheetResults.get(blocks[0].id).resultLatex, '');
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 1);
});

test('mock evaluator returns only exact registered fixtures and explicit errors', async () => {
  const adapter = new MockEvaluationAdapter();
  const base = { documentId: 'mock-test', blockId: 'mock-block', requestId: 7, sourceRevision: 2, displayUnit: '' };
  const success = await adapter.evaluate({ ...base, latex: String.raw`F \coloneqq \placeholder[force]{100\,\mathrm{N}}` });
  assert.equal(success.status, 'success');
  assert.match(success.resultLatex ?? '', /MOCK/);
  const intentionalError = await adapter.evaluate({ ...base, latex: 'MOCK_ERROR' });
  assert.equal(intentionalError.status, 'error');
  const unknown = await adapter.evaluate({ ...base, latex: 'x := 123' });
  assert.equal(unknown.status, 'error');
  assert.match(unknown.diagnostic ?? '', /No mock fixture/);
});

test('default controller adapter reports unavailable rather than pretending to calculate', async t => {
  const { blocks, worksheet } = fixture(['unavailable-source']);
  const controller = new WorksheetController({ documentId: 'controller-unavailable-test', worksheet });
  t.after(() => controller.dispose());
  await controller.requestEvaluation(blocks[0].id);
  assert.equal(worksheetResults.get(blocks[0].id).status, 'unavailable');
});

test('removed blocks lose their subscriptions and transient result state', async t => {
  const { blocks, worksheet } = fixture(['removed-source']);
  const controller = new WorksheetController({ documentId: 'controller-remove-test', worksheet, adapter: successAdapter() });
  t.after(() => controller.dispose());
  await controller.requestEvaluation(blocks[0].id);
  assert.equal(worksheetResults.get(blocks[0].id).status, 'success');
  worksheet.children = [];
  worksheet.childrenUpdated.emit(undefined);
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 0);
  blocks[0].propsUpdated.emit({ key: 'latex' });
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 0);
});
