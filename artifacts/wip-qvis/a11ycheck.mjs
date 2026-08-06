// Deterministic re-check of the floors my presentation changes could move:
// horizontal overflow at 390px, medallion touch targets, and measured contrast
// of every carved/DOM text style against the wood actually painted behind it.
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const out = {};
for (const [tag, vp] of [['desktop', { width: 1280, height: 800 }], ['iphone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.addInitScript(() => localStorage.setItem('oathwood.v1', JSON.stringify({
    opened: ['01-runerow','02-bismer'], attempts: {}, hints: {}, journal: [],
    settings: { muted: true, reducedMotion: null }, startedAt: '2026-01-01T00:00:00.000Z' })));
  await p.goto('http://127.0.0.1:8791/#autotest');
  await p.getByRole('button', { name: /Lay hands|Continue/ }).first().click();
  await p.waitForSelector('.screen-lid');
  await p.waitForTimeout(400);
  const overflowLid = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const targets = await p.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width + 0.5 < 44 || r.height + 0.5 < 44) bad.push(`${el.getAttribute('aria-label') || el.textContent.trim().slice(0,24)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
    }
    return bad;
  });
  await p.locator('.medallion-hit[aria-label^="Lock 3:"]').click();
  await p.waitForSelector('.screen-lockroom');
  await p.waitForTimeout(300);
  const overflowLock = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  // contrast of text styles over the canvas actually behind them
  const contrast = await p.evaluate(() => {
    const lum = ({r,g,b}) => { const c=v=>{const s=v/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);};
      return 0.2126*c(r)+0.7152*c(g)+0.0722*c(b); };
    const parse = s => { const m=s.match(/rgba?\(([^)]+)\)/); if(!m) return null;
      const a=m[1].split(',').map(Number); return {r:a[0],g:a[1],b:a[2]}; };
    const out = {};
    for (const sel of ['.dare-name','.dare-taunt','.lock-epigraph','.ledger-numeral','.btn-quiet','.continue-hint','.hint-slot']) {
      const el = document.querySelector(sel); if (!el) continue;
      const rect = el.getBoundingClientRect(); if (!rect.width) continue;
      const canvas = document.querySelector('.screen canvas'); if (!canvas) continue;
      const cr = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      const sx = canvas.width/cr.width, sy = canvas.height/cr.height;
      const bx=Math.max(0,Math.round((rect.left-cr.left)*sx)), by=Math.max(0,Math.round((rect.top-cr.top)*sy));
      const bw=Math.max(1,Math.min(canvas.width-bx,Math.round(rect.width*sx)));
      const bh=Math.max(1,Math.min(canvas.height-by,Math.round(rect.height*sy)));
      const d = ctx.getImageData(bx,by,bw,bh).data;
      let r=0,g=0,bl=0,n=0; for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];bl+=d[i+2];n++;}
      const bg={r:r/n,g:g/n,b:bl/n};
      const fg=parse(getComputedStyle(el).color); if(!fg) continue;
      const L1=Math.max(lum(fg),lum(bg)), L2=Math.min(lum(fg),lum(bg));
      out[sel]=Number(((L1+0.05)/(L2+0.05)).toFixed(2));
    }
    return out;
  });
  out[tag] = { overflowLid, overflowLock, undersizedTargets: targets, contrast, pageErrors: errs };
  await p.close();
}
console.log(JSON.stringify(out, null, 2));
await b.close();
