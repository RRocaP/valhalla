// OW-CHAPTERS evidence run: real-input drive of the wager card + gauntlet
// banners, dSF2 captures at both first-class framings, density-rubric
// measurement (docs/QUALITY.md), and a contrast spot-check on the wager text.
// Run: node scripts/serve.mjs &  then  node artifacts/wip-chapters/capture.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:8791/#autotest';
const OUT = 'artifacts/wip-chapters';
mkdirSync(OUT, { recursive: true });

// Composite every canvas of the current screen (DOM order) and measure:
// - detail%: cells holding intentional strong-edge detail
// - largest contiguous featureless region as % of the panel
// (DOM text/buttons are not composited, so real occupancy is >= reported.)
async function densityOf(page) {
  return page.evaluate(() => {
    const screen = document.querySelector('.screen');
    const canvases = Array.from(screen.querySelectorAll('canvas'))
      .filter((c) => c.width > 4 && c.height > 4 && c.offsetParent !== null);
    const rect = screen.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    const comp = document.createElement('canvas');
    comp.width = W; comp.height = H;
    const ctx = comp.getContext('2d', { willReadFrequently: true });
    for (const c of canvases) {
      const r = c.getBoundingClientRect();
      ctx.drawImage(c, r.left - rect.left, r.top - rect.top, r.width, r.height);
    }
    const img = ctx.getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      lum[i] = 0.2126 * img[i * 4] + 0.7152 * img[i * 4 + 1] + 0.0722 * img[i * 4 + 2];
    }
    const CELL = 16;
    const cw = Math.floor(W / CELL), ch = Math.floor(H / CELL);
    // docs/QUALITY.md dead-zone law: quiet incidental carving at LOW contrast
    // (1.5-2.5:1) COUNTS as detail; only bare, structureless mid-field fails.
    // A cell is featureless when it has (a) almost no low-threshold edges,
    // (b) low internal variance, and (c) sits near the global field level.
    const means = new Float32Array(cw * ch);
    const stds = new Float32Array(cw * ch);
    const edgeFrac = new Float32Array(cw * ch);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        let s = 0, s2 = 0, strong = 0, total = 0;
        for (let y = cy * CELL + 1; y < (cy + 1) * CELL - 1; y++) {
          for (let x = cx * CELL + 1; x < (cx + 1) * CELL - 1; x++) {
            const i = y * W + x;
            const v = lum[i];
            s += v; s2 += v * v;
            const gx = lum[i + 1] - lum[i - 1];
            const gy = lum[i + W] - lum[i - W];
            if (Math.sqrt(gx * gx + gy * gy) > 9) strong++;
            total++;
          }
        }
        const m = s / total;
        means[cy * cw + cx] = m;
        stds[cy * cw + cx] = Math.sqrt(Math.max(0, s2 / total - m * m));
        edgeFrac[cy * cw + cx] = strong / total;
      }
    }
    const sortedMeans = Array.from(means).sort((a, b) => a - b);
    const globalMedian = sortedMeans[sortedMeans.length >> 1];
    const featureless = [];
    for (let k = 0; k < cw * ch; k++) {
      featureless[k] = edgeFrac[k] < 0.015 && stds[k] < 5 && Math.abs(means[k] - globalMedian) < 11;
    }
    // flood fill featureless regions (4-connected)
    const seen = new Uint8Array(cw * ch);
    let largest = 0;
    for (let s = 0; s < cw * ch; s++) {
      if (!featureless[s] || seen[s]) continue;
      let area = 0;
      const stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const k = stack.pop();
        area++;
        const x = k % cw, y = (k / cw) | 0;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const nk = ny * cw + nx;
          if (featureless[nk] && !seen[nk]) { seen[nk] = 1; stack.push(nk); }
        }
      }
      largest = Math.max(largest, area);
    }
    const detailCells = featureless.filter((f) => !f).length;
    return {
      detailPct: Math.round((detailCells / (cw * ch)) * 1000) / 10,
      largestFeaturelessPct: Math.round((largest / (cw * ch)) * 1000) / 10,
    };
  });
}

// avg-canvas-under-text contrast approximation (same method as
// tests/e2e/helpers.mjs sampleContrastRatio, scoped to a given canvas).
async function contrastOn(page, textSel, canvasSel) {
  return page.evaluate(({ textSel, canvasSel }) => {
    const elT = document.querySelector(textSel);
    const canvas = document.querySelector(canvasSel);
    if (!elT || !canvas) return null;
    const tr = elT.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const sx = canvas.width / cr.width, sy = canvas.height / cr.height;
    const bx = Math.max(0, Math.round((tr.left - cr.left) * sx));
    const by = Math.max(0, Math.round((tr.top - cr.top) * sy));
    const bw = Math.max(1, Math.min(canvas.width - bx, Math.round(tr.width * sx)));
    const bh = Math.max(1, Math.min(canvas.height - by, Math.round(tr.height * sy)));
    const d = ctx.getImageData(bx, by, bw, bh).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    const bg = { r: r / n, g: g / n, b: b / n };
    const m = getComputedStyle(elT).color.match(/rgba?\(([^)]+)\)/);
    const [fr, fg2, fb] = m[1].split(',').map((s) => parseFloat(s));
    const lum = ({ r, g, b }) => {
      const c = (v) => { const q = v / 255; return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
    };
    const L1 = Math.max(lum({ r: fr, g: fg2, b: fb }), lum(bg));
    const L2 = Math.min(lum({ r: fr, g: fg2, b: fb }), lum(bg));
    return Math.round(((L1 + 0.05) / (L2 + 0.05)) * 100) / 100;
  }, { textSel, canvasSel });
}

async function drive(name, ctxOpts) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2, ...ctxOpts });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/\/(music|credits|act2|act3)\.mp3(\?|$)/.test(url)) return;
    errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e}`));

  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__OW === 'object');
  await page.waitForTimeout(600);
  const out = { name };

  out.threshold = await densityOf(page);
  await page.screenshot({ path: `${OUT}/${name}-01-threshold.png` });

  // begin gesture -> wager card (real input)
  await page.getByRole('button', { name: 'Lay hands on the chest', exact: true }).click();
  await page.locator('.wager-card').waitFor({ state: 'visible' });
  await page.waitForTimeout(700); // let the rise/fade land — shoot the held card
  const btnBox = await page.locator('.wager-continue').boundingBox();
  out.wagerBtn = btnBox ? `${Math.round(btnBox.width)}x${Math.round(btnBox.height)}` : 'MISSING';
  out.wagerContrast = await contrastOn(page, '.wager-text', '.wager-panel');
  await page.screenshot({ path: `${OUT}/${name}-02-wager.png` });

  // tap/Enter continue -> lid with gauntlet banners
  await page.keyboard.press('Enter');
  await page.locator('.screen-lid').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  out.lid = await densityOf(page);
  out.duelBannerCount = await page.locator('.duel-banner').count();
  out.chapterLabels = await page.locator('.chapter-label').allTextContents();
  const labelBoxes = await page.locator('.chapter-label').evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }));
  out.labelBoxes = labelBoxes;
  out.journalTail = await page.evaluate(() => window.__OW.save.journal.slice(0, 4));
  await page.screenshot({ path: `${OUT}/${name}-03-lid.png` });

  // medallion aria-label prefix contract still drives navigation
  await page.locator('.medallion-hit[aria-label^="Lock 1:"]').click();
  await page.locator('.screen-lockroom').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/${name}-04-lockroom01.png` });
  await page.keyboard.press('Escape');
  await page.locator('.screen-lid').waitFor({ state: 'visible' });
  // a natural persist (mute toggle twice) carries the wager echo into storage
  // (pushJournal alone is memory-only until the next writeSave)
  await page.locator('.settings-nail').click();
  const muteSwitch = page.locator('[role="switch"]').first();
  await muteSwitch.click();
  await muteSwitch.click();
  await page.keyboard.press('Escape');

  // reload -> Continue path must NOT re-show the wager (journal-derived once)
  await page.reload();
  await page.waitForFunction(() => typeof window.__OW === 'object');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  out.wagerReshown = await page.locator('.wager-card').isVisible().catch(() => false);
  await page.locator('.screen-lid').waitFor({ state: 'visible' });

  out.errors = errors;
  await browser.close();
  return out;
}

const desktop = await drive('desktop', { viewport: { width: 1280, height: 800 } });
const phone = await drive('iphone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const rm = await drive('desktop-rm', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

for (const r of [desktop, phone, rm]) console.log(JSON.stringify(r, null, 1));
const bad = [desktop, phone, rm].filter((r) => r.errors.length || r.wagerReshown || r.duelBannerCount !== 1);
process.exit(bad.length ? 1 : 0);
