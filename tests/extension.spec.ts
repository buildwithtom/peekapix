import { test as base, expect, chromium, type Page } from '@playwright/test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

declare const chrome: typeof import('wxt/browser')['browser'];

const extension = resolve('.output/chrome-mv3');

type ExtensionFixture = {
  page: Page;
  trigger: () => Promise<void>;
  badge: () => Promise<string>;
  popup: () => Promise<string>;
  extensionId: string;
};

const test = base.extend<{ extension: ExtensionFixture }>({
  async extension({ baseURL }, provide) {
    const profile = await mkdtemp(join(tmpdir(), 'peekapix-test-'));
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      viewport: { width: 1320, height: 860 },
      args: ['--enable-unsafe-extension-debugging', '--disable-extensions-except=' + extension, '--load-extension=' + extension],
    });
    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      const extensionId = new URL(worker.url()).host;
      await worker.evaluate(() => chrome.action.getTitle({}));
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(baseURL!, { timeout: 10000 });
      await page.bringToFront();
      const browserSession = await context.browser()!.newBrowserCDPSession();
      const tabInfo = () => worker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (tabId === undefined) throw new Error('No active test tab');
        return {
          badge: await chrome.action.getBadgeText({ tabId }),
          popup: await chrome.action.getPopup({ tabId }),
        };
      });

      await provide({
        page, extensionId,
        async trigger() {
          const { targetInfos } = await browserSession.send('Target.getTargets', { filter: [{ type: 'tab' }, { exclude: true }] });
          const tab = targetInfos.find(item => item.url === page.url()) ?? (targetInfos.length === 1 ? targetInfos[0] : undefined);
          if (!tab) throw new Error('No Chromium tab target for ' + page.url());
          await browserSession.send('Extensions.triggerAction', { id: extensionId, targetId: tab.targetId });
        },
        async badge() { return (await tabInfo()).badge; },
        async popup() { return (await tabInfo()).popup; },
      });
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
});

const host = (page: Page) => page.locator('peekapix-inspector');
const tool = (page: Page, name: string) => host(page).getByRole('button', { name, exact: true });
const style = (page: Page, key: string) => page.locator('#button-variant').evaluate((element, key) => getComputedStyle(element).getPropertyValue(key), key);

test('production manifest grants only temporary page access and scripting', async () => {
  const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions.toSorted()).toEqual(['activeTab', 'scripting']);
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.optional_host_permissions).toBeUndefined();
  expect(manifest.content_scripts).toBeUndefined();
  expect(manifest.web_accessible_resources).toBeUndefined();
  expect(manifest.action.default_popup).toBeUndefined();
  for (const path of Object.values(manifest.icons) as string[]) {
    expect((await readFile(join(extension, path))).subarray(1, 4).toString()).toBe('PNG');
  }
});

test('toolbar toggles inspection, blocks selection clicks and restores page interaction', async ({ extension: ext }) => {
  const { page } = ext;
  const button = page.locator('#button-baseline');
  await expect(host(page)).toHaveCount(0);
  await ext.trigger();
  await expect(host(page)).toHaveCount(1);
  await expect.poll(ext.badge).toBe('ON');
  await button.hover();
  await expect(host(page).locator('.outline-label-hover')).toContainText('button#button-baseline');
  const target = await button.boundingBox();
  const outline = await host(page).locator('.outline-hover').boundingBox();
  expect(outline).toEqual(target);
  await button.click();
  await expect(page.locator('#actions')).toHaveText('0 kit actions');
  await expect(host(page).getByRole('heading', { name: 'Inspector' })).toBeVisible();
  await expect(tool(page, 'Copy padding: 12px 16px')).toBeVisible();
  await expect(host(page).locator('.dock')).toHaveCSS('font-family', /Peekapix Barlow/);
  await expect(host(page).locator('.dock')).toHaveCSS('background-color', 'rgb(32, 39, 36)');
  await button.click();
  await expect(page.locator('#actions')).toHaveText('1 kit actions');
  const submit = page.locator('#submit-sample');
  await tool(page, 'Pick an element').click();
  await submit.click();
  await expect(page.locator('#form-actions')).toHaveText('0 submissions');
  await submit.click();
  await expect(page.locator('#form-actions')).toHaveText('1 submissions');
  await ext.trigger();
  await expect(host(page)).toHaveCount(0);
  await expect.poll(ext.badge).toBe('');
  await ext.trigger();
  await expect(host(page)).toHaveCount(1);
  await tool(page, 'Deactivate Peekapix').click();
  await expect(host(page)).toHaveCount(0);
  await expect.poll(ext.badge).toBe('');
  await button.click();
  await expect(page.locator('#actions')).toHaveText('2 kit actions');
});

test('comparison measures rendered gaps, copies CSS, previews explicitly selected properties and restores styles', async ({ extension: ext }, testInfo) => {
  const { page } = ext;
  const a = page.locator('#button-baseline');
  const b = page.locator('#button-variant');
  const original = await b.getAttribute('style');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await ext.trigger();
  await tool(page, 'Compare').click();
  await a.click();
  await expect(host(page).locator('.status-label')).toHaveText('Picking B');
  await b.click();
  const [left, right] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  const gap = Number((right!.x - left!.x - left!.width).toFixed(2)) + 'px';
  await expect(host(page).locator('.geometry-readout')).toContainText('Horizontal gap');
  await expect(host(page).locator('.geometry-readout strong')).toHaveText(gap);
  await expect(host(page).locator('.ruler-label')).toHaveText(gap);
  await page.screenshot({ path: testInfo.outputPath('comparison-light.png'), animations: 'disabled' });
  await expect(host(page).getByRole('rowheader', { name: 'Padding right' })).toHaveCount(0);
  await tool(page, 'All').click();
  await expect(host(page).getByRole('rowheader', { name: 'Padding right' })).toHaveCount(1);
  await tool(page, 'Differences').click();
  await tool(page, 'Copy A padding-top: 12px').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('12px');
  await tool(page, 'Copy differences').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('#button-variant {');
  const differences = await page.evaluate(() => navigator.clipboard.readText());
  expect(differences).toContain('#button-variant {');
  expect(differences).toContain('padding-top: 12px;');
  expect(differences).not.toContain('rendered-width');
  expect(await page.evaluate(css => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet.cssRules.length;
  }, differences)).toBe(1);

  const padding = host(page).getByRole('checkbox', { name: 'Select padding-top for preview' });
  await padding.check();
  await tool(page, 'Preview 1 property').click();
  await expect.poll(() => style(page, 'padding-top')).toBe('12px');
  expect(await style(page, 'padding-bottom')).toBe('8px');
  expect(await style(page, 'font-weight')).toBe('500');
  await tool(page, 'Copy preview patch').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('padding-top: 12px;');
  const patch = await page.evaluate(() => navigator.clipboard.readText());
  expect(patch).not.toContain('padding-bottom');

  await host(page).getByRole('checkbox', { name: 'Select font-weight for preview' }).check();
  await tool(page, 'Preview 1 property').click();
  await expect.poll(() => style(page, 'font-weight')).toBe('700');
  await tool(page, 'Undo last preview').click();
  await expect.poll(() => style(page, 'font-weight')).toBe('500');
  await expect.poll(() => style(page, 'padding-top')).toBe('12px');
  await tool(page, 'Reset').click();
  await expect.poll(() => style(page, 'padding-top')).toBe('8px');
  await expect(b).toHaveAttribute('style', original!);

  await padding.check();
  await tool(page, 'Preview 1 property').click();
  await b.evaluate(element => element.style.setProperty('outline-color', 'red'));
  await tool(page, 'Deactivate Peekapix').click();
  await expect.poll(() => style(page, 'padding-top')).toBe('8px');
  await expect.poll(() => style(page, 'outline-color')).toBe('rgb(255, 0, 0)');
  expect(await b.evaluate(element => element.style.getPropertyPriority('padding-top'))).toBe('important');
  await expect(page.locator('#actions')).toHaveText('0 kit actions');
});

test('compare can replace either reference, swap, reverse the preview, and recover removed selections', async ({ extension: ext }) => {
  const { page } = ext;
  const a = page.locator('#button-baseline');
  const b = page.locator('#button-variant');
  await ext.trigger();
  await tool(page, 'Compare').click();
  await a.click();
  await a.click();
  await expect(host(page).locator('.announcement')).toContainText('separate elements');
  await b.click();
  await tool(page, 'Swap A and B').click();
  await expect(host(page).locator('.reference-a')).toContainText('#button-variant');
  await tool(page, 'Replace A').click();
  await page.locator('.product h3').first().click();
  await expect(host(page).locator('.reference-a')).toContainText('h3');
  await tool(page, 'Replace B').click();
  await b.click();
  await host(page).getByLabel('Match direction').selectOption('a');
  await host(page).getByRole('checkbox', { name: 'Select font-size for preview' }).check();
  await tool(page, 'Preview 1 property').click();
  const title = page.locator('.product h3').first();
  await expect(title).toHaveCSS('font-size', '15px');
  await tool(page, 'Collapse panel').click();
  await tool(page, 'Expand panel').click();
  await expect(host(page).getByLabel('Match direction')).toHaveValue('a');
  await expect(host(page).locator('.preview-banner')).toContainText('Preview on A');
  await title.evaluate(element => element.remove());
  await expect(host(page).locator('.announcement')).toContainText('removed from the page');
  await expect(tool(page, 'Pick A')).toBeVisible();
});

test('responsive dark UI stays in bounds and inspection follows scroll, keyboard and open shadow roots', async ({ extension: ext }, testInfo) => {
  const { page } = ext;
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 750 });
  await ext.trigger();
  const button = page.locator('#button-baseline');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#actions')).toHaveText('0 kit actions');
  await expect(host(page).getByRole('heading', { name: 'Inspector' })).toBeVisible();
  const panel = await host(page).getByRole('region', { name: 'Inspector' }).boundingBox();
  expect(panel).not.toBeNull();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390);
  expect(panel!.y).toBeGreaterThanOrEqual(0);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(750);
  await expect(host(page).locator('.panel')).toHaveCSS('background-color', 'rgb(37, 46, 40)');
  await tool(page, 'Collapse panel').click();
  await page.evaluate(() => window.scrollBy(0, 150));
  await expect.poll(async () => (await host(page).locator('.outline-a').boundingBox())?.y)
    .toBe((await button.boundingBox())!.y);
  await tool(page, 'Hide measurements').click();
  await expect(host(page).locator('.outline-a')).toBeHidden();
  await tool(page, 'Pick an element').click();
  const shadow = page.getByRole('button', { name: 'Open shadow control' });
  await shadow.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await shadow.click();
  await expect(host(page).getByRole('heading', { name: 'Inspector' })).toBeVisible();
  await expect(tool(page, 'Copy selector #shadow-button')).toBeVisible();
  await expect(tool(page, 'Copy padding: 7px 11px')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('inspector-dark-narrow.png') });
});

test('cross-origin frame is selectable as a boundary and protected Chrome pages get an explanation', async ({ extension: ext }) => {
  const { page } = ext;
  const frame = page.locator('#embedded-frame');
  await frame.scrollIntoViewIfNeeded();
  await expect(frame.contentFrame().getByRole('button', { name: 'Embedded control' })).toBeVisible();
  expect(await frame.evaluate(node => node instanceof HTMLIFrameElement && node.contentDocument)).toBeNull();
  await ext.trigger();
  await expect.poll(ext.badge).toBe('ON');
  const bounds = (await frame.boundingBox())!;
  await page.mouse.move(bounds.x + 70, bounds.y + 26);
  await expect(host(page).locator('.outline-label-hover')).toContainText('iframe#embedded-frame');
  await page.mouse.click(bounds.x + 70, bounds.y + 26);
  await expect(host(page).getByRole('heading', { name: 'Inspector' })).toBeVisible();
  await expect(host(page).locator('.element-identity')).toContainText('embedded document');
  await page.goto('chrome://settings');
  await ext.trigger();
  await expect.poll(ext.badge).toBe('!');
  await expect.poll(ext.popup).toContain('unavailable.html?reason=restricted');
  const popup = await page.context().newPage();
  await popup.goto('chrome-extension://' + ext.extensionId + '/unavailable.html?reason=restricted');
  await expect(popup.getByRole('heading', { name: 'This page is protected' })).toBeVisible();
});

test('narrow comparison can be repositioned and reloading clears previews', async ({ extension: ext }, testInfo) => {
  const { page } = ext;
  await page.setViewportSize({ width: 350, height: 690 });
  await ext.trigger();
  await tool(page, 'Compare').click();
  await tool(page, 'Move Peekapix dock').click();
  await expect(host(page).locator('.toolkit')).toHaveAttribute('data-side', 'left');
  await tool(page, 'Collapse panel').click();
  await page.locator('#button-baseline').click();
  await tool(page, 'Collapse panel').click();
  await page.locator('#button-variant').click();
  await expect(host(page).getByRole('heading', { name: 'Compare elements' })).toBeVisible();
  const toolkit = (await host(page).locator('.toolkit').boundingBox())!;
  expect(toolkit.x).toBeGreaterThanOrEqual(0);
  expect(toolkit.x + toolkit.width).toBeLessThanOrEqual(350);
  expect(toolkit.y + toolkit.height).toBeLessThanOrEqual(690);
  await host(page).getByRole('checkbox', { name: 'Select padding-top for preview' }).check();
  await tool(page, 'Preview 1 property').click();
  await expect.poll(() => style(page, 'padding-top')).toBe('12px');
  await page.screenshot({ path: testInfo.outputPath('comparison-narrow.png'), animations: 'disabled' });
  await page.reload();
  await expect(host(page)).toHaveCount(0);
  await expect.poll(ext.badge).toBe('');
  await expect.poll(() => style(page, 'padding-top')).toBe('8px');
});

test('preview restores competing logical declarations and preserves a newer page edit', async ({ extension: ext }) => {
  const { page } = ext;
  const variant = page.locator('#button-variant');
  await variant.evaluate(element => {
    element.style.setProperty('padding-top', '8px', 'important');
    element.style.setProperty('padding-block-start', '8px', 'important');
  });
  const original = await variant.getAttribute('style');
  await ext.trigger();
  await tool(page, 'Compare').click();
  await page.locator('#button-baseline').click();
  await variant.click();
  const padding = host(page).getByRole('checkbox', { name: 'Select padding-top for preview' });
  await padding.check();
  await tool(page, 'Preview 1 property').click();
  await expect.poll(() => style(page, 'padding-top')).toBe('12px');
  await tool(page, 'Undo last preview').click();
  await expect.poll(() => style(page, 'padding-top')).toBe('8px');
  await expect(variant).toHaveAttribute('style', original!);
  await padding.check();
  await tool(page, 'Preview 1 property').click();
  await variant.evaluate(element => element.style.setProperty('padding-top', '10px', 'important'));
  await tool(page, 'Deactivate Peekapix').click();
  await expect.poll(() => style(page, 'padding-top')).toBe('10px');
});
