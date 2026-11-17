import type { EvaluationAdapter, EvaluationRequest, EvaluationResponse } from './controller';

/**
 * Deterministic UI fixture adapter. It performs no parsing or calculation:
 * only exact, pre-authored source strings have fixture responses.
 */
export class MockEvaluationAdapter implements EvaluationAdapter {
  private readonly fixtures = new Map<string, Omit<EvaluationResponse, 'blockId' | 'requestId' | 'sourceRevision'>>([
    [String.raw`F \\coloneqq \\placeholder[force]{100\\,\\mathrm{N}}`, {
      status: 'success',
      resultLatex: String.raw`\\boxed{\\text{MOCK: fixture result}}`,
      diagnostic: 'Mock fixture — not a calculation.',
    }],
    ['MOCK_ERROR', {
      status: 'error',
      diagnostic: 'Mock fixture: intentional evaluation error.',
    }],
  ]);

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    await Promise.resolve();
    const fixture = this.fixtures.get(request.latex);
    if (!fixture) {
      return {
        blockId: request.blockId,
        requestId: request.requestId,
        sourceRevision: request.sourceRevision,
        status: 'error',
        diagnostic: 'No mock fixture is registered for this exact source. No calculation was performed.',
      };
    }
    return {
      blockId: request.blockId,
      requestId: request.requestId,
      sourceRevision: request.sourceRevision,
      ...fixture,
    };
  }
}
