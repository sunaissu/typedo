import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`startup stays centered before scripts and while storage opens at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let releaseScript;
    const scriptGate = new Promise(resolve => { releaseScript = resolve; });
    await page.route('**/assets/*.js', async route => { await scriptGate; await route.continue(); });
    await page.addInitScript(() => {
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (...args) {
        const request = open.apply(this, args);
        let released = false;
        request.addEventListener('success', event => {
          if (released) return;
          event.stopImmediatePropagation();
          window.releaseStartupStorage = () => {
            released = true;
            request.dispatchEvent(new Event('success'));
          };
        });
        return request;
      };
    });
    const assertCentered = async () => {
      await expect(page.locator('.loading-content')).toBeVisible();
      const box = await page.locator('.loading-content').boundingBox();
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
      expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    };
    try {
      await page.goto('/', { waitUntil: 'commit' });
      await expect(page.getByRole('status')).toHaveText('Your practice space is opening.');
      await assertCentered();
      releaseScript();
      await expect(page.getByRole('status')).toHaveText('Loading your profiles…');
      await page.waitForFunction(() => typeof window.releaseStartupStorage === 'function');
      await assertCentered();
      await page.evaluate(() => window.releaseStartupStorage());
      await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible();
      await expect(page.locator('.storage-loading')).toHaveCount(0);
    } finally { releaseScript(); }
  });
}
