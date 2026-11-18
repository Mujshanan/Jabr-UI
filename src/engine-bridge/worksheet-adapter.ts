import type { EvaluationAdapter, EvaluationRequest, EvaluationResponse } from '../worksheet/calculation-provider';
import { EngineBridgeClient } from './client';
import type { EvaluateBlockRequest, EvaluateBlockResponse } from './contracts';

/** Adapts the versioned Engine protocol to the worksheet provider interface. */
export class EngineBridgeEvaluationAdapter implements EvaluationAdapter {
  constructor(private readonly client: EngineBridgeClient) {}

  setCurrentRevision(documentId: string, blockId: string, revision: number): void {
    this.client.setCurrentRevision(documentId, blockId, revision);
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    const bridgeRequest: EvaluateBlockRequest = {
      protocolVersion: 1,
      engineName: 'jabr-engine',
      requestId: `ui-${request.requestId}`,
      documentId: request.documentId,
      blockId: request.blockId,
      sourceRevision: request.sourceRevision,
      operation: 'evaluate-block',
      payload: { latex: request.latex, displayUnit: request.displayUnit },
    };
    const outcome = await this.client.execute<typeof bridgeRequest.payload, EvaluateBlockResponse['envelope']['result']>(bridgeRequest);
    if (outcome.kind === 'stale') {
      return {
        blockId: request.blockId,
        requestId: request.requestId,
        sourceRevision: request.sourceRevision,
        status: 'error',
        diagnostic: 'Stale Engine response discarded.',
      };
    }
    const { envelope } = outcome.response;
    const diagnostic = envelope.diagnostics.find(item => item.severity === 'error') ??
      envelope.diagnostics[0];
    const result = envelope.result;
    return {
      blockId: request.blockId,
      requestId: request.requestId,
      sourceRevision: request.sourceRevision,
      status: result?.status === 'success' ? 'success' : result?.status === 'error' || diagnostic?.severity === 'error' ? 'error' : 'unavailable',
      resultLatex: result?.status === 'success' ? result.resultLatex ?? '' : '',
      diagnostic: diagnostic?.message ?? '',
    };
  }

  dispose(): void {
    this.client.dispose();
  }
}
