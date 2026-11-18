import {
  LocalOrderedCalculationProvider,
  type CalculationProvider,
  type EvaluationAdapter,
  type EvaluationRequest,
} from './calculation-provider';
import { worksheetResults, type EvaluationResultState } from './result-store';

export type MathBlockModelLike = {
  id: string;
  flavour: string;
  latex: string;
  displayUnit: string;
};

export type WorksheetModelLike = {
  id?: string;
  children: MathBlockModelLike[];
};

type StoreBlockUpdateEvent =
  | { type: 'add' | 'delete'; id: string; flavour: string }
  | { type: 'update'; id: string; flavour: string; props: { key: string } };

type StoreEventSource = {
  on(listener: (event: StoreBlockUpdateEvent) => void): { dispose(): void };
};

type ControllerOptions = {
  documentId: string;
  worksheet: WorksheetModelLike;
  store: { slots: { blockUpdated: StoreEventSource } };
  adapter?: EvaluationAdapter;
  provider?: CalculationProvider;
};

const unavailableAdapter: EvaluationAdapter = {
  evaluate: async request => ({
    blockId: request.blockId,
    requestId: request.requestId,
    sourceRevision: request.sourceRevision,
    status: 'unavailable',
    diagnostic: 'Jabr-engine bridge is not connected yet.',
  }),
};

/** Observes BlockSuite changes and delegates calculation semantics to a provider. */
export class WorksheetController {
  private readonly storeSubscription: { dispose(): void };
  private readonly provider: CalculationProvider;
  private disposed = false;

  constructor(private readonly options: ControllerOptions) {
    this.provider = options.provider ??
      new LocalOrderedCalculationProvider(options.adapter ?? unavailableAdapter);
    this.syncBlockState();
    this.storeSubscription = this.options.store.slots.blockUpdated.on(event => {
      if (event.type === 'update') {
        if (
          event.flavour === 'jabr:math' &&
          event.props.key === 'latex' &&
          this.mathBlocks().some(block => block.id === event.id)
        ) {
          this.onBlockSourceChanged(event.id);
        }
        return;
      }
      this.syncBlockState();
    });
  }

  private mathBlocks(): MathBlockModelLike[] {
    return this.options.worksheet.children.filter(block => block.flavour === 'jabr:math');
  }

  private syncBlockState(): void {
    if (this.disposed) return;
    const current = new Map(this.mathBlocks().map(block => [block.id, block]));
    // Remove provider state for blocks no longer in the authored document.
    // The provider owns revisions and request lifecycle; the result store is presentation-only.
    for (const blockId of this.knownBlockIds) {
      if (!current.has(blockId)) {
        this.provider.removeBlock(this.options.documentId, blockId);
        worksheetResults.clear(blockId);
        this.knownBlockIds.delete(blockId);
        this.initializedResultBlocks.delete(blockId);
      }
    }
    for (const block of current.values()) {
      this.provider.registerBlock(block.id);
      this.knownBlockIds.add(block.id);
      if (!this.initializedResultBlocks.has(block.id)) {
        worksheetResults.invalidate(block.id, this.provider.currentRevision(block.id));
        this.initializedResultBlocks.add(block.id);
      }
    }
  }

  private readonly knownBlockIds = new Set<string>();
  private readonly initializedResultBlocks = new Set<string>();

  private onBlockSourceChanged(blockId: string): void {
    const invalidated = this.provider.invalidateFrom(
      this.options.documentId,
      blockId,
      this.mathBlocks().map(block => block.id)
    );
    for (const item of invalidated) {
      worksheetResults.invalidate(item.blockId, item.sourceRevision);
    }
  }

  async requestEvaluation(blockId: string): Promise<void> {
    const block = this.mathBlocks().find(candidate => candidate.id === blockId);
    if (!block || this.disposed) return;

    const sourceRevision = this.provider.currentRevision(blockId);
    const request: EvaluationRequest = {
      documentId: this.options.documentId,
      blockId,
      requestId: this.provider.nextRequestId(),
      sourceRevision,
      latex: block.latex,
      displayUnit: block.displayUnit ?? '',
    };
    const pending: EvaluationResultState = {
      status: 'pending',
      resultLatex: '',
      diagnostic: '',
      sourceRevision,
      requestId: request.requestId,
    };
    worksheetResults.set(blockId, pending);

    try {
      const response = await this.provider.evaluate(request);
      if (this.disposed || !response || !this.provider.isCurrent(request)) return;
      worksheetResults.set(blockId, {
        status: response.status,
        resultLatex: response.status === 'success' ? response.resultLatex ?? '' : '',
        diagnostic: response.diagnostic ?? '',
        sourceRevision,
        requestId: request.requestId,
      });
    } catch (error) {
      if (this.disposed || !this.provider.isCurrent(request)) return;
      worksheetResults.set(blockId, {
        status: 'error',
        resultLatex: '',
        diagnostic: error instanceof Error ? error.message : String(error),
        sourceRevision,
        requestId: request.requestId,
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.storeSubscription.dispose();
    this.provider.dispose();
  }
}
