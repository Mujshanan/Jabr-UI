import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';

export const JabrMathSchema = defineBlockSchema({
  flavour: 'jabr:math',
  props: () => ({
    // LaTeX is the canonical editable expression, including its input placeholders.
    // Quantity values and units are initially represented by separately named prompts.
    latex: String.raw`F = \placeholder[mass-value]{}\,\placeholder[mass-unit]{\mathrm{kg}} \cdot \placeholder[acceleration-value]{}\,\placeholder[acceleration-unit]{\mathrm{m/s^2}}`,
  }),
  metadata: {
    version: 1,
    role: 'content',
    children: [],
  },
});

export type JabrMathModel = SchemaToModel<typeof JabrMathSchema>;
