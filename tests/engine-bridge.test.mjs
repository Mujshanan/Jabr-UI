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

const { EngineBridgeClient } = await vite.ssrLoadModule('/src/engine-bridge/client.ts');
const { MockEngineTransport } = await vite.ssrLoadModule('/src/engine-bridge/mock-engine.ts');
const { asKernelNodeId } = await vite.ssrLoadModule('/src/engine-bridge/contracts.ts');
const { EngineBridgeEvaluationAdapter } = await vite.ssrLoadModule('/src/engine-bridge/worksheet-adapter.ts');

const DEFAULT_FIXTURE = String.raw`F \\coloneqq \\placeholder[force]{100\\,\\mathrm{N}}`;

const request = (requestId, sourceRevision, latex = DEFAULT_FIXTURE) => ({
  protocolVersion: 1,
  engineName: 'jabr-engine',
  requestId,
  documentId: 'doc-1',
  blockId: 'blocksuite-uuid-1',
  sourceRevision,
  operation: 'evaluate-block',
  payload: { latex, displayUnit: '' },
});

test('mock Engine returns a Kernel-envelope response with a validated NodeId', async () => {
  const client = new EngineBridgeClient(new MockEngineTransport());
  const outcome = await client.execute(request('request-1', 0));
  assert.equal(outcome.kind, 'applied');
  assert.equal(outcome.response.envelope.schema_version, 1);
  assert.equal(outcome.response.envelope.result.status, 'success');
  assert.equal(outcome.response.nodeId, 1);
  client.dispose();
});

test('mock Engine diagnostics use the shared Kernel diagnostic shape', async () => {
  const client = new EngineBridgeClient(new MockEngineTransport());
  const outcome = await client.execute(request('request-error', 0, 'MOCK_ERROR'));
  assert.equal(outcome.kind, 'applied');
  assert.equal(outcome.response.envelope.result.status, 'error');
  assert.deepEqual(outcome.response.envelope.diagnostics[0], {
    code: 'engine.mock.intentional_error',
    severity: 'error',
    message: 'Mock Engine fixture error.',
  });
  client.dispose();
});

test('a later request supersedes an earlier in-flight response', async () => {
  let resolveFirst;
  const mock = new MockEngineTransport();
  const transport = {
    async execute(req) {
      if (req.requestId === 'older') {
        await new Promise(resolve => { resolveFirst = resolve; });
      }
      return mock.execute(req);
    },
  };
  const client = new EngineBridgeClient(transport);
  const older = client.execute(request('older', 0));
  await Promise.resolve();
  const newer = await client.execute(request('newer', 0));
  assert.equal(newer.kind, 'applied');
  resolveFirst();
  assert.equal((await older).kind, 'stale');
  client.dispose();
});

test('source revision changes invalidate in-flight work', async () => {
  let resolveRequest;
  const mock = new MockEngineTransport();
  const transport = {
    async execute(req) {
      await new Promise(resolve => { resolveRequest = resolve; });
      return mock.execute(req);
    },
  };
  const client = new EngineBridgeClient(transport);
  const pending = client.execute(request('revision-0', 0));
  await Promise.resolve();
  client.setCurrentRevision('doc-1', 'blocksuite-uuid-1', 1);
  resolveRequest();
  assert.equal((await pending).kind, 'stale');
  client.dispose();
});

test('Kernel NodeId validation rejects zero, fractions, and unsafe integers', () => {
  assert.equal(asKernelNodeId(1), 1);
  assert.throws(() => asKernelNodeId(0), RangeError);
  assert.throws(() => asKernelNodeId(1.5), RangeError);
  assert.throws(() => asKernelNodeId(Number.MAX_SAFE_INTEGER + 1), RangeError);
});

test('client rejects unsupported protocol and malformed envelope versions', async () => {
  const client = new EngineBridgeClient(new MockEngineTransport());
  await assert.rejects(client.execute({ ...request('bad-protocol', 0), protocolVersion: 2 }), /Unsupported Engine bridge/);
  const badTransport = {
    async execute(req) {
      const response = await new MockEngineTransport().execute(req);
      response.envelope.schema_version = 2;
      return response;
    },
  };
  const badClient = new EngineBridgeClient(badTransport);
  await assert.rejects(badClient.execute(request('bad-envelope', 0)), /Unsupported Kernel envelope/);
  client.dispose();
  badClient.dispose();
});

test('worksheet adapter translates bridge success and shared diagnostics', async () => {
  const adapter = new EngineBridgeEvaluationAdapter(new EngineBridgeClient(new MockEngineTransport()));
  const result = await adapter.evaluate({
    documentId: 'doc-adapter',
    blockId: 'block-adapter',
    requestId: 4,
    sourceRevision: 2,
    latex: DEFAULT_FIXTURE,
    displayUnit: 'kN',
  });
  assert.equal(result.status, 'success');
  assert.match(result.resultLatex, /MOCK/);
  adapter.dispose();
});

test('removed block identity clears the client revision/request guard', async () => {
  const client = new EngineBridgeClient(new MockEngineTransport());
  client.setCurrentRevision('doc-1', 'blocksuite-uuid-1', 7);
  client.removeBlock('doc-1', 'blocksuite-uuid-1');
  const outcome = await client.execute(request('after-remove', 0));
  assert.equal(outcome.kind, 'applied');
  client.dispose();
});

test('mock Engine refuses unregistered source without calculating', async () => {
  const client = new EngineBridgeClient(new MockEngineTransport());
  const outcome = await client.execute(request('unknown-source', 0, 'x := 123'));
  assert.equal(outcome.kind, 'applied');
  assert.equal(outcome.response.envelope.result.status, 'error');
  assert.equal(outcome.response.envelope.diagnostics[0].code, 'engine.mock.no_fixture');
  client.dispose();
});
