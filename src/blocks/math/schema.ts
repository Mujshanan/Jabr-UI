import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';

export const JabrMathSchema = defineBlockSchema({
  flavour: 'jabr:math',
  props: () => ({
    // LaTeX is the canonical editable source. Rendered DOM is never persisted.
    latex: String.raw`\placeholder[operand-a]{} = \placeholder[operand-b]{} + \placeholder[operand-c]{}`,
  }),
  metadata: {
    version: 1,
    role: 'content',
    children: [],
  },
});

export type JabrMathModel = SchemaToModel<typeof JabrMathSchema>;
