// A11y floors on the real build: pointer-free journey, focus visibility,
// contrast over the real painted background, reduced motion.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = ([r, g, b]) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

const browser = await H.launch();
const report = {};

// ---------- 1. pointer-free journey, threshold -> lid -> locks 1,2,3 ----------
{
  const page = await H.newPage(browser, H.DESKTOP);
  await H.boot(page, { save: H.saveWithOpenedUpTo(1) });
  const steps = [];
  const focus = () => page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { tag: 'BODY' };
    const cs = getComputedStyle(a);
    return {
      tag: a.tagName, cls: a.className,
      label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
      ring: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
    };
  });
  const tabTo = async (pred, max = 40) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      const f = await focus();
      if (pred(f)) return f;
    }
    return null;
  };
  const t1 = await tabTo((f) => /Lay hands|Continue/.test(f.label));
  steps.push(['threshold button reached by Tab', !!t1, t1]);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.screen-lid', { timeout: 5000 });
  steps.push(['Enter crosses the threshold', true, null]);

  for (const ord of [1, 2, 3]) {
    const f = await tabTo((x) => (x.label || '').startsWith(`Lock ${ord}:`), 60);
    steps.push([`lid: medallion ${ord} reachable by Tab`, !!f, f]);
    if (!f) continue;
    if (ord < 3) continue; // 1 and 2 are already open in this save; walk on to the duel
    await page.keyboard.press('Enter');
    await page.waitForSelector('.screen-lockroom', { timeout: 5000 });
    const df = await focus();
    steps.push(['dare card: Answer the dare auto-focused', /Answer the dare/.test(df.label), df]);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    steps.push(['Enter answers the dare', await page.locator('.dare-card').count() === 0, null]);
    // solve lock 3 with the keyboard only
    const target = (await page.evaluate(() => window.__OW.answerOf('03-beacons'))).night;
    const dial = await tabTo((x) => (x.cls || '').includes('ow3-dial'), 20);
    steps.push(['lock 3 dial reachable by Tab, focus ring', !!dial, dial]);
    for (let g = 0; g < 500; g++) {
      const cur = Number(await page.locator('.ow3-dial').getAttribute('aria-valuenow'));
      if (cur === target) break;
      const d = target - cur;
      await page.keyboard.press(Math.abs(d) >= 10 ? (d > 0 ? 'ArrowUp' : 'ArrowDown') : (d > 0 ? 'ArrowRight' : 'ArrowLeft'));
    }
    const act = await tabTo((x) => (x.cls || '').includes('ow3-act'), 12);
    steps.push(['lock 3 submit reachable by Tab, focus ring', !!act, act]);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.ceremony-overlay', { timeout: 6000 });
    steps.push(['pointer-free solve reaches the yield beat', true,
      { line: await page.locator('.ceremony-line').textContent() }]);
    await page.waitForTimeout(2600);
    steps.push(['ceremony resolves back to the lid', await page.locator('.screen-lid').count() > 0, null]);
  }
  report.keyboardJourney = steps;
  await page.context().close();
}

// ---------- 2. focus ring on every control of locks 06..15 ----------
{
  const page = await H.newPage(browser, H.DESKTOP);
  const rows = [];
  for (let ord = 6; ord <= 15; ord++) {
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const root = document.querySelector('.lock-root');
      const els = [...root.querySelectorAll('button,[tabindex]:not([tabindex="-1"]),[role="option"],[role="slider"],[role="application"]')];
      let noRing = 0, notFocusable = 0;
      for (const e of els) {
        e.focus();
        if (document.activeElement !== e) { notFocusable++; continue; }
        const cs = getComputedStyle(e, null);
        const ok = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
          || cs.boxShadow !== 'none';
        if (!ok) noRing++;
      }
      return { n: els.length, notFocusable, noRing };
    });
    rows.push({ ord, ...r });
  }
  report.focusRings = rows;
  await page.context().close();
}

// ---------- 3. contrast over the real painted background ----------
{
  const page = await H.newPage(browser, H.DESKTOP);
  const out = [];
  for (const [ord, sels] of [
    [6, ['.lock-title', '.lock-epigraph', '.ow-jotun .law', '.ow-jotun .send', '.ow-jotun .slate button', '.near-line', '.hint-slot']],
    [9, ['.ow-sunstone .law', '.ow-sunstone .bearing', '.ow-sunstone .stone .name', '.ow-sunstone .send']],
    [15, ['.ow15-act', '.ow15-slot', '.ow15-val', '.ow15-hasp + p, .ow15-ring + p']],
  ]) {
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord, { attempts: { [H.LOCK_IDS[ord - 1]]: 3 } }) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(400);
    for (const sel of sels) {
      const m = await page.evaluate((s) => {
        const e = document.querySelector(s);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        const cs = getComputedStyle(e);
        // sample the real painted pixel behind the text from the screen canvas
        const cvs = [...document.querySelectorAll('canvas.lockroom-canvas')];
        let bg = null;
        if (cvs.length) {
          const c = cvs[0];
          const sx = Math.round((r.left + r.width / 2) * (c.width / c.getBoundingClientRect().width));
          const sy = Math.round((r.top + 4) * (c.height / c.getBoundingClientRect().height));
          try { const d = c.getContext('2d').getImageData(sx, sy, 1, 1).data; bg = [d[0], d[1], d[2]]; } catch (e2) {}
        }
        const own = cs.backgroundColor.match(/[\d.]+/g);
        const ownOpaque = own && own.length >= 3 && (own.length < 4 || Number(own[3]) > 0.85)
          ? [Number(own[0]), Number(own[1]), Number(own[2])] : null;
        const fg = cs.color.match(/[\d.]+/g).slice(0, 3).map(Number);
        return { sel: s, fg, bg: ownOpaque || bg, size: parseFloat(cs.fontSize), weight: cs.fontWeight, ownBg: !!ownOpaque };
      }, sel);
      if (!m || !m.bg) { out.push({ ord, sel, skipped: true }); continue; }
      out.push({ ord, ...m, ratio: +ratio(m.fg, m.bg).toFixed(2) });
    }
  }
  report.contrast = out;
  await page.context().close();
}

// ---------- 4. reduced motion ----------
{
  const page = await H.newPage(browser, H.DESKTOP, { reducedMotion: 'reduce' });
  await H.boot(page, { save: H.saveWithOpenedUpTo(15) });
  await H.crossThreshold(page);
  const rm = {};
  rm.appClass = await page.evaluate(() => document.getElementById('app').className);
  await H.enterLock(page, 15);
  await page.waitForTimeout(300);
  rm.dare = await page.evaluate(() => {
    const c = document.querySelector('.dare-card');
    return c ? { name: c.querySelector('.dare-name').textContent, taunt: c.querySelector('.dare-taunt').textContent.length, anim: getComputedStyle(c).animationName } : null;
  });
  await H.shot(page, 'rm-dare');
  await page.locator('.dare-card .btn-carved').click();
  await page.waitForTimeout(250);
  const ring = (await page.evaluate(() => window.__OW.answerOf('15-oathring'))).ring;
  const F14 = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚱ', 'ᚴ', 'ᚼ', 'ᚾ', 'ᛁ', 'ᛅ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛘ', 'ᛚ'];
  const labels = await page.locator('.ow15-chip').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const byRune = Object.fromEntries(F14.map((ch, k) => [ch, labels[k]]));
  for (let i = 0; i < 14; i++) {
    await page.locator(`.ow15-chip[aria-label="${byRune[ring[i]]}"]`).click();
    await page.locator('.ow15-slot').nth(i).click();
  }
  const t0 = Date.now();
  await page.locator('button', { hasText: 'Close the ring' }).click();
  await page.waitForSelector('.ceremony-overlay', { timeout: 6000 });
  rm.yield = { ms: Date.now() - t0, line: await page.locator('.ceremony-line').textContent() };
  await H.shot(page, 'rm-yield');
  await page.waitForSelector('.screen-finale', { timeout: 10000 });
  rm.finale = await page.evaluate(() => (document.querySelector('.screen-finale')?.innerText || '').slice(0, 200));
  await H.shot(page, 'rm-finale');
  // advance the finale to the credits
  rm.finaleSteps = [];
  for (let i = 0; i < 14 && !(await page.locator('.credits-scroll').count()); i++) {
    const horns = page.locator('.screen-finale button', { hasText: /horns/i });
    if (await horns.count() && await horns.first().isVisible()) { await horns.first().click(); }
    else { await page.keyboard.press('Enter'); }
    await page.waitForTimeout(800);
    rm.finaleSteps.push((await page.evaluate(() => (document.querySelector('.screen-finale')?.innerText || '').replace(/\n/g, ' | ').slice(0, 80))) || '(gone)');
  }
  rm.credits = await page.evaluate(() => {
    const c = document.querySelector('.credits-scroll');
    if (!c) return null;
    const st = [...document.querySelectorAll('.credits-scroll canvas, .credits-sticker')];
    return { textLen: c.innerText.length, head: c.innerText.slice(0, 90).replace(/\n/g, ' | '), stickers: st.length, anim: getComputedStyle(c).animationName };
  });
  await H.shot(page, 'rm-credits');
  report.reducedMotion = rm;
  report.rmErrors = page.__errors;
  await page.context().close();
}

writeFileSync('artifacts/wip-qplay/a11y.json', JSON.stringify(report, null, 1));
console.log('=== pointer-free journey ===');
for (const [what, ok, det] of report.keyboardJourney) console.log(` ${ok ? 'PASS' : 'FAIL'}  ${what}${det ? '  ' + JSON.stringify(det) : ''}`);
console.log('\n=== focus rings (locks 06..15) ===');
for (const r of report.focusRings) console.log(` lock ${String(r.ord).padStart(2)}  controls ${String(r.n).padStart(3)}  not-focusable ${r.notFocusable}  no-ring ${r.noRing}`);
console.log('\n=== contrast ===');
for (const c of report.contrast) {
  if (c.skipped) { console.log(` lock ${c.ord}  ${c.sel}  (not present)`); continue; }
  const floor = c.size >= 24 || (c.size >= 18.66 && Number(c.weight) >= 700) ? 3 : 4.5;
  console.log(` lock ${String(c.ord).padStart(2)}  ${c.sel.padEnd(30)} ${String(c.ratio).padStart(6)}:1  floor ${floor}  ${c.ratio >= floor ? 'PASS' : 'FAIL'}   ${c.size}px ${c.ownBg ? '(own bg)' : '(painted wood)'}`);
}
console.log('\n=== reduced motion ===');
console.log(JSON.stringify(report.reducedMotion, null, 1));
await browser.close();
