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
  await page.goto('about:blank');
  await page.evaluate(async () => {
    const names = ['jabr-ui-worksheet-v1:collection', 'jabr-ui-worksheet-v1:document'];
    await Promise.all(names.map(name => new Promise<void>(resolve => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    })));
  });
  await page.goto('/?e2e=1');
  await expect(page.locator('#save-status')).toContainText('Local document ready');
  await expect(page.locator('jabr-math-block math-field.jabr-math-field')).toBeVisible();
}

test.beforeEach(async ({ page }) => resetLocalDocument(page));

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


test('light-DOM block hosts are block-level and text styles do not leak to unrelated textareas', async ({ page }) => {
  const styles = await page.evaluate(() => {
    const externalTextarea = document.createElement('textarea');
    document.body.append(externalTextarea);
    const result = {
      rootDisplay: getComputedStyle(document.querySelector('jabr-root-block')!).display,
      worksheetDisplay: getComputedStyle(document.querySelector('jabr-worksheet-block')!).display,
      mathDisplay: getComputedStyle(document.querySelector('jabr-math-block')!).display,
      textDisplay: getComputedStyle(document.querySelector('jabr-text-block')!).display,
      externalTextareaMinHeight: getComputedStyle(externalTextarea).minHeight,
    };
    externalTextarea.remove();
    return result;
  });

  expect(styles.rootDisplay).toBe('block');
  expect(styles.worksheetDisplay).toBe('block');
  expect(styles.mathDisplay).toBe('block');
  expect(styles.textDisplay).toBe('block');
  expect(styles.externalTextareaMinHeight).not.toBe('42px');
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
