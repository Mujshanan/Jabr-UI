import {
  worksheetResults,
  type EvaluationResultState,
} from './result-store';

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

/** Adapter boundary for the future Jabr-CLI worksheet evaluator. */
export interface EvaluationAdapter {
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
}

type SlotSubscription = { dispose(): void };
type SlotLike<T> = { on(callback: (event: T) => void): SlotSubscription };

export type MathBlockModelLike = {
  id: string;
  flavour: string;
  latex: string;
  displayUnit: string;
  propsUpdated: SlotLike<{ key?: string }>;
};

export type WorksheetModelLike = {
  children: MathBlockModelLike[];
  childrenUpdated: SlotLike<unknown>;
};

type ControllerOptions = {
  documentId: string;
  worksheet: WorksheetModelLike;
  adapter?: EvaluationAdapter;
};

/**
 * Conservative ordered invalidation for the UI prototype.
 *
 * This is not a dependency graph: a source edit invalidates the edited math
 * block and every later math block in the same worksheet hub. Jabr-CLI will
 * replace this positional approximation with symbol-aware dependency tracking.
 */
export class WorksheetController {
  private readonly subscriptions = new Map<string, SlotSubscription>();
  private readonly revisions = new Map<string, number>();
  private readonly latestRequests = new Map<string, number>();
  private requestSequence = 0;
  private disposed = false;

  private readonly adapter: EvaluationAdapter;

  constructor(private readonly options: ControllerOptions) {
    this.adapter = options.adapter ?? {
      evaluate: async request => ({
        blockId: request.blockId,
        requestId: request.requestId,
        sourceRevision: request.sourceRevision,
        status: 'unavailable',
        diagnostic: 'Jabr-CLI evaluator is not connected yet.',
      }),
    };

    this.syncBlockSubscriptions();
    this.options.worksheet.childrenUpdated.on(() => this.syncBlockSubscriptions());
  }

  private mathBlocks(): MathBlockModelLike[] {
    return this.options.worksheet.children.filter(block => block.flavour === 'jabr:math');
  }

  private syncBlockSubscriptions(): void {
    if (this.disposed) return;
    const current = new Map(this.mathBlocks().map(block => [block.id, block]));

    for (const [blockId, subscription] of this.subscriptions) {
      if (!current.has(blockId)) {
        subscription.dispose();
        this.subscriptions.delete(blockId);
        this.revisions.delete(blockId);
        this.latestRequests.delete(blockId);
        worksheetResults.clear(blockId);
      }
    }

    for (const block of current.values()) {
      if (!this.revisions.has(block.id)) {
        this.revisions.set(block.id, 0);
        worksheetResults.invalidate(block.id, 0);
      }
      if (this.subscriptions.has(block.id)) continue;

      const subscription = block.propsUpdated.on(({ key }) => {
        // propsUpdated is emitted for Yjs-backed programmatic updates too,
        // including undo/redo. Ignore display-unit edits; only source changes
        // invalidate calculation results.
        if (key === 'latex') this.onBlockSourceChanged(block.id);
      });
      this.subscriptions.set(block.id, subscription);
    }
  }

  private onBlockSourceChanged(blockId: string): void {
    const blocks = this.mathBlocks();
    const changedIndex = blocks.findIndex(block => block.id === blockId);
    if (changedIndex < 0) return;

    // No DAG exists in Jabr-UI. Conservatively invalidate all later math rows.
    for (const block of blocks.slice(changedIndex)) {
      const revision = (this.revisions.get(block.id) ?? 0) + 1;
      this.revisions.set(block.id, revision);
      this.latestRequests.delete(block.id);
      worksheetResults.invalidate(block.id, revision);
    }
  }

  async requestEvaluation(blockId: string): Promise<void> {
    const block = this.mathBlocks().find(candidate => candidate.id === blockId);
    if (!block || this.disposed) return;

    const sourceRevision = this.revisions.get(blockId) ?? 0;
    const requestId = ++this.requestSequence;
    this.latestRequests.set(blockId, requestId);
    const pending: EvaluationResultState = {
      status: 'pending',
      resultLatex: '',
      diagnostic: '',
      sourceRevision,
      requestId,
    };
    worksheetResults.set(blockId, pending);

    const request: EvaluationRequest = {
      documentId: this.options.documentId,
      blockId,
      requestId,
      sourceRevision,
      latex: block.latex,
      displayUnit: block.displayUnit ?? '',
    };

    try {
      const response = await this.adapter.evaluate(request);
      if (this.disposed) return;
      if (this.latestRequests.get(blockId) !== requestId) return;
      if ((this.revisions.get(blockId) ?? 0) !== sourceRevision) return;
      if (response.blockId !== blockId || response.requestId !== requestId ||
          response.sourceRevision !== sourceRevision) return;

      worksheetResults.set(blockId, {
        status: response.status,
        resultLatex: response.status === 'success' ? response.resultLatex ?? '' : '',
        diagnostic: response.diagnostic ?? '',
        sourceRevision,
        requestId,
      });
    } catch (error) {
      if (this.disposed || this.latestRequests.get(blockId) !== requestId) return;
      if ((this.revisions.get(blockId) ?? 0) !== sourceRevision) return;
      worksheetResults.set(blockId, {
        status: 'error',
        resultLatex: '',
        diagnostic: error instanceof Error ? error.message : String(error),
        sourceRevision,
        requestId,
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const subscription of this.subscriptions.values()) subscription.dispose();
    this.subscriptions.clear();
    this.latestRequests.clear();
  }
}
