// OW-B03 board capture: lock 03 at both viewports, dSF2, plus a 200% crop and
// the docs/QUALITY.md density rubric measured on the real screenshot pixels.
//   field occupancy   — % of 8px cells inside the board panel carrying local
//                       contrast (>= 8/255 luminance range)
//   largest dead zone  — biggest 4-connected run of featureless cells, % of panel
//   board->controls gap — vertical px between the last canvas and the first control
// Usage: node artifacts/wip-b03/capture.mjs <tag> [reduced]
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
const reduced = process.argv.includes('reduced');
mkdirSync('artifacts/wip-b03/shots', { recursive: true });

// Density is measured by re-loading the PNG into a blank page and reading its
// pixels back through a canvas — no image decoding dependency in node.
const MEASURE = (src) => new Promise((done) => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const CELL = 8;
    const cw = Math.floor(c.width / CELL), ch = Math.floor(c.height / CELL);
    const feat = new Uint8Array(cw * ch);
    let featured = 0;
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        let lo = 255, hi = 0;
        for (let y = 0; y < CELL; y++) {
          for (let x = 0; x < CELL; x++) {
            const i = (((cy * CELL + y) * c.width) + (cx * CELL + x)) * 4;
            const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
            if (l < lo) lo = l;
            if (l > hi) hi = l;
          }
        }
        if (hi - lo >= 8) { feat[cy * cw + cx] = 1; featured++; }
      }
    }
    // largest 4-connected component of featureless cells
    const seen = new Uint8Array(cw * ch);
    let worst = 0;
    const stack = [];
    for (let s = 0; s < cw * ch; s++) {
      if (feat[s] || seen[s]) continue;
      let n = 0;
      stack.length = 0; stack.push(s); seen[s] = 1;
      while (stack.length) {
        const k = stack.pop(); n++;
        const kx = k % cw, ky = (k - kx) / cw;
        if (kx > 0 && !feat[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1); }
        if (kx < cw - 1 && !feat[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1); }
        if (ky > 0 && !feat[k - cw] && !seen[k - cw]) { seen[k - cw] = 1; stack.push(k - cw); }
        if (ky < ch - 1 && !feat[k + cw] && !seen[k + cw]) { seen[k + cw] = 1; stack.push(k + cw); }
      }
      if (n > worst) worst = n;
    }
    const total = cw * ch;
    done({
      occupancy: +(featured / total).toFixed(3),
      largestDeadZone: +(worst / total).toFixed(3),
      cells: total,
    });
  };
  img.src = src;
});

// The shared harness predates the threshold wager card; cross it locally.
async function cross(page) {
  await page.locator('.threshold-actions button').first().click();
  const wager = page.locator('.wager-card .wager-continue');
  if (await wager.count()) {
    await wager.click({ timeout: 4000 }).catch(() => {});
  }
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp, { reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await H.boot(page, { save: H.saveWithOpenedUpTo(3) });
  await cross(page);
  await H.enterLock(page, 3);
  await H.answerDare(page);
  await page.waitForTimeout(4200); // let the showing run out

  await page.screenshot({ path: `artifacts/wip-b03/shots/${tag}-${name}.png` });

  const geo = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const r = root.getBoundingClientRect();
    const canvases = [...root.querySelectorAll('canvas')];
    const ctrls = [...root.querySelectorAll('button,[role="slider"],[role="button"],a[href],input')];
    const boxes = ctrls.map((e) => {
      const b = e.getBoundingClientRect();
      return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), top: +b.top.toFixed(1),
        t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 22) };
    }).filter((o) => o.w > 0);
    // last painted canvas bottom vs first control below it
    const lastCanvasBottom = canvases.reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
    const below = boxes.filter((b) => b.top >= lastCanvasBottom - 1).sort((a, b) => a.top - b.top);
    const ink = canvases.map((c) => {
      let n = 0;
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      } catch (e) { n = -1; }
      return { w: c.width, h: c.height, ink: n, cover: +(n / (c.width * c.height)).toFixed(3) };
    });
    return {
      box: { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      scrollH: root.scrollHeight, viewH: window.innerHeight,
      nCanvas: canvases.length, ink,
      nCtrl: boxes.length,
      under44: boxes.filter((o) => o.w < 44 || o.h < 44),
      boardToControlsGap: below.length ? +(below[0].top - lastCanvasBottom).toFixed(1) : null,
      lowestControlTop: boxes.length ? Math.max(...boxes.map((b) => b.top)) : null,
    };
  });

  // density on the board panel only
  const clip = { x: geo.box.x, y: Math.max(0, geo.box.y), width: geo.box.w, height: Math.min(geo.box.h, vp.height - Math.max(0, geo.box.y)) };
  const panel = await page.screenshot({ clip });
  writeFileSync(`artifacts/wip-b03/shots/${tag}-${name}-panel.png`, panel);
  const blank = await browser.newContext({ viewport: { width: 400, height: 400 } });
  const mp = await blank.newPage();
  await mp.goto('about:blank');
  const density = await mp.evaluate(MEASURE, `data:image/png;base64,${panel.toString('base64')}`);
  await blank.close();

  // 200% crop of the board's busiest quarter for the texture-layer read
  const cx = Math.round(clip.x + clip.width * 0.5);
  const cy = Math.round(clip.y + clip.height * 0.32);
  const cw = Math.min(300, clip.width);
  const chh = Math.min(220, clip.height);
  await page.screenshot({
    path: `artifacts/wip-b03/shots/${tag}-${name}-crop.png`,
    clip: { x: Math.max(0, cx - cw / 2), y: Math.max(0, cy - chh / 2), width: cw, height: chh },
  });

  out.push({ vp: name, ...geo, ...density, consoleErrors: page.__errors.slice() });
  await page.context().close();
}
await browser.close();
writeFileSync(`artifacts/wip-b03/shots/${tag}-metrics.json`, JSON.stringify(out, null, 1));
for (const r of out) {
  console.log(`${r.vp}: box ${r.box.w}x${r.box.h} scrollH=${r.scrollH}/${r.viewH} canvases=${r.nCanvas} `
    + `occupancy=${(r.occupancy * 100).toFixed(1)}% deadzone=${(r.largestDeadZone * 100).toFixed(1)}% `
    + `gap=${r.boardToControlsGap} under44=${r.under44.length} errs=${r.consoleErrors.length}`);
  if (r.under44.length) console.log('   under44:', JSON.stringify(r.under44));
  if (r.consoleErrors.length) console.log('   errors:', r.consoleErrors.slice(0, 3));
}
