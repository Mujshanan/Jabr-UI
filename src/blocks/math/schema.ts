import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';

export const JabrMathSchema = defineBlockSchema({
  flavour: 'jabr:math',
  props: () => ({
    // LaTeX is the canonical editable expression, including named quantity prompts.
    // Each prompt contains a complete quantity (value and unit), not separate fields.
    latex: String.raw`F = \placeholder[mass]{5\,\mathrm{kg}} \cdot \placeholder[acceleration]{9.81\,\mathrm{m/s^2}}`,
  }),
  metadata: {
    version: 1,
    role: 'content',
    children: [],
  },
});

export type JabrMathModel = SchemaToModel<typeof JabrMathSchema>;
