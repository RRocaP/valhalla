// Measured text contrast for board 14 (docs/ART.md shipping gate: >= 4.5:1 for
// body text over its REAL background). The background is not a CSS colour here
// — it is painted wood — so each run is measured by hiding the text, shooting
// the exact box it occupied, averaging those pixels, and comparing that to the
// element's computed colour.
import * as H from '../wip-qplay/harness.mjs';

async function crossThreshold(page) {
  const btn = page.locator('.screen-threshold button').first();
  await btn.waitFor({ timeout: 8000 });
  await btn.click();
  const wager = page.locator('.wager-continue');
  if (await wager.count() && await wager.isVisible().catch(() => false)) await wager.click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const lum = ([r, g, b]) => {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const l1 = lum(a); const l2 = lum(b); const hi = Math.max(l1, l2); const lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

const SELECTORS = ['.ow14-plate', '.ow14-count', '.ow14-tag', '.ow14-cols p', 'p[aria-live="polite"]'];
const browser = await H.launch();
const rows = [];
for (const [vpName, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(14) });
  await crossThreshold(page);
  await H.enterLock(page, 14);
  await page.waitForTimeout(3800);
  for (const sel of SELECTORS) {
    const info = await page.evaluate((s) => {
      const el = document.querySelector(`.lock-root ${s}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const m = getComputedStyle(el).color.match(/[\d.]+/g).map(Number);
      return { fg: [m[0], m[1], m[2]], box: { x: r.x, y: r.y, width: r.width, height: r.height }, text: (el.textContent || '').trim().slice(0, 26) };
    }, sel);
    if (!info) continue;
    await page.evaluate((s) => { document.querySelector(`.lock-root ${s}`).style.visibility = 'hidden'; }, sel);
    const buf = await page.screenshot({ clip: info.box });
    await page.evaluate((s) => { document.querySelector(`.lock-root ${s}`).style.visibility = ''; }, sel);
    // average the clip's pixels straight from the PNG via the browser itself
    const bg = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let r = 0; let gg = 0; let bb = 0; let n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; }
      return [r / n, gg / n, bb / n];
    }, buf.toString('base64'));
    rows.push({ vp: vpName, sel, text: info.text, ratio: +ratio(info.fg, bg).toFixed(2) });
  }
  await page.context().close();
}
await browser.close();
let bad = 0;
for (const r of rows) {
  const ok = r.ratio >= 4.5;
  if (!ok) bad++;
  console.log(`${r.vp.padEnd(6)} ${r.sel.padEnd(22)} ${String(r.ratio).padStart(6)}:1  ${ok ? 'PASS' : 'FAIL'}  "${r.text}"`);
}
console.log(bad === 0 ? 'CONTRAST FLOOR (lock 14, >=4.5:1): GREEN' : `CONTRAST FLOOR: ${bad} run(s) under 4.5:1`);
process.exit(bad === 0 ? 0 : 1);
