import { BlockComponent } from '@blocksuite/block-std';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { JabrMathModel } from './schema';
import { worksheetResults } from '../../worksheet/result-store';

type InlineShortcut = string | { after: string; value: string };
type InsertOptions = { selectionMode: 'placeholder' };
type MathFieldElement = HTMLElement & {
  value: string;
  inlineShortcuts: Record<string, InlineShortcut>;
  getValue(format?: string): string;
  getPrompts(): string[];
  getPromptValue(id: string, format?: string): string;
  executeCommand(command: string | [string, string, InsertOptions]): boolean;
};

type PromptOutput = { id: string; value: string };
type MathTemplate = {
  id: string;
  label: string;
  latex: string;
  description: string;
};

const QUANTITY_PROMPT_HINTS: Record<string, string> = {
  mass: 'Expected dimension: mass · e.g. 5 kg',
  acceleration: 'Expected dimension: acceleration · e.g. 9.81 m/s²',
  force: 'Expected dimension: force · e.g. 12 kN',
};

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

// These are editor templates, not calculation-language variables. Prompt IDs are
// scoped to this inserted structure and are used only for navigation/inspection.
const MATH_TEMPLATES: MathTemplate[] = [
  {
    id: 'fraction',
    label: 'Fraction',
    latex: String.raw`\frac{\placeholder[numerator]{}}{\placeholder[denominator]{}}`,
    description: 'Numerator and denominator',
  },
  {
    id: 'square-root',
    label: 'Square root',
    latex: String.raw`\sqrt{\placeholder[radicand]{}}`,
    description: 'Radicand',
  },
  {
    id: 'indexed-root',
    label: 'Indexed root',
    latex: String.raw`\sqrt[\placeholder[rootindex]{}]{\placeholder[rootradicand]{}}`,
    description: 'Root index and radicand',
  },
  {
    id: 'integral',
    label: 'Integral',
    latex: String.raw`\int_{\placeholder[lowerlimit]{}}^{\placeholder[upperlimit]{}}\placeholder[integrand]{}\,d\placeholder[integrationvariable]{}`,
    description: 'Lower limit, upper limit, integrand, and variable',
  },
  {
    id: 'matrix-2x2',
    label: '2×2 matrix',
    latex: String.raw`\begin{bmatrix}\placeholder[matrix11]{} & \placeholder[matrix12]{}\\\placeholder[matrix21]{} & \placeholder[matrix22]{}\end{bmatrix}`,
    description: 'Four independently editable cells',
  },
];

@customElement('jabr-math-block')
export class JabrMathBlockView extends BlockComponent<JabrMathModel> {
  static override styles = css`
    :host { display: block; min-width: 0; }
    .jabr-math-block {
      min-height: 72px;
      padding: 14px 16px;
      border: 1px solid transparent;
      border-radius: 8px;
      transition: border-color 120ms ease, background 120ms ease;
    }
    .jabr-math-block:focus-within { border-color: #cbd5e1; background: #fbfcfe; }
    .jabr-math-label {
      margin-bottom: 8px;
      color: #94a0af;
      font: 700 10px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.12em;
    }
    .jabr-math-toolbar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 9px; }
    .jabr-template-button {
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 5px 8px;
      color: #475569;
      background: #fff;
      cursor: pointer;
      font: 11px/1.3 Inter, ui-sans-serif, system-ui, sans-serif;
    }
    .jabr-template-button:hover, .jabr-template-button:focus-visible {
      border-color: #94a3b8; background: #f8fafc; outline: none;
    }
    .jabr-math-help {
      margin-bottom: 8px;
      color: #94a3b8;
      font: 11px/1.4 Inter, ui-sans-serif, system-ui, sans-serif;
    }
    .jabr-math-row { display: grid; grid-template-columns: minmax(0, 1fr) 22px minmax(190px, 0.62fr); align-items: center; gap: 12px; min-width: 0; }
    .math-input-zone, .result-zone, .result-main { min-width: 0; }
    .math-equals { color: #94a3b8; text-align: center; font: 500 22px/1 Inter, ui-sans-serif, system-ui, sans-serif; }
    .result-zone { display: flex; align-items: center; gap: 8px; }
    .result-main { flex: 1; }
    .jabr-result-field { display: block; width: 100%; min-height: 42px; border: 0; outline: 0; background: transparent; color: #334155; font-size: 22px; --caret-color: transparent; }
    .result-status { display: block; min-height: 14px; color: #94a3b8; font: 10px/1.4 Inter, ui-sans-serif, system-ui, sans-serif; }
    .unit-override { box-sizing: border-box; width: 62px; min-width: 0; padding: 6px 5px; border: 1px dashed #cbd5e1; border-radius: 5px; color: #64748b; background: #fff; font: 12px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; outline: none; }
    .unit-override:focus { border-style: solid; border-color: #94a3b8; }
    @media (max-width: 640px) { .jabr-math-row { grid-template-columns: minmax(0, 1fr) 18px minmax(125px, 0.75fr); gap: 7px; } .jabr-result-field { font-size: 18px; } .unit-override { width: 48px; } }
    .jabr-math-field {
      display: block;
      width: 100%;
      min-height: 48px;
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
    .math-output dt { color: #94a3b8; }
    .math-output dd { min-width: 0; margin: 0; overflow-wrap: anywhere; color: #334155; }
    .math-output pre { margin: 5px 0 10px; white-space: pre-wrap; overflow-wrap: anywhere; color: #334155; }
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
  private resultSubscription: (() => void) | null = null;
  private latexOutput = '';
  private promptOutput: PromptOutput[] = [];
  private templateSequence = 0;
  private inspecting = false;

  private readonly onMathInput = () => {
    if (!this.mathField) return;
    const latex = this.mathField.value;
    if (latex !== this.model.latex) {
      this.doc.updateBlock(this.model, { latex });
    }
    if (this.inspecting) this.refreshOutput();
  };

  private readonly onInspectorToggle = (event: Event) => {
    this.inspecting = (event.currentTarget as HTMLDetailsElement).open;
    if (this.inspecting) this.refreshOutput();
  };

  private readonly onMathKeydown = (event: KeyboardEvent) => {
    if (!this.mathField || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === '=') {
      event.preventDefault();
      this.requestEvaluation();
      return;
    }
    if (event.key === '/') {
      // Match Mathcad: slash inserts a structured fraction, not a literal slash.
      event.preventDefault();
      this.insertTemplate(MATH_TEMPLATES[0]);
    }
  };

  private readonly onDisplayUnitInput = (event: Event) => {
    const displayUnit = (event.currentTarget as HTMLInputElement).value;
    if (displayUnit !== this.model.displayUnit) {
      this.doc.updateBlock(this.model, { displayUnit });
    }
  };

  private requestEvaluation() {
    this.dispatchEvent(new CustomEvent('jabr-evaluate-request', {
      bubbles: true,
      composed: true,
      detail: { blockId: this.model.id },
    }));
  }

  private get resultStatusLabel() {
    const state = worksheetResults.get(this.model.id);
    switch (state.status) {
      case 'pending': return 'Evaluating…';
      case 'success': return 'Result';
      case 'error': return state.diagnostic || 'Evaluation error';
      case 'unavailable': return state.diagnostic || 'CLI evaluator unavailable';
      default: return 'Press = to request evaluation';
    }
  }

  private readonly onModelUpdated = () => this.syncFromModel();

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
    this.resultSubscription = worksheetResults.subscribe(this.model.id, () => this.requestUpdate());
    field.inlineShortcuts = { ...field.inlineShortcuts, ...UNIT_SHORTCUTS };
    field.value = this.model.latex;
    field.addEventListener('input', this.onMathInput);
    field.addEventListener('keydown', this.onMathKeydown, true);
    this.modelSubscription = this.model.propsUpdated.on(this.onModelUpdated);
    this.refreshOutput();
  }

  private detachMathField() {
    this.mathField?.removeEventListener('input', this.onMathInput);
    this.mathField?.removeEventListener('keydown', this.onMathKeydown, true);
    this.mathField = null;
    this.resultSubscription?.();
    this.resultSubscription = null;
    this.modelSubscription?.dispose();
    this.modelSubscription = null;
  }

  private syncFromModel() {
    if (this.mathField && this.mathField.value !== this.model.latex) this.mathField.value = this.model.latex;
    this.refreshOutput();
  }

  private insertTemplate(template: MathTemplate) {
    if (!this.mathField) return;
    this.mathField.focus();
    const existingPromptIds = new Set(this.mathField.getPrompts());
    let sequence = this.templateSequence;
    let latex = '';
    let insertedPromptIds: string[] = [];

    do {
      sequence += 1;
      insertedPromptIds = [];
      latex = template.latex.replace(/\\placeholder\[([^\]]+)\]/g, (_match, id: string) => {
        const uniqueId = `${id}p${sequence}`;
        insertedPromptIds.push(uniqueId);
        return `\\placeholder[${uniqueId}]`;
      });
    } while (insertedPromptIds.some(id => existingPromptIds.has(id)));

    this.templateSequence = sequence;
    this.mathField.executeCommand(['insert', latex, { selectionMode: 'placeholder' }]);
  }

  private refreshOutput() {
    if (!this.mathField || !this.inspecting) return;
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
        <div class="jabr-math-label">MATH · STRUCTURED INPUT</div>
        <div class="jabr-math-toolbar" role="toolbar" aria-label="Insert mathematical structure">
          ${MATH_TEMPLATES.map(template => html`
            <button class="jabr-template-button" type="button"
              title="${template.description}" aria-label="Insert ${template.label}"
              @click=${() => this.insertTemplate(template)}>${template.label}</button>
          `)}
        </div>
        <div class="jabr-math-help">
          / inserts a fraction · = requests evaluation · Tab / Shift+Tab moves between placeholders · Arrow keys navigate mathematical structures
        </div>
        <div class="jabr-math-row">
          <div class="math-input-zone">
            <math-field class="jabr-math-field" math-virtual-keyboard-policy="manual"
              smart-fence smart-mode smart-superscript placeholder="Enter an expression"
              aria-label="Mathematical expression editor"></math-field>
          </div>
          <span class="math-equals" aria-hidden="true">=</span>
          <div class="result-zone">
            <div class="result-main">
              <math-field class="jabr-result-field" read-only .value=${worksheetResults.get(this.model.id).resultLatex}
                aria-label="Read-only calculation result"></math-field>
              <span class="result-status" role="status">${this.resultStatusLabel}</span>
            </div>
            <input class="unit-override" type="text" .value=${this.model.displayUnit}
              placeholder="unit" aria-label="Requested result display unit"
              title="Request a result unit, for example cm" @input=${this.onDisplayUnitInput} />
          </div>
        </div>
        <details class="math-output" @toggle=${this.onInspectorToggle}>
          <summary>Inspect expression and placeholders</summary>
          <h4>LaTeX source</h4>
          <pre>${this.latexOutput || 'Waiting for MathLive…'}</pre>
          <h4>Placeholder values</h4>
          ${this.promptOutput.length ? html`<dl>
            ${this.promptOutput.map(prompt => html`
              <dt>${prompt.id}</dt>
              <dd>${prompt.value || '(empty)'}
                ${QUANTITY_PROMPT_HINTS[prompt.id] ? html`<span> — ${QUANTITY_PROMPT_HINTS[prompt.id]}</span>` : ''}
              </dd>
            `)}
          </dl>` : html`<p>No active placeholders. Type directly into the expression.</p>`}
        </details>
      </section>
    `;
  }
}
