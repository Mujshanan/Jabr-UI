export type EvaluationStatus = 'idle' | 'pending' | 'success' | 'error' | 'unavailable';

export type EvaluationResultState = {
  status: EvaluationStatus;
  resultLatex: string;
  diagnostic: string;
  sourceRevision: number;
  requestId: number | null;
};

const emptyState = (sourceRevision = 0): EvaluationResultState => ({
  status: 'idle',
  resultLatex: '',
  diagnostic: '',
  sourceRevision,
  requestId: null,
});

/**
 * Ephemeral worksheet result state. It deliberately lives outside BlockSuite/Yjs:
 * only authored source and user-selected display units belong in the document.
 */
export class WorksheetResultStore {
  private readonly states = new Map<string, EvaluationResultState>();
  private readonly listeners = new Map<string, Set<() => void>>();

  get(blockId: string): EvaluationResultState {
    return this.states.get(blockId) ?? emptyState();
  }

  set(blockId: string, state: EvaluationResultState): void {
    this.states.set(blockId, state);
    this.notify(blockId);
  }

  invalidate(blockId: string, sourceRevision: number): void {
    this.set(blockId, emptyState(sourceRevision));
  }

  clear(blockId: string): void {
    this.states.delete(blockId);
    this.notify(blockId);
  }

  subscribe(blockId: string, listener: () => void): () => void {
    let listeners = this.listeners.get(blockId);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(blockId, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) this.listeners.delete(blockId);
    };
  }

  private notify(blockId: string): void {
    this.listeners.get(blockId)?.forEach(listener => listener());
  }
}

export const worksheetResults = new WorksheetResultStore();
