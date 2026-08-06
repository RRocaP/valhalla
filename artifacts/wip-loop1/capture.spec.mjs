// OW-LOOP1 captures: every LIGHT & TYPE judged moment, both viewports, dSF2.
// Versioned by LOOP1_CYCLE (v0 = before, v1.. = iterations).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { drivers } from '../../tests/e2e/helpers.mjs';

const CYCLE = process.env.LOOP1_CYCLE || 'v0';
const OUT = new URL(`./${CYCLE}/`, import.meta.url).pathname;
const LOCK_IDS = [
  '01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork',
  '06-jotunvillur', '07-tafl', '08-hacksilver', '09-sunstone', '10-drottkvaett',
  '11-skerry', '12-veitsla', '13-althing', '14-bindrune', '15-oathring',
];

function shotter(page, testInfo) {
  const tag = testInfo.project.name === 'iphone' ? 'm' : 'd';
  mkdirSync(OUT, { recursive: true });
  return async function shot(name, opts = {}) {
    await page.screenshot({ path: `${OUT}${name}-${tag}.png`, ...opts });
  };
}

async function seed(page, openedCount) {
  await page.addInitScript((o) => {
    localStorage.setItem('oathwood.v1', JSON.stringify({
      opened: o, attempts: {}, hints: {}, journal: [],
      settings: { muted: true, reducedMotion: null },
      startedAt: '2026-01-01T00:00:00.000Z',
    }));
  }, LOCK_IDS.slice(0, openedCount));
}

async function boot(page) {
  await page.goto('/#autotest');
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect.poll(() => page.evaluate(() => !!window.__OW)).toBe(true);
  await page.waitForTimeout(600); // async-decoded portraits
}

async function enter(page) {
  await page.getByRole('button', { name: /Lay hands on the chest|Continue/ }).first().click();
}

test('threshold + fresh lid + lock room + type chrome', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await boot(page);
  await shot('01-threshold');
  const tc = await page.locator('.threshold-content').boundingBox();
  if (tc) await shot('01b-threshold-title-crop', { clip: { x: tc.x, y: tc.y, width: tc.width, height: Math.min(tc.height, 360) } });

  await enter(page);
  await expect(page.locator('.screen-lid')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('02-lid-fresh');

  // journal drawer (ink-on-vellum axis) + settings
  await page.getByRole('button', { name: 'Open the journal' }).click();
  await page.waitForTimeout(400);
  await shot('03-journal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.waitForTimeout(400);
  await shot('03b-settings');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // lock room 1 (header, ledger numeral, footer chrome)
  const med = page.locator('.medallion-hit[aria-label^="Lock 1:"]');
  await expect(med).toBeEnabled();
  await med.click();
  await expect(page.locator('.screen-lockroom')).toBeVisible();
  await page.waitForTimeout(350);
  await shot('04-lockroom');
  const hd = await page.locator('.lockroom-header').boundingBox();
  if (hd) await shot('04b-lockroom-header-crop', { clip: hd });

  // shard ceremony: real solve through the mounted UI
  const root = page.locator('.lock-root');
  const { answer, instance } = await page.evaluate(() => ({
    answer: window.__OW.answerOf('01-runerow'), instance: window.__OW.instanceOf('01-runerow'),
  }));
  await drivers['01-runerow'](page, root, answer, instance);
  await expect(page.locator('.ceremony-overlay')).toBeVisible();
  await shot('05-ceremony');
});

test('lid early + duel dare + banner', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await seed(page, 2); // lock 3 armed -> JARL BOURJ banner + dare
  await boot(page);
  await enter(page);
  await expect(page.locator('.screen-lid')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('06-lid-early-banner');
  const banner = await page.locator('.duel-banner').boundingBox();
  if (banner) {
    await shot('06b-banner-crop', {
      clip: { x: Math.max(0, banner.x - 40), y: Math.max(0, banner.y - 30), width: banner.width + 80, height: banner.height + 120 },
    });
  }
  const med = page.locator('.medallion-hit[aria-label^="Lock 3:"]');
  await expect(med).toBeEnabled();
  await med.click();
  await expect(page.locator('.dare-card')).toBeVisible();
  await page.waitForTimeout(1400); // entrance beat settles
  await shot('07-dare');
  const card = await page.locator('.dare-card').boundingBox();
  if (card) await shot('07b-dare-crop', { clip: card });
});

test('lid late + medallion states crop', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await seed(page, 14); // 14 open, Aerya banner on 15
  await boot(page);
  await enter(page);
  await expect(page.locator('.screen-lid')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('08-lid-late');
  // states crop: around medallions 13(open),15(next) — includes hasp
  const m13 = await page.locator('.medallion-hit[aria-label^="Lock 13:"]').boundingBox();
  const m15 = await page.locator('.medallion-hit[aria-label^="Lock 15:"]').boundingBox();
  if (m13 && m15) {
    const x = Math.min(m13.x, m15.x) - 30;
    const y = Math.min(m13.y, m15.y) - 60;
    await shot('08b-medallions-late-crop', {
      clip: { x: Math.max(0, x), y: Math.max(0, y), width: Math.min(600, page.viewportSize().width - x), height: 260 },
    });
  }
});

test('lid mid states', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await seed(page, 5); // open/next/sealed all visible in quantity
  await boot(page);
  await enter(page);
  await expect(page.locator('.screen-lid')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('09-lid-mid');
  const m5 = await page.locator('.medallion-hit[aria-label^="Lock 5:"]').boundingBox();
  const m7 = await page.locator('.medallion-hit[aria-label^="Lock 7:"]').boundingBox();
  if (m5 && m7) {
    const x = Math.max(0, Math.min(m5.x, m7.x) - 40);
    const y = Math.max(0, Math.min(m5.y, m7.y) - 40);
    await shot('09b-medallion-states-crop', {
      clip: { x, y, width: Math.min(640, page.viewportSize().width - x), height: 240 },
    });
  }
});

test('finale + credits', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await seed(page, 15);
  await boot(page);
  await enter(page);
  await expect(page.locator('.screen-finale')).toBeVisible();
  await page.waitForTimeout(1100);
  await shot('10-finale-intro-mid');
  // let intro finish (2.6s) or reveal already on screen
  await expect(page.locator('.finale-title')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);
  await shot('11-finale-tebi');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await shot('12-finale-alano');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await shot('13-finale-tableau');
  await page.getByRole('button', { name: 'Raise the horns', exact: true }).click();
  await page.waitForTimeout(1600);
  await shot('14-credits-top');
  await page.locator('.credits-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(900);
  await shot('15-credits-end');
});
