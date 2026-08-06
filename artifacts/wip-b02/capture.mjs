// OW-B02 board capture: lock 02 at both viewports, dSF2, plus a 200% crop and
// a density measurement (field occupancy + largest featureless region).
// Usage: node artifacts/wip-b02/capture.mjs <tag>
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
mkdirSync('artifacts/wip-b02/shots', { recursive: true });

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(2) });
  // the shell gained a wager card between the begin gesture and the lid
  // (sibling lane, docs/JARLS.md); take it, then cross.
  await page.locator('.threshold-actions button').first().click();
  const wager = page.locator('.wager-layer .wager-continue');
  if (await wager.isVisible().catch(() => false)) await wager.click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 2);
  await H.answerDare(page);
  await page.waitForTimeout(3600); // let the showing run out
  await page.screenshot({ path: `artifacts/wip-b02/shots/${tag}-${name}.png` });
  await page.locator('.lock-root').screenshot({ path: `artifacts/wip-b02/shots/${tag}-${name}-board.png` });

  // density: sample the lock-root box, count "featured" pixels (local contrast)
  const m = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const r = root.getBoundingClientRect();
    const els = [...root.querySelectorAll('button,[role="radio"],[role="slider"],[role="button"],a[href],input')];
    const small = els.map((e) => {
      const b = e.getBoundingClientRect();
      return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
    const canvases = [...root.querySelectorAll('canvas')].map((c) => {
      let ink = 0;
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      } catch (e) { ink = -1; }
      return { w: c.width, h: c.height, ink, cover: +(ink / (c.width * c.height)).toFixed(3) };
    });
    // density rubric (docs/QUALITY.md): tile the panel, mark a tile covered when
    // its centre falls inside painted furniture (a canvas) or a text block;
    // report occupancy and the largest connected uncovered region.
    const T = 8;
    const cols = Math.max(1, Math.round(r.width / T));
    const rows = Math.max(1, Math.round(r.height / T));
    const boxes = [...root.querySelectorAll('canvas, p, span.ow2-tag, button')]
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width > 2 && b.height > 2);
    const cov = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = r.left + (x + 0.5) * (r.width / cols);
        const py = r.top + (y + 0.5) * (r.height / rows);
        for (const b of boxes) {
          if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) { cov[y * cols + x] = 1; break; }
        }
      }
    }
    let filled = 0;
    for (const v of cov) if (v) filled++;
    let biggest = 0;
    const seen = new Uint8Array(cols * rows);
    for (let i = 0; i < cov.length; i++) {
      if (cov[i] || seen[i]) continue;
      let n = 0;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const k = stack.pop();
        n++;
        const kx = k % cols, ky = (k / cols) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = kx + dx, ny = ky + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx;
          if (cov[j] || seen[j]) continue;
          seen[j] = 1;
          stack.push(j);
        }
      }
      if (n > biggest) biggest = n;
    }
    const submit = root.querySelector('.btn-carved');
    // the painted board ends at the lowest canvas edge (the rack's backdrop),
    // not at the grid box inside it
    const lowest = Math.max(...[...root.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect().bottom));
    const rackEl = { getBoundingClientRect: () => ({ bottom: lowest }) };
    return {
      occupancy: +(filled / cov.length).toFixed(3),
      largestVoid: +(biggest / cov.length).toFixed(3),
      boardToControls: submit && rackEl
        ? +(submit.getBoundingClientRect().top - rackEl.getBoundingClientRect().bottom).toFixed(0) : null,
      box: { w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      scrollH: root.scrollHeight,
      under44: small,
      canvases,
      nCanvas: canvases.length,
      errors: [],
    };
  });
  m.consoleErrors = page.__errors.slice();
  out.push({ vp: name, ...m });
  await page.context().close();
}
await browser.close();
writeFileSync(`artifacts/wip-b02/shots/${tag}-metrics.json`, JSON.stringify(out, null, 1));
for (const r of out) {
  console.log(`${r.vp}: box ${r.box.w}x${r.box.h} occupancy=${r.occupancy} largestVoid=${r.largestVoid} boardToControls=${r.boardToControls}px canvases=${r.nCanvas} under44=${r.under44.length} errs=${r.consoleErrors.length}`);
  if (r.under44.length) console.log('   under44:', JSON.stringify(r.under44));
  if (r.consoleErrors.length) console.log('   errors:', r.consoleErrors.slice(0, 3));
}
