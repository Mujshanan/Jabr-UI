import { BlockComponent } from '@blocksuite/block-std';
import { defineBlockSchema, type SchemaToModel } from '@blocksuite/store';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

export const JabrWorksheetSchema = defineBlockSchema({
  flavour: 'jabr:worksheet',
  props: () => ({}),
  metadata: {
    version: 1,
    role: 'hub',
    parent: ['jabr:root'],
    children: ['jabr:math', 'jabr:text'],
  },
});

type JabrWorksheetModel = SchemaToModel<typeof JabrWorksheetSchema>;

@customElement('jabr-worksheet-block')
export class JabrWorksheetBlockView extends BlockComponent<JabrWorksheetModel> {
  static override styles = css`
    jabr-worksheet-block { display: block; width: 100%; }
    .jabr-worksheet-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
  `;

  override render() {
    return html`
      <section class="jabr-worksheet-content" aria-label="Calculation worksheet">
        ${this.renderChildren(this.model)}
      </section>
    `;
  }
}
