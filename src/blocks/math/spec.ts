import type { BlockSpec } from '@blocksuite/block-std';
import { literal } from 'lit/static-html.js';
import { JabrMathSchema } from './schema';

export const JabrMathBlockSpec: BlockSpec = {
  schema: JabrMathSchema,
  view: {
    component: literal`jabr-math-block`,
  },
};
