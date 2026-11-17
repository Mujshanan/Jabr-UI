import '@blocksuite/lit';
import 'mathlive';
import './styles.css';

import { EditorHost } from '@blocksuite/lit';
import { DocCollection, Schema } from '@blocksuite/store';
import { IndexeddbPersistence } from 'y-indexeddb';
import { JabrMathSchema } from './blocks/math';
import { JabrTextSchema } from './blocks/text';
import { JabrRootSchema } from './editor/root';
import { JabrBlockSpecs } from './editor/specs';

const DATABASE_NAME = 'jabr-ui-math-block-v1';
const DEFAULT_LATEX = String.raw`\placeholder[variable]{} = \frac{\placeholder[numerator]{}}{\placeholder[denominator]{}}`;

const schema = new Schema().register(JabrRootSchema).register(JabrTextSchema).register(JabrMathSchema);
const collection = new DocCollection({ schema });
collection.meta.initialize();

const doc = collection.createDoc();
const editorContainer = document.querySelector<HTMLDivElement>('#editor');
const addMathButton = document.querySelector<HTMLButtonElement>('#add-math');
const addTextButton = document.querySelector<HTMLButtonElement>('#add-text');
const saveStatus = document.querySelector<HTMLSpanElement>('#save-status');

if (!editorContainer || !addMathButton || !addTextButton || !saveStatus) {
  throw new Error('The Jabr UI application shell is incomplete.');
}

const host = new EditorHost();
host.doc = doc;
host.specs = JabrBlockSpecs;
editorContainer.append(host);

let rootId = '';

function ensureInitialDocument() {
  if (doc.root.length > 0) {
    rootId = doc.root[0].id;
    return;
  }

  doc.load(() => {
    rootId = doc.addBlock('jabr:root', { title: 'Untitled calculation' });
    doc.addBlock('jabr:text', {}, rootId);
    doc.addBlock('jabr:math', { latex: DEFAULT_LATEX }, rootId);
  });
}

const persistence = new IndexeddbPersistence(DATABASE_NAME, doc.spaceDoc);
persistence.on('synced', () => {
  doc.load();
  ensureInitialDocument();
  saveStatus.textContent = 'Local document ready';
});

addTextButton.addEventListener('click', () => {
  if (!rootId) return;
  doc.addBlock('jabr:text', {}, rootId);
});

addMathButton.addEventListener('click', () => {
  if (!rootId) return;

  doc.addBlock('jabr:math', { latex: DEFAULT_LATEX }, rootId);
  requestAnimationFrame(() => {
    const fields = host.querySelectorAll('math-field');
    (fields[fields.length - 1] as HTMLElement | undefined)?.focus();
  });
});

window.addEventListener('beforeunload', () => {
  persistence.destroy();
});
