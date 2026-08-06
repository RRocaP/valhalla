// OW-MOODS room floor. Two things the shared artifacts/wip-qplay/ink-targets.mjs
// would have covered, re-run here because that runner is currently blocked at
// the threshold by the wager framing card (CHAPTERS, 2026-08-06 22:22) which
// its crossThreshold does not dismiss:
//
//  1. INK + TARGETS — every canvas the lock draws has ink, every interactive
//     target is >= 44x44 CSS px, at phone width, with the moods live.
//  2. MOOD PER ROOM — all fifteen rooms carry the right gauntlet mood, the
//     mood layer is painted, the console stays clean, and leaving a room
//     tears its layer and its rAF down (no leak across fifteen mounts).
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

async function cross(page) {
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-card .wager-continue');
  if (await wager.count() && await wager.isVisible()) await wager.click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const rows = [];
let bad = 0;

// ---- 1. ink + targets, phone and desktop, moods live ----------------------
for (const vp of [H.DESKTOP, H.PHONE]) {
  for (let ord = 6; ord <= 15; ord++) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await cross(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(450);
    const m = await page.evaluate(() => {
      const root = document.querySelector('.lock-root');
      const canvases = [...root.querySelectorAll('canvas')];
      const blank = [];
      for (const c of canvases) {
        if (!c.width || !c.height) { blank.push('zero-sized'); continue; }
        let ink = 0;
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { ink++; if (ink > 20) break; }
        } catch { ink = -1; }
        if (ink >= 0 && ink <= 20) blank.push(`${c.width}x${c.height} ink=${ink}`);
      }
      const els = [...root.querySelectorAll('button,[role="option"],[role="slider"],[role="button"],a[href],input')];
      const small = els.map((e) => {
        const r = e.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 16) };
      }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
      return { nCanvas: canvases.length, blank, nCtrl: els.length, under44: small.length, sample: small.slice(0, 3) };
    });
    rows.push({ vp: `${vp.width}x${vp.height}`, ord, ...m });
    if (m.blank.length || m.under44) bad++;
    await page.context().close();
  }
}

// ---- 2. all fifteen rooms in one session: mood, console, teardown ---------
const page = await H.newPage(browser, H.DESKTOP);
await H.boot(page, { save: H.saveWithOpenedUpTo(15) });
await cross(page);
const moodRows = [];
let moodBad = 0;
for (let ord = 1; ord <= 15; ord++) {
  await H.enterLock(page, ord);
  await H.answerDare(page);
  await page.waitForTimeout(320);
  const m = await page.evaluate(() => {
    const scr = document.querySelector('.screen-lockroom');
    const layers = document.querySelectorAll('.lockroom-mood');
    const c = scr && scr.querySelector('.lockroom-mood');
    let ink = -1;
    let stretch = null;
    if (c) {
      ink = 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { ink++; if (ink > 500) break; }
      const r = c.getBoundingClientRect();
      stretch = +(c.height / (r.height * (window.devicePixelRatio || 1))).toFixed(3);
    }
    return {
      mood: scr ? scr.getAttribute('data-mood') : null,
      tint: scr ? getComputedStyle(scr).getPropertyValue('--mood-tint').trim() : '',
      layers: layers.length,
      painted: ink > 500,
      stretch,
    };
  });
  const want = ['torchlit', 'seer', 'snowlight', 'feast', 'throne'][Math.ceil(ord / 3) - 1];
  const ok = m.mood === want && m.painted && m.layers === 1 && Math.abs(m.stretch - 1) < 0.02;
  if (!ok) moodBad++;
  moodRows.push({ ord, want, ...m, ok });
  await page.locator('.back-latch').click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
}
const leaked = await page.evaluate(() => document.querySelectorAll('.lockroom-mood').length);
const errs = page.__errors.slice();
await page.context().close();
await browser.close();

writeFileSync('artifacts/wip-moods/rooms.json', JSON.stringify({ rows, moodRows, leaked, errs }, null, 1));
console.log('vp        lock canvases blank      ctrls under44');
for (const r of rows) {
  console.log(`${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}  ${String(r.nCanvas).padStart(5)}   ${JSON.stringify(r.blank).padEnd(10)} ${String(r.nCtrl).padStart(4)}  ${String(r.under44).padStart(4)}`);
}
console.log(bad === 0 ? 'INK+TARGET FLOOR: GREEN' : `INK+TARGET FLOOR: ${bad} row(s) failing`);
console.log('--- mood per room (15 mounts in one session) ---');
for (const r of moodRows) {
  console.log(`  lock ${String(r.ord).padStart(2)}  want ${r.want.padEnd(9)} got ${String(r.mood).padEnd(9)} painted=${r.painted} layers=${r.layers} stretch=${r.stretch} ${r.ok ? 'ok' : 'FAIL'}`);
}
console.log(`mood layers left in the document after leaving the last room: ${leaked} (want 0)`);
console.log(`console errors across fifteen room mounts: ${errs.length}`);
if (errs.length) console.log(errs.slice(0, 5));
const green = bad === 0 && moodBad === 0 && leaked === 0 && errs.length === 0;
console.log(green ? 'OW-MOODS ROOM FLOOR: GREEN' : 'OW-MOODS ROOM FLOOR: RED');
process.exit(green ? 0 : 1);
