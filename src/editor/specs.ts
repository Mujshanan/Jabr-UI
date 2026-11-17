import { BlockViewExtension } from '@blocksuite/block-std';
import { literal } from 'lit/static-html.js';

// Custom block flavours are registered in the document Schema; these extensions
// connect each flavour to its Lit custom-element view.
export const JabrBlockExtensions = [
  BlockViewExtension('jabr:root' as never, literal`jabr-root-block`),
  BlockViewExtension('jabr:worksheet' as never, literal`jabr-worksheet-block`),
  BlockViewExtension('jabr:math' as never, literal`jabr-math-block`),
  BlockViewExtension('jabr:text' as never, literal`jabr-text-block`),
];
