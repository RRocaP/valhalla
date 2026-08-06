// OW-B04 board capture: lock 04 (The Clinker Strakes) at both viewports, dSF2,
// plus the density rubric numbers (field occupancy, largest featureless region,
// board->controls gap) and the 44px target floor.
// Usage: node artifacts/wip-b04/capture.mjs <tag>
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
mkdirSync('artifacts/wip-b04/shots', { recursive: true });

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(4) });
  // a sibling lane added a wager gate between the threshold and the lid; the
  // shared harness does not know it yet, so answer it here.
  await page.locator('.screen-threshold button').first().click();
  const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
  if (await wager.count()) { await wager.first().click({ timeout: 4000 }).catch(() => {}); }
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 4);
  await H.answerDare(page);
  await page.waitForTimeout(900);  // the showing is still running
  await page.screenshot({ path: `artifacts/wip-b04/shots/${tag}-${name}-demo.png` });
  await page.waitForTimeout(2900); // let the showing run out
  await page.screenshot({ path: `artifacts/wip-b04/shots/${tag}-${name}.png` });

  const m = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const r = root.getBoundingClientRect();
    const els = [...root.querySelectorAll('button,[role="radio"],[role="slider"],[role="button"],a[href],input')];
    const under44 = els.map((e) => {
      const b = e.getBoundingClientRect();
      return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 22) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));

    const canvases = [...root.querySelectorAll('canvas')].map((c) => {
      let ink = 0;
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      } catch (e) { ink = -1; }
      const b = c.getBoundingClientRect();
      return { w: c.width, h: c.height, cssW: +b.width.toFixed(0), cssH: +b.height.toFixed(0), ink, cover: +(ink / (c.width * c.height)).toFixed(3) };
    });

    // ---- density rubric, measured over the lock-root box on a coarse grid ----
    // "furniture" = any element box (canvas, plaque, text run) that is not the
    // bare field. Occupancy = share of grid cells covered by furniture.
    const CELL = 8;
    const cols = Math.ceil(r.width / CELL);
    const rows = Math.ceil(r.height / CELL);
    const grid = new Uint8Array(cols * rows);
    const mark = (box) => {
      const x0 = Math.max(0, Math.floor((box.left - r.left) / CELL));
      const x1 = Math.min(cols - 1, Math.ceil((box.right - r.left) / CELL) - 1);
      const y0 = Math.max(0, Math.floor((box.top - r.top) / CELL));
      const y1 = Math.min(rows - 1, Math.ceil((box.bottom - r.top) / CELL) - 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * cols + x] = 1;
    };
    const walk = (el) => {
      for (const ch of el.children) {
        if (ch.tagName === 'STYLE' || ch.tagName === 'SCRIPT') continue;
        const b = ch.getBoundingClientRect();
        const leaf = !ch.children.length || ch.tagName === 'CANVAS' || ch.tagName === 'BUTTON';
        if (b.width > 0 && b.height > 0 && leaf) mark(b);
        if (!leaf) walk(ch);
      }
    };
    walk(root);
    let filled = 0;
    for (let i = 0; i < grid.length; i++) filled += grid[i];
    const occupancy = +(filled / grid.length).toFixed(3);

    // largest empty axis-aligned rectangle (histogram sweep over 0-cells)
    let best = 0;
    const heights = new Int32Array(cols);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) heights[x] = grid[y * cols + x] ? 0 : heights[x] + 1;
      const st = [];
      for (let x = 0; x <= cols; x++) {
        const h = x === cols ? 0 : heights[x];
        let start = x;
        while (st.length && st[st.length - 1][1] >= h) {
          const [s, hh] = st.pop();
          best = Math.max(best, hh * (x - s));
          start = s;
        }
        st.push([start, h]);
      }
    }
    const largestVoid = +(best / grid.length).toFixed(3);

    // vertical gap between the last board furniture and the primary action
    const act = root.querySelector('.btn-carved, button.ow4-act');
    let gap = null;
    if (act) {
      const ab = act.getBoundingClientRect();
      let bottom = r.top;
      for (const e of root.querySelectorAll('canvas,p,div')) {
        if (e.contains(act)) continue;
        const b = e.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        if (b.bottom <= ab.top + 0.5 && b.bottom > bottom) bottom = b.bottom;
      }
      gap = +(ab.top - bottom).toFixed(0);
    }

    return {
      box: { w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      scrollH: root.scrollHeight,
      occupancy, largestVoid, gap,
      nCanvas: canvases.length,
      blankCanvas: canvases.filter((c) => c.ink >= 0 && c.ink <= 20).length,
      canvases: canvases.slice(0, 6),
      under44,
    };
  });
  // brand an oath and send a wrong stack, so the blood mark and the WHERE
  // marks are on the glass and not merely in the source
  await page.locator('[role="radio"].ow4-say').nth(0).click();
  await page.screenshot({ path: `artifacts/wip-b04/shots/${tag}-${name}-branded.png` });
  await page.getByRole('button', { name: 'Raise the stack', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `artifacts/wip-b04/shots/${tag}-${name}-wrong.png` });

  m.consoleErrors = page.__errors.slice();
  out.push({ vp: name, ...m });
  await page.context().close();
}
await browser.close();
writeFileSync(`artifacts/wip-b04/shots/${tag}-metrics.json`, JSON.stringify(out, null, 1));
for (const r of out) {
  console.log(`${r.vp}: box ${r.box.w}x${r.box.h} scrollH=${r.scrollH} occupancy=${r.occupancy} largestVoid=${r.largestVoid} gap=${r.gap} canvases=${r.nCanvas} blank=${r.blankCanvas} under44=${r.under44.length} errs=${r.consoleErrors.length}`);
  if (r.under44.length) console.log('   under44:', JSON.stringify(r.under44.slice(0, 6)));
  if (r.consoleErrors.length) console.log('   errors:', r.consoleErrors.slice(0, 3));
}
