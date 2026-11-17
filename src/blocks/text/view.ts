import { BlockComponent } from '@blocksuite/lit';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { JabrTextModel } from './schema';

@customElement('jabr-text-block')
export class JabrTextBlockView extends BlockComponent<JabrTextModel> {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .jabr-text-block {
      display: grid;
      gap: 8px;
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
    }

    .jabr-text-label {
      color: #94a0af;
      font: 700 10px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.12em;
    }

    textarea {
      display: block;
      width: 100%;
      min-height: 58px;
      resize: vertical;
      border: 0;
      outline: 0;
      color: #303846;
      background: transparent;
      font: 14px/1.6 Inter, ui-sans-serif, system-ui, sans-serif;
    }

    .jabr-text-block:focus-within {
      border-color: #94a3b8;
      background: #fbfcfe;
    }
  `;

  private readonly onTextInput = (event: Event) => {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    if (textarea.value !== this.model.text) {
      this.doc.updateBlock(this.model, { text: textarea.value });
    }
  };

  override render() {
    return html`
      <section class="jabr-text-block" aria-label="Plain text block">
        <div class="jabr-text-label">PLAIN TEXT / BLOCKSUITE TEST</div>
        <textarea
          aria-label="Plain text content"
          .value=${this.model.text}
          @input=${this.onTextInput}
          placeholder="Type here to test BlockSuite updates…"
        ></textarea>
      </section>
    `;
  }
}
