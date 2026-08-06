// OW-B09 capture rig — board 09 only, both viewports, dSF2.
// Usage: node artifacts/wip-b09/cap.mjs <tag> [reduced]
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'x';
const reduced = process.argv[3] === 'reduced';
mkdirSync('artifacts/wip-b09/shots', { recursive: true });

// wip-qplay's harness predates the wager framing card; cross locally instead
async function crossThreshold(page) {
  await page.locator('.screen-threshold .btn-carved').first().click();
  const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
  try {
    await wager.waitFor({ state: 'visible', timeout: 2500 });
    await wager.click();
  } catch { /* no wager card this run */ }
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const errs = [];
for (const vp of [H.DESKTOP, H.PHONE]) {
  const name = vp.width < 500 ? 'phone' : 'desktop';
  const page = await H.newPage(browser, vp, reduced ? { reducedMotion: 'reduce' } : {});
  await H.boot(page, { save: H.saveWithOpenedUpTo(9) });
  await crossThreshold(page);
  await H.enterLock(page, 9);
  await H.answerDare(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `artifacts/wip-b09/shots/${tag}-board-${name}.png` });
  // demo runs at mount; wait it out, then focus stone 2 and set a bearing so
  // the interactive states (blades + cord glint + needle) are on film too
  await page.waitForTimeout(2800);
  const { answer } = await page.evaluate(() => ({ answer: window.__OW.answerOf('09-sunstone') }));
  await page.locator(`button[aria-label^="take bearing ${answer.azimuth},"]`).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `artifacts/wip-b09/shots/${tag}-bearing-${name}.png` });
  await page.locator('.stone').nth(answer.wet).locator('.wet').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `artifacts/wip-b09/shots/${tag}-armed-${name}.png` });
  if (page.__errors.length) errs.push({ vp: name, errors: page.__errors });
  await page.context().close();
}
await browser.close();
if (errs.length) { console.error('PAGE ERRORS:', JSON.stringify(errs, null, 1)); process.exit(1); }
console.log('captured', tag);
