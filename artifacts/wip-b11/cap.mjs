// OW-B11 capture + density rig for lock 11 (The Skerry Road).
// Usage: node artifacts/wip-b11/cap.mjs <tag> [both|desk|phone]
// Shots land in artifacts/wip-b11/shots/<tag>-<name>-<vp>.png at dSF2.
// Metrics (docs/QUALITY.md density rubric) land beside them as <tag>-metrics.json:
//   fieldOccupancy   — fraction of the lock panel carrying local contrast (>=0.55)
//   largestDeadPct   — largest contiguous featureless region as % of panel (<=18)
//   boardToControls  — vertical gap board bottom -> first control top (<=48px)
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
const which = process.argv[3] || 'both';
const DIR = 'artifacts/wip-b11/shots';
mkdirSync(DIR, { recursive: true });

const vps = which === 'phone' ? [['phone', H.PHONE]] : which === 'desk' ? [['desk', H.DESKTOP]] : [['desk', H.DESKTOP], ['phone', H.PHONE]];

// Reload a captured PNG into the page and measure local contrast on it.
async function density(page, pngB64) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const B = 4;                                   // 4 device px = 2 CSS px at dSF2
    const bw = Math.floor(cv.width / B);
    const bh = Math.floor(cv.height / B);
    const feat = new Uint8Array(bw * bh);
    let featured = 0;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        let lo = 255;
        let hi = 0;
        for (let y = 0; y < B; y++) {
          for (let x = 0; x < B; x++) {
            const i = (((by * B + y) * cv.width) + (bx * B + x)) * 4;
            const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722);
            if (l < lo) lo = l;
            if (l > hi) hi = l;
          }
        }
        if (hi - lo >= 6) { feat[by * bw + bx] = 1; featured++; }
      }
    }
    // largest contiguous featureless region (4-connected flood fill)
    const seen = new Uint8Array(bw * bh);
    let largest = 0;
    let where = null;
    const stack = [];
    for (let s = 0; s < feat.length; s++) {
      if (feat[s] || seen[s]) continue;
      let n = 0;
      const bb = { x0: bw, y0: bh, x1: 0, y1: 0 };
      stack.length = 0;
      stack.push(s);
      seen[s] = 1;
      while (stack.length) {
        const c = stack.pop();
        n++;
        const cx = c % bw;
        const cy = (c - cx) / bw;
        if (cx < bb.x0) bb.x0 = cx;
        if (cx > bb.x1) bb.x1 = cx;
        if (cy < bb.y0) bb.y0 = cy;
        if (cy > bb.y1) bb.y1 = cy;
        if (cx > 0 && !feat[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
        if (cx < bw - 1 && !feat[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
        if (cy > 0 && !feat[c - bw] && !seen[c - bw]) { seen[c - bw] = 1; stack.push(c - bw); }
        if (cy < bh - 1 && !feat[c + bw] && !seen[c + bw]) { seen[c + bw] = 1; stack.push(c + bw); }
      }
      if (n > largest) { largest = n; where = bb; }
    }
    const total = bw * bh;
    return {
      fieldOccupancy: +(featured / total).toFixed(3),
      largestDeadPct: +((largest / total) * 100).toFixed(1),
      deadBox: where && { x: where.x0 * B / 2, y: where.y0 * B / 2, w: (where.x1 - where.x0) * B / 2, h: (where.y1 - where.y0) * B / 2 },
      px: `${cv.width}x${cv.height}`,
    };
  }, pngB64);
}

// The shell gained a wager card between threshold and lid (sibling lane), so
// this rig crosses on its own rather than through H.crossThreshold.
async function cross(page) {
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count() && await wager.first().isVisible()) await wager.first().click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const out = [];
for (const [name, vp] of vps) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(11) });
  await cross(page);
  await H.enterLock(page, 11);
  await H.answerDare(page);

  // mid-demo evidence, then let the showing run out
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/${tag}-demo-${name}.png` });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${DIR}/${tag}-board-${name}.png` });

  // The room paints its wood on a viewport-fixed canvas, so an element
  // screenshot of a panel taller than the viewport comes back blank below the
  // fold — a capture artifact, not a dead zone. Measure what a player sees:
  // the panel clipped to the viewport, at the top of the board and again at
  // the bottom, and take the worse of the two.
  const root = page.locator('.lock-root');
  const clip = await root.boundingBox();
  async function frame(where, file) {
    await page.evaluate((w) => {
      const r = document.querySelector('.lock-root');
      r.scrollIntoView({ block: w, behavior: 'instant' });
    }, where);
    await page.waitForTimeout(260);
    const bb = await root.boundingBox();
    const y = Math.max(0, bb.y);
    const h = Math.min(bb.height, vp.height - y, vp.height);
    const buf = await page.screenshot({ path: file, clip: { x: bb.x, y, width: bb.width, height: h } });
    return density(page, buf.toString('base64'));
  }
  const top = await frame('start', `${DIR}/${tag}-panel-${name}.png`);
  const bottom = await frame('end', `${DIR}/${tag}-panelb-${name}.png`);
  const dens = top.fieldOccupancy <= bottom.fieldOccupancy ? top : bottom;
  dens.fieldOccupancy = Math.min(top.fieldOccupancy, bottom.fieldOccupancy);
  dens.largestDeadPct = Math.max(top.largestDeadPct, bottom.largestDeadPct);
  await page.evaluate(() => document.querySelector('.lock-root').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(200);
  // split the verdict: the chart itself vs the controls stack beneath it
  const boardB64 = (await page.locator('.lock-root canvas').first().screenshot()).toString('base64');
  const boardDens = await density(page, boardB64);
  dens.boardOccupancy = boardDens.fieldOccupancy;
  dens.boardDeadPct = boardDens.largestDeadPct;

  // 200% texture crop: top-left quadrant of the chart canvas, blown up
  const cbox = await page.locator('.lock-root canvas').first().boundingBox();
  if (cbox) {
    await page.screenshot({
      path: `${DIR}/${tag}-crop200-${name}.png`,
      clip: { x: cbox.x, y: cbox.y, width: Math.min(cbox.width, 340), height: Math.min(cbox.height, 220) },
    });
  }

  const dom = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const r = root.getBoundingClientRect();
    const cv = root.querySelector('canvas');
    const cvr = cv ? cv.getBoundingClientRect() : null;
    const ctrls = [...root.querySelectorAll('button,[role="radio"],[role="button"],a[href],input')];
    // docs/QUALITY.md density rubric reads "vertical gap between board and
    // controls" as a VOID: the largest empty run between two consecutive laid
    // out blocks, not the sum of the copy that sits between them.
    let gap = null;
    {
      const blocks = [...root.querySelectorAll('canvas,p,button,div')]
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 4 && b.height > 4)
        .sort((a, b) => a.top - b.top);
      let worst = 0;
      let reach = cvr ? cvr.top : (blocks[0] ? blocks[0].top : 0);
      for (const b of blocks) {
        if (b.top > reach) worst = Math.max(worst, b.top - reach);
        reach = Math.max(reach, b.bottom);
      }
      gap = +worst.toFixed(1);
    }
    const under44 = ctrls.map((e) => {
      const b = e.getBoundingClientRect();
      return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 26) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
    const canvases = [...root.querySelectorAll('canvas')].map((c) => {
      let ink = 0;
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      } catch (e) { ink = -1; }
      return { w: c.width, h: c.height, cover: +(ink / (c.width * c.height)).toFixed(3) };
    });
    return {
      box: { w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      scrollH: root.scrollHeight,
      boardToControls: gap,
      under44,
      canvases,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  out.push({ vp: name, viewport: `${vp.width}x${vp.height}`, clip: clip && { w: +clip.width.toFixed(0), h: +clip.height.toFixed(0) }, ...dens, ...dom, consoleErrors: page.__errors.slice() });
  await page.context().close();
}
await browser.close();
writeFileSync(`${DIR}/${tag}-metrics.json`, JSON.stringify(out, null, 1));
let bad = 0;
for (const r of out) {
  const occOK = r.fieldOccupancy >= 0.55;
  const deadOK = r.largestDeadPct <= 18;
  const gapOK = r.boardToControls != null && r.boardToControls <= 48;
  if (!occOK || !deadOK || !gapOK || r.under44.length || r.consoleErrors.length || r.overflowX > 1) bad++;
  console.log(`${r.vp.padEnd(5)} box ${r.box.w}x${r.box.h} occ=${r.fieldOccupancy}${occOK ? '' : ' FAIL'} (chart ${r.boardOccupancy}/dead ${r.boardDeadPct}%)`
    + ` dead=${r.largestDeadPct}%${deadOK ? '' : ' FAIL'} gap=${r.boardToControls}${gapOK ? '' : ' FAIL'}`
    + ` dead@${r.deadBox ? r.deadBox.x + ',' + r.deadBox.y + ' ' + r.deadBox.w + 'x' + r.deadBox.h : '-'} under44=${r.under44.length} overflowX=${r.overflowX} errs=${r.consoleErrors.length}`);
  if (r.under44.length) console.log('   under44:', JSON.stringify(r.under44.slice(0, 5)));
  if (r.consoleErrors.length) console.log('   errors:', r.consoleErrors.slice(0, 3));
}
console.log(bad === 0 ? 'B11 DENSITY: GREEN' : `B11 DENSITY: ${bad} viewport(s) failing`);
