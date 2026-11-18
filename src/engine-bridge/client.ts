import {
  assertKernelEnvelope,
  asKernelNodeId,
  ENGINE_BRIDGE_PROTOCOL_VERSION,
  type EngineRequest,
  type EngineResponse,
} from './contracts';

export interface EngineTransport {
  execute<TPayload, TResult>(
    request: EngineRequest<TPayload>
  ): Promise<EngineResponse<TResult>>;
}

export type BridgeOutcome<TResult> =
  | { kind: 'applied'; response: EngineResponse<TResult> }
  | { kind: 'stale' };

/**
 * UI-side protocol client. It owns request correlation and stale-response
 * rejection, but never performs calculation or constructs worksheet graphs.
 */
export class EngineBridgeClient {
  private readonly latestRequest = new Map<string, string>();
  private readonly currentRevision = new Map<string, number>();

  constructor(private readonly transport: EngineTransport) {}

  private key(documentId: string, blockId: string): string {
    return `${documentId}\u0000${blockId}`;
  }

  /** Retire transient request state when a block is removed from the current document tree. */
  removeBlock(documentId: string, blockId: string): void {
    const key = this.key(documentId, blockId);
    this.latestRequest.delete(key);
    this.currentRevision.delete(key);
  }

  /** Called whenever the authored source revision changes, including undo/redo. */
  setCurrentRevision(documentId: string, blockId: string, revision: number): void {
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw new RangeError('sourceRevision must be a non-negative safe integer.');
    }
    const key = this.key(documentId, blockId);
    this.currentRevision.set(key, revision);
    this.latestRequest.delete(key);
  }

  async execute<TPayload, TResult>(
    request: EngineRequest<TPayload>
  ): Promise<BridgeOutcome<TResult>> {
    if (request.protocolVersion !== ENGINE_BRIDGE_PROTOCOL_VERSION) {
      throw new TypeError('Unsupported Engine bridge protocol version.');
    }
    if (!request.requestId || !request.documentId || !request.blockId) {
      throw new TypeError('requestId, documentId, and blockId are required.');
    }
    if (!Number.isSafeInteger(request.sourceRevision) || request.sourceRevision < 0) {
      throw new RangeError('sourceRevision must be a non-negative safe integer.');
    }

    const key = this.key(request.documentId, request.blockId);
    const knownRevision = this.currentRevision.get(key);
    if (knownRevision !== undefined && knownRevision !== request.sourceRevision) {
      return { kind: 'stale' };
    }
    this.currentRevision.set(key, request.sourceRevision);
    this.latestRequest.set(key, request.requestId);

    const response = await this.transport.execute<TPayload, TResult>(request);
    assertKernelEnvelope<TResult>(response.envelope);

    if (this.latestRequest.get(key) !== request.requestId ||
        this.currentRevision.get(key) !== request.sourceRevision ||
        response.requestId !== request.requestId ||
        response.documentId !== request.documentId ||
        response.blockId !== request.blockId ||
        response.sourceRevision !== request.sourceRevision ||
        response.protocolVersion !== ENGINE_BRIDGE_PROTOCOL_VERSION ||
        response.engineName !== 'jabr-engine' ||
        typeof response.engineVersion !== 'string' || !response.engineVersion) {
      return { kind: 'stale' };
    }

    asKernelNodeId(response.nodeId);
    return { kind: 'applied', response };
  }

  dispose(): void {
    this.latestRequest.clear();
    this.currentRevision.clear();
  }
}
