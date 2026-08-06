// OW-B05 board capture + density rubric, both viewports, dSF2.
//   node artifacts/wip-b05/capture.mjs <tag> [--lang es] [--solved]
//
// Numbers reported (docs/QUALITY.md "Density rubric"), measured on the REAL
// rendered lock-room field (element screenshot, decoded, DOM chrome included):
//   occupancy  featured 16px probes / all probes            >= 55%
//   maxVoid    largest contiguous featureless blob, % field  <= 18%
//   gapPx      board bottom -> controls top, CSS px          <= 48
//   deadZone   local contrast ratio of incidental carving outside the board
//              (median / p90)                    visible >=1.5, subordinate <=2.5
//   layers     luminance bands >= 2% of a 200% margin crop   >= 3
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';
import { decodePng, density, layers } from './png.mjs';

/** Sub-image copy, so a metric can be scoped to one rect. */
function cropImg(img, r) {
  const { bpp, data, w } = img;
  const out = Buffer.alloc(r.w * r.h * bpp);
  for (let y = 0; y < r.h; y++) {
    data.copy(out, y * r.w * bpp, ((r.y + y) * w + r.x) * bpp, ((r.y + y) * w + r.x + r.w) * bpp);
  }
  return { w: r.w, h: r.h, bpp, data: out };
}

const tag = process.argv[2] || 'now';
const argOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const lang = argOf('--lang');
const DIR = 'artifacts/wip-b05/shots';
mkdirSync(DIR, { recursive: true });

const browser = await H.launch();
const out = [];
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const sfx = `${tag}-${name}${lang ? '-' + lang : ''}`;
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(5) });
  if (lang) {
    await page.evaluate((l) => {
      const s = JSON.parse(localStorage.getItem('oathwood.v1'));
      s.settings = { ...(s.settings || {}), lang: l };
      localStorage.setItem('oathwood.v1', JSON.stringify(s));
    }, lang);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.screen', { timeout: 10000 });
  }
  // the threshold now gates on the wager (sibling lane, landed mid-run); the
  // shared qplay harness predates it, so cross it here.
  await page.locator('.screen-threshold .btn-carved').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count()) await wager.first().click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
  await H.enterLock(page, 5);
  await H.answerDare(page);
  await page.waitForTimeout(4200); // let the showing run out

  const geo = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const r = root.getBoundingClientRect();
    const cv = root.querySelector('.ow5-panel canvas');
    const cr = cv ? cv.getBoundingClientRect() : null;
    const acts = root.querySelector('.ow5-actions') || root.querySelector('.btn-carved');
    const ar = acts ? acts.getBoundingClientRect() : null;
    const els = [...root.querySelectorAll('button,[role="option"],[role="button"],a[href],input')];
    const small = els.map((e) => {
      const b = e.getBoundingClientRect();
      return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
    return {
      root: { w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
      scrollH: root.scrollHeight,
      canvasCss: cr ? { w: +cr.width.toFixed(0), h: +cr.height.toFixed(0) } : null,
      // board rect relative to the lock-root, CSS px (the puzzle box to avoid)
      boardRel: cr ? { x: cr.left - r.left, y: cr.top - r.top, w: cr.width, h: cr.height } : null,
      // the WORK's box inside the bench (data-box, bench units -> lock-root CSS):
      // the dead-zone law is about the bench around it, not the room around all of it
      workRel: (() => {
        const pb = root.querySelector('.ow5-panel');
        if (!pb || !cr || !pb.dataset.box) return null;
        const [bx, by, bw2, bh2, BW, BH] = pb.dataset.box.split(',').map(Number);
        const k = cr.width / BW;
        return { x: cr.left - r.left + bx * k, y: cr.top - r.top + by * k, w: bw2 * k, h: bh2 * (cr.height / BH) };
      })(),
      // every text/control box, so the dead-zone contrast measures CARVING only
      textRel: [...root.querySelectorAll('p,button,h1,h2,h3,span,li')]
        .filter((e) => (e.textContent || '').trim().length)
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 0 && b.height > 0)
        .map((b) => ({ x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height })),
      gapPx: cr && ar ? +(ar.top - cr.bottom).toFixed(1) : null,
      nCanvas: root.querySelectorAll('canvas').length,
      under44: small,
      text: (root.innerText || '').replace(/\n+/g, ' | ').trim().slice(0, 500),
    };
  });

  await page.screenshot({ path: `${DIR}/${sfx}-room.png` });
  await page.locator('.lock-root').screenshot({ path: `${DIR}/${sfx}-field.png` });
  const img = decodePng(readFileSync(`${DIR}/${sfx}-field.png`));
  const S = img.w / geo.root.w; // device scale factor actually captured
  const scale = (b) => ({ x: Math.round(b.x * S), y: Math.round(b.y * S), w: Math.round(b.w * S), h: Math.round(b.h * S) });
  const board = geo.boardRel ? scale(geo.boardRel) : null;
  // occupancy / voids over the whole room; dead-zone contrast over the BENCH
  // only, with the work and every text box excluded.
  const d = density(img, { tile: 16, delta: 12, avoid: [board, ...geo.textRel.map(scale)].filter(Boolean) });
  const dz = geo.workRel
    ? density(cropImg(img, board), { tile: 16, delta: 12, avoid: [{ ...scale(geo.workRel), x: scale(geo.workRel).x - board.x, y: scale(geo.workRel).y - board.y }] })
    : { deadZoneMedian: null, deadZoneP90: null, deadZoneN: 0 };
  d.deadZoneMedian = dz.deadZoneMedian;
  d.deadZoneP90 = dz.deadZoneP90;
  d.deadZoneN = dz.deadZoneN;
  d.benchOccupancy = dz.occupancy;
  // 200% crop from the widest margin of the board (or the field's left edge)
  const cx = board ? Math.max(0, Math.min(img.w - 160, board.x + 8)) : 8;
  const cy = board ? Math.max(0, Math.min(img.h - 160, board.y + Math.round(board.h * 0.45))) : 8;
  const lay = layers(img, cx, cy, 160, 160);
  out.push({ vp: name, dsf: +S.toFixed(2), img: `${img.w}x${img.h}`, ...geo, ...d, layers: lay, consoleErrors: page.__errors.slice() });
  await page.context().close();
}
await browser.close();
writeFileSync(`${DIR}/${tag}${lang ? '-' + lang : ''}-metrics.json`, JSON.stringify(out, null, 1));

let bad = 0;
for (const r of out) {
  const fail = [];
  if (r.occupancy < 55) fail.push('occupancy');
  if (r.maxVoid > 18) fail.push('maxVoid');
  if (r.gapPx != null && r.gapPx > 48) fail.push('gap');
  if (r.layers < 3) fail.push('layers');
  if (r.deadZoneMedian != null && (r.deadZoneMedian < 1.5)) fail.push('deadZone-invisible');
  if (r.under44.length) fail.push('under44');
  if (r.consoleErrors.length) fail.push('console');
  if (fail.length) bad++;
  console.log(`${r.vp.padEnd(5)} field ${r.img} dsf${r.dsf} root ${r.root.w}x${r.root.h} scrollH ${r.scrollH} board ${r.canvasCss ? r.canvasCss.w + 'x' + r.canvasCss.h : '-'}`);
  console.log(`      occupancy ${r.occupancy}% (bench ${r.benchOccupancy}%)  maxVoid ${r.maxVoid}%  gap ${r.gapPx}px  layers ${r.layers}  deadZone med ${r.deadZoneMedian} p90 ${r.deadZoneP90} (n=${r.deadZoneN})  under44 ${r.under44.length}  errs ${r.consoleErrors.length}`);
  if (r.under44.length) console.log('      under44:', JSON.stringify(r.under44.slice(0, 4)));
  if (r.consoleErrors.length) console.log('      errors:', r.consoleErrors.slice(0, 3));
  if (fail.length) console.log('      FAIL:', fail.join(', '));
}
console.log(bad === 0 ? 'DENSITY RUBRIC: GREEN' : `DENSITY RUBRIC: ${bad} viewport(s) failing`);
process.exit(bad === 0 ? 0 : 1);
