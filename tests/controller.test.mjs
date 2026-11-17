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

const { WorksheetController } = await vite.ssrLoadModule('/src/worksheet/controller.ts');
const { worksheetResults } = await vite.ssrLoadModule('/src/worksheet/result-store.ts');

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

test('programmatic undo and redo updates use the propsUpdated path', t => {
  const { blocks, worksheet } = fixture(['undo-redo-source']);
  const controller = new WorksheetController({ documentId: 'controller-undo-redo-test', worksheet });
  t.after(() => controller.dispose());
  // Simulate Yjs replay: model props change without a DOM input event.
  blocks[0].latex = 'x := 1';
  blocks[0].propsUpdated.emit({ key: 'latex' });
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 1);
  blocks[0].latex = 'x := 2';
  blocks[0].propsUpdated.emit({ key: 'latex' });
  assert.equal(worksheetResults.get(blocks[0].id).sourceRevision, 2);
  assert.equal(worksheetResults.get(blocks[0].id).status, 'idle');
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
