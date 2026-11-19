import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_MATH_LATEX } from '../../src/blocks/math/schema';

declare global {
  interface Window {
    __JABR_TEST__?: {
      doc: {
        captureSync(): void;
        updateBlock(block: unknown, props: Record<string, unknown>): void;
        undo(): void;
        redo(): void;
        getBlockById(id: string): { id: string; latex: string; displayUnit: string; yBlock: { toJSON(): unknown } } | null;
      };
      worksheet: { children: Array<{ id: string; flavour: string; latex: string }> };
      getResult(blockId: string): { status: string; resultLatex: string; sourceRevision: number } | undefined;
      getUpdateBlockCallCount?(): number;
    };
  }
}

async function getFirstMathBlockId(page: Page) {
  return page.evaluate(() => {
    const api = window.__JABR_TEST__;
    if (!api) throw new Error('Browser test seam not installed');
    const block = api.worksheet.children.find(child => child.flavour === 'jabr:math');
    if (!block) throw new Error('Math block not found in worksheet');
    return block.id;
  });
}

// Evaluation is an explicit action; '=' remains ordinary MathLive input.
async function requestEvaluation(page: Page) {
  await page.getByRole('button', { name: 'Evaluate expression' }).first().click();
}

async function readBlockLatex(page: Page, blockId: string): Promise<string | null> {
  return page.evaluate(id => window.__JABR_TEST__?.doc.getBlockById(id)?.latex ?? null, blockId);
}

async function readBlockDisplayUnit(page: Page, blockId: string): Promise<string | null> {
  return page.evaluate(id => window.__JABR_TEST__?.doc.getBlockById(id)?.displayUnit ?? null, blockId);
}

async function readResultRevision(page: Page, blockId: string): Promise<number | null> {
  return page.evaluate(id => window.__JABR_TEST__?.getResult(id)?.sourceRevision ?? null, blockId);
}

async function runHistoryAction(page: Page, action: 'undo' | 'redo') {
  await page.evaluate(action => {
    const api = window.__JABR_TEST__;
    if (!api) throw new Error('Browser test seam not installed');
    api.doc[action]();
  }, action);
}

async function resetLocalDocument(page: Page) {
  // Playwright creates a fresh browser context for each test, so IndexedDB
  // starts empty without deleting databases from an opaque about:blank origin.
  await page.goto('/?e2e=1');
  await expect(page.locator('#save-status')).toContainText('Local document ready');
  await expect(page.locator('jabr-math-block math-field.jabr-math-field')).toBeVisible();
}

test.beforeEach(async ({ page }) => resetLocalDocument(page));

test('real BlockSuite model updates, undo and redo drive controller invalidation in Chromium', async ({ page }) => {
  await page.getByRole('button', { name: 'Enable mock evaluator' }).click();
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  await requestEvaluation(page);
  const result = page.locator('jabr-math-block math-field.jabr-result-field').first();
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toMatch(/MOCK/);
  await expect(page.locator('jabr-math-block .result-status').first()).toHaveText('Result');

  const blockId = await getFirstMathBlockId(page);
  await page.evaluate(id => {
    const api = window.__JABR_TEST__;
    if (!api) throw new Error('Browser test seam not installed');
    const block = api.doc.getBlockById(id);
    if (!block) throw new Error(`Math block ${id} not found for undo/redo mutation`);
    api.doc.captureSync();
    api.doc.updateBlock(block, { latex: 'MOCK_ERROR', displayUnit: 'kN' });
    api.doc.captureSync();
  }, blockId);

  await expect.poll(() => readResultRevision(page, blockId)).toBe(1);
  await expect(page.locator('jabr-math-block .result-status').first()).toContainText('Press Evaluate');
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toBe('');

  await runHistoryAction(page, 'undo');
  await expect.poll(() => readBlockLatex(page, blockId)).toBe(DEFAULT_MATH_LATEX);
  await expect.poll(() => readBlockDisplayUnit(page, blockId)).toBe('');
  await expect.poll(() => readResultRevision(page, blockId)).toBe(2);

  await runHistoryAction(page, 'redo');
  await expect.poll(() => readBlockLatex(page, blockId)).toBe('MOCK_ERROR');
  await expect.poll(() => readBlockDisplayUnit(page, blockId)).toBe('kN');
  await expect.poll(() => readResultRevision(page, blockId)).toBe(3);
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toBe('');
});


test('equals remains authored math input and does not trigger evaluation', async ({ page }) => {
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  const result = page.locator('jabr-math-block math-field.jabr-result-field').first();

  await source.press('=');
  await expect.poll(() => source.evaluate((field: Element & { value: string }) => field.value)).toContain('=');
  await expect(result).toHaveValue('');
  await expect(page.locator('jabr-math-block .result-status').first()).toHaveText('Press Evaluate to request evaluation');
});


test('external model updates synchronize MathLive without echoing a document write', async ({ page }) => {
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  const blockId = await page.evaluate(() => {
    const api = window.__JABR_TEST__;
    if (!api) throw new Error('Browser test seam not installed');
    const block = api.worksheet.children.find(child => child.flavour === 'jabr:math');
    if (!block) throw new Error('Math block not found');
    const model = api.doc.getBlockById(block.id);
    if (!model) throw new Error('Math block model not found');
    const originalUpdate = api.doc.updateBlock.bind(api.doc);
    let writeCount = 0;
    api.doc.updateBlock = (target, props) => {
      writeCount += 1;
      originalUpdate(target, props);
    };
    api.getUpdateBlockCallCount = () => writeCount;
    // Apply an external authored update without going through the wrapped method.
    originalUpdate(model, { latex: String.raw`\\frac{1}{2}` });
    return block.id;
  });

  await expect.poll(() => source.evaluate((field: Element & { value: string }) => field.value))
    .toContain('\\\\frac');
  await expect.poll(() => page.evaluate(() => window.__JABR_TEST__?.getUpdateBlockCallCount?.() ?? -1))
    .toBe(0);
  await expect.poll(() => readBlockLatex(page, blockId)).toBe(String.raw`\\frac{1}{2}`);
});

test('IME composition and modified slash do not insert a fraction shortcut', async ({ page }) => {
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  const initialLatex = await source.evaluate((field: Element & { value: string }) => field.value);

  await source.evaluate((field: Element) => {
    field.dispatchEvent(new KeyboardEvent('keydown', {
      key: '/', isComposing: true, bubbles: true, composed: true,
    }));
    field.dispatchEvent(new KeyboardEvent('keydown', {
      key: '/', ctrlKey: true, bubbles: true, composed: true,
    }));
  });

  await expect.poll(() => source.evaluate((field: Element & { value: string }) => field.value)).toBe(initialLatex);
});

test('result zone is read-only and computed state is absent from the persisted Yjs block', async ({ page }) => {
  await page.getByRole('button', { name: 'Enable mock evaluator' }).click();
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  const result = page.locator('jabr-math-block math-field.jabr-result-field').first();
  await expect(result).toHaveAttribute('read-only', '');
  await requestEvaluation(page);
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toMatch(/MOCK/);

  const blockId = await getFirstMathBlockId(page);
  await page.locator('jabr-math-block .unit-override').first().fill('kN');
  await expect.poll(() => readBlockDisplayUnit(page, blockId)).toBe('kN');
  const persisted = await page.evaluate(id => {
    const block = window.__JABR_TEST__?.doc.getBlockById(id);
    if (!block) throw new Error(`Math block ${id} not found while reading Yjs state`);
    return JSON.stringify(block.yBlock.toJSON());
  }, blockId);
  expect(persisted).not.toContain('resultLatex');
  expect(persisted).not.toContain('resultStatus');
  expect(persisted).not.toContain('diagnostic');
  expect(persisted).toContain('displayUnit');
  expect(persisted).toContain('kN');
});

test('MathLive-authored LaTeX persists across reload while transient result state resets', async ({ page }) => {
  const blockId = await getFirstMathBlockId(page);
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  await source.press('1');
  const authoredLatex = await source.evaluate((field: Element & { value: string }) => field.value);
  await expect.poll(() => readBlockLatex(page, blockId)).toBe(authoredLatex);
  await expect(authoredLatex).not.toBe(DEFAULT_MATH_LATEX);

  await page.locator('jabr-math-block .unit-override').first().fill('cm');
  await expect.poll(() => readBlockDisplayUnit(page, blockId)).toBe('cm');

  await page.reload();
  await expect(page.locator('#save-status')).toContainText('Local document ready');
  const reloadedSource = page.locator('jabr-math-block math-field.jabr-math-field').first();
  await expect(reloadedSource).toBeVisible();
  // Provider startup and model hydration are separate; wait for both model and field.
  await expect.poll(() => readBlockLatex(page, blockId), { timeout: 15_000 }).toBe(authoredLatex);
  await expect.poll(() => reloadedSource.evaluate((field: Element & { value: string }) => field.value),
    { timeout: 15_000 }).toBe(authoredLatex);
  await expect(page.locator('jabr-math-block .unit-override').first()).toHaveValue('cm');
  await expect.poll(() => readBlockDisplayUnit(page, blockId), { timeout: 15_000 }).toBe('cm');
  await expect(page.locator('jabr-math-block .result-status').first()).toContainText('Press Evaluate');
});


test('BlockSuite shadow-DOM hosts and text styles are applied', async ({ page }) => {
  // The initial worksheet contains math only; add a text block to test its scoped styles.
  await page.locator('#add-text').click();
  // Playwright locators pierce open shadow roots; document.querySelector does not.
  const rootDisplay = await page.locator('jabr-root-block').evaluate(element => getComputedStyle(element).display);
  const worksheetDisplay = await page.locator('jabr-worksheet-block').evaluate(element => getComputedStyle(element).display);
  const mathDisplay = await page.locator('jabr-math-block').evaluate(element => getComputedStyle(element).display);
  const textBlock = page.locator('jabr-text-block');
  const textDisplay = await textBlock.evaluate(element => getComputedStyle(element).display);
  const internalTextareaStyles = await textBlock.locator('textarea').evaluate(element => {
    const styles = getComputedStyle(element);
    return { minHeight: styles.minHeight, fontSize: styles.fontSize };
  });
  expect(rootDisplay).toBe('block');
  expect(worksheetDisplay).toBe('block');
  expect(mathDisplay).toBe('block');
  expect(textDisplay).toBe('block');
  expect(internalTextareaStyles.minHeight).toBe('42px');
  expect(internalTextareaStyles.fontSize).toBe('14px');
});
test('MathLive inspector reads prompt data only while expanded and reflects latest expression on open', async ({ page }) => {
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  const inspector = page.locator('jabr-math-block details.math-output').first();

  // Insert before spying: the template insertion implementation itself reads
  // existing prompts to guarantee unique IDs.
  await page.getByRole('button', { name: 'Insert Fraction' }).click();
  // Resolve the target prompt before installing the read counter, otherwise
  // the test's own lookup would count as a collapsed-inspector read.
  const numeratorPromptId = await source.evaluate((field: Element & {
    getPrompts: () => string[];
  }) => field.getPrompts().find(id => id.startsWith('numeratorp')) ?? null);
  expect(numeratorPromptId).not.toBeNull();

  await source.evaluate((field: Element & { getPrompts: () => string[]; __promptReadCount?: number }) => {
    const original = field.getPrompts.bind(field);
    field.__promptReadCount = 0;
    field.getPrompts = () => {
      field.__promptReadCount = (field.__promptReadCount ?? 0) + 1;
      return original();
    };
  });

  // Set the named MathLive prompt directly. Keyboard typing is caret-dependent
  // and can land outside the numerator when the template's selection changes.
  await source.evaluate((field: Element & {
    setPromptValue: (id: string, value: string) => void;
  }, id) => field.setPromptValue(id, '7'), numeratorPromptId);
  await expect.poll(() => source.evaluate((field: Element & { __promptReadCount?: number }) =>
    field.__promptReadCount ?? 0)).toBe(0);
  await expect(inspector).not.toHaveAttribute('open', '');

  await inspector.locator('summary').click();
  await expect(inspector).toHaveAttribute('open', '');
  await expect.poll(() => source.evaluate((field: Element & { __promptReadCount?: number }) =>
    field.__promptReadCount ?? 0)).toBeGreaterThan(0);
  await expect(inspector.locator('pre')).toContainText('\\frac');
  const numeratorValue = inspector.locator('dl dt')
    .filter({ hasText: numeratorPromptId! })
    .locator('xpath=following-sibling::dd[1]');
  await expect(numeratorValue).toContainText('7');
});


test('MathLive slash shortcut and toolbar insert structured templates with unique prompt IDs', async ({ page }) => {
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();

  // The Mathcad-style slash shortcut must insert a native MathLive fraction.
  await source.press('/');
  await expect.poll(() => source.evaluate((field: Element & { value: string }) => field.value))
    .toContain('\\frac');
  const shortcutPrompts = await source.evaluate((field: Element & { getPrompts: () => string[] }) => field.getPrompts());
  expect(shortcutPrompts.length).toBeGreaterThanOrEqual(2);
  expect(new Set(shortcutPrompts).size).toBe(shortcutPrompts.length);

  // Repeated insertion must generate fresh IDs rather than collide with existing prompts.
  await page.getByRole('button', { name: 'Insert Fraction' }).click();
  const repeatedPrompts = await source.evaluate((field: Element & { getPrompts: () => string[] }) => field.getPrompts());
  expect(repeatedPrompts.length).toBeGreaterThan(shortcutPrompts.length);
  expect(new Set(repeatedPrompts).size).toBe(repeatedPrompts.length);

  const templates = [
    { label: 'Insert Square root', latex: String.raw`\sqrt{` },
    { label: 'Insert Indexed root', latex: String.raw`\sqrt[` },
    { label: 'Insert Integral', latex: '\\int' },
    { label: 'Insert 2×2 matrix', latex: '\\begin{bmatrix}' },
  ];
  for (const template of templates) {
    await page.getByRole('button', { name: template.label }).click();
    await expect.poll(() => source.evaluate((field: Element & { value: string }) => field.value))
      .toContain(template.latex);
  }

  const finalPrompts = await source.evaluate((field: Element & { getPrompts: () => string[] }) => field.getPrompts());
  expect(new Set(finalPrompts).size).toBe(finalPrompts.length);
});
