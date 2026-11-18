import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';

export const DEFAULT_MATH_LATEX = String.raw`F \coloneqq \placeholder[force]{100\,\mathrm{N}}`;

export const JabrMathSchema = defineBlockSchema({
  flavour: 'jabr:math',
  props: () => ({
    // LaTeX is the canonical editable source.
    latex: DEFAULT_MATH_LATEX,
    // Results are transient controller state, never persisted in Yjs.
    displayUnit: '',
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['jabr:worksheet'],
    children: [],
  },
});

export type JabrMathModel = SchemaToModel<typeof JabrMathSchema>;
