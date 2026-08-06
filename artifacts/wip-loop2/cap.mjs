// OW-LOOP2 capture rig. Usage:
//   node artifacts/wip-loop2/cap.mjs <tag> [boards|ceremony|finale|all] [desktop|phone|both]
// Screenshots land in artifacts/wip-loop2/shots/<tag>-<name>-<vp>.png at dSF2.
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';
import { BY_CH } from '../../src/kernel/futhark.js';

const tag = process.argv[2] || 'x';
const what = process.argv[3] || 'boards';
const vpArg = process.argv[4] || 'desktop';
mkdirSync('artifacts/wip-loop2/shots', { recursive: true });

const vps = vpArg === 'both' ? [H.DESKTOP, H.PHONE] : vpArg === 'phone' ? [H.PHONE] : [H.DESKTOP];
const vpName = (vp) => (vp.width < 500 ? 'phone' : 'desktop');
const shoot = (page, name, vp) => page.screenshot({ path: `artifacts/wip-loop2/shots/${tag}-${name}-${vpName(vp)}.png` });

const browser = await H.launch();
const errs = [];

async function boards(vp, ords) {
  for (const ord of ords) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(600);
    await shoot(page, `lock${String(ord).padStart(2, '0')}`, vp);
    if (page.__errors.length) errs.push({ ord, vp: vpName(vp), errors: page.__errors });
    await page.context().close();
  }
}

// drive lock 09 (duel) to a real solve: yield beat + shard ceremony
async function ceremony(vp) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(9) });
  await H.crossThreshold(page);
  await H.enterLock(page, 9);
  await H.answerDare(page);
  const { answer } = await page.evaluate(() => ({ answer: window.__OW.answerOf('09-sunstone') }));
  await page.locator(`button[aria-label^="take bearing ${answer.azimuth},"]`).first().click();
  await page.locator('.stone').nth(answer.wet).locator('.wet').click();
  await page.getByRole('button', { name: 'Swear the bearing', exact: true }).click();
  await page.waitForSelector('.ceremony-overlay', { timeout: 5000 });
  await page.waitForTimeout(500);
  await shoot(page, 'yield', vp);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  if (await page.locator('.ceremony-overlay').count()) await shoot(page, 'ceremony', vp);
  if (page.__errors.length) errs.push({ stage: 'ceremony', vp: vpName(vp), errors: page.__errors });
  await page.context().close();
}

// drive lock 15 to the finale, then credits
async function finale(vp) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(15) });
  await H.crossThreshold(page);
  await H.enterLock(page, 15);
  await H.answerDare(page);
  const { answer } = await page.evaluate(() => ({ answer: window.__OW.answerOf('15-oathring') }));
  for (let slot = 0; slot < answer.ring.length; slot++) {
    const rune = answer.ring[slot];
    const name = BY_CH[rune] ? BY_CH[rune].name : rune;
    await page.locator(`.ow15-chip[aria-label^="Shard ${name},"]`).click();
    await page.locator('.ow15-slot').nth(slot).click();
  }
  await page.getByRole('button', { name: 'Close the ring', exact: true }).click();
  await page.waitForSelector('.ceremony-overlay', { timeout: 5000 });
  await page.waitForTimeout(400);
  await shoot(page, 'yield15', vp);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.screen-finale', { timeout: 8000 });
  await page.waitForTimeout(900);
  await shoot(page, 'finale-lid', vp);
  if (await page.locator('.skip-hint').count()) { await page.locator('.screen-finale').click(); }
  await page.waitForSelector('.finale-title', { timeout: 8000 });
  await page.waitForTimeout(400);
  await shoot(page, 'finale-tebi', vp);
  await page.locator('.finale-reveal').click();
  await page.waitForTimeout(300);
  await shoot(page, 'finale-alano', vp);
  await page.locator('.finale-reveal').click();
  await page.waitForTimeout(300);
  await shoot(page, 'finale-tableau', vp);
  await page.getByRole('button', { name: 'Raise the horns', exact: true }).click();
  await page.waitForSelector('.screen-credits', { timeout: 8000 });
  await page.waitForTimeout(2500);
  await shoot(page, 'credits', vp);
  if (page.__errors.length) errs.push({ stage: 'finale', vp: vpName(vp), errors: page.__errors });
  await page.context().close();
}

for (const vp of vps) {
  if (what === 'boards' || what === 'all') await boards(vp, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  if (what === 'boards6' ) await boards(vp, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  if (/^b[\d,]+$/.test(what)) await boards(vp, what.slice(1).split(',').map(Number));
  if (what === 'ceremony' || what === 'all') await ceremony(vp);
  if (what === 'finale' || what === 'all') await finale(vp);
}

await browser.close();
if (errs.length) { console.error('PAGE ERRORS:', JSON.stringify(errs, null, 1)); process.exit(1); }
console.log('captured:', tag, what, vpArg);
