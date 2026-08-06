// deterministic gate: the DOM name must sit inside the carved plaque band the
// canvas draws (seat logical y 92..114 of 120; chip logical y 100..128 of 136)
import * as H from '../wip-qplay/harness.mjs';
const b = await H.launch();
let bad = 0;
for (const vp of [H.DESKTOP, H.PHONE]) {
  const page = await H.newPage(b, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(12) });
  await page.locator('.screen-threshold button').first().click();
  const w = page.locator('.wager-continue'); if (await w.count()) await w.click();
  await page.waitForSelector('.screen-lid'); await H.enterLock(page, 12); await H.answerDare(page);
  const truth = await page.evaluate(() => window.__OW.answerOf('12-veitsla'));
  await page.locator('.ow12-chip').getByText(truth.benches[0][0], { exact: true }).click();
  await page.locator('.ow12-seat').nth(0).click();
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const band = (el, lo, hi, total) => {
      const box = el.getBoundingClientRect();
      const rng = document.createRange();
      const tn = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (!tn) return null;
      rng.selectNodeContents(tn);
      const t = rng.getBoundingClientRect();
      const mid = (t.top + t.bottom) / 2 - box.top;
      return { mid: +(mid / box.height).toFixed(3), lo: lo / total, hi: hi / total,
               inside: mid / box.height > lo / total && mid / box.height < hi / total,
               fits: t.width <= box.width * 0.92 };
    };
    return {
      seat: band(document.querySelector('.ow12-seat'), 92, 114, 120),
      chip: band(document.querySelector('.ow12-chip'), 100, 128, 136),
    };
  });
  for (const k of ['seat', 'chip']) if (!r[k] || !r[k].inside || !r[k].fits) bad++;
  console.log(vp.width, JSON.stringify(r));
  await page.context().close();
}
await b.close();
console.log(bad === 0 ? 'PLAQUE ALIGNMENT: GREEN' : `PLAQUE ALIGNMENT: ${bad} failing`);
process.exit(bad === 0 ? 0 : 1);
