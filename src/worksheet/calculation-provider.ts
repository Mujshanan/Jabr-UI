export type EvaluationRequest = {
  documentId: string;
  blockId: string;
  requestId: number;
  sourceRevision: number;
  latex: string;
  displayUnit: string;
};

export type EvaluationResponse = {
  blockId: string;
  requestId: number;
  sourceRevision: number;
  status: 'success' | 'error' | 'unavailable';
  resultLatex?: string;
  diagnostic?: string;
};

export interface EvaluationAdapter {
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
  setCurrentRevision?(documentId: string, blockId: string, revision: number): void;
  removeBlock?(documentId: string, blockId: string): void;
  dispose?(): void;
}

/**
 * Replaceable calculation boundary. The standalone implementation uses
 * conservative ordered invalidation; the future Engine provider owns graph-
 * aware invalidation and scheduling without changing BlockSuite views.
 */
export interface CalculationProvider {
  nextRequestId(): number;
  registerBlock(blockId: string): void;
  currentRevision(blockId: string): number;
  invalidateFrom(documentId: string, blockId: string, orderedBlockIds: readonly string[]): Array<{ blockId: string; sourceRevision: number }>;
  removeBlock(documentId: string, blockId: string): void;
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse | null>;
  isCurrent(request: EvaluationRequest): boolean;
  dispose(): void;
}

export class LocalOrderedCalculationProvider implements CalculationProvider {
  private readonly revisions = new Map<string, number>();
  private readonly latestRequests = new Map<string, number>();
  private requestSequence = 0;
  private disposed = false;

  constructor(private readonly adapter: EvaluationAdapter) {}

  nextRequestId(): number {
    return ++this.requestSequence;
  }

  registerBlock(blockId: string): void {
    if (!this.revisions.has(blockId)) this.revisions.set(blockId, 0);
  }

  currentRevision(blockId: string): number {
    return this.revisions.get(blockId) ?? 0;
  }

  invalidateFrom(
    documentId: string,
    blockId: string,
    orderedBlockIds: readonly string[]
  ): Array<{ blockId: string; sourceRevision: number }> {
    const start = orderedBlockIds.indexOf(blockId);
    if (start < 0 || this.disposed) return [];
    const invalidated: Array<{ blockId: string; sourceRevision: number }> = [];
    for (const id of orderedBlockIds.slice(start)) {
      const revision = this.currentRevision(id) + 1;
      this.revisions.set(id, revision);
      this.latestRequests.delete(id);
      this.adapter.setCurrentRevision?.(documentId, id, revision);
      invalidated.push({ blockId: id, sourceRevision: revision });
    }
    return invalidated;
  }

  removeBlock(documentId: string, blockId: string): void {
    this.adapter.removeBlock?.(documentId, blockId);
    this.revisions.delete(blockId);
    this.latestRequests.delete(blockId);
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse | null> {
    if (this.disposed) return null;
    this.latestRequests.set(request.blockId, request.requestId);
    const response = await this.adapter.evaluate(request);
    if (!this.isCurrent(request)) return null;
    if (response.blockId !== request.blockId ||
        response.requestId !== request.requestId ||
        response.sourceRevision !== request.sourceRevision) return null;
    return response;
  }

  isCurrent(request: EvaluationRequest): boolean {
    return !this.disposed &&
      this.latestRequests.get(request.blockId) === request.requestId &&
      this.currentRevision(request.blockId) === request.sourceRevision;
  }

  dispose(): void {
    this.disposed = true;
    this.latestRequests.clear();
    this.revisions.clear();
    this.adapter.dispose?.();
  }
}
