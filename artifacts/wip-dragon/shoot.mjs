// WIP capture: node artifacts/wip-dragon/shoot.mjs <out.png>:<selector> ...
// Serves nothing itself — expects scripts/serve.mjs on 127.0.0.1:8791.
import { chromium } from '@playwright/test';

const jobs = process.argv.slice(2).map((a) => {
  const i = a.lastIndexOf(':');
  return { out: a.slice(0, i), sel: a.slice(i + 1) };
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto('http://127.0.0.1:8791/artifacts/wip-dragon/preview.html', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 30000 });

for (const { out, sel } of jobs) {
  const el = await page.$(sel);
  if (!el) { console.log(`MISS ${sel}`); continue; }
  await el.screenshot({ path: out });
  console.log(`wrote ${out}  <- ${sel}`);
}
console.log('measure:\n' + (await page.textContent('#measure')));
console.log(errs.length ? `CONSOLE ERRORS:\n${errs.join('\n')}` : 'console: clean');
await browser.close();
