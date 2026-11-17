import type { BlockSpec } from '@blocksuite/block-std';
import { literal } from 'lit/static-html.js';
import { JabrTextSchema } from './schema';

export const JabrTextBlockSpec: BlockSpec = {
  schema: JabrTextSchema,
  view: {
    component: literal`jabr-text-block`,
  },
};
