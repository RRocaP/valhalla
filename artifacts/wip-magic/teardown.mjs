// OW-MAGIC teardown walker: capture every moment of the game at both
// viewports (en + es), audit visible words + text overlaps deterministically.
// Real build, real input, no source edits.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';
import { drivers } from '../../tests/e2e/helpers.mjs';

const browser = await H.launch();
const SHOTS = 'artifacts/wip-magic/shots';
const audit = [];

// Visible-text audit, run inside the page. Returns word counts per region,
// text-leaf overlap pairs (rects intersecting >3px both axes, non-kin),
// and right-edge clipping.
const AUDIT_FN = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    // visually-hidden pattern: 1px clip
    if (r.width <= 1.5 && r.height <= 1.5) return false;
    return true;
  };
  const leaves = [];
  const walk = (el) => {
    for (const child of el.children) walk(child);
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent).join(' ').trim();
    if (ownText && vis(el)) leaves.push({ el, text: ownText });
  };
  walk(document.getElementById('app'));
  const words = (t) => t.split(/\s+/).filter(Boolean).length;
  const inSel = (el, sel) => !!el.closest(sel);
  const buckets = { header: 0, board: 0, footer: 0, other: 0, total: 0 };
  const lines = [];
  for (const { el, text } of leaves) {
    const w = words(text);
    buckets.total += w;
    if (inSel(el, '.lockroom-header')) buckets.header += w;
    else if (inSel(el, '.lock-root')) buckets.board += w;
    else if (inSel(el, '.lockroom-footer')) buckets.footer += w;
    else buckets.other += w;
    lines.push({ text: text.slice(0, 80), w, cls: el.className && String(el.className).slice(0, 40) });
  }
  // overlap pairs among text leaves + interactive controls
  const boxes = leaves.map(({ el, text }) => ({ el, text, r: el.getBoundingClientRect() }));
  document.querySelectorAll('#app button, #app [role="slider"]').forEach((el) => {
    if (vis(el) && !boxes.some((b) => b.el === el)) {
      boxes.push({ el, text: '[ctl] ' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), r: el.getBoundingClientRect() });
    }
  });
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 3 && oy > 3) {
        overlaps.push({ a: a.text.slice(0, 50), b: b.text.slice(0, 50), ox: +ox.toFixed(0), oy: +oy.toFixed(0) });
      }
    }
  }
  const clipped = boxes.filter((b) => b.r.right > innerWidth + 2 || b.r.left < -2)
    .map((b) => b.text.slice(0, 50));
  const scroller = document.body.scrollHeight > document.body.clientHeight + 1
    ? document.body : document.documentElement;
  return {
    buckets,
    overlaps,
    clipped,
    scrollNeed: Math.max(0, scroller.scrollHeight - innerHeight),
    lines,
  };
};

async function shotAudit(page, name, extra = {}) {
  await page.waitForTimeout(extra.settle ?? 550);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  const a = await page.evaluate(AUDIT_FN);
  audit.push({ name, ...extra.meta, words: a.buckets, overlaps: a.overlaps, clipped: a.clipped, scrollNeed: a.scrollNeed });
  return a;
}

const VPS = [['desk', H.DESKTOP], ['phone', H.PHONE]];

// ---- EN full walk ----------------------------------------------------------
for (const [vp, viewport] of VPS) {
  // threshold + wager + fresh lid + overlays
  let page = await H.newPage(browser, viewport);
  await H.boot(page, {});
  await shotAudit(page, `en-${vp}-01-threshold`);
  await page.locator('.screen-threshold button').first().click();
  try {
    await page.locator('.wager-card').waitFor({ timeout: 2500 });
    await shotAudit(page, `en-${vp}-02-wager`);
    await page.locator('.wager-card button').click();
  } catch { /* no wager */ }
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await shotAudit(page, `en-${vp}-03-lid-fresh`);
  await page.locator('.journal-handle').click();
  await shotAudit(page, `en-${vp}-04-journal`);
  await page.keyboard.press('Escape');
  await page.locator('.settings-nail').click();
  await shotAudit(page, `en-${vp}-05-settings`);
  await page.context().close();

  // mid + late lid
  page = await H.newPage(browser, viewport);
  await H.boot(page, { save: H.saveWithOpenedUpTo(8) });
  await H.crossThreshold(page);
  await shotAudit(page, `en-${vp}-06-lid-mid`);
  await page.context().close();

  // every lock room on entry (+ dare cards where the gauntlet opens)
  for (let ord = 1; ord <= 15; ord++) {
    page = await H.newPage(browser, viewport);
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    const nn = String(ord).padStart(2, '0');
    const dare = page.locator('.dare-card');
    if (await dare.count()) {
      await shotAudit(page, `en-${vp}-L${nn}-dare`);
      await page.locator('.dare-card .btn-carved').click();
      await page.waitForSelector('.dare-card', { state: 'detached', timeout: 5000 });
    }
    await page.waitForSelector('.lock-root canvas, .lock-root button', { timeout: 10000 });
    await shotAudit(page, `en-${vp}-L${nn}-board`, { meta: { room: nn } });
    await page.context().close();
  }
}

// ---- EN solve moments (desktop): ceremony, yield, finale, credits ----------
{
  const page = await H.newPage(browser, H.DESKTOP);
  await H.boot(page, { save: H.saveWithOpenedUpTo(3) });
  await H.crossThreshold(page);
  await H.enterLock(page, 3);
  const { answer, instance } = await page.evaluate(() => ({
    answer: window.__OW.answerOf('03-beacons'),
    instance: window.__OW.instanceOf('03-beacons'),
  }));
  await drivers['03-beacons'](page, page.locator('.lock-root'), answer, instance);
  await page.waitForSelector('.ceremony-overlay', { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/en-desk-L03-yieldbeat.png` });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${SHOTS}/en-desk-L03-ceremony.png` });
  await page.context().close();
}
{
  // finale + credits via a full save
  const page = await H.newPage(browser, H.DESKTOP);
  await H.boot(page, { save: JSON.stringify({
    opened: H.LOCK_IDS.slice(), attempts: {}, hints: {}, journal: [],
    settings: { muted: true, reducedMotion: null }, startedAt: new Date().toISOString(),
  }) });
  await H.crossThreshold(page);
  await page.waitForSelector('.screen-finale', { timeout: 8000 });
  await shotAudit(page, 'en-desk-90-finale');
  const credits = page.getByRole('button', { name: 'Raise the horns', exact: true });
  if (await credits.count()) {
    await credits.click();
    await page.waitForSelector('.screen-credits', { timeout: 8000 });
    await shotAudit(page, 'en-desk-91-credits', { settle: 1200 });
  }
  await page.context().close();
}

// ---- ES / CA spot walk ------------------------------------------------------
const esSave = (ord, lang) => JSON.stringify({
  opened: H.LOCK_IDS.slice(0, ord - 1), attempts: {}, hints: {}, journal: [],
  settings: { muted: true, reducedMotion: null, lang }, startedAt: new Date().toISOString(),
});
for (const [vp, viewport] of VPS) {
  for (const lang of ['es', 'ca']) {
    for (const ord of lang === 'es' ? [1, 2, 4, 11, 12] : [2, 12]) {
      const page = await H.newPage(browser, viewport);
      await H.boot(page, { save: esSave(ord, lang), hash: '' });
      await H.crossThreshold(page);
      await H.enterLock(page, ord);
      const nn = String(ord).padStart(2, '0');
      const dare = page.locator('.dare-card');
      if (await dare.count()) {
        await shotAudit(page, `${lang}-${vp}-L${nn}-dare`);
        await page.locator('.dare-card .btn-carved').click();
        await page.waitForSelector('.dare-card', { state: 'detached', timeout: 5000 });
      }
      await page.waitForSelector('.lock-root canvas, .lock-root button', { timeout: 10000 });
      await shotAudit(page, `${lang}-${vp}-L${nn}-board`);
      await page.context().close();
    }
  }
  // es threshold + lid + settings
  const page = await H.newPage(browser, viewport);
  await H.boot(page, { save: esSave(1, 'es'), hash: '' });
  await shotAudit(page, `es-${vp}-01-threshold`);
  await H.crossThreshold(page);
  await shotAudit(page, `es-${vp}-03-lid`);
  await page.locator('.settings-nail').click();
  await shotAudit(page, `es-${vp}-05-settings`);
  await page.context().close();
}

writeFileSync('artifacts/wip-magic/teardown-audit.json', JSON.stringify(audit, null, 1));
// summary to stdout: overlaps + clipped + word budgets
let bad = 0;
for (const row of audit) {
  const flag = (row.overlaps.length ? ' OVERLAPS=' + row.overlaps.length : '')
    + (row.clipped.length ? ' CLIPPED=' + row.clipped.length : '');
  if (flag) bad++;
  console.log(`${row.name.padEnd(26)} words[h/b/f/o]=${row.words.header}/${row.words.board}/${row.words.footer}/${row.words.other} scroll=${row.scrollNeed}${flag}`);
}
console.log(`\n${bad} screen(s) with overlap/clipping — details in teardown-audit.json`);
await browser.close();
process.exit(0);
