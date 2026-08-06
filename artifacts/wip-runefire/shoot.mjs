// WIP capture: node artifacts/wip-runefire/shoot.mjs <suffix>
// Expects scripts/serve.mjs on 127.0.0.1:8791. Captures the preview board
// (frozen t for determinism) at dSF2 + prints the measure block.
import { chromium } from '@playwright/test';

const suffix = process.argv[2] || 'v1';
const DIR = 'artifacts/wip-runefire';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1560, height: 1200 }, deviceScaleFactor: 2 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));

// t=2600 lands mid-breath with wisps visibly mid-lick (not at a zero crossing)
await page.goto('http://127.0.0.1:8791/artifacts/wip-runefire/preview.html?t=2600', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 30000 });

const shots = [
  ['sec-oak', `${DIR}/board-oak-${suffix}.png`],
  ['sec-tar', `${DIR}/board-tar-${suffix}.png`],
  ['sec-sizes', `${DIR}/sizes-${suffix}.png`],
  ['sec-reduced', `${DIR}/reduced-${suffix}.png`],
  ['sec-wordmark', `${DIR}/wordmark-${suffix}.png`],
];
for (const [id, out] of shots) {
  const el = await page.$(`#${id}`);
  if (!el) { console.log(`MISS #${id}`); continue; }
  await el.screenshot({ path: out });
  console.log(`wrote ${out}`);
}
console.log('measure:\n' + (await page.textContent('#measure')));

// live-mode sanity: let the rAF loop run, re-measure perf while animating
await page.goto('http://127.0.0.1:8791/artifacts/wip-runefire/preview.html', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 30000 });
await page.waitForTimeout(900);
console.log('live measure:\n' + (await page.textContent('#measure')));

console.log(errs.length ? `CONSOLE ERRORS:\n${errs.join('\n')}` : 'console: clean');
await browser.close();
