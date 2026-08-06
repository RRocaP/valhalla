// OW-B12 trilingual check: the board is entered in es and ca (no #autotest, so
// the shell resolves save.settings.lang for real) and every player-facing
// string on lock 12 is read back — plate, oath-board caption, the nine oath
// sentences, the carved tally, the actions and the help line.
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const SAVE = (lang) => JSON.stringify({
  opened: H.LOCK_IDS.slice(0, 11),
  attempts: {}, hints: {}, journal: [],
  settings: { muted: true, reducedMotion: null, lang },
  startedAt: '2026-08-07T00:00:00.000Z',
});

const browser = await H.launch();
const out = [];
for (const lang of ['es', 'ca']) {
  for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: SAVE(lang), hash: '' });
    await page.locator('.screen-threshold button').first().click();
    const wager = page.locator('.wager-continue');
    if (await wager.count()) await wager.click();
    await page.waitForSelector('.screen-lid', { timeout: 8000 });
    await page.locator('.medallion-hit').nth(11).click();
    await page.waitForSelector('.screen-lockroom', { timeout: 8000 });
    await H.answerDare(page);
    await page.waitForTimeout(600);
    const read = await page.evaluate(() => {
      const t = (s) => (document.querySelector(s)?.textContent || '').trim();
      return {
        title: t('.lock-title'),
        epigraph: t('.lock-epigraph'),
        plate: t('.ow12-platetext'),
        oathCap: t('.ow12-oathcap'),
        oath0: t('.ow12-boast'),
        tally: document.querySelector('.ow12-tallybox canvas').getAttribute('aria-label'),
        swear: [...document.querySelectorAll('button')].map((b) => b.textContent.trim())
          .filter((x) => x && x.length < 40).slice(-4),
        seatAria: document.querySelector('.ow12-seat').getAttribute('aria-label'),
        chipAria: document.querySelector('.ow12-chip').getAttribute('aria-label'),
        help: t('.ow12-help'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    await page.screenshot({ path: `artifacts/wip-b12/shots/locale-${lang}-${name}.png` });
    out.push({ lang, vp: name, ...read, errs: page.__errors.slice(0, 3) });
    await page.context().close();
  }
}
await browser.close();
writeFileSync('artifacts/wip-b12/shots/locale.json', JSON.stringify(out, null, 1));
let bad = 0;
for (const r of out) {
  const ascii = /^[\x20-\x7E]*$/;
  const localized = !/oaths hold|the boast|Seat the eight/.test(`${r.plate}${r.tally}${r.oath0}`);
  if (!localized) bad++;
  if (r.overflow > 1) bad++;
  console.log(`[${r.lang}/${r.vp}] overflow=${r.overflow} localized=${localized} errs=${r.errs.length}`);
  console.log(`   title="${r.title}" plate="${r.plate.slice(0, 62)}"`);
  console.log(`   oath0="${r.oath0.slice(0, 62)}" tally="${r.tally}"`);
  console.log(`   seat="${r.seatAria}" chip="${r.chipAria}"`);
}
console.log(bad === 0 ? 'LOCALE: GREEN' : `LOCALE: ${bad} failing`);
process.exit(bad === 0 ? 0 : 1);
