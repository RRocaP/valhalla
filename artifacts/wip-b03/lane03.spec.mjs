// OW-B03 lane gate: lock 03 driven end to end through the SHARED e2e driver
// (tests/e2e/helpers.mjs '03-beacons'), on both framings. This proves the
// selector contract the journey depends on — canvas[role="slider"],
// aria-valuenow, Home/PageUp/ArrowUp/ArrowRight, "Set the dial" — without
// waiting on the whole fifteen-lock traversal.
//   npx playwright test artifacts/wip-b03/lane03.spec.mjs --config artifacts/wip-b03/lane.config.mjs
import { test, expect } from '@playwright/test';
import { gotoAutotest, openLockFromLid, drivers, owAnswerAndInstance } from '../../tests/e2e/helpers.mjs';

const LOCK_IDS = [
  '01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork',
  '06-jotunvillur', '07-tafl', '08-hacksilver', '09-sunstone', '10-drottkvaett',
  '11-skerry', '12-veitsla', '13-althing', '14-bindrune', '15-oathring',
];

test('lock 03 solves by real input, no console errors', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.addInitScript((s) => {
    try { localStorage.setItem('oathwood.v1', s); } catch (e) { /* no storage */ }
  }, JSON.stringify({
    opened: LOCK_IDS.slice(0, 2), attempts: {}, hints: {}, journal: [],
    settings: { muted: true, reducedMotion: null }, startedAt: new Date().toISOString(),
  }));
  await gotoAutotest(page);

  await page.locator('.threshold-actions button').first().click();
  const wager = page.locator('.wager-card .wager-continue');
  if (await wager.count()) await wager.click({ timeout: 4000 }).catch(() => {});
  await expect(page.locator('.screen-lid')).toBeVisible();

  await openLockFromLid(page, 3);
  const dare = page.locator('.dare-card');
  if (await dare.count()) {
    await dare.getByRole('button', { name: 'Answer the dare', exact: true }).click();
    await expect(dare).toBeHidden();
  }

  const root = page.locator('.lock-root');
  // the plain plate is on the board, not only in the journal
  await expect(root).toContainText('Turn the dial to the next night all three fires burn together.');
  // both painted surfaces are labelled for the screen reader
  await expect(root.locator('canvas[role="img"]')).toHaveAttribute('aria-label', /every \d+ nights/);

  const { answer, instance } = await owAnswerAndInstance(page, '03-beacons');
  await drivers['03-beacons'](page, root, answer, instance);
  await expect(page.locator('.ceremony-overlay')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.screen-lid')).toBeVisible();

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
