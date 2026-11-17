import { BlockComponent } from '@blocksuite/block-std';
import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

export const JabrRootSchema = defineBlockSchema({
  flavour: 'jabr:root',
  props: () => ({
    title: 'Untitled calculation',
  }),
  metadata: {
    version: 1,
    role: 'root',
    children: ['jabr:worksheet'],
  },
});

type JabrRootModel = SchemaToModel<typeof JabrRootSchema>;

@customElement('jabr-root-block')
export class JabrRootBlockView extends BlockComponent<JabrRootModel> {
  static override styles = css`
    :host { display: block; width: 100%; }
    .jabr-document-title {
      margin: 0 0 28px;
      color: #303846;
      font: 600 20px/1.3 Inter, ui-sans-serif, system-ui, sans-serif;
    }
  `;

  override render() {
    return html`
      <article class="jabr-document">
        <h2 class="jabr-document-title">${this.model.title}</h2>
        ${this.renderChildren(this.model)}
      </article>
    `;
  }
}
