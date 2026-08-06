// OW-B15 board capture + density rubric, both viewports, dSF2.
//   node artifacts/wip-b15/capture.mjs <tag> [--lang es] [--state empty|mid|near|full|solved|refuse]
// Numbers reported (docs/QUALITY.md "Density rubric"):
//   occupancy   featured tiles / all tiles over the ring canvas (>= 55%)
//   maxVoid     largest contiguous featureless blob, % of canvas (<= 18%)
//   gapPx       ring bottom -> first control top, CSS px (<= 48)
//   deadZone    local contrast ratio of incidental carving outside the ring band
//               (median / p90) — visible >= 1.5:1, subordinate <= 2.5:1
//   layers      luminance bands >= 2% of a 200% crop (>= 3)
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
const argOf = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null; };
const lang = argOf('--lang');
const state = argOf('--state') || 'empty';
mkdirSync('artifacts/wip-b15/shots', { recursive: true });

// Runs in the page: tile-grid local contrast over the ring canvas.
function measureFn([sel, ringBox]) {
  const cv = document.querySelector(sel);
  if (!cv) return { error: 'no canvas' };
  const g = cv.getContext('2d');
  const W = cv.width, Hh = cv.height;
  const d = g.getImageData(0, 0, W, Hh).data;
  const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  const T = 16; // device px per probe tile (dpr 2 -> 8 CSS px)
  const cols = Math.floor(W / T), rows = Math.floor(Hh / T);
  const feat = new Uint8Array(cols * rows);
  const spread = new Float32Array(cols * rows);
  const relL = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      let lo = 1e9, hi = -1e9;
      for (let y = 0; y < T; y += 2) {
        for (let x = 0; x < T; x += 2) {
          const i = (((ty * T + y) * W) + (tx * T + x)) * 4;
          const l = lum(i);
          if (l < lo) lo = l;
          if (l > hi) hi = l;
        }
      }
      const k = ty * cols + tx;
      spread[k] = (relL(hi) + 0.05) / (relL(lo) + 0.05); // WCAG-style local ratio
      feat[k] = hi - lo >= 12 ? 1 : 0;
    }
  }
  let featured = 0;
  for (let k = 0; k < feat.length; k++) featured += feat[k];

  // largest contiguous featureless blob (4-neighbour flood)
  const seen = new Uint8Array(cols * rows);
  let maxVoid = 0;
  const stack = [];
  for (let k = 0; k < feat.length; k++) {
    if (feat[k] || seen[k]) continue;
    let n = 0;
    stack.length = 0;
    stack.push(k);
    seen[k] = 1;
    while (stack.length) {
      const c = stack.pop();
      n++;
      const cx = c % cols, cy = (c / cols) | 0;
      const nb = [];
      if (cx > 0) nb.push(c - 1);
      if (cx < cols - 1) nb.push(c + 1);
      if (cy > 0) nb.push(c - cols);
      if (cy < rows - 1) nb.push(c + cols);
      for (const m of nb) if (!seen[m] && !feat[m]) { seen[m] = 1; stack.push(m); }
    }
    if (n > maxVoid) maxVoid = n;
  }

  // dead-zone contrast: featured tiles OUTSIDE the ring band (throne floor + corners)
  const dz = [];
  if (ringBox) {
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const k = ty * cols + tx;
        if (!feat[k]) continue;
        const px = tx * T + T / 2, py = ty * T + T / 2;
        const rr = Math.hypot(px - ringBox.cx, py - ringBox.cy);
        if (rr < ringBox.rIn || rr > ringBox.rOut) dz.push(spread[k]);
      }
    }
    dz.sort((a, b) => a - b);
  }

  // texture layers on 200% crops taken across the dead zones the rubric names
  // (dais heart, dais margin, and the rim band). Reported as the WORST of them,
  // so one lucky window cannot carry a flat surface.
  const layersAt = (cropX0, cropY0) => {
    const cropX = Math.max(0, Math.min(W - 120, Math.round(cropX0)));
    const cropY = Math.max(0, Math.min(Hh - 120, Math.round(cropY0)));
    const cw = Math.min(120, W - cropX), ch = Math.min(120, Hh - cropY);
    const hist = new Array(16).fill(0);
    const cd = g.getImageData(cropX, cropY, cw, ch).data;
    // NB: index the CROP buffer, not the whole-canvas one the tile pass uses —
    // closing over `lum` here read (0,0) for every probe and reported 1 layer
    // for any surface at all.
    const cl = (i) => 0.2126 * cd[i] + 0.7152 * cd[i + 1] + 0.0722 * cd[i + 2];
    for (let i = 0; i < cd.length; i += 4) hist[Math.min(15, Math.floor(cl(i) / 16))]++;
    const tot = cd.length / 4;
    return hist.filter((h) => h / tot >= 0.02).length;
  };
  const cxr = ringBox ? ringBox.cx : W / 2;
  const cyr = ringBox ? ringBox.cy : Hh / 2;
  const inR = ringBox ? ringBox.rIn : W * 0.3;
  const outR = ringBox ? ringBox.rOut : W * 0.36;
  const probes = [
    [cxr - 60, cyr - 60],                                  // the heart
    [cxr - inR * 0.55 - 60, cyr - inR * 0.5 - 60],         // dais, lit side
    [cxr + inR * 0.5 - 60, cyr + inR * 0.5 - 60],          // dais, shaded side
    [cxr - 60, cyr - outR - 70],                           // the rim band
  ];
  const layerSet = probes.map(([px, py]) => layersAt(px, py));
  const layers = Math.min(...layerSet);

  const q = (arr, p) => (arr.length ? +arr[Math.min(arr.length - 1, Math.floor(arr.length * p))].toFixed(2) : null);
  return {
    canvas: `${W}x${Hh}`,
    tiles: cols * rows,
    occupancy: +(featured / (cols * rows) * 100).toFixed(1),
    maxVoid: +(maxVoid / (cols * rows) * 100).toFixed(1),
    deadZoneN: dz.length,
    deadZoneMedian: q(dz, 0.5),
    deadZoneP90: q(dz, 0.9),
    layers,
    layerSet,
  };
}

/** Cross the threshold; the shell grew a wager step the shared harness predates. */
async function cross(page) {
  await page.locator('.screen-threshold .btn-carved').first().click();
  for (let i = 0; i < 5; i++) {
    if (await page.locator('.screen-lid, .screen-finale').count()) return;
    const wager = page.locator('.screen-threshold .wager-continue');
    const next = (await wager.count()) ? wager : page.locator('.screen-threshold .btn-carved');
    await next.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

/** Hang shards by the same handles the e2e driver uses. */
async function hang(page, pairs) {
  for (const [runeName, slot] of pairs) {
    await page.locator(`.ow15-chip[aria-label^="Shard ${runeName},"]`).click();
    await page.locator('.ow15-slot').nth(slot).click();
  }
}

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  const solvedRun = state === 'solved';
  await H.boot(page, { save: H.saveWithOpenedUpTo(solvedRun ? 16 : 15) });
  if (lang) {
    await page.evaluate((l) => {
      const s = JSON.parse(localStorage.getItem('oathwood.v1'));
      s.settings = { ...(s.settings || {}), lang: l };
      localStorage.setItem('oathwood.v1', JSON.stringify(s));
    }, lang);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.screen', { timeout: 10000 });
  }
  await cross(page);
  await H.enterLock(page, 15);
  await H.answerDare(page);
  await page.waitForTimeout(3900); // let the showing run out

  // chips are built from instance.shards in order, so index maps rune -> aria name
  const { ring, runeNames } = await page.evaluate(() => {
    const inst = window.__OW.instanceOf('15-oathring');
    const chips = [...document.querySelectorAll('.ow15-chip')];
    const map = {};
    inst.shards.forEach((s, k) => {
      const m = /^Shard ([^,]+),/.exec((chips[k] && chips[k].getAttribute('aria-label')) || '');
      if (m) map[s.rune] = m[1];
    });
    return { ring: window.__OW.answerOf('15-oathring').ring, runeNames: map };
  });
  if (state === 'mid') await hang(page, ring.slice(0, 7).map((ch, i) => [runeNames[ch], i]));
  if (state === 'near') await hang(page, ring.slice(0, 13).map((ch, i) => [runeNames[ch], i]));
  if (state === 'full' || state === 'refuse') {
    const order = ring.slice();
    if (state === 'refuse') { const t = order[5]; order[5] = order[9]; order[9] = t; }
    await hang(page, order.map((ch, i) => [runeNames[ch], i]));
  }
  if (state === 'refuse') {
    await page.locator('.ow15-act', { hasText: 'Close the ring' }).first().click().catch(() => {});
    await page.getByRole('button', { name: /Close the ring|Cerrar|Tancar/ }).first().click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(700);

  const geo = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const r = root.getBoundingClientRect();
    const cv = root.querySelector('.ow15-ring canvas');
    const cr = cv ? cv.getBoundingClientRect() : null;
    const acts = root.querySelector('.ow15-act, .btn-carved');
    const ar = acts ? acts.getBoundingClientRect() : null;
    const els = [...root.querySelectorAll('button,[role="option"],[role="button"],a[href],input')];
    const small = els.map((e) => {
      const b = e.getBoundingClientRect();
      return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
    return {
      root: { w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      scrollH: root.scrollHeight,
      docScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      canvasCss: cr ? { w: +cr.width.toFixed(0), h: +cr.height.toFixed(0) } : null,
      gapPx: cr && ar ? +(ar.top - cr.bottom).toFixed(1) : null,
      nCanvas: root.querySelectorAll('canvas').length,
      under44: small,
      box: window.__OW15_RING || null,
      text: (root.innerText || '').trim().slice(0, 500),
    };
  });

  const m = await page.evaluate(measureFn, ['.ow15-ring canvas', geo.box]).catch((e) => ({ error: String(e) }));
  const suffix = `${tag}-${state}-${name}${lang ? '-' + lang : ''}`;
  await page.screenshot({ path: `artifacts/wip-b15/shots/${suffix}.png` });
  const cv = page.locator('.ow15-ring canvas');
  if (await cv.count()) await cv.screenshot({ path: `artifacts/wip-b15/shots/${suffix}-ring.png` });
  out.push({ vp: name, state, ...geo, ...m, consoleErrors: page.__errors.slice() });
  await page.context().close();
}
await browser.close();
writeFileSync(`artifacts/wip-b15/shots/${tag}-${state}${lang ? '-' + lang : ''}-metrics.json`, JSON.stringify(out, null, 1));
let bad = 0;
for (const r of out) {
  const fail = [];
  if (r.occupancy != null && r.occupancy < 55) fail.push('occupancy');
  if (r.maxVoid != null && r.maxVoid > 18) fail.push('maxVoid');
  if (r.gapPx != null && r.gapPx > 48) fail.push('gap');
  if (r.layers != null && r.layers < 3) fail.push('layers');
  if (r.under44.length) fail.push('under44');
  if (r.consoleErrors.length) fail.push('console');
  if (r.docScrollW > r.innerW) fail.push('hscroll');
  if (fail.length) bad++;
  console.log(`${r.vp.padEnd(5)} root ${r.root.w}x${r.root.h} scrollH ${r.scrollH} canvas ${r.canvas || '-'} css ${r.canvasCss ? r.canvasCss.w + 'x' + r.canvasCss.h : '-'}`);
  console.log(`      occupancy ${r.occupancy}%  maxVoid ${r.maxVoid}%  gap ${r.gapPx}px  layers ${r.layers} ${JSON.stringify(r.layerSet || [])}  deadZone med ${r.deadZoneMedian} p90 ${r.deadZoneP90} (n=${r.deadZoneN})  under44 ${r.under44.length}  errs ${r.consoleErrors.length}  ${fail.length ? 'FAIL:' + fail.join(',') : 'ok'}`);
  if (r.under44.length) console.log('      under44:', JSON.stringify(r.under44.slice(0, 4)));
  if (r.consoleErrors.length) console.log('      errors:', r.consoleErrors.slice(0, 3));
}
console.log(bad === 0 ? 'B15 RUBRIC: GREEN' : `B15 RUBRIC: ${bad} viewport(s) failing`);
