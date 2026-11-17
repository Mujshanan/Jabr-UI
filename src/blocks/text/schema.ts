import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';

export const JabrTextSchema = defineBlockSchema({
  flavour: 'jabr:text',
  props: () => ({
    text: 'Plain text block: edit this text to test BlockSuite model updates.',
  }),
  metadata: {
    version: 1,
    role: 'content',
    children: [],
  },
});

export type JabrTextModel = SchemaToModel<typeof JabrTextSchema>;
