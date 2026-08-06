// Follow-up floors for OW-CARDLIGHT: vertical fit of the taller dare card,
// the reduced-motion dare (which must land on FULL exposure with no warm-up
// to wait through), and the shard ceremony's adoption of drawRune opts.magic.
//   node artifacts/wip-cardlight/checks.mjs
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

mkdirSync('artifacts/wip-cardlight/shots', { recursive: true });
const browser = await H.launch();
let bad = 0;

for (const vp of [H.PHONE, H.DESKTOP]) {
  const name = vp.width < 500 ? 'phone' : 'desktop';
  for (const reduced of [false, true]) {
    const ctx = await browser.newContext({
      viewport: vp, deviceScaleFactor: 2,
      reducedMotion: reduced ? 'reduce' : 'no-preference',
      hasTouch: vp.width < 500, isMobile: vp.width < 500,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.__errors = errors;
    await H.boot(page, { save: H.saveWithOpenedUpTo(1) });
    await H.crossThreshold(page);
    await H.enterLock(page, 1);
    await page.waitForSelector('.dare-card canvas.dare-portrait');
    await page.waitForTimeout(reduced ? 350 : 2400);
    const m = await page.evaluate(() => {
      const btn = document.querySelector('.dare-card .btn-carved').getBoundingClientRect();
      const cv = document.querySelector('.dare-portrait');
      const cs = getComputedStyle(cv);
      return {
        scrollH: document.documentElement.scrollHeight,
        innerH: innerHeight,
        btnBottom: +btn.bottom.toFixed(1),
        btnW: +btn.width.toFixed(1), btnH: +btn.height.toFixed(1),
        portraitFilter: cs.filter,
        cardBottomGap: +(innerHeight - btn.bottom).toFixed(1),
      };
    });
    const tag = `${name}${reduced ? '-reduced' : ''}`;
    await page.screenshot({ path: `artifacts/wip-cardlight/shots/chk-dare-${tag}.png` });
    const overflow = m.scrollH > m.innerH + 1;
    const clipped = m.btnBottom > m.innerH;
    const dim = reduced && m.portraitFilter !== 'none';
    const small = m.btnW < 44 || m.btnH < 44;
    console.log(
      `${tag.padEnd(17)} scrollH=${m.scrollH}/${m.innerH} btnBottom=${m.btnBottom} `
      + `gap=${m.cardBottomGap} btn=${m.btnW}x${m.btnH} filter=${m.portraitFilter}`
      + `${overflow ? '  OVERFLOW' : ''}${clipped ? '  BUTTON CLIPPED' : ''}`
      + `${dim ? '  REDUCED-MOTION NOT AT FULL EXPOSURE' : ''}${small ? '  TARGET <44' : ''}`
    );
    if (clipped || dim || small) bad++;
    if (errors.length) { console.log('   errors:', errors.slice(0, 3)); bad++; }
    await ctx.close();
  }
}

// ---- shard ceremony: does the rune take opts.magic? ----------------------
{
  const page = await H.newPage(browser, H.PHONE);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await H.boot(page, { save: H.saveWithOpenedUpTo(2) });
  await H.crossThreshold(page);
  await H.enterLock(page, 2);
  await H.answerDare(page);
  const answer = await page.evaluate(() => window.__OW.answerOf('02-bismer'));
  await page.locator('[role="radio"].ow2-pouch').nth(answer.pouch).click();
  await page.getByRole('button', { name: 'Name the pouch', exact: true }).click();
  await page.waitForSelector('.ceremony-shard .shard-rune', { timeout: 8000 });
  await page.waitForTimeout(1150);            // past the strike, magic at full
  const rune = await page.evaluate(() => {
    const cv = document.querySelector('.shard-rune');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let ink = 0, cool = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 12) continue;
      ink++;
      if (d[i + 2] > d[i] + 8) cool++;        // blue-dominant = arcane core
    }
    return { ink, cool };
  });
  const magicLive = rune.cool > 0;
  console.log(`shard rune        ink=${rune.ink} arcaneCoolPx=${rune.cool} `
    + `-> drawRune opts.magic ${magicLive ? 'ADOPTED (rendering)' : 'not visible'}`);
  if (!rune.ink) { console.log('   shard rune drew nothing'); bad++; }
  if (errors.length) { console.log('   errors:', errors.slice(0, 3)); bad++; }
  await page.context().close();
}

await browser.close();
console.log(bad === 0 ? 'CARDLIGHT CHECKS: GREEN' : `CARDLIGHT CHECKS: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
