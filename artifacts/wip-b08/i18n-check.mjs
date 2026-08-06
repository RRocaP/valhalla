// OW-B08: proof the board speaks es and ca, not just that the block exists.
// #autotest forces en (docs/CONTRACT.md §4.1), so this boots without it and
// seeds save.settings.lang, then reads the real rendered board text.
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const browser = await H.launch();
const out = {};
for (const lang of ['en', 'es', 'ca']) {
  const page = await H.newPage(browser, H.DESKTOP);
  await page.goto(H.URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((l) => {
    localStorage.setItem('oathwood.v1', JSON.stringify({
      opened: ['01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork',
        '06-jotunvillur', '07-tafl'],
      attempts: {}, hints: {}, journal: [],
      settings: { muted: true, reducedMotion: null, lang: l },
      startedAt: new Date().toISOString(),
    }));
  }, lang);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.screen');
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count()) { await wager.first().waitFor({ state: 'visible' }); await wager.first().click(); }
  await page.waitForSelector('.screen-lid');
  await H.enterLock(page, 8);
  await H.answerDare(page);
  await page.waitForTimeout(3600);
  await page.locator('.lock-root [role="radio"]').nth(2).click();
  await page.locator('.lock-root .ow8-scale').first().click();
  await page.waitForTimeout(250);
  out[lang] = await page.evaluate(() => {
    const q = (s) => (document.querySelector(s) || {}).textContent || '';
    return {
      title: q('.lock-title'),
      epigraph: q('.lock-epigraph').slice(0, 60),
      plate: q('.ow-hacksilver .visually-hidden'),
      caption: [...document.querySelectorAll('.ow8-beam canvas')].length + ' beam canvases',
      reading: q('.ow8-read'),
      staging: q('.ow8-stage'),
      pans: [...document.querySelectorAll('.ow8-scale')].map((b) => b.textContent.trim()),
      swear: q('.ow-hacksilver .btn-carved'),
      aria: (document.querySelector('.lock-root [role="radio"]') || {}).getAttribute
        ? document.querySelector('.lock-root [role="radio"]').getAttribute('aria-label') : '',
    };
  });
  await page.context().close();
}
await browser.close();
writeFileSync('artifacts/wip-b08/shots/i18n.json', JSON.stringify(out, null, 1));
for (const [l, v] of Object.entries(out)) {
  console.log(`--- ${l} ---`);
  console.log(' title  :', v.title);
  console.log(' plate  :', v.plate);
  console.log(' reading:', v.reading);
  console.log(' staging:', v.staging);
  console.log(' pans   :', JSON.stringify(v.pans), '| swear:', v.swear);
  console.log(' aria   :', v.aria);
}
