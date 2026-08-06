import { chromium } from 'playwright-core';
import * as H from '../wip-qplay/harness.mjs';
const b = await chromium.launch({ headless: true });
const p = await H.newPage(b, H.PHONE);
await H.boot(p, { save: H.saveWithOpenedUpTo(2) });
await p.locator('.threshold-actions button').first().click();
const w = p.locator('.wager-layer .wager-continue');
if (await w.isVisible().catch(()=>false)) await w.click();
await p.waitForSelector('.screen-lid');
await H.enterLock(p, 2);
await H.answerDare(p);
await p.waitForTimeout(1200);
console.log(await p.evaluate(() => {
  const grid = document.querySelector('.ow2-grid');
  const out = { gridW: grid.getBoundingClientRect().width, cols: getComputedStyle(grid).gridTemplateColumns };
  out.cells = [...document.querySelectorAll('.ow2-pouch')].slice(0,4).map(e => {
    const t = e.querySelector('.ow2-tag');
    const r = e.getBoundingClientRect(), tr = t.getBoundingClientRect();
    return { btn: +r.width.toFixed(1), tag: +tr.width.toFixed(1), tagStyleW: t.style.width, txt: t.textContent, lines: +(tr.height).toFixed(0) };
  });
  out.wrapW = document.querySelector('.lock-root').firstElementChild.getBoundingClientRect().width;
  return out;
}));
await b.close();
