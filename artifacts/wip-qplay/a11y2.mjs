// Corrections: (1) the journey must start from a save where locks 1-3 are all
// reachable (a sealed medallion is correctly not tabbable); (2) focus rings
// must be judged under REAL Tab focus - element.focus() from script does not
// set :focus-visible in Chromium, so the first pass measured nothing.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';
const browser = await H.launch();
const report = {};

{
  const page = await H.newPage(browser, H.DESKTOP);
  await H.boot(page, { save: H.saveWithOpenedUpTo(3) });     // 1 and 2 open, 3 armed
  const steps = [];
  const focus = () => page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { tag: 'BODY' };
    const cs = getComputedStyle(a);
    return { tag: a.tagName, cls: String(a.className).slice(0, 30),
      label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 44),
      fv: a.matches(':focus-visible'),
      ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? `${cs.outlineWidth} ${cs.outlineColor}` : 'none' };
  });
  const tabTo = async (pred, max = 60) => {
    for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const f = await focus(); if (pred(f)) return f; }
    return null;
  };
  const t = await tabTo((f) => /Lay hands|Continue/.test(f.label));
  steps.push(['threshold reached + ring', !!t && t.ring !== 'none', t]);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.screen-lid');
  for (const ord of [1, 2, 3]) {
    const f = await tabTo((x) => (x.label || '').startsWith(`Lock ${ord}:`), 60);
    steps.push([`lid: medallion ${ord} tabbable + ring`, !!f && f.ring !== 'none', f]);
  }
  // walk into the duel at 3 and finish it with no pointer at all
  await page.keyboard.press('Enter');
  await page.waitForSelector('.screen-lockroom');
  const df = await focus();
  steps.push(['dare auto-focus on Answer the dare', /Answer the dare/.test(df.label), df]);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  steps.push(['Enter answers the dare', await page.locator('.dare-card').count() === 0, null]);
  const target = (await page.evaluate(() => window.__OW.answerOf('03-beacons'))).night;
  const dial = await tabTo((x) => (x.cls || '').includes('ow3-dial'), 25);
  steps.push(['dial tabbable + ring', !!dial && dial.ring !== 'none', dial]);
  for (let g = 0; g < 600; g++) {
    const cur = Number(await page.locator('.ow3-dial').getAttribute('aria-valuenow'));
    if (cur === target) break;
    const d = target - cur;
    await page.keyboard.press(Math.abs(d) >= 10 ? (d > 0 ? 'ArrowUp' : 'ArrowDown') : (d > 0 ? 'ArrowRight' : 'ArrowLeft'));
  }
  steps.push(['dial driven to the answer by arrows only', true, { night: target }]);
  const act = await tabTo((x) => (x.cls || '').includes('ow3-act'), 15);
  steps.push(['submit tabbable + ring', !!act && act.ring !== 'none', act]);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.ceremony-overlay', { timeout: 6000 });
  steps.push(['pointer-free solve reaches the yield', true, { line: await page.locator('.ceremony-line').textContent() }]);
  await page.waitForTimeout(2800);
  steps.push(['ceremony returns to the lid', await page.locator('.screen-lid').count() > 0, null]);
  const f4 = await tabTo((x) => (x.label || '').startsWith('Lock 4:'), 60);
  steps.push(['next lock armed and tabbable', !!f4, f4]);
  report.journey = steps;
  await page.context().close();
}

{
  const page = await H.newPage(browser, H.DESKTOP);
  const rows = [];
  for (let ord = 6; ord <= 15; ord++) {
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(350);
    const total = await page.evaluate(() => document.querySelectorAll('.lock-root button,.lock-root [tabindex]:not([tabindex="-1"]),.lock-root [role="option"],.lock-root [role="slider"],.lock-root [role="application"]').length);
    // tab from the top of the lock body and record what real focus looks like
    await page.evaluate(() => document.querySelector('.lock-root').focus());
    const seen = new Set(); let noRing = 0; let inBody = 0;
    for (let i = 0; i < total + 6; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || !document.querySelector('.lock-root').contains(a)) return null;
        const cs = getComputedStyle(a);
        return { k: (a.className || '') + '|' + (a.getAttribute('aria-label') || a.textContent || '').slice(0, 20),
          fv: a.matches(':focus-visible'),
          ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' };
      });
      if (!f) continue;
      inBody++;
      if (!seen.has(f.k)) { seen.add(f.k); if (!f.ring) noRing++; }
    }
    rows.push({ ord, controls: total, tabReached: seen.size, tabStops: inBody, noRing });
  }
  report.focusRings = rows;
  await page.context().close();
}

writeFileSync('artifacts/wip-qplay/a11y2.json', JSON.stringify(report, null, 1));
console.log('=== pointer-free journey: lid -> lock 1..3, duel at 3, solved by keyboard ===');
for (const [w, ok, d] of report.journey) console.log(` ${ok ? 'PASS' : 'FAIL'}  ${w}${d ? '  ' + JSON.stringify(d) : ''}`);
console.log('\n=== focus rings under real Tab focus ===');
console.log(' lock  controls  reachedByTab  tabStops  without-a-ring');
for (const r of report.focusRings) console.log(`  ${String(r.ord).padStart(3)}   ${String(r.controls).padStart(6)}   ${String(r.tabReached).padStart(10)}  ${String(r.tabStops).padStart(8)}   ${r.noRing}`);
await browser.close();
