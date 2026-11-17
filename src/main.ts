import 'mathlive';
import './styles.css';

import { BlockStdScope } from '@blocksuite/block-std';
import { DocCollection, Schema } from '@blocksuite/store';
import { IndexeddbPersistence } from 'y-indexeddb';
import { JabrMathSchema } from './blocks/math';
import { JabrTextSchema } from './blocks/text';
import { JabrRootSchema } from './editor/root';
import { JabrWorksheetSchema } from './editor/worksheet';
import { JabrBlockExtensions } from './editor/specs';

const DATABASE_NAME = 'jabr-ui-worksheet-v1';
const DOCUMENT_ID = 'calculation-sheet';
const DEFAULT_LATEX = String.raw`F \coloneqq \placeholder[force]{100\,\mathrm{N}}`;

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
const saveStatus = document.querySelector<HTMLSpanElement>('#save-status');

if (!editorContainer || !addMathButton || !addTextButton || !saveStatus) {
  throw new Error('The Jabr UI application shell is incomplete.');
}

const editorElement = editorContainer;
const addMathControl = addMathButton;
const addTextControl = addTextButton;
const statusElement = saveStatus;


const collectionPersistence = new IndexeddbPersistence(
  `${DATABASE_NAME}:collection`,
  collection.doc
);
let documentPersistence: IndexeddbPersistence | null = null;
let worksheetId = '';

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
    doc.addBlock('jabr:math' as never, { latex: DEFAULT_LATEX } as never, worksheetId);
  } else {
    const root = doc.root;
    worksheetId = root.children[0]?.id ?? doc.addBlock('jabr:worksheet' as never, {} as never, root.id);
  }

  const std = new BlockStdScope({ doc, extensions: JabrBlockExtensions });
  editorElement.replaceChildren(std.render());

  addMathControl.addEventListener('click', () => {
    doc.addBlock('jabr:math' as never, { latex: DEFAULT_LATEX } as never, worksheetId);
  });
  addTextControl.addEventListener('click', () => {
    doc.addBlock('jabr:text' as never, { text: '' } as never, worksheetId);
  });

  statusElement.textContent = 'Local document ready';
}

void initializeDocument().catch(error => {
  console.error('Failed to initialize Jabr worksheet:', error);
  statusElement.textContent = 'Could not load local document';
});

window.addEventListener('beforeunload', () => {
  documentPersistence?.destroy();
  collectionPersistence.destroy();
  collection.dispose();
});
