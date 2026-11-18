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
import { DEFAULT_MATH_LATEX } from '../blocks/math/schema';

/** Deterministic protocol fixture. It does not parse or calculate expressions. */
export class MockEngineTransport implements EngineTransport {
  async execute<TPayload, TResult>(
    request: EngineRequest<TPayload>
  ): Promise<EngineResponse<TResult>> {
    await Promise.resolve();
    const payload = request.payload as EvaluateBlockPayload;
    const defaultFixture = String.raw`F \\coloneqq \\placeholder[force]{100\\,\\mathrm{N}}`;
    const isIntentionalError = payload.latex === 'MOCK_ERROR';
    const isKnownFixture = payload.latex === defaultFixture;
    const result: EvaluateBlockResult = isKnownFixture
      ? { status: 'success', resultLatex: String.raw`\\boxed{MOCK: bridge fixture}` }
      : { status: 'error' };

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
        diagnostics: isIntentionalError
          ? [{ code: 'engine.mock.intentional_error', severity: 'error', message: 'Mock Engine fixture error.' }]
          : isKnownFixture
            ? []
            : [{ code: 'engine.mock.no_fixture', severity: 'error', message: 'No mock fixture is registered for this exact source. No calculation was performed.' }],
      },
    };
  }
}
