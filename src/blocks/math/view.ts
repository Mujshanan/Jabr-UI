import { BlockComponent } from '@blocksuite/lit';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { JabrMathModel } from './schema';

type InlineShortcut = string | { after: string; value: string };

type MathFieldElement = HTMLElement & {
  value: string;
  inlineShortcuts: Record<string, InlineShortcut>;
  getValue(format?: string): string;
  getPrompts(): string[];
  getPromptValue(id: string, format?: string): string;
};

type PromptOutput = { id: string; value: string };

const QUANTITY_PROMPT_HINTS: Record<string, string> = {
  mass: 'Expected dimension: mass · e.g. 5 kg',
  acceleration: 'Expected dimension: acceleration · e.g. 9.81 m/s²',
  force: 'Expected dimension: force · e.g. 12 kN',
};

// These shortcuts typeset common engineering units upright after a number or space.
// They are input conveniences only; dimensional validation is handled outside MathLive.
const UNIT_SHORTCUTS: Record<string, InlineShortcut> = {
  kg: { after: 'digit | space', value: String.raw`\mathrm{kg}` },
  mm: { after: 'digit | space', value: String.raw`\mathrm{mm}` },
  cm: { after: 'digit | space', value: String.raw`\mathrm{cm}` },
  km: { after: 'digit | space', value: String.raw`\mathrm{km}` },
  kN: { after: 'digit | space', value: String.raw`\mathrm{kN}` },
  MN: { after: 'digit | space', value: String.raw`\mathrm{MN}` },
  MPa: { after: 'digit | space', value: String.raw`\mathrm{MPa}` },
  GPa: { after: 'digit | space', value: String.raw`\mathrm{GPa}` },
  kPa: { after: 'digit | space', value: String.raw`\mathrm{kPa}` },
  mps: { after: 'digit | space', value: String.raw`\mathrm{m/s}` },
  mps2: { after: 'digit | space', value: String.raw`\mathrm{m/s^2}` },
  mmps2: { after: 'digit | space', value: String.raw`\mathrm{mm/s^2}` },
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
      margin-bottom: 5px;
      color: #94a0af;
      font: 700 10px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.12em;
    }

    .jabr-math-help {
      margin-bottom: 8px;
      color: #94a3b8;
      font: 11px/1.4 Inter, ui-sans-serif, system-ui, sans-serif;
    }

    .jabr-math-field {
      display: block;
      width: 100%;
      min-height: 42px;
      padding: 3px 0;
      border: 0;
      outline: 0;
      background: transparent;
      font-size: 25px;
      --caret-color: #2563eb;
      --selection-background-color: #dbeafe;
      --contains-highlight-background-color: #eff6ff;
    }

    .math-output {
      margin-top: 12px;
      border-top: 1px solid #e8edf2;
      padding-top: 9px;
      color: #64748b;
      font: 11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
    }

    .math-output summary {
      width: fit-content;
      cursor: pointer;
      color: #64748b;
      font: 600 11px/1.5 Inter, ui-sans-serif, system-ui, sans-serif;
    }

    .math-output dl {
      display: grid;
      grid-template-columns: minmax(120px, 0.3fr) 1fr;
      gap: 5px 12px;
      margin: 10px 0 0;
    }

    .math-output dt {
      color: #94a3b8;
    }

    .math-output dd {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
      color: #334155;
    }

    .math-output pre {
      margin: 5px 0 10px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: #334155;
    }

    .math-output h4 {
      margin: 10px 0 2px;
      color: #94a3b8;
      font: 700 9px/1.4 Inter, ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  `;

  private mathField: MathFieldElement | null = null;
  private modelSubscription: { dispose: () => void } | null = null;
  private latexOutput = '';
  private promptOutput: PromptOutput[] = [];

  private readonly onMathInput = () => {
    if (!this.mathField) return;

    const latex = this.mathField.value;
    if (latex !== this.model.latex) {
      this.doc.updateBlock(this.model, { latex });
    }
    this.refreshOutput();
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
    field.inlineShortcuts = {
      ...field.inlineShortcuts,
      ...UNIT_SHORTCUTS,
    };
    field.value = this.model.latex;
    field.addEventListener('input', this.onMathInput);
    this.modelSubscription = this.model.propsUpdated.on(this.onModelUpdated);
    this.refreshOutput();
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
    this.refreshOutput();
  }

  private refreshOutput() {
    if (!this.mathField) return;

    this.latexOutput = this.mathField.getValue('latex');
    this.promptOutput = this.mathField.getPrompts().map(id => ({
      id,
      value: this.mathField?.getPromptValue(id, 'latex') ?? '',
    }));
    this.requestUpdate();
  }

  override render() {
    return html`
      <section class="jabr-math-block" aria-label="Mathematical expression">
        <div class="jabr-math-label">MATH / MATHLIVE · EDITABLE EXPRESSION</div>
        <div class="jabr-math-help">Tab / Shift+Tab: move between inputs · Type unit shortcuts after a value (kg, kN, MPa, mps2)</div>
        <math-field
          class="jabr-math-field"
          math-virtual-keyboard-policy="manual"
          smart-fence
          smart-mode
          smart-superscript
          placeholder="Enter an expression"
          aria-label="Mathematical expression editor"
        ></math-field>
        <details class="math-output">
          <summary>Inspect expression inputs</summary>
          <h4>LaTeX source</h4>
          <pre>${this.latexOutput || 'Waiting for MathLive…'}</pre>
          <h4>Named quantity inputs</h4>
          ${this.promptOutput.length
            ? html`<dl>
                ${this.promptOutput.map(prompt => html`
                  <dt>${prompt.id}</dt>
                  <dd>
                    ${prompt.value || '(empty)'}
                    ${QUANTITY_PROMPT_HINTS[prompt.id]
                      ? html`<span> — ${QUANTITY_PROMPT_HINTS[prompt.id]}</span>`
                      : ''}
                  </dd>
                `)}
              </dl>`
            : html`<p>No input placeholders. Type directly into the expression.</p>`}
        </details>
      </section>
    `;
  }
}
