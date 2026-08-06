// Is every part of the played surface actually on screen? .screen has
// overflow:hidden and nothing scrolls, so anything outside the viewport is
// unreachable — not merely awkward.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const browser = await H.launch();
const rows = [];
for (const vp of [H.DESKTOP, H.PHONE]) {
  for (let ord = 6; ord <= 15; ord++) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord, { attempts: { [H.LOCK_IDS[ord - 1]]: 10 } }) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const box = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), inView: r.top >= -1 && r.bottom <= vh + 1 };
      };
      const frame = document.querySelector('.lockroom-frame');
      const fr = frame.getBoundingClientRect();
      const root = document.querySelector('.lock-root');
      const rr = root.getBoundingClientRect();
      // every interactive control in the lock body
      const ctrls = [...root.querySelectorAll('button,[role="option"],[role="slider"],[role="application"],[tabindex]:not([tabindex="-1"])')];
      const offscreen = ctrls.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.height > 0 && (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw);
      });
      return {
        vw, vh,
        docScrollH: document.documentElement.scrollHeight,
        frameTop: Math.round(fr.top), frameBottom: Math.round(fr.bottom), frameH: Math.round(fr.height),
        rootH: Math.round(rr.height), rootScrollH: root.scrollHeight,
        header: box('.lockroom-header'),
        title: box('.lock-title'),
        nearLine: box('.near-line'),
        hintHorn: box('.hint-horn'),
        backBtn: box('.back-latch'),
        nCtrls: ctrls.length,
        offscreenCtrls: offscreen.length,
        offscreenSample: offscreen.slice(0, 4).map((e) => (e.textContent || e.getAttribute('aria-label') || e.className).trim().slice(0, 28)),
      };
    });
    rows.push({ vp: `${vp.width}x${vp.height}`, ord, ...m });
    await page.context().close();
  }
}
writeFileSync('artifacts/wip-qplay/containment.json', JSON.stringify(rows, null, 1));
console.log('vp        lock  frameH  rootH/scroll  header  near  hints  back  offscreenCtrls');
for (const r of rows) {
  const f = (b) => (b ? (b.inView ? ' in ' : 'OUT!') : ' -- ');
  console.log(
    `${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}  ${String(r.frameH).padStart(5)}  ${String(r.rootH).padStart(4)}/${String(r.rootScrollH).padEnd(5)} ` +
    ` ${f(r.header)}  ${f(r.nearLine)}  ${f(r.hintHorn)}  ${f(r.backBtn)}   ${r.offscreenCtrls}/${r.nCtrls} ${JSON.stringify(r.offscreenSample)}`
  );
}
await browser.close();
