import { expect, test } from '@playwright/test';
import { DEFAULT_MATH_LATEX } from '../../src/blocks/math/schema';

declare global {
  interface Window {
    __JABR_TEST__?: {
      doc: {
        captureSync(): void;
        updateBlock(block: unknown, props: Record<string, unknown>): void;
        undo(): void;
        redo(): void;
        getBlockById(id: string): { id: string; latex: string; yBlock: { toJSON(): unknown } } | null;
      };
      worksheet: { children: Array<{ id: string; flavour: string; latex: string }> };
      getResult(blockId: string): { status: string; resultLatex: string; sourceRevision: number };
    };
  }
}

async function resetLocalDocument(page: import('@playwright/test').Page) {
  // Playwright creates a fresh browser context for each test, so IndexedDB
  // starts empty without deleting databases from an opaque about:blank origin.
  await page.goto('/?e2e=1');
  await expect(page.locator('#save-status')).toContainText('Local document ready');
  await expect(page.locator('jabr-math-block math-field.jabr-math-field')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  page.on('console', message => {
    if (message.type() === 'error') console.log(`[browser console] ${message.text()}`);
  });
  page.on('pageerror', error => console.log(`[browser pageerror] ${error.stack ?? error.message}`));
  await resetLocalDocument(page);
});

test('real BlockSuite model updates, undo and redo drive controller invalidation in Chromium', async ({ page }) => {
  await page.getByRole('button', { name: 'Enable mock evaluator' }).click();
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  await source.press('=');
  const result = page.locator('jabr-math-block math-field.jabr-result-field').first();
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toMatch(/MOCK/);
  await expect(page.locator('jabr-math-block .result-status').first()).toHaveText('Result');

  const blockId = await page.evaluate(() => {
    const api = window.__JABR_TEST__;
    if (!api) throw new Error('Browser test seam not installed');
    const block = api.worksheet.children.find(child => child.flavour === 'jabr:math');
    if (!block) throw new Error('Math block not found');
    api.doc.captureSync();
    api.doc.updateBlock(block, { latex: 'MOCK_ERROR' });
    api.doc.captureSync();
    return block.id;
  });

  await expect.poll(() => page.evaluate(id => window.__JABR_TEST__!.getResult(id).sourceRevision, blockId)).toBe(1);
  await expect(page.locator('jabr-math-block .result-status').first()).toContainText('Press =');
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toBe('');

  await page.evaluate(() => window.__JABR_TEST__!.doc.undo());
  await expect.poll(() => page.evaluate(id => window.__JABR_TEST__!.doc.getBlockById(id)!.latex, blockId))
    .toBe(DEFAULT_MATH_LATEX);
  await expect.poll(() => page.evaluate(id => window.__JABR_TEST__!.getResult(id).sourceRevision, blockId)).toBe(2);

  await page.evaluate(() => window.__JABR_TEST__!.doc.redo());
  await expect.poll(() => page.evaluate(id => window.__JABR_TEST__!.doc.getBlockById(id)!.latex, blockId)).toBe('MOCK_ERROR');
  await expect.poll(() => page.evaluate(id => window.__JABR_TEST__!.getResult(id).sourceRevision, blockId)).toBe(3);
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toBe('');
});

test('result zone is read-only and computed state is absent from the persisted Yjs block', async ({ page }) => {
  await page.getByRole('button', { name: 'Enable mock evaluator' }).click();
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  const result = page.locator('jabr-math-block math-field.jabr-result-field').first();
  await expect(result).toHaveAttribute('read-only', '');
  await source.press('=');
  await expect.poll(() => result.evaluate((field: Element & { value: string }) => field.value)).toMatch(/MOCK/);

  const persisted = await page.evaluate(() => {
    const api = window.__JABR_TEST__;
    if (!api) throw new Error('Browser test seam not installed');
    const block = api.worksheet.children.find(child => child.flavour === 'jabr:math');
    if (!block) throw new Error('Math block not found');
    return JSON.stringify(api.doc.getBlockById(block.id)?.yBlock.toJSON());
  });
  expect(persisted).not.toContain('resultLatex');
  expect(persisted).not.toContain('resultStatus');
  expect(persisted).not.toContain('diagnostic');
});

test('authored LaTeX persists across reload while transient result state resets', async ({ page }) => {
  const blockId = await page.evaluate(() => {
    const api = window.__JABR_TEST__;
    if (!api) throw new Error('Browser test seam not installed');
    const block = api.worksheet.children.find(child => child.flavour === 'jabr:math');
    if (!block) throw new Error('Math block not found');
    api.doc.updateBlock(block, { latex: 'persisted source test' });
    return block.id;
  });
  await expect.poll(() => page.evaluate(id => window.__JABR_TEST__!.doc.getBlockById(id)!.latex, blockId))
    .toBe('persisted source test');
  await page.reload();
  await expect(page.locator('#save-status')).toContainText('Local document ready');
  await expect.poll(() => page.locator('jabr-math-block math-field.jabr-math-field').first()
    .evaluate((field: Element & { value: string }) => field.value)).toBe('persisted source test');
  await expect(page.locator('jabr-math-block .result-status').first()).toContainText('Press =');
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
  const documentHasTextareaRule = await page.evaluate(() =>
    Array.from(document.styleSheets).some(sheet => {
      try {
        return Array.from(sheet.cssRules).some(rule => rule.cssText.includes('textarea'));
      } catch {
        return false;
      }
    })
  );

  expect(rootDisplay).toBe('block');
  expect(worksheetDisplay).toBe('block');
  expect(mathDisplay).toBe('block');
  expect(textDisplay).toBe('block');
  expect(internalTextareaStyles.minHeight).toBe('42px');
  expect(internalTextareaStyles.fontSize).toBe('14px');
  // Textarea styling belongs to the text block's shadow stylesheet, not document CSS.
  expect(documentHasTextareaRule).toBe(false);
});
test('MathLive inspector reads prompt data only while expanded', async ({ page }) => {
  const source = page.locator('jabr-math-block math-field.jabr-math-field').first();
  await source.evaluate((field: Element & { getPrompts: () => string[]; __promptReadCount?: number }) => {
    const original = field.getPrompts.bind(field);
    field.__promptReadCount = 0;
    field.getPrompts = () => {
      field.__promptReadCount = (field.__promptReadCount ?? 0) + 1;
      return original();
    };
  });

  await source.press('1');
  await expect.poll(() => source.evaluate((field: Element & { __promptReadCount?: number }) => field.__promptReadCount ?? 0)).toBe(0);

  await page.locator('jabr-math-block details.math-output').first().locator('summary').click();
  await expect.poll(() => source.evaluate((field: Element & { __promptReadCount?: number }) => field.__promptReadCount ?? 0)).toBeGreaterThan(0);
});
