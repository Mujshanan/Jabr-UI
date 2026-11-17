import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';

export const JabrMathSchema = defineBlockSchema({
  flavour: 'jabr:math',
  props: () => ({
    // LaTeX is the canonical editable expression, including named quantity prompts.
    // Each prompt contains a complete quantity (value and unit), not separate fields.
    latex: String.raw`F \coloneqq \placeholder[force]{100\,\mathrm{N}}`,
  }),
  metadata: {
    version: 1,
    role: 'content',
    children: [],
  },
});

export type JabrMathModel = SchemaToModel<typeof JabrMathSchema>;
