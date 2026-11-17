import { BlockComponent } from '@blocksuite/lit';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { JabrMathModel } from './schema';

type MathFieldElement = HTMLElement & {
  value: string;
};

@customElement('jabr-math-block')
export class JabrMathBlockView extends BlockComponent<JabrMathModel> {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .jabr-math-block {
      min-height: 72px;
      padding: 14px 16px;
      border: 1px solid transparent;
      border-radius: 8px;
      transition: border-color 120ms ease, background 120ms ease;
    }

    .jabr-math-block:focus-within {
      border-color: #cbd5e1;
      background: #fbfcfe;
    }

    .jabr-math-label {
      margin-bottom: 10px;
      color: #94a0af;
      font: 700 10px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.12em;
    }

    .jabr-math-field {
      display: block;
      width: 100%;
      min-height: 36px;
      padding: 3px 0;
      border: 0;
      outline: 0;
      background: transparent;
      font-size: 25px;
      --caret-color: #2563eb;
      --selection-background-color: #dbeafe;
      --contains-highlight-background-color: #eff6ff;
    }
  `;

  private mathField: MathFieldElement | null = null;
  private modelSubscription: { dispose: () => void } | null = null;

  private readonly onMathInput = () => {
    if (!this.mathField) return;

    const latex = this.mathField.value;
    if (latex !== this.model.latex) {
      this.doc.updateBlock(this.model, { latex });
    }
  };

  private readonly onModelUpdated = () => {
    this.syncFromModel();
  };

  override connectedCallback() {
    super.connectedCallback();
    void this.updateComplete.then(() => this.attachMathField());
  }

  override disconnectedCallback() {
    this.detachMathField();
    super.disconnectedCallback();
  }

  private attachMathField() {
    const field = this.renderRoot.querySelector('math-field') as MathFieldElement | null;
    if (!field || this.mathField === field) return;

    this.detachMathField();
    this.mathField = field;
    field.value = this.model.latex;
    field.addEventListener('input', this.onMathInput);
    this.modelSubscription = this.model.propsUpdated.on(this.onModelUpdated);
  }

  private detachMathField() {
    this.mathField?.removeEventListener('input', this.onMathInput);
    this.mathField = null;
    this.modelSubscription?.dispose();
    this.modelSubscription = null;
  }

  private syncFromModel() {
    if (this.mathField && this.mathField.value !== this.model.latex) {
      this.mathField.value = this.model.latex;
    }
  }

  override render() {
    return html`
      <section class="jabr-math-block" aria-label="Mathematical expression">
        <div class="jabr-math-label">MATH</div>
        <math-field
          class="jabr-math-field"
          readonly
          math-virtual-keyboard-policy="manual"
          smart-fence
          smart-mode
          placeholder="Enter an expression"
          aria-label="Fill mathematical placeholders"
        ></math-field>
      </section>
    `;
  }
}
