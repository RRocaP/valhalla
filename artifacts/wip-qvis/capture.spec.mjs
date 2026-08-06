// OW-QUALITY-VIS capture harness. Drives the REAL build through every moment
// docs/QUALITY.md names, at deviceScaleFactor 2, and writes numbered PNGs plus
// tight zoom crops for the 100%/200% carve + surface judgements.
//
// Every puzzle is driven through its real mounted UI via the QA-owned
// tests/e2e/helpers.mjs drivers (imported read-only). Save state is seeded via
// localStorage before boot purely to reach late-game moments quickly — the same
// frozen `oathwood.v1` schema the shell itself writes.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { drivers } from '../../tests/e2e/helpers.mjs';
import { BY_CH } from '../../src/kernel/futhark.js';

// Local override for lock 15: the shared helper indexes `.ow15-chip` by the
// shard's index in instance.shards, but the lock REMOVES a chip from the hasp
// once it is placed, so every index after the first placement is stale. Select
// by the chip's own aria-label instead. (Capture-only; tests/** is QA's lane.)
drivers['15-oathring'] = async function driveOathring(page, root, answer, instance) {
  for (let slot = 0; slot < answer.ring.length; slot++) {
    const rune = answer.ring[slot];
    const runeName = BY_CH[rune] ? BY_CH[rune].name : rune;
    await root.locator(`.ow15-chip[aria-label^="Shard ${runeName},"]`).first().click();
    await root.locator('.ow15-slot').nth(slot).click();
  }
  await root.getByRole('button', { name: 'Close the ring', exact: true }).click();
};

const CYCLE = process.env.QVIS_CYCLE || 'c1';
const OUT = `artifacts/wip-qvis/${CYCLE}`;
const LOCK_IDS = [
  '01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork',
  '06-jotunvillur', '07-tafl', '08-hacksilver', '09-sunstone', '10-drottkvaett',
  '11-skerry', '12-veitsla', '13-althing', '14-bindrune', '15-oathring',
];

function shotter(page, testInfo) {
  const tag = testInfo.project.name === 'iphone' ? 'm' : 'd';
  mkdirSync(OUT, { recursive: true });
  return async function shot(name, opts = {}) {
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, ...opts });
  };
}

async function seed(page, opened, extra = {}) {
  await page.addInitScript(([o, e]) => {
    localStorage.setItem('oathwood.v1', JSON.stringify({
      opened: o, attempts: {}, hints: {}, journal: [],
      settings: { muted: true, reducedMotion: null },
      startedAt: '2026-01-01T00:00:00.000Z',
      ...e,
    }));
  }, [opened, extra]);
}

async function boot(page) {
  await page.goto('/#autotest');
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect.poll(() => page.evaluate(() => !!window.__OW)).toBe(true);
  // portraits + treasure are async-decoded data URIs; wait for the real images
  await page.waitForTimeout(600);
}

async function enter(page) {
  const cont = page.getByRole('button', { name: /Lay hands on the chest|Continue/ });
  await cont.first().click();
}

async function openLock(page, ordinal) {
  const med = page.locator(`.medallion-hit[aria-label^="Lock ${ordinal}:"]`);
  await expect(med).toBeEnabled();
  await med.click();
  await expect(page.locator('.screen-lockroom')).toBeVisible();
}

async function solveCurrent(page, id, ordinal) {
  const root = page.locator('.lock-root');
  const { answer, instance } = await page.evaluate((lockId) => ({
    answer: window.__OW.answerOf(lockId), instance: window.__OW.instanceOf(lockId),
  }), id);
  await drivers[id](page, root, answer, instance);
}

// ---------------------------------------------------------------------------

test('threshold + lid + early lock + feedback', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await boot(page);
  await shot('01-threshold');
  await shot('01b-threshold-title-crop', { clip: await page.locator('.threshold-content').boundingBox() });

  await enter(page);
  await expect(page.locator('.screen-lid')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('02-lid-fresh');
  const lidBox = await page.locator('.screen-lid').boundingBox();
  await shot('02b-lid-wood-crop', {
    clip: { x: lidBox.x + 20, y: lidBox.y + 20, width: Math.min(340, lidBox.width - 40), height: 200 },
  });
  await shot('02c-lid-hasp-crop', { clip: await page.locator('.hasp-wrap').boundingBox() });

  await openLock(page, 1);
  await page.waitForTimeout(300);
  await shot('03-lockroom-01');
  await shot('03b-lockroom-header-crop', { clip: await page.locator('.lockroom-header').boundingBox() });

  // wrong answer: submit the untouched row
  await page.locator('.lock-root').getByRole('button', { name: 'Set the row', exact: true }).click();
  await page.waitForTimeout(220);
  await shot('04-wrong-answer');

  // arm the hints (3 wrong attempts total)
  for (let i = 0; i < 2; i++) {
    await page.locator('.lock-root').getByRole('button', { name: 'Set the row', exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page.locator('.hint-slot').first().click();
  await page.waitForTimeout(250);
  await shot('05-hint-taken');
});

test('shard ceremony', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  // Lock 02 (one radio + submit) reaches the ceremony in two clicks; lock 01's
  // 16-tile reorder is a long drive with nothing extra to show for it here.
  await seed(page, ['01-runerow']);
  await boot(page);
  await enter(page);
  await openLock(page, 2);
  await solveCurrent(page, '02-bismer', 2);
  await expect(page.locator('.ceremony-overlay')).toBeVisible();
  await page.waitForTimeout(220);
  await shot('06-shard-ceremony');
  await shot('06b-shard-rune-crop', { clip: await page.locator('.ceremony-overlay').boundingBox() });
});

test('mid lid + late lock + duel dare + yield', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await seed(page, LOCK_IDS.slice(0, 8));
  await boot(page);
  await enter(page);
  await expect(page.locator('.screen-lid')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('07-lid-mid');
  const b = await page.locator('.duel-banner').boundingBox();
  if (b) await shot('07b-duel-banner-crop', { clip: { x: b.x - 60, y: b.y - 20, width: b.width + 120, height: b.height + 90 } });

  await openLock(page, 9);
  await page.waitForTimeout(400);
  await shot('08-dare-card');
  await shot('08b-dare-portrait-crop', { clip: await page.locator('.dare-card canvas').boundingBox() });

  await page.locator('.dare-card').getByRole('button', { name: 'Answer the dare', exact: true }).click();
  await page.waitForTimeout(250);
  await shot('09-lockroom-09');

  await solveCurrent(page, '09-sunstone', 9);
  await expect(page.locator('.ceremony-overlay')).toBeVisible();
  await page.waitForTimeout(700); // mid-bow
  await shot('10-yield-beat');
  await shot('10b-yield-portrait-crop', { clip: await page.locator('.ceremony-overlay canvas').boundingBox() });
});

test('late puzzle presentation', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await seed(page, LOCK_IDS.slice(0, 12));
  await boot(page);
  await enter(page);
  await openLock(page, 13);
  await page.waitForTimeout(350);
  await shot('11-lockroom-13');
});

test('finale + credits', async ({ page }, testInfo) => {
  const shot = shotter(page, testInfo);
  await seed(page, LOCK_IDS.slice(0, 14));
  await boot(page);
  await enter(page);
  await expect(page.locator('.screen-lid')).toBeVisible();
  await page.waitForTimeout(400);
  await shot('12-lid-near-full');

  await openLock(page, 15);
  await page.waitForTimeout(400);
  await shot('13-dare-arya');
  await page.locator('.dare-card').getByRole('button', { name: 'Answer the dare', exact: true }).click();
  await page.waitForTimeout(250);
  await solveCurrent(page, '15-oathring', 15);

  await expect(page.locator('.ceremony-overlay')).toBeVisible();
  await page.waitForTimeout(750);
  await shot('14-arya-yield');
  await page.locator('.ceremony-overlay').click();

  await expect(page.locator('.screen-finale')).toBeVisible();
  await page.waitForTimeout(900);
  await shot('15-finale-intro-mid');
  await page.waitForTimeout(900);
  await shot('15b-finale-intro-late');

  await expect(page.locator('.finale-title')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(400);
  await shot('16-finale-tebi');
  await shot('16b-finale-tebi-crop', { clip: await page.locator('.finale-reveal canvas').boundingBox() });

  await page.locator('.finale-reveal').click();
  await page.waitForTimeout(400);
  await shot('17-finale-alano');

  await page.locator('.finale-reveal').click();
  await page.waitForTimeout(400);
  await shot('18-finale-tableau');

  await page.getByRole('button', { name: 'Raise the horns', exact: true }).click();
  await expect(page.locator('.screen-credits')).toBeVisible();
  await page.waitForTimeout(2600);
  await shot('19-credits-top');
  const sc = await page.locator('.credits-scroll').boundingBox();
  await shot('19b-credits-stickers-crop', { clip: { x: sc.x, y: sc.y, width: sc.width, height: Math.min(420, sc.height) } });

  await page.locator('.credits-scroll').evaluate((e) => { e.scrollTop = e.scrollHeight * 0.35; });
  await page.waitForTimeout(1400);
  await shot('20-credits-challengers');
  await page.locator('.credits-scroll').evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await page.waitForTimeout(1600);
  await shot('21-credits-ramon');
});
