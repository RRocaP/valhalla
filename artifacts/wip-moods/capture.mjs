// OW-MOODS capture: the SAME lock-room angle across all five gauntlets
// (locks 2, 5, 8, 11, 14 — the middle lock of each gauntlet, so no dare card
// is in the way), both viewports, deviceScaleFactor 2.
// Usage: node artifacts/wip-moods/capture.mjs <tag>
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
const LOCKS = [2, 5, 8, 11, 14];
mkdirSync('artifacts/wip-moods/shots', { recursive: true });

// Local threshold crossing: as of 2026-08-06 22:22 the shell gates the begin
// gesture behind the wager framing card (docs/JARLS.md "The wager"), which the
// shared harness's crossThreshold does not yet dismiss.
async function cross(page) {
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-card .wager-continue');
  if (await wager.count() && await wager.isVisible()) await wager.click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  for (const ord of LOCKS) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await cross(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(1400);
    const path = `artifacts/wip-moods/shots/${tag}-g${Math.ceil(ord / 3)}-l${ord}-${name}.png`;
    await page.screenshot({ path });
    const m = await page.evaluate(() => {
      const scr = document.querySelector('.screen-lockroom');
      const mood = scr.querySelector('.lockroom-mood');
      let ink = -1;
      if (mood) {
        ink = 0;
        const d = mood.getContext('2d').getImageData(0, 0, mood.width, mood.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      }
      return {
        hasMood: !!mood,
        moodInk: ink,
        moodCover: mood ? +(ink / (mood.width * mood.height)).toFixed(3) : 0,
        moodName: scr.getAttribute('data-mood') || '',
        tintVar: getComputedStyle(scr).getPropertyValue('--mood-tint').trim(),
      };
    });
    out.push({ vp: name, ord, path, ...m, errs: page.__errors.slice() });
    await page.context().close();
  }
}
await browser.close();
writeFileSync(`artifacts/wip-moods/shots/${tag}-capture.json`, JSON.stringify(out, null, 1));
for (const r of out) {
  console.log(`${r.vp.padEnd(5)} lock ${String(r.ord).padStart(2)}  mood=${String(r.moodName).padEnd(9)} cover=${r.moodCover} tint=${r.tintVar} errs=${r.errs.length}`);
  if (r.errs.length) console.log('   ', r.errs.slice(0, 2));
}
