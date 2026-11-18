import 'mathlive';
import './styles.css';

import { BlockStdScope } from '@blocksuite/block-std';
import { effects } from '@blocksuite/block-std/effects';
import { DocCollection, Schema } from '@blocksuite/store';
import { IndexeddbPersistence } from 'y-indexeddb';
import { DEFAULT_MATH_LATEX, JabrMathSchema } from './blocks/math';
import { JabrTextSchema } from './blocks/text';
import { JabrRootSchema } from './editor/root';
import { JabrWorksheetSchema } from './editor/worksheet';
import { JabrBlockExtensions } from './editor/specs';
import { WorksheetController, type WorksheetModelLike } from './worksheet/controller';
import { EngineBridgeClient } from './engine-bridge/client';
import { MockEngineTransport } from './engine-bridge/mock-engine';
import { EngineBridgeEvaluationAdapter } from './engine-bridge/worksheet-adapter';
import { worksheetResults } from './worksheet/result-store';

if (!customElements.get('editor-host')) effects();

const DATABASE_NAME = 'jabr-ui-worksheet-v1';
const DOCUMENT_ID = 'calculation-sheet';

const schema = new Schema().register([
  JabrRootSchema,
  JabrWorksheetSchema,
  JabrMathSchema,
  JabrTextSchema,
]);
const collection = new DocCollection({ id: DATABASE_NAME, schema });
collection.meta.initialize();

const editorContainer = document.querySelector<HTMLDivElement>('#editor');
const addMathButton = document.querySelector<HTMLButtonElement>('#add-math');
const addTextButton = document.querySelector<HTMLButtonElement>('#add-text');
const mockButton = document.querySelector<HTMLButtonElement>('#toggle-mock');
const saveStatus = document.querySelector<HTMLSpanElement>('#save-status');

if (!editorContainer || !addMathButton || !addTextButton || !mockButton || !saveStatus) {
  throw new Error('The Jabr UI application shell is incomplete.');
}

const editorElement = editorContainer;
const addMathControl = addMathButton;
const addTextControl = addTextButton;
const mockControl = mockButton;
const statusElement = saveStatus;

const collectionPersistence = new IndexeddbPersistence(
  `${DATABASE_NAME}:collection`,
  collection.doc
);
const mockAdapter = new EngineBridgeEvaluationAdapter(
  new EngineBridgeClient(new MockEngineTransport())
);
let mockEnabled = false;
let documentPersistence: IndexeddbPersistence | null = null;
let worksheetId = '';
let worksheetController: WorksheetController | null = null;
let evaluationRequestListener: ((event: Event) => void) | null = null;

async function initializeDocument() {
  await collectionPersistence.whenSynced;

  const doc = collection.getDoc(DOCUMENT_ID) ?? collection.createDoc({ id: DOCUMENT_ID });
  documentPersistence = new IndexeddbPersistence(
    `${DATABASE_NAME}:document`,
    doc.spaceDoc
  );
  await documentPersistence.whenSynced;
  doc.load();

  if (!doc.root) {
    const rootId = doc.addBlock('jabr:root' as never, { title: 'Untitled calculation' } as never);
    worksheetId = doc.addBlock('jabr:worksheet' as never, {} as never, rootId);
    doc.addBlock('jabr:math' as never, { latex: DEFAULT_MATH_LATEX } as never, worksheetId);
  }

  const rootModel = doc.root;
  if (!rootModel) throw new Error('The document root could not be initialized.');
  const worksheetModel = rootModel.children.find(child => child.flavour === 'jabr:worksheet')
    ?? doc.getBlockById(doc.addBlock('jabr:worksheet' as never, {} as never, rootModel.id));
  if (!worksheetModel) throw new Error('The document is missing its worksheet hub.');
  worksheetId = worksheetModel.id;
  worksheetController = new WorksheetController({
    documentId: DOCUMENT_ID,
    worksheet: worksheetModel as unknown as WorksheetModelLike,
    store: doc,
    adapter: {
      evaluate: request => mockEnabled
        ? mockAdapter.evaluate(request)
        : Promise.resolve({
            blockId: request.blockId,
            requestId: request.requestId,
            sourceRevision: request.sourceRevision,
            status: 'unavailable',
            diagnostic: 'Enable the mock evaluator or connect Jabr-engine.',
          }),
    },
  });
  evaluationRequestListener = (event: Event) => {
    const detail = (event as CustomEvent<{ blockId: string }>).detail;
    if (detail?.blockId) void worksheetController?.requestEvaluation(detail.blockId);
  };
  editorElement.addEventListener('jabr-evaluate-request', evaluationRequestListener);

  if (new URLSearchParams(window.location.search).has('e2e')) {
    // Narrow test seam: exposes the real BlockSuite document only in browser E2E runs.
    Object.defineProperty(window, '__JABR_TEST__', {
      configurable: true,
      value: {
        doc,
        worksheet: worksheetModel,
        getResult: (blockId: string) => worksheetResults.get(blockId),
      },
    });
  }

  const std = new BlockStdScope({ doc, extensions: JabrBlockExtensions });
  editorElement.replaceChildren(std.render());

  addMathControl.addEventListener('click', () => {
    doc.addBlock('jabr:math' as never, { latex: DEFAULT_MATH_LATEX } as never, worksheetId);
  });
  addTextControl.addEventListener('click', () => {
    doc.addBlock('jabr:text' as never, { text: '' } as never, worksheetId);
  });
  mockControl.addEventListener('click', () => {
    mockEnabled = !mockEnabled;
    mockControl.textContent = mockEnabled ? 'Disable mock evaluator' : 'Enable mock evaluator';
    statusElement.textContent = mockEnabled
      ? 'Local document ready · mock evaluator enabled (fixtures only)'
      : 'Local document ready · Engine bridge unavailable';
  });

  statusElement.textContent = 'Local document ready · Engine bridge unavailable';
}

void initializeDocument().catch(error => {
  console.error('Failed to initialize Jabr worksheet:', error);
  statusElement.textContent = 'Could not load local document';
});

window.addEventListener('beforeunload', () => {
  worksheetController?.dispose();
  if (evaluationRequestListener) editorElement.removeEventListener('jabr-evaluate-request', evaluationRequestListener);
  documentPersistence?.destroy();
  collectionPersistence.destroy();
  collection.dispose();
});
