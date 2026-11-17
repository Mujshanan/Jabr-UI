import { BlockComponent } from '@blocksuite/lit';
import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { literal } from 'lit/static-html.js';
import type { BlockSpec } from '@blocksuite/block-std';

export const JabrRootSchema = defineBlockSchema({
  flavour: 'jabr:root',
  props: () => ({
    title: 'Untitled calculation',
  }),
  metadata: {
    version: 1,
    role: 'root',
    children: ['jabr:math'],
  },
});

type JabrRootModel = SchemaToModel<typeof JabrRootSchema>;

@customElement('jabr-root-block')
class JabrRootBlockView extends BlockComponent<JabrRootModel> {
  override render() {
    return html`
      <article class="jabr-document">
        <h2 class="jabr-document-title">${this.model.title}</h2>
        <div class="jabr-document-content">
          ${this.renderModelChildren(this.model)}
        </div>
      </article>
    `;
  }
}

export const JabrRootBlockSpec: BlockSpec = {
  schema: JabrRootSchema,
  view: {
    component: literal`jabr-root-block`,
  },
};
