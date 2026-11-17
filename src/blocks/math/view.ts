import { BlockComponent } from '@blocksuite/lit';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { JabrMathModel } from './schema';

type MathFieldElement = HTMLElement & {
  value: string;
};

@customElement('jabr-math-block')
export class JabrMathBlockView extends BlockComponent<JabrMathModel> {
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
          math-virtual-keyboard-policy="manual"
          smart-fence
          smart-mode
          placeholder="Enter an expression"
          aria-label="Edit mathematical expression"
        ></math-field>
      </section>
    `;
  }
}
