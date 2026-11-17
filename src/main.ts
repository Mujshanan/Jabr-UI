import '@blocksuite/lit';
import 'mathlive';
import './styles.css';

import { EditorHost } from '@blocksuite/lit';
import { DocCollection, Schema } from '@blocksuite/store';
import { IndexeddbPersistence } from 'y-indexeddb';
import { JabrMathSchema } from './blocks/math';
import { JabrRootSchema } from './editor/root';
import { JabrBlockSpecs } from './editor/specs';

const DATABASE_NAME = 'jabr-ui-math-block-v1';
const DEFAULT_LATEX = String.raw`F = \placeholder[mass]{5\,\mathrm{kg}} \cdot \placeholder[acceleration]{9.81\,\mathrm{m/s^2}}`;

const schema = new Schema()
  .register(JabrRootSchema)
  .register(JabrMathSchema);
const collection = new DocCollection({ schema });
collection.meta.initialize();

const doc = collection.createDoc();
const editorContainer = document.querySelector<HTMLDivElement>('#editor');
const addMathButton = document.querySelector<HTMLButtonElement>('#add-math');
const saveStatus = document.querySelector<HTMLSpanElement>('#save-status');

if (!editorContainer || !addMathButton || !saveStatus) {
  throw new Error('The Jabr UI application shell is incomplete.');
}

const host = new EditorHost();
host.doc = doc;
host.specs = JabrBlockSpecs;
editorContainer.append(host);

let rootId = '';

function initializeDocument() {
  doc.load();

  if (doc.root.length > 0) {
    rootId = doc.root[0].id;
  } else {
    rootId = doc.addBlock('jabr:root', { title: 'Untitled calculation' });
    doc.addBlock('jabr:math', { latex: DEFAULT_LATEX }, rootId);
  }

  saveStatus.textContent = 'Local document ready';
}

const persistence = new IndexeddbPersistence(DATABASE_NAME, doc.spaceDoc);
persistence.on('synced', initializeDocument);

addMathButton.addEventListener('click', () => {
  if (!rootId) return;
  doc.addBlock('jabr:math', { latex: DEFAULT_LATEX }, rootId);
});

window.addEventListener('beforeunload', () => {
  persistence.destroy();
});
