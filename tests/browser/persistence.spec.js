import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { emptyProgress } from '../../src/storage.js';
import { makeChallengeLink } from '../../src/challenges.js';
import { STORIES } from '../../src/stories.js';

const errors = new WeakMap();
test.beforeEach(async ({ context }) => {
  errors.set(context, []);
  context.on('page', page => page.on('pageerror', error => errors.get(context).push(error.message)));
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});
test.afterEach(async ({ context }) => { expect(errors.get(context)).toEqual([]); });

async function seedLegacy(page) {
  const progress = emptyProgress();
  Object.assign(progress.settings, { mode: 'custom', customText: 'a cat', guide: false });
  const raw = JSON.stringify(progress);
  await page.addInitScript(raw => {
    if (localStorage.getItem('typedo:v1') === null) localStorage.setItem('typedo:v1', raw);
  }, raw);
  return raw;
}

async function saved(page, key = 'typedo:v1') {
  return page.evaluate(key => new Promise((resolve, reject) => {
    const open = indexedDB.open('typedo', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('records');
      const request = transaction.objectStore('records').get(key);
      transaction.oncomplete = () => { database.close(); resolve(request.result ? JSON.parse(request.result) : null); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }), key);
}

const settled = page => expect(page.locator('.sidebar-local')).toHaveText('Saved in this browser');
const openProgress = page => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Progress', exact: true }).click();
async function openTyping(page) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Type', exact: true }).click();
  return page.getByRole('textbox', { name: 'Typing input', exact: true });
}

test('new visitors get three choices and an introductory story resumes from Home', async ({ page }, testInfo) => {
  await page.goto('/'); await settled(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What would you like to do?');
  await expect(page.locator('.home-choice-grid button')).toHaveCount(3);
  await expect(page.locator('.home-plan-grid')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Not sure? Find a starting point' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('start-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('start-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Practise with a story', exact: true }).click();
  await expect(page.locator('.story-reader')).toBeVisible();
  await expect(page.locator('.story-reader textarea')).toBeFocused();
  await page.locator('.story-reader textarea').pressSequentially(STORIES[0].chapters[0].text.slice(0, 6));
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Start', exact: true }).click();
  await settled(page);
  await expect(page.locator('.home-continue')).toContainText(STORIES[0].title);
  await expect(page.locator('.home-more')).not.toHaveAttribute('open');
  await page.screenshot({ path: testInfo.outputPath('returning-mobile.png'), fullPage: true });
  await page.reload(); await settled(page);
  await page.locator('.home-continue .primary-button').click();
  await expect(page.locator('.story-reader')).toBeVisible();
  expect((await saved(page)).storyDrafts[STORIES[0].id].typed).toBe(STORIES[0].chapters[0].text.slice(0, 6));
});

test('direct Type preference survives reload without hijacking shared challenges', async ({ page }) => {
  await page.goto('/'); await settled(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Open directly to Type next time' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await settled(page);
  await page.reload(); await settled(page);
  await expect(page.getByRole('textbox', { name: 'Typing input', exact: true })).toBeFocused();
  await expect(page.locator('.status-dot.running')).toHaveCount(0);
  const link = makeChallengeLink({ title: 'A shared starting point', text: 'Hello there.' }, 'http://127.0.0.1:5189/');
  await page.goto('about:blank');
  await page.goto(link); await settled(page);
  await expect(page.getByRole('heading', { name: 'Shared passage: A shared starting point' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.start-page')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Open directly to Type next time' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await settled(page);
  await page.goto('/'); await settled(page);
  await expect(page.locator('.start-page')).toBeVisible();
});

test('all fifteen stories are discoverable and a new chapter keeps its draft', async ({ page }) => {
  await page.goto('/'); await settled(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Stories/ }).click();
  await expect(page.locator('.story-book')).toHaveCount(15);
  await page.getByRole('searchbox', { name: 'Search stories' }).fill('blue envelope');
  await expect(page.locator('.story-book')).toHaveCount(1);
  await page.locator('.story-book button').click();
  const story = STORIES.find(item => item.id === 'recipe-envelope');
  await page.locator('.story-reader textarea').pressSequentially(story.chapters[0].text.slice(0, 8));
  await page.locator('.story-reader textarea').press('Escape');
  await settled(page);
  await page.reload(); await settled(page);
  await expect(page.locator('.home-continue')).toContainText(story.title);
  expect((await saved(page)).storyDrafts[story.id].typed).toBe(story.chapters[0].text.slice(0, 8));
});

test('result feedback, private PNG card, heatmap and exact-key retry work', async ({ page }, testInfo) => {
  await seedLegacy(page);
  await page.goto('/'); await settled(page);
  const input = await openTyping(page);
  await input.pressSequentially('x', { delay: 30 });
  await input.press('Backspace');
  await input.pressSequentially('a cat', { delay: 30 });
  await expect(page.getByRole('region', { name: 'Result feedback' })).toContainText('1 missed / 3 attempts');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download result card', exact: true }).click();
  const download = await pending;
  const card = testInfo.outputPath('result.png'); await download.saveAs(card);
  const png = await readFile(card);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1200); expect(png.readUInt32BE(20)).toBe(720);
  await page.screenshot({ path: testInfo.outputPath('results.png'), fullPage: true });
  await page.getByRole('button', { name: 'Practise these mistakes', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Typing input', exact: true })).toBeFocused();
  await expect(page.locator('.words-text')).toContainText('Try a once.');
  await openProgress(page);
  const heatmap = page.getByRole('region', { name: 'Keyboard accuracy heatmap' });
  await expect(heatmap.getByLabel('a: 66.7% accuracy, 1 missed in 3 attempts. Not enough practice yet', { exact: true })).toBeVisible();
  await heatmap.getByRole('button', { name: 'Shifted keys' }).click();
  await expect(heatmap.getByLabel('Capital A: Not enough practice yet: 0 attempts', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('heatmap-mobile.png'), fullPage: true });
});

test('reset offers cancellation and backup, survives reload, and backup restores results', async ({ page }, testInfo) => {
  await seedLegacy(page); await page.goto('/'); await settled(page);
  await (await openTyping(page)).pressSequentially('a cat', { delay: 20 });
  await settled(page); const original = await saved(page);
  await openProgress(page);
  await page.getByRole('button', { name: 'Reset progress...', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: "Reset this profile's progress?" });
  await expect(dialog.getByRole('button', { name: 'Keep my progress' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep my progress' }).click();
  expect((await saved(page)).history).toHaveLength(1);
  await page.getByRole('button', { name: 'Reset progress...', exact: true }).click();
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download backup first' }).click();
  const backupPath = testInfo.outputPath('backup.json'); await (await pending).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.history).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Yes, reset my progress' }).click();
  await settled(page);
  await expect.poll(async () => (await saved(page)).history.length).toBe(0);
  await page.reload(); await settled(page);
  const reset = await saved(page);
  expect(reset.history).toEqual([]); expect(reset.keyStats).toEqual({});
  expect(reset.settings).toEqual(original.settings);
  await page.locator('input[aria-label="Restore a Typedo backup"]').setInputFiles(backupPath);
  await settled(page);
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
});

test('reset transaction failure preserves results and allows a safe retry', async ({ page }) => {
  await seedLegacy(page); await page.goto('/'); await settled(page);
  await (await openTyping(page)).pressSequentially('a cat', { delay: 20 });
  await settled(page); await openProgress(page);
  await page.getByRole('button', { name: 'Reset progress...', exact: true }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'records' && args[1] === 'typedo:v1') {
        IDBObjectStore.prototype.put = original;
        request.addEventListener('success', () => this.transaction.abort());
      }
      return request;
    };
  });
  const dialog = page.getByRole('dialog', { name: "Reset this profile's progress?" });
  await dialog.getByRole('button', { name: 'Yes, reset my progress' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Progress was not reset');
  expect((await saved(page)).history).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Yes, reset my progress' }).click();
  await settled(page);
  await expect.poll(async () => (await saved(page)).history.length).toBe(0);
});

test('reset leaves another profile intact and a stale tab cannot bring back cleared progress', async ({ page, context }) => {
  await seedLegacy(page);
  const other = emptyProgress(); other.settings.theme = 'light';
  await page.addInitScript(raw => localStorage.setItem('typedo:profile:other:v1', raw), JSON.stringify(other));
  await page.goto('/'); await settled(page);
  await (await openTyping(page)).pressSequentially('a cat', { delay: 20 });
  await settled(page);
  const stale = await context.newPage(); await stale.goto('/'); await settled(stale);
  // Loading a legacy-shaped history can normalize its stored representation.
  // Refresh the resetter so this exercise starts from the current saved version.
  await page.reload(); await settled(page);
  const otherBefore = await saved(page, 'typedo:profile:other:v1');
  await openProgress(page);
  await page.getByRole('button', { name: 'Reset progress...', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, reset my progress', exact: true }).click();
  await settled(page);
  expect((await saved(page)).history).toEqual([]);
  expect(await saved(page, 'typedo:profile:other:v1')).toEqual(otherBefore);
  await stale.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await expect(stale.locator('.storage-warning')).toContainText('Another tab changed this profile');
  expect((await saved(page)).history).toEqual([]);
});

test('legacy migration, pause, reload and completion preserve the exact attempt', async ({ page }) => {
  const legacy = await seedLegacy(page);
  await page.goto('/');
  await settled(page);
  const input = await openTyping(page);
  await input.pressSequentially('a ');
  await input.press('Escape');
  await settled(page);
  await expect.poll(async () => Object.values((await saved(page)).workspaceDrafts)[0]?.typed).toBe('a ');
  const draft = Object.values((await saved(page)).workspaceDrafts)[0];
  await page.reload();
  await settled(page);
  await page.locator('.home-continue button').click();
  await page.getByRole('dialog', { name: 'Practice paused' }).getByRole('button', { name: 'Resume typing', exact: true }).click();
  await page.getByRole('textbox', { name: 'Typing input', exact: true }).pressSequentially('cat');
  await settled(page);
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
  expect((await saved(page)).history[0].id).toBe(draft.id);
  expect((await saved(page)).workspaceDrafts).toEqual({});
  await page.reload();
  await settled(page);
  expect((await saved(page)).history).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('typedo:v1'))).toBe(legacy);
});

test('two real tabs preserve newer results and export conflicting work before a confirmed reload', async ({ page, context }, testInfo) => {
  await seedLegacy(page);
  await page.goto('/');
  await settled(page);
  const second = await context.newPage();
  await second.goto('/');
  await settled(second);
  await (await openTyping(page)).pressSequentially('a cat');
  await settled(page);
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
  const input = await openTyping(second);
  await input.pressSequentially('a');
  await expect(second.locator('.storage-warning')).toContainText('Another tab changed this profile');
  await input.press('Escape');
  await second.getByRole('button', { name: 'Finish for now', exact: true }).click();
  const original = await saved(page);
  expect(original.history).toHaveLength(1);
  expect(original.workspaceDrafts).toEqual({});
  const download = second.waitForEvent('download');
  await second.getByRole('button', { name: 'Export this tab', exact: true }).click();
  const backup = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(Object.values(backup.workspaceDrafts)[0].typed).toBe('a');
  expect(await saved(second)).toEqual(original);
  await second.setViewportSize({ width: 390, height: 844 });
  await second.screenshot({ path: testInfo.outputPath('conflict-mobile.png'), fullPage: false });
  await second.getByRole('button', { name: 'Load saved progress', exact: true }).click();
  await second.getByRole('button', { name: 'Keep working here', exact: true }).click();
  await expect(second.locator('.storage-warning')).toContainText('Another tab changed');
  await second.getByRole('button', { name: 'Load saved progress', exact: true }).click();
  await second.getByRole('button', { name: 'Load saved version', exact: true }).click();
  await settled(second);
  await expect(second.locator('.storage-warning')).toHaveCount(0);
  expect((await saved(second)).history).toHaveLength(1);
  // Restore the exported work through the existing backup merger, then complete
  // it. Both tabs' results must survive under distinct run IDs.
  await second.locator('input[type="file"]').setInputFiles({ name: 'conflicting-tab.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await settled(second);
  await second.locator('.home-continue button').click();
  await second.getByRole('dialog', { name: 'Practice paused' }).getByRole('button', { name: 'Resume typing', exact: true }).click();
  await second.getByRole('textbox', { name: 'Typing input', exact: true }).pressSequentially(' cat');
  await expect.poll(async () => (await saved(second)).history.length).toBe(2);
});

test('a transaction abort keeps work in memory and Retry saving commits it', async ({ page }) => {
  await page.goto('/');
  await settled(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'records' && args[1] === 'typedo:v1') {
        IDBObjectStore.prototype.put = original;
        request.addEventListener('success', () => this.transaction.abort());
      }
      return request;
    };
  });
  await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saving', exact: true })).toBeVisible();
  expect((await saved(page)).settings.theme).toBe('dark');
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await settled(page);
  expect((await saved(page)).settings.theme).toBe('light');
  await expect(page.locator('.storage-warning')).toHaveCount(0);
});

test('tabs using separate profiles save independently and keep their current profile', async ({ page, context }) => {
  await page.goto('/');
  await settled(page);
  await page.getByRole('button', { name: 'Manage local profiles', exact: true }).click();
  await page.getByLabel('New profile name', { exact: true }).fill('Alex');
  await page.getByRole('button', { name: 'Create and switch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Manage local profiles', exact: true })).toContainText('Alex');
  await settled(page);
  const metadata = await saved(page, 'typedo:profiles:v1');
  const second = await context.newPage();
  await second.goto('/');
  await settled(second);
  await page.getByRole('button', { name: 'Manage local profiles', exact: true }).click();
  await page.locator('.profile-list button').filter({ hasText: 'Original profile' }).click();
  await expect(page.getByRole('button', { name: 'Manage local profiles', exact: true })).toContainText('Original profile');
  await settled(page);
  await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await settled(page);
  await second.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await settled(second);
  await expect(second.getByRole('button', { name: 'Manage local profiles', exact: true })).toContainText('Alex');
  expect((await saved(page)).settings.theme).toBe('light');
  expect((await saved(second, `typedo:profile:${metadata.activeId}:v1`)).settings.theme).toBe('light');
  await expect(second.locator('.storage-warning')).toHaveCount(0);
});
