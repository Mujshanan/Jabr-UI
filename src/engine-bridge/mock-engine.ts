import {
  asKernelNodeId,
  ENGINE_BRIDGE_PROTOCOL_VERSION,
  KERNEL_ENVELOPE_SCHEMA_VERSION,
  type EngineRequest,
  type EngineResponse,
  type EvaluateBlockPayload,
  type EvaluateBlockResult,
} from './contracts';
import type { EngineTransport } from './client';

/** Deterministic protocol fixture. It does not parse or calculate expressions. */
export class MockEngineTransport implements EngineTransport {
  async execute<TPayload, TResult>(
    request: EngineRequest<TPayload>
  ): Promise<EngineResponse<TResult>> {
    await Promise.resolve();
    const payload = request.payload as EvaluateBlockPayload;
    const result: EvaluateBlockResult = payload.latex === 'MOCK_ERROR'
      ? { status: 'error' }
      : { status: 'success', resultLatex: String.raw`\\boxed{MOCK: bridge fixture}` };

    return {
      protocolVersion: ENGINE_BRIDGE_PROTOCOL_VERSION,
      engineName: 'jabr-engine',
      engineVersion: 'mock-0.1.0',
      requestId: request.requestId,
      documentId: request.documentId,
      blockId: request.blockId,
      sourceRevision: request.sourceRevision,
      nodeId: asKernelNodeId(1),
      envelope: {
        schema_version: KERNEL_ENVELOPE_SCHEMA_VERSION,
        result: result as TResult,
        diagnostics: payload.latex === 'MOCK_ERROR'
          ? [{ code: 'engine.mock.intentional_error', severity: 'error', message: 'Mock Engine fixture error.' }]
          : [],
      },
    };
  }
}
