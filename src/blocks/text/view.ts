import { BlockComponent } from '@blocksuite/block-std';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { JabrTextModel } from './schema';

@customElement('jabr-text-block')
export class JabrTextBlockView extends BlockComponent<JabrTextModel> {
  static override styles = css`
    :host { display: block; min-width: 0; }
    textarea {
      display: block;
      box-sizing: border-box;
      width: 100%;
      min-height: 42px;
      resize: vertical;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 9px 12px;
      color: #475569;
      background: transparent;
      font: 14px/1.6 Inter, ui-sans-serif, system-ui, sans-serif;
      outline: none;
    }
    textarea:focus {
      border-color: #dbe3ed;
      background: #fff;
    }
    textarea::placeholder { color: #a0aab8; }
  `;

  private readonly onInput = (event: Event) => {
    const value = (event.currentTarget as HTMLTextAreaElement).value;
    if (value !== this.model.text) this.doc.updateBlock(this.model, { text: value });
  };

  override render() {
    return html`
      <textarea rows="2" .value=${this.model.text}
        placeholder="Add a note or explanation…"
        aria-label="Worksheet text block"
        @input=${this.onInput}></textarea>
    `;
  }
}
