// OW-B05 comprehension gate: the showing, the gleam, and the tally, driven by
// real input at both viewports and under both motion settings.
//   node artifacts/wip-b05/teach.mjs <tag>
import { writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'teach';
const DIR = 'artifacts/wip-b05/shots';
mkdirSync(DIR, { recursive: true });

async function enter(browser, vp, extra = {}) {
  const page = await H.newPage(browser, vp, extra);
  // #autotest pins the shell to English (shell/index.js), so the copy runs boot without it
  await H.boot(page, { save: H.saveWithOpenedUpTo(5), hash: extra.lang ? '' : '#autotest' });
  if (extra.lang) {
    await page.evaluate((l) => {
      const s = JSON.parse(localStorage.getItem('oathwood.v1'));
      s.settings = { ...(s.settings || {}), lang: l };
      localStorage.setItem('oathwood.v1', JSON.stringify(s));
    }, extra.lang);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.screen');
  }
  await page.locator('.screen-threshold .btn-carved').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count()) await wager.first().click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 5);
  await H.answerDare(page);
  return page;
}

const read = (page) => page.evaluate(() => {
  const root = document.querySelector('.lock-root');
  const ps = [...root.querySelectorAll('p')].map((e) => e.textContent.trim()).filter(Boolean);
  const ghost = root.querySelector('.ow5-ghost');
  const live = [...root.querySelectorAll('[aria-live="polite"]')].map((e) => e.textContent.trim());
  return {
    plate: ps[0] || '',
    lines: ps.slice(1),
    status: live[0] || '',
    tally: live[1] || '',
    law: ps[ps.length - 1] || '',
    ghostShown: !!ghost && ghost.style.display !== 'none',
    skipShown: !![...root.querySelectorAll('button')].find((b) => b.style.display !== 'none' && /Skip|Saltar/.test(b.textContent)),
    submitText: (root.querySelector('.btn-carved') || {}).textContent || '',
  };
});

const rows = [];
const browser = await H.launch();

// 1. the showing, mid-flight, both viewports
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await enter(browser, vp);
  await page.waitForTimeout(900);
  const during = await read(page);
  await page.locator('.lock-root').screenshot({ path: `${DIR}/${tag}-${name}-showing.png` });
  await page.waitForTimeout(3200);
  const after = await read(page);

  // 2. a real turn, caught mid-gleam
  const free = await page.evaluate(() => window.__OW.instanceOf('05-knotwork').free);
  await page.locator('.ow5-cell').nth(free[3]).click();
  await page.waitForTimeout(260);
  await page.locator('.lock-root').screenshot({ path: `${DIR}/${tag}-${name}-gleam.png` });
  const gleaming = await read(page);

  // 2b. frame cost while the gleam runs (QUALITY.md: no frame > 32ms)
  const frames = await page.evaluate((cell) => new Promise((res) => {
    document.querySelectorAll('.ow5-cell')[cell].click();
    const t = [];
    let last = 0;
    const step = (now) => {
      if (last) t.push(now - last);
      last = now;
      if (t.length < 45) requestAnimationFrame(step);
      else { document.querySelectorAll('.ow5-cell')[cell].click(); res(t); } // put the turn back
    };
    requestAnimationFrame(step);
  }), free[3]);
  await page.waitForTimeout(1400);
  frames.sort((a, b) => a - b);
  const frameStats = {
    median: +frames[frames.length >> 1].toFixed(1),
    p95: +frames[Math.floor(frames.length * 0.95)].toFixed(1),
    max: +frames[frames.length - 1].toFixed(1),
    over32: frames.filter((v) => v > 32).length,
  };

  // 3. solve it by hand and watch the tally fall to one band
  const st = await page.evaluate(() => {
    const i = window.__OW.instanceOf('05-knotwork');
    return { free: i.free, initial: i.initial, answer: window.__OW.answerOf('05-knotwork').states };
  });
  const tallies = [];
  for (let k = 0; k < st.free.length; k++) {
    const want = st.answer[k];
    const now = k === 3 ? !st.initial[k] : st.initial[k];
    if (now === want) continue;
    await page.locator('.ow5-cell').nth(st.free[k]).click();
    await page.waitForTimeout(60);
    tallies.push((await read(page)).tally);
  }
  const solved = await read(page);
  await page.locator('.lock-root').screenshot({ path: `${DIR}/${tag}-${name}-oneband.png` });
  await page.locator('.ow5-actions .btn-carved').click();
  await page.waitForTimeout(700);
  const bound = await page.evaluate(() => !!document.querySelector('.screen-ceremony, .ceremony, .shard-award')
    || (window.__OW.save.opened || []).includes('05-knotwork'));

  rows.push({
    vp: name,
    showingGhost: during.ghostShown,
    showingSkip: during.skipShown,
    showingEnded: !after.ghostShown && !after.skipShown,
    plate: during.plate,
    gleamLine: gleaming.status,
    frameStats,
    tallyTrail: tallies.slice(-5),
    finalTally: solved.tally,
    boundOk: bound,
    errors: page.__errors.slice(),
  });
  await page.context().close();
}

// 4. reduced motion: the same lesson, held still
{
  const page = await enter(browser, H.DESKTOP, { reducedMotion: 'reduce' });
  await page.waitForTimeout(900);
  const during = await read(page);
  await page.locator('.lock-root').screenshot({ path: `${DIR}/${tag}-desk-reduced.png` });
  rows.push({ vp: 'desk/reduced', showingGhost: during.ghostShown, showingSkip: during.skipShown, errors: page.__errors.slice() });
  await page.context().close();
}

// 5. es + ca copy, on the board
for (const lang of ['es', 'ca']) {
  const page = await enter(browser, H.DESKTOP, { lang });
  await page.waitForTimeout(4200);
  const t = await read(page);
  await page.locator('.lock-root').screenshot({ path: `${DIR}/${tag}-desk-${lang}.png` });
  await page.locator('.ow5-cell').nth(0).click();
  await page.waitForTimeout(200);
  const after = await read(page);
  rows.push({ vp: `desk/${lang}`, plate: t.plate, tally: t.tally, law: t.law, submitText: t.submitText, afterClick: after.status, errors: page.__errors.slice() });
  await page.context().close();
}

await browser.close();
writeFileSync(`${DIR}/${tag}.json`, JSON.stringify(rows, null, 1));

let bad = 0;
for (const r of rows) {
  console.log(`--- ${r.vp}`);
  for (const [k, v] of Object.entries(r)) {
    if (k === 'vp') continue;
    console.log(`    ${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`);
  }
  if (r.errors && r.errors.length) bad++;
  if (r.vp === 'desk' || r.vp === 'phone') {
    if (!r.showingGhost || !r.showingSkip || !r.showingEnded || !r.boundOk) bad++;
    if (!/one band/i.test(r.finalTally)) bad++;
    if (r.frameStats && r.frameStats.over32 > 1) bad++;
  }
}
console.log(bad === 0 ? 'TEACH GATE: GREEN' : `TEACH GATE: ${bad} problem(s)`);
process.exit(bad === 0 ? 0 : 1);
