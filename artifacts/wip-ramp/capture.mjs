// OW-RAMP evidence run: drive the rebuilt lock 01 with real input at both
// framings, capture the board, and report the cold-read facts (tally, near
// line, latency, touch-target sizes, console cleanliness).
//
// Usage: node scripts/serve.mjs &  then  node artifacts/wip-ramp/capture.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.OW_BASE || 'http://127.0.0.1:8791';
const OUT = 'artifacts/wip-ramp/shots';
mkdirSync(OUT, { recursive: true });

const FRAMES = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'iphone', viewport: { width: 390, height: 844 }, mobile: true, hasTouch: true },
];

const log = (...a) => console.log(...a);

async function run(browser, frame) {
  const context = await browser.newContext({
    viewport: frame.viewport,
    hasTouch: !!frame.hasTouch,
    isMobile: !!frame.mobile,
    deviceScaleFactor: frame.mobile ? 3 : 2,
    reducedMotion: process.env.OW_CALM ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/\/(music|act2|act3|credits)\.mp3(\?|$)/.test(url)) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  const tag = process.env.OW_CALM ? `${frame.name}-calm` : frame.name;
  await page.goto(`${BASE}/#autotest`);
  await page.waitForFunction(() => typeof window.__OW === 'object' && !!window.__OW);
  await page.getByRole('button', { name: 'Lay hands on the chest', exact: true }).click();
  await page.locator('.screen-lid').waitFor();
  await page.locator('.medallion-hit[aria-label^="Lock 1:"]').click();
  await page.locator('.screen-lockroom').waitFor();

  const root = page.locator('.lock-root');
  const tiles = root.locator('.ow1-tile');
  await tiles.first().waitFor();

  // 1 — the cold board, mid-showing (the ghost demo beat is running)
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/01-cold-${tag}.png` });
  const demoVisible = await root.locator('.ow1-ghost').isVisible();

  // 1b — the cold-read audit shot: every word on the screen hidden, so what is
  // left is only what the board itself says (docs: artifacts/wip-ramp/cold-read.md)
  await page.evaluate(() => {
    const hide = document.querySelectorAll('.lock-root p, .lock-epigraph, .lock-title, .lockroom-footer, .ledger-numeral');
    for (const el of hide) el.style.visibility = 'hidden';
  });
  await page.screenshot({ path: `${OUT}/01b-wordless-${tag}.png` });
  await page.evaluate(() => {
    const hide = document.querySelectorAll('.lock-root p, .lock-epigraph, .lock-title, .lockroom-footer, .ledger-numeral');
    for (const el of hide) el.style.visibility = '';
  });

  // touch-target and layout facts
  const boxes = [];
  for (let i = 0; i < 6; i++) boxes.push(await tiles.nth(i).boundingBox());
  const minW = Math.min(...boxes.map((b) => b.width));
  const minH = Math.min(...boxes.map((b) => b.height));
  const scrollX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const railLabel = await root.locator('canvas[role="img"]').getAttribute('aria-label');

  // 2 — the first drag a cold player would try: take the leftmost stray to its gap
  const { answer } = await page.evaluate(() => ({ answer: window.__OW.answerOf('01-runerow') }));
  const order = [0, 1, 2, 3, 4, 5];
  const drag = async (targetId, pos) => {
    const cur = order.indexOf(targetId, pos);
    if (cur === pos) return 0;
    const src = await tiles.nth(cur).boundingBox();
    const dst = await tiles.nth(pos).boundingBox();
    const t0 = Date.now();
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
    await page.mouse.down();
    await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2);
    await page.mouse.up();
    const dt = Date.now() - t0;
    const [id] = order.splice(cur, 1);
    order.splice(pos, 0, id);
    return dt;
  };

  // the first move a cold player would make: the leftmost stave that is not
  // already home. This is the beat that has to teach the rule by doing.
  let firstPos = 0;
  while (firstPos < 6 && order[firstPos] === answer.order[firstPos]) firstPos++;
  const tallyBefore = await root.locator('p').filter({ hasText: /stand true|s.aguanten|se sostienen/ }).first().textContent();
  const firstDrag = await drag(answer.order[firstPos], firstPos);
  await page.screenshot({ path: `${OUT}/02-first-drag-${tag}.png` });
  const tallyAfterOne = await root.locator('p').filter({ hasText: /stand true|s.aguanten|se sostienen/ }).first().textContent();
  const statusAfterOne = await root.locator('p[aria-live="polite"]').first().textContent();

  // 3 — a wrong setting: the whole ætt in order but the mirror left unturned
  for (let pos = 0; pos < 6; pos++) await drag(answer.order[pos], pos);
  await page.screenshot({ path: `${OUT}/03-ordered-mirror-left-${tag}.png` });
  const tallyBeforeFlip = await root.locator('p').filter({ hasText: /stand true|s.aguanten|se sostienen/ }).first().textContent();
  await root.getByRole('button', { name: 'Set the ætt', exact: true }).click();
  await page.waitForTimeout(200);
  const nearLine = await page.locator('.near-line').textContent();
  await page.screenshot({ path: `${OUT}/04-near-${tag}.png` });

  // 4 — turn the mirrored stave (a stationary tap) and set the ætt
  const flipAt = answer.flips.indexOf(true);
  const t1 = Date.now();
  await tiles.nth(flipAt).click();
  const flipMs = Date.now() - t1;
  const tallyFull = await root.locator('p').filter({ hasText: /stand true|s.aguanten|se sostienen/ }).first().textContent();
  await page.screenshot({ path: `${OUT}/05-all-true-${tag}.png` });
  await root.getByRole('button', { name: 'Set the ætt', exact: true }).click();
  await page.waitForTimeout(900);
  const opened = await page.evaluate(() => window.__OW.save.opened.includes('01-runerow'));
  await page.screenshot({ path: `${OUT}/06-solved-${tag}.png` });

  log(`\n== ${tag} ==`);
  log(`  demo beat visible on entry : ${demoVisible}`);
  log(`  tile box (min)             : ${minW.toFixed(1)} x ${minH.toFixed(1)} px`);
  log(`  horizontal scroll          : ${scrollX}`);
  log(`  first drag round trip      : ${firstDrag} ms (place ${firstPos})`);
  log(`  tap-to-turn round trip     : ${flipMs} ms`);
  log(`  tally on entry             : ${JSON.stringify(tallyBefore)}`);
  log(`  tally after one drag       : ${JSON.stringify(tallyAfterOne)}`);
  log(`  status after one drag      : ${JSON.stringify(statusAfterOne)}`);
  log(`  tally, ordered, unturned   : ${JSON.stringify(tallyBeforeFlip)}`);
  log(`  near line at that setting  : ${JSON.stringify(nearLine)}`);
  log(`  tally after the turn       : ${JSON.stringify(tallyFull)}`);
  log(`  lock opened                : ${opened}`);
  log(`  rail aria-label            : ${JSON.stringify(railLabel)}`);
  log(`  console errors             : ${errors.length ? errors.join(' | ') : 'none'}`);

  await context.close();
  return { tag, opened, errors: errors.length, minW, minH, scrollX };
}

const browser = await chromium.launch();
const results = [];
for (const f of FRAMES) results.push(await run(browser, f));
await browser.close();
const bad = results.filter((r) => !r.opened || r.errors || r.scrollX || r.minW < 44 || r.minH < 44);
log(`\nshots in ${OUT}`);
if (bad.length) { console.error('FAIL', bad); process.exit(1); }
log('RAMP CAPTURE GREEN');
