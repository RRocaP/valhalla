// OW-MAGIC cycle-2 battery: full moment sweep with
//  - z-aware text overlap detection (same-layer, elementFromPoint-verified)
//  - focal-luminance measure on the actual capture (Magic Law: focal >= 2.2x field)
//  - capture set for the look pass
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const SHOTS = 'artifacts/wip-magic/shots';
const browser = await H.launch();
const report = [];

const OVERLAP_FN = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0;
  };
  const layerOf = (el) => (el.closest('.drawer,.panel-overlay,.wager-layer,.dare-card,.ceremony-overlay') || el.closest('.screen') || document.body);
  const leaves = [];
  const walk = (el) => {
    for (const c of el.children) walk(c);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
    if (own && vis(el)) leaves.push({ el, text: own });
  };
  walk(document.getElementById('app'));
  const out = [];
  const inlineKin = (a, b) => {
    // wrapped inline siblings share line boxes; their union rects intersect
    // without any visual overlap — normal flow cannot overlap itself
    const da = getComputedStyle(a).display; const db = getComputedStyle(b).display;
    if (!da.startsWith('inline') || !db.startsWith('inline')) return false;
    return a.parentElement === b.parentElement;
  };
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i]; const b = leaves[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (layerOf(a.el) !== layerOf(b.el)) continue;
      if (inlineKin(a.el, b.el)) continue;
      const ra = a.el.getBoundingClientRect(); const rb = b.el.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox <= 3 || oy <= 3) continue;
      // verify visually: does a midpoint of the intersection hit one of the two?
      const mx = Math.max(ra.left, rb.left) + ox / 2;
      const my = Math.max(ra.top, rb.top) + oy / 2;
      const top = document.elementFromPoint(mx, my);
      if (!top) continue;
      const inA = a.el.contains(top) || top.contains(a.el);
      const inB = b.el.contains(top) || top.contains(b.el);
      if (inA || inB) out.push({ a: a.text.slice(0, 40), b: b.text.slice(0, 40), ox: +ox.toFixed(0), oy: +oy.toFixed(0) });
    }
  }
  return out;
};

// Focal luminance, measured over the CAPTURE (composited truth), with the
// focal rect anchored to the actual DOM object and the field defined as the
// screen EXCLUDING the focal region (Magic Law: focal >= 2.2x field).
async function lumOfShot(page, pngPath, focalSel) {
  const rect = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = Math.min(r.width, r.height) * 0.1;
    return {
      x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad),
      w: Math.min(innerWidth, r.width + pad * 2), h: Math.min(innerHeight, r.height + pad * 2),
      vw: innerWidth, vh: innerHeight,
    };
  }, focalSel);
  if (!rect) return null;
  return page.evaluate(async ({ src, f }) => {
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const sx = c.width / f.vw; const sy = c.height / f.vh;
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const fx0 = f.x * sx; const fy0 = f.y * sy; const fx1 = (f.x + f.w) * sx; const fy1 = (f.y + f.h) * sy;
    let fs = 0; let fn = 0; let os = 0; let on = 0;
    const samples = [];
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const k = (y * c.width + x) * 4;
        const L = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
        if (x >= fx0 && x < fx1 && y >= fy0 && y < fy1) { fs += L; fn++; samples.push(L); } else { os += L; on++; }
      }
    }
    const focal = fs / Math.max(1, fn); const field = os / Math.max(1, on);
    samples.sort((a, b) => a - b);
    const p90 = samples.length ? samples[Math.floor(samples.length * 0.9)] : 0;
    return { field: +field.toFixed(1), focal: +focal.toFixed(1),
      ratio: +(focal / Math.max(1, field)).toFixed(2),
      p90ratio: +(p90 / Math.max(1, field)).toFixed(2) };
  }, { src: '/' + pngPath, f: rect });
}

async function moment(name, viewport, drive, focalSel) {
  const page = await H.newPage(browser, viewport, { dsr: 1 });
  try {
    await drive(page);
    await page.waitForTimeout(650);
    const png = `${SHOTS}/${name}.png`;
    await page.screenshot({ path: png });
    const overlaps = await page.evaluate(OVERLAP_FN);
    let lum = null;
    if (focalSel) lum = await lumOfShot(page, png, focalSel);
    report.push({ name, overlaps, lum });
  } catch (e) {
    report.push({ name, error: String(e).slice(0, 120) });
  }
  await page.context().close();
}

const th = async (p, save) => { await H.boot(p, save ? { save } : {}); };
const lid = async (p, n) => { await H.boot(p, { save: H.saveWithOpenedUpTo(n) }); await H.crossThreshold(p); };
const room = async (p, n) => { await lid(p, n); await H.enterLock(p, n); await H.answerDare(p); await p.waitForSelector('.lock-root canvas, .lock-root button', { timeout: 10000 }); };

for (const [vp, viewport] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  await moment(`v2-${vp}-threshold`, viewport, (p) => th(p), '.threshold-actions');
  await moment(`v2-${vp}-lid`, viewport, (p) => lid(p, 6), '.medallion-hit:not([disabled])');
  await moment(`v2-${vp}-journal`, viewport, async (p) => { await lid(p, 4); await p.locator('.journal-handle').click(); }, '.drawer');
  for (const n of [1, 4, 9, 12, 13]) {
    await moment(`v2-${vp}-L${String(n).padStart(2, '0')}`, viewport, (p) => room(p, n), '.lock-root > *:first-child');
  }
  await moment(`v2-${vp}-dare13`, viewport, async (p) => {
    await lid(p, 13); await H.enterLock(p, 13); await p.waitForSelector('.dare-card'); await p.waitForTimeout(2600);
  }, '.dare-portrait');
}
// es / ca spot rooms (galdr verse render + settings)
const langSave = (ord, lang) => JSON.stringify({
  opened: H.LOCK_IDS.slice(0, ord - 1), attempts: {}, hints: {}, journal: [],
  settings: { muted: true, reducedMotion: null, lang }, startedAt: new Date().toISOString(),
});
for (const [lang, ord] of [['es', 2], ['es', 12], ['ca', 2], ['ca', 15]]) {
  await moment(`v2-phone-${lang}-L${String(ord).padStart(2, '0')}`, H.PHONE, async (p) => {
    await H.boot(p, { save: langSave(ord, lang), hash: '' });
    await H.crossThreshold(p);
    await H.enterLock(p, ord);
    await H.answerDare(p);
    await p.waitForSelector('.lock-root canvas, .lock-root button', { timeout: 10000 });
  });
}
await moment('v2-desk-finale', H.DESKTOP, async (p) => {
  await H.boot(p, { save: JSON.stringify({ opened: H.LOCK_IDS.slice(), attempts: {}, hints: {}, journal: [], settings: { muted: true, reducedMotion: null }, startedAt: new Date().toISOString() }) });
  await H.crossThreshold(p);
  await p.waitForSelector('.screen-finale', { timeout: 8000 });
}, '.finale-reveal');

writeFileSync('artifacts/wip-magic/verify2.json', JSON.stringify(report, null, 1));
let bad = 0;
for (const r of report) {
  const o = r.overlaps ? r.overlaps.length : '-';
  const lum = r.lum ? `focal/field=${r.lum.ratio}x p90=${r.lum.p90ratio}x` : '';
  const objectScreen = /-L\d\d$|dare|finale/.test(r.name);
  const lumOk = !r.lum || (objectScreen ? r.lum.p90ratio >= 2.2 : r.lum.ratio >= 2.2);
  const flag = (r.overlaps && r.overlaps.length ? ' OVERLAP' : '') + (!lumOk ? ' DIM' : '') + (r.error ? ' ERR ' + r.error : '');
  if (flag) bad++;
  console.log(`${r.name.padEnd(22)} overlaps=${o} ${lum}${flag}`);
}
console.log(bad === 0 ? 'VERIFY2: GREEN' : `VERIFY2: ${bad} flagged`);
await browser.close();
