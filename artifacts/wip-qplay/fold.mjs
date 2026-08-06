// Correction to the containment pass: body IS the scroller (html is not), so
// off-viewport content is reachable by wheel. The question that actually
// matters: when the player is looking at the submit control, can they see the
// near-line the shudder just wrote?
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';
const ACTION = {
  6:'Read the manifest',7:'Swear the road',8:'Swear the accusation',9:'Swear the bearing',
  10:'Speak the verse',11:'Seal the route',12:'Swear the seating',13:'Give the verdict',
  14:'Name the bound runes',15:'Close the ring' };
const browser = await H.launch();
const rows=[];
for (const vp of [H.DESKTOP, H.PHONE]) {
  for (let ord=6; ord<=15; ord++) {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord, { attempts:{[H.LOCK_IDS[ord-1]]:10} }) });
    await H.crossThreshold(page); await H.enterLock(page, ord); await H.answerDare(page);
    await page.waitForTimeout(400);
    const m = await page.evaluate((label) => {
      const vh = innerHeight;
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
      if (btn) btn.scrollIntoView({ block: 'nearest' });
      const vis = (sel) => { const e=document.querySelector(sel); if(!e) return null;
        const r=e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= vh; };
      const sc = document.scrollingElement || document.body;
      return { scrollRange: Math.max(document.body.scrollHeight, sc.scrollHeight) - vh,
        actionFound: !!btn,
        actionVisible: btn ? (()=>{const r=btn.getBoundingClientRect(); return r.top>=0&&r.bottom<=vh;})() : null,
        nearVisibleWithAction: vis('.near-line'), hintsVisibleWithAction: vis('.hint-horn'),
        titleVisibleWithAction: vis('.lock-title') };
    }, ACTION[ord]);
    rows.push({ vp:`${vp.width}x${vp.height}`, ord, ...m });
    await page.context().close();
  }
}
writeFileSync('artifacts/wip-qplay/fold.json', JSON.stringify(rows,null,1));
console.log('vp        lock scrollRange action nearWithAction hintsWithAction titleWithAction');
for(const r of rows) console.log(`${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}  ${String(r.scrollRange).padStart(6)}   ${String(r.actionVisible).padEnd(5)}  ${String(r.nearVisibleWithAction).padEnd(6)}        ${String(r.hintsVisibleWithAction).padEnd(6)}          ${r.titleVisibleWithAction}`);
await browser.close();
