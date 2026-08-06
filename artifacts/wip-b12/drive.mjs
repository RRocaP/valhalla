// OW-B12 state capture: the showing mid-flight, a partly-seated hall (so the
// oath-board's warm/smoulder/cold states are all on screen at once), and the
// full hall with a boast accused (the mead-stain brand). Both viewports, dSF2.
// Usage: node artifacts/wip-b12/drive.mjs <tag>
import { mkdirSync, writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
mkdirSync('artifacts/wip-b12/shots', { recursive: true });

async function enter(browser, vp) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(12) });
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count()) await wager.click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 12);
  await H.answerDare(page);
  return page;
}

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  // 1. the showing, caught after the ghost lands and the plaques answer
  let page = await enter(browser, vp);
  await page.waitForTimeout(2000);
  // read the state BEFORE the screenshot: a dSF2 full-page shot costs ~1s and
  // would otherwise sample the board after the showing has run out
  const showing = await page.evaluate(() => ({
    states: [...document.querySelectorAll('.ow12-boast')].map((b) => b.dataset.state),
    tally: document.querySelector('.ow12-tallybox canvas').getAttribute('aria-label'),
    ghost: !!document.querySelector('.ow12-ghost') && document.querySelector('.ow12-ghost').style.display !== 'none',
  }));
  await page.screenshot({ path: `artifacts/wip-b12/shots/${tag}-showing-${name}.png` });
  await page.context().close();

  // 2. seven men seated: warm, smouldering and cold plaques together
  page = await enter(browser, vp);
  const truth = await page.evaluate(() => window.__OW.answerOf('12-veitsla'));
  const seat = async (b, i) => {
    await page.locator('.ow12-chip').getByText(truth.benches[b][i], { exact: true }).click();
    await page.locator('.ow12-seat').nth(b * 4 + i).click();
  };
  for (let b = 0; b < 2; b++) for (let i = 0; i < 4; i++) if (!(b === 1 && i === 3)) await seat(b, i);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `artifacts/wip-b12/shots/${tag}-partial-${name}.png` });
  const partial = await page.evaluate(() => ({
    states: [...document.querySelectorAll('.ow12-boast')].map((b) => b.dataset.state),
    tally: document.querySelector('.ow12-tallybox canvas').getAttribute('aria-label'),
  }));

  // 3. the whole hall, the boast accused, the brand on the plaque
  await seat(1, 3);
  await page.locator('.ow12-boast').nth(truth.boast).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `artifacts/wip-b12/shots/${tag}-accused-${name}.png` });
  const accused = await page.evaluate(() => ({
    states: [...document.querySelectorAll('.ow12-boast')].map((b) => b.dataset.state),
    pressed: [...document.querySelectorAll('.ow12-boast')].map((b) => b.getAttribute('aria-pressed')),
    tally: document.querySelector('.ow12-tallybox canvas').getAttribute('aria-label'),
    swearOn: !document.querySelector('.btn-carved[disabled]'),
  }));

  // 4. and it solves through the real controls
  await page.getByRole('button', { name: 'Swear the seating', exact: true }).click();
  await page.waitForTimeout(900);
  const solved = await page.evaluate(() => !!window.__OW.save.opened.includes('12-veitsla'));
  await page.screenshot({ path: `artifacts/wip-b12/shots/${tag}-solved-${name}.png` });
  out.push({ vp: name, boast: truth.boast, showing, partial, accused, solved, errs: page.__errors.slice(0, 4) });
  await page.context().close();
}
await browser.close();
writeFileSync(`artifacts/wip-b12/shots/${tag}-states.json`, JSON.stringify(out, null, 1));
for (const r of out) {
  console.log(`${r.vp}: showing=${JSON.stringify(r.showing.states)} ghost=${r.showing.ghost} "${r.showing.tally}"`);
  console.log(`   partial=${JSON.stringify(r.partial.states)} "${r.partial.tally}"`);
  console.log(`   accused=${JSON.stringify(r.accused.states)} pressed@${r.boast}=${r.accused.pressed[r.boast]} swearOn=${r.accused.swearOn} "${r.accused.tally}"`);
  console.log(`   solved=${r.solved} errs=${r.errs.length}`);
}
