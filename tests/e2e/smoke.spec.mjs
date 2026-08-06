import { test, expect } from '@playwright/test';

test('page boots clean and offline-capable', async ({ page, context }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/#autotest');
  await expect(page).toHaveTitle(/OATHWOOD/);
  await expect(page.locator('#app')).not.toBeEmpty();
  // no network after load (single-file contract)
  await context.setOffline(true);
  await page.reload().catch(() => {});
  await context.setOffline(false);
  await page.goto('/#autotest');
  await expect(page.locator('#app')).not.toBeEmpty();
  expect(errors, errors.join('\n')).toHaveLength(0);
  await page.screenshot({ path: 'artifacts/screens/smoke.png' });
});
