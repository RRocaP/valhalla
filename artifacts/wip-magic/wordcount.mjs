// Post-purge word audit: visible words per lock room on entry (en, desk+phone).
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const AUDIT = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0;
  };
  const words = { header: 0, board: 0, footer: 0 };
  const texts = [];
  const walk = (el) => {
    for (const child of el.children) walk(child);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
    if (own && vis(el)) {
      const w = own.split(/\s+/).filter(Boolean).length;
      if (el.closest('.lockroom-header')) words.header += w;
      else if (el.closest('.lock-root')) { words.board += w; texts.push(own.slice(0, 44)); }
      else if (el.closest('.lockroom-footer')) words.footer += w;
    }
  };
  walk(document.querySelector('.screen-lockroom'));
  return { words, texts };
};

const browser = await H.launch();
const rows = [];
for (const [vp, viewport] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  for (let ord = 1; ord <= 15; ord++) {
    const page = await H.newPage(browser, viewport);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForSelector('.lock-root canvas, .lock-root button', { timeout: 10000 });
    await page.waitForTimeout(500);
    const a = await page.evaluate(AUDIT);
    rows.push({ vp, ord, ...a.words, boardTexts: a.texts });
    await page.context().close();
  }
}
writeFileSync('artifacts/wip-magic/wordcount.json', JSON.stringify(rows, null, 1));
for (const r of rows.filter((x) => x.vp === 'desk')) {
  console.log(`L${String(r.ord).padStart(2, '0')} header=${String(r.header).padStart(2)} board=${String(r.board).padStart(3)} footer=${r.footer}  [${r.boardTexts.join(' | ').slice(0, 90)}]`);
}
await browser.close();
