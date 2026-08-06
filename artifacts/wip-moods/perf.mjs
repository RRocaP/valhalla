// OW-MOODS gates, both numeric:
//  1. PERF — applyMood() cost per frame at 1280x800 (dSF2), all five moods,
//     measured in the real browser on the real mood layer.
//  2. CONTRAST — the worst text-over-mood case, sampled from the ACTUAL
//     composite the player sees (room wood + mood overlay under the text box),
//     not from the wood canvas alone. Floors: 4.5:1 body, 3:1 display.
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const LOCKS = [2, 5, 8, 11, 14];

async function cross(page) {
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-card .wager-continue');
  if (await wager.count() && await wager.isVisible()) await wager.click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const ink = [];

// --- 1. per-frame cost of the real applyMood(), 1280x800, dSF2 -------------
const perfPage = await H.newPage(browser, H.DESKTOP);
await perfPage.goto('http://127.0.0.1:8791/artifacts/wip-moods/perf.html', { waitUntil: 'load' });
await perfPage.waitForFunction(() => window.__moodReady === true, null, { timeout: 10000 });
const perfRun = await perfPage.evaluate(() => window.__moodPerf(400));
const perf = perfRun.out;
await perfPage.context().close();

for (const ord of LOCKS) {
  const page = await H.newPage(browser, H.DESKTOP);
  await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
  await cross(page);
  await H.enterLock(page, ord);
  await H.answerDare(page);
  await page.waitForTimeout(900);

  // --- 2. real composite contrast under every text style in the room -------
  const c = await page.evaluate(() => {
    const scr = document.querySelector('.screen-lockroom');
    const wood = scr.querySelector('.lockroom-canvas');
    const moodC = scr.querySelector('.lockroom-mood');
    const lum = ({ r, g, b }) => {
      const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const parse = (s) => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const q = m[1].split(',').map(parseFloat);
      return { r: q[0], g: q[1], b: q[2] };
    };
    // composite wood + mood exactly as the browser stacks them, then read the
    // mean colour inside each text element's box
    const mk = (withMood) => {
      const off = document.createElement('canvas');
      off.width = wood.width; off.height = wood.height;
      const c2 = off.getContext('2d');
      c2.drawImage(wood, 0, 0);
      if (withMood) c2.drawImage(moodC, 0, 0, off.width, off.height);
      return { off, c2 };
    };
    const withM = mk(true);
    const bare = mk(false);
    const off = withM.off;
    const oc = withM.c2;
    const wr = wood.getBoundingClientRect();
    const sx = off.width / wr.width;
    const sy = off.height / wr.height;
    const sample = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      // Sample the INKED text box, not the block box: a block-level heading is
      // as wide as the frame, so a light shaft crossing its empty margin would
      // otherwise be reported as the background "behind" the glyphs.
      let r = el.getBoundingClientRect();
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rr = range.getBoundingClientRect();
        if (rr.width > 4 && rr.height > 4) r = rr;
      } catch { /* keep the block box */ }
      if (r.width < 4 || r.height < 4) return null;
      const bx = Math.max(0, Math.round((r.left - wr.left) * sx));
      const by = Math.max(0, Math.round((r.top - wr.top) * sy));
      const bw = Math.max(1, Math.min(off.width - bx, Math.round(r.width * sx)));
      const bh = Math.max(1, Math.min(off.height - by, Math.round(r.height * sy)));
      const read = (c2) => {
        const d = c2.getImageData(bx, by, bw, bh).data;
        let R = 0, G = 0, B = 0, n = 0, peak = 0;
        for (let i = 0; i < d.length; i += 4) {
          R += d[i]; G += d[i + 1]; B += d[i + 2]; n++;
          const l = lum({ r: d[i], g: d[i + 1], b: d[i + 2] });
          if (l > peak) peak = l;
        }
        return { mean: lum({ r: R / n, g: G / n, b: B / n }), peak };
      };
      const m = read(oc);
      const b0 = read(bare.c2);
      const fg = parse(getComputedStyle(el).color);
      const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return {
        sel,
        mean: +ratio(lum(fg), m.mean).toFixed(2),
        woodOnly: +ratio(lum(fg), b0.mean).toFixed(2),
        worstPixel: +ratio(lum(fg), m.peak).toFixed(2),
        worstPixelWoodOnly: +ratio(lum(fg), b0.peak).toFixed(2),
      };
    };
    return ['.lock-epigraph', '.lock-title', '.ledger-numeral', '.near-line', '.hint-text']
      .map(sample).filter(Boolean);
  });

  ink.push({ ord, gauntlet: Math.ceil(ord / 3), text: c });
  await page.context().close();
}
await browser.close();

writeFileSync('artifacts/wip-moods/perf.json', JSON.stringify({ dpr: perfRun.dpr, perf, ink }, null, 1));
console.log(`--- applyMood cost, 1280x800 @dpr${perfRun.dpr} (mean of 400 frames) ---`);
for (const r of perf) {
  console.log(`  G${r.g}  ${r.ms.toFixed(3)} ms/frame  (clear-only baseline ${r.clearMs.toFixed(3)} ms)`);
}
console.log('--- text over mood, real wood+mood composite (floor 4.5 body / 3 display) ---');
let worst = Infinity;
for (const r of ink) {
  for (const t of r.text) {
    worst = Math.min(worst, t.mean);
    console.log(`  G${r.gauntlet} ${t.sel.padEnd(16)} wood-only ${String(t.woodOnly).padStart(6)}:1 -> with mood ${String(t.mean).padStart(6)}:1   (worst pixel: wood ${String(t.worstPixelWoodOnly).padStart(5)}:1 -> ${String(t.worstPixel).padStart(5)}:1)`);
  }
}
console.log(`WORST MEAN CONTRAST OVER ANY MOOD: ${worst.toFixed(2)}:1`);
