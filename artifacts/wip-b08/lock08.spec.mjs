// OW-B08 lane gate: the shared journey spec is sequential and currently stops
// at lock 01 (`.ow1-tile`, another lane, mid-flight), so it never reaches this
// board. This drives lock 08 alone with the SAME driver, helpers and contracts
// the journey uses — real input events, no shortcuts — at both projects, and
// also checks the wrong-answer path and the keyboard path.
// Run: npx playwright test artifacts/wip-b08/lock08.spec.mjs
import { test, expect } from '@playwright/test';
import {
  gotoAutotest, openLockFromLid,
  resolveCeremony, drivers, owAnswerAndInstance, assertTouchTargets,
} from '../../tests/e2e/helpers.mjs';

const ID = '08-hacksilver';

// The shared beginFromThreshold expects the first-run gesture; a seeded save
// shows 'Continue' instead. Same two steps, either label.
async function begin(page) {
  await page.locator('.screen-threshold button').first().click();
  const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
  try {
    await wager.waitFor({ state: 'visible', timeout: 2500 });
    await wager.click();
  } catch { /* no wager card this run */ }
  await expect(page.locator('.screen-lid')).toBeVisible();
}

async function enter(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/\/(music|credits)\.mp3(\?|$)/.test(url)) return;
    errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e}`));
  await gotoAutotest(page);
  // same save shape the shared capture harness writes (artifacts/wip-qplay)
  await page.evaluate(() => {
    localStorage.setItem('oathwood.v1', JSON.stringify({
      opened: ['01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork',
        '06-jotunvillur', '07-tafl'],
      attempts: {}, hints: {}, journal: [],
      settings: { muted: true, reducedMotion: null },
      startedAt: new Date().toISOString(),
    }));
  });
  // a second goto to the same #hash is a same-document nav, so the seeded save
  // is only picked up by a real reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoAutotest(page);
  await begin(page);
  await openLockFromLid(page, 8);
  // lock 8 opens no dare card (docs/JARLS.md dares are 1,4,7,10,13); tolerate either
  const dare = page.locator('.dare-card');
  if (await dare.count()) await dare.getByRole('button', { name: 'Answer the dare', exact: true }).click();
  return errors;
}

test('08 — the driver contract opens the lock with real input', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await enter(page);
  const root = page.locator('.lock-root');

  // the board's own comprehension plate, in the language the shell forces
  await expect(root).toContainText(
    'Three weighings are sworn. One piece is false — name it, and say if it weighs heavy or light.');
  await expect(root.locator('[role="radio"]')).toHaveCount(12);
  await expect(root.getByRole('button', { name: 'heavy — salted', exact: true })).toHaveCount(1);
  await expect(root.getByRole('button', { name: 'light — clipped', exact: true })).toHaveCount(1);

  const { answer } = await owAnswerAndInstance(page, ID);

  // a wrong naming first: the beam must answer, and must not open
  const wrong = { piece: (answer.piece + 1) % 12, heavier: answer.heavier };
  await drivers[ID](page, root, wrong);
  await expect(root.locator('.ow8-tell')).not.toHaveText('');
  await expect(page.locator('.screen-lockroom')).toBeVisible();

  // then the true naming
  await drivers[ID](page, root, answer);
  await resolveCeremony(page, { ordinal: 8 });
  const opened = await page.evaluate(() => window.__OW.save.opened);
  expect(opened).toContain(ID);
  expect(errors).toEqual([]);
});

test('08 — the cross-reference glint and the staging are real', async ({ page }) => {
  test.setTimeout(120_000);
  await enter(page);
  const root = page.locator('.lock-root');
  await page.waitForTimeout(3400); // let the showing finish

  await root.locator('[role="radio"]').nth(3).click();
  const read = await root.locator('.ow8-read').textContent();
  expect(read).toMatch(/first:.*second:.*third:/);
  await expect(root.locator('.ow-hacksilver .btn-carved')).toBeDisabled();

  await root.getByRole('button', { name: 'light — clipped', exact: true }).click();
  await expect(root.locator('.ow8-stage')).toContainText('You will swear:');
  await expect(root.locator('.ow-hacksilver .btn-carved')).toBeEnabled();

  await assertTouchTargets(page, '.lock-root', 44);
});

test('08 — the board is fully keyboard-drivable', async ({ page }) => {
  test.setTimeout(120_000);
  await enter(page);
  const root = page.locator('.lock-root');
  await page.waitForTimeout(3400);

  await root.locator('[role="radio"]').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(root.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
  await page.keyboard.press('h');
  await expect(root.getByRole('button', { name: 'heavy — salted', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator('.ow-hacksilver .btn-carved')).toBeEnabled();
});
