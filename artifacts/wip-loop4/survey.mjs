// OW-LOOP4 survey rig — full sequential journey with dSF2 captures + metrics.
// Standalone (not a test): node artifacts/wip-loop4/survey.mjs [desktop|phone]
// Reuses the frozen e2e drivers so every lock is driven through real input.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { drivers, DARE_ORDER, DUEL_ORDER } from '../../tests/e2e/helpers.mjs';

const MODE = process.argv[2] || 'desktop';
const VP = MODE === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const DIR = `artifacts/wip-loop4/survey/${MODE === 'phone' ? 'm' : 'd'}`;
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const url = (m.location() && m.location().url) || '';
  if (/\/(music|credits|act\d+)\.mp3(\?|$)/.test(url)) return;
  if (/favicon\.ico/.test(url)) return; // known 404, logged separately
  errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e}`));

let n = 0;
const shot = async (desc, opts = {}) => {
  n += 1;
  const path = `${DIR}/${String(n).padStart(2, '0')}-${desc}.png`;
  if (opts.element) await page.locator(opts.element).screenshot({ path });
  else await page.screenshot({ path });
  return path;
};
const settle = (ms) => page.waitForTimeout(ms);
const scrollBodyTo = (y) => page.evaluate((v) => { document.body.scrollTop = v; document.documentElement.scrollTop = v; }, y);

const metrics = [];

await page.goto('http://127.0.0.1:8791/index.html#autotest');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__OW);
await settle(1200);
await shot('threshold');

await page.getByRole('button', { name: 'Lay hands on the chest', exact: true }).click();
const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
try { await wager.waitFor({ state: 'visible', timeout: 2500 }); await settle(600); await shot('wager'); await wager.click(); } catch {}
await page.locator('.screen-lid').waitFor();
await settle(1400);
await shot('lid-fresh');

const locks = await page.evaluate(() => window.__OW.locks.map((l) => ({ id: l.id, ordinal: l.ordinal, title: l.title, hints: l.hints })));

for (const lock of locks) {
  const { ordinal, id } = lock;
  const tag = String(ordinal).padStart(2, '0');
  const isDare = DARE_ORDER.includes(ordinal);
  const isYield = DUEL_ORDER.includes(ordinal);

  if (isYield) { await settle(500); await shot(`lid-duelbanner-${tag}`); }

  await page.locator(`.medallion-hit[aria-label^="Lock ${ordinal}:"]`).click();
  await page.locator('.screen-lockroom').waitFor();

  if (isDare) {
    await page.locator('.dare-card').waitFor();
    await settle(1900);
    await shot(`dare-${tag}`);
    await page.locator('.dare-card').getByRole('button', { name: 'Answer the dare', exact: true }).click();
  }

  await page.locator('.lock-root').waitFor();
  await settle(1300);
  await shot(`board-${tag}-entrytruth`);
  const m = await page.evaluate(() => {
    const app = document.getElementById('app');
    const subs = [...document.querySelectorAll('.lock-root button')].filter((b) => b.offsetParent);
    const sub = subs.length ? subs[subs.length - 1] : null;
    return {
      appH: Math.round(app.getBoundingClientRect().height),
      entryScroll: Math.round(document.body.scrollTop || document.documentElement.scrollTop),
      submitClass: sub ? sub.className : null,
      submitText: sub ? sub.textContent.trim() : null,
    };
  });
  metrics.push({ ordinal, id, vp: MODE, ...m });
  await scrollBodyTo(0);
  await settle(350);
  await shot(`board-${tag}-top`);
  await shot(`board-${tag}-full`, { element: '#app' });

  const { answer, instance } = await page.evaluate((lockId) => ({ answer: window.__OW.answerOf(lockId), instance: window.__OW.instanceOf(lockId) }), id);
  const root = page.locator('.lock-root');

  if (id === '02-bismer') {
    const wrongIdx = (answer.pouch + 1) % instance.pouches.length;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await root.locator('[role="radio"].ow2-pouch').nth(wrongIdx).click();
      await root.getByRole('button', { name: 'Name the pouch', exact: true }).click();
      if (attempt === 1) { await settle(120); await shot('deny-02-midshudder'); await settle(900); await shot('deny-02-settled'); }
    }
    await settle(400);
    await page.locator('.hint-slot').first().click();
    await settle(700);
    await shot('hint-open-02');
  }
  if (id === '09-sunstone' && MODE === 'desktop') {
    // one deliberate wrong swear late in the run: deny/heckle in a later act.
    // sunstone picks are absolute (radio-like), so the real driver recovers cleanly.
    const wrongAz = (answer.azimuth + 90) % 360;
    const wrongBtn = root.locator(`button[aria-label^="take bearing ${wrongAz},"]`);
    if (await wrongBtn.count()) {
      await wrongBtn.first().click();
      await root.locator('.stone').nth((answer.wet + 1) % 3).locator('.wet').click();
      await root.getByRole('button', { name: 'Swear the bearing', exact: true }).click();
      await settle(150); await shot('deny-09-midshudder'); await settle(900); await shot('deny-09-settled');
    }
  }

  await drivers[id](page, root, answer, instance);

  // ceremony beats
  const duel = isYield;
  const overlay = page.locator('.ceremony-overlay');
  if (duel) {
    await overlay.waitFor();
    await settle(900);
    await shot(`yield-${tag}`);
    await page.keyboard.press('Enter');
  }
  if (ordinal === 15) {
    await page.locator('.screen-finale').waitFor();
  } else {
    await overlay.waitFor();
    await settle(650);
    await shot(`shard-${tag}`);
    await page.keyboard.press('Enter');
    await page.locator('.screen-lid').waitFor();
    if (isYield || ordinal === 1) { await settle(1100); await shot(`lid-after-${tag}`); }
  }
}

// finale
await settle(1500);
await shot('finale-intro');
if (await page.locator('.skip-hint').count()) await page.locator('.screen-finale').click();
await page.locator('.finale-title').waitFor();
await settle(900);
await shot('finale-tebi');
await page.locator('.finale-reveal').click();
await settle(1200);
await shot('finale-alano');
await page.locator('.finale-reveal').click();
await page.locator('.finale-tableau').waitFor();
await settle(900);
await shot('finale-tableau');
await page.getByRole('button', { name: 'Raise the horns', exact: true }).click();
await page.locator('.screen-credits').waitFor();
await settle(1500);
await shot('credits-top');
await page.locator('.credits-scroll').evaluate((el) => el.scrollBy(0, 600));
await settle(700);
await shot('credits-scrolled');

writeFileSync(`${DIR}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(`done ${MODE}: ${n} shots, errors=${errors.length}`);
for (const e of errors) console.log(e);
await browser.close();
process.exit(errors.length ? 2 : 0);
