import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';

export const JabrTextSchema = defineBlockSchema({
  flavour: 'jabr:text',
  props: () => ({
    text: '',
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['jabr:worksheet'],
    children: [],
  },
});

export type JabrTextModel = SchemaToModel<typeof JabrTextSchema>;
