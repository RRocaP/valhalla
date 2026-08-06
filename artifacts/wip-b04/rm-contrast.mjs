// OW-B04: (a) the showing under prefers-reduced-motion holds still and stays
// legible, (b) measured contrast of every text style over the pixels actually
// behind it (ART.md floor: >=4.5 body, >=3 display).
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const lum = ([r, g, b]) => {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const browser = await H.launch();
const out = [];
for (const [name, rm] of [['motion', 'no-preference'], ['calm', 'reduce']]) {
  const page = await H.newPage(browser, H.DESKTOP, { reducedMotion: rm });
  await H.boot(page, { save: H.saveWithOpenedUpTo(4) });
  await page.locator('.screen-threshold button').first().click();
  const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
  if (await wager.count()) await wager.first().click().catch(() => {});
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 4);
  await H.answerDare(page);
  await page.waitForTimeout(700);

  // (a) the showing: is it up, and does it move?
  const boxAt = () => page.evaluate(() => {
    const g = document.querySelector('.ow4-ghost');
    if (!g || g.style.display === 'none') return null;
    const r = g.getBoundingClientRect();
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), on: true };
  });
  const a = await boxAt();
  await page.waitForTimeout(700);
  const b = await boxAt();
  const moved = a && b ? Math.abs(a.y - b.y) > 1.5 || Math.abs(a.x - b.x) > 1.5 : false;
  await page.screenshot({ path: `artifacts/wip-b04/shots/rm-${name}.png` });

  // (b) contrast: sample the painted pixel under each text run's own box
  const contrast = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const pick = [
      ['plank name', root.querySelector('.ow4-plank > span')],
      ['tally-board line', root.querySelector('.ow4-say .ow4-line')],
      ['tally-board rivets', root.querySelector('.ow4-say .ow4-line + span')],
      ['sheer/keel label', root.querySelector('.ow4-end')],
      ['tally text', [...root.querySelectorAll('p')].find((e) => /joints lie fair/.test(e.textContent))],
      ['law', [...root.querySelectorAll('p')].find((e) => /^Lap law/.test(e.textContent))],
      ['help', [...root.querySelectorAll('p')].find((e) => /^Drag a plank/.test(e.textContent))],
    ];
    const parse = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
    return pick.filter(([, e]) => e).map(([label, e]) => {
      const r = e.getBoundingClientRect();
      const fg = parse(getComputedStyle(e).color);
      // the painted board behind this text: read the nearest ancestor canvas
      let host = e.closest('.ow4-plank, .ow4-say') || root;
      const cv = host.querySelector('canvas');
      let bg = null;
      if (cv) {
        const cr = cv.getBoundingClientRect();
        const sx = Math.round(((r.left + 6 - cr.left) / cr.width) * cv.width);
        const sy = Math.round(((r.top + r.height / 2 - cr.top) / cr.height) * cv.height);
        try {
          const d = cv.getContext('2d').getImageData(Math.max(0, sx), Math.max(0, sy), 1, 1).data;
          if (d[3] > 8) bg = [d[0], d[1], d[2]];
        } catch (err) { bg = null; }
      }
      return { label, fg, bg, size: getComputedStyle(e).fontSize };
    });
  });
  for (const c of contrast) {
    c.ratio = c.bg ? +ratio(c.fg, c.bg).toFixed(2) : null;
  }
  out.push({ vp: name, showing: { up: !!a, moved }, contrast, errors: page.__errors.slice() });
  await page.context().close();
}
await browser.close();
writeFileSync('artifacts/wip-b04/rm-contrast.json', JSON.stringify(out, null, 1));
let bad = 0;
for (const r of out) {
  console.log(`${r.vp}: showing up=${r.showing.up} moved=${r.showing.moved} errors=${r.errors.length}`);
  for (const c of r.contrast) {
    const floor = /label|law|help|tally text/.test(c.label) ? 4.5 : 4.5;
    const ok = c.ratio == null ? '(no painted bg sampled)' : (c.ratio >= floor ? 'OK' : 'BELOW');
    if (c.ratio != null && c.ratio < floor) bad++;
    console.log(`   ${c.label.padEnd(20)} ${String(c.size).padEnd(7)} ratio=${c.ratio} ${ok}`);
  }
}
console.log(out[0].showing.moved && !out[1].showing.moved ? 'MOTION LAW: drifts with motion, holds still under reduce' : 'MOTION LAW: CHECK');
console.log(bad === 0 ? 'CONTRAST: all sampled runs >= 4.5' : `CONTRAST: ${bad} below floor`);
