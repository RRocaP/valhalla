import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = '/Users/ramon/oathwood';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(8797);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8797/index.html#autotest');

// fresh save; walk straight to lock 07 by marking 01..06 opened
await page.evaluate(() => {
  const locks = window.__OW.locks;
  const opened = locks.filter((l) => l.ordinal <= 6).map((l) => l.id);
  localStorage.setItem('oathwood.v1', JSON.stringify({
    opened, attempts: {}, hints: {}, journal: [], settings: { muted: true, reducedMotion: null }, startedAt: new Date().toISOString(),
  }));
});
await page.reload();
await page.getByRole('button', { name: /Continue|Lay hands/i }).first().click();
await page.getByRole("button", { name: /Lock 7:/ }).click();
// dare card? none at 7. wait lock root
await page.waitForSelector('.lock-root .ow-tafl', { timeout: 8000 });

const answer = await page.evaluate(() => window.__OW.answerOf('07-tafl'));
console.log('LINE:', JSON.stringify(answer.line));

const root = page.locator('.lock-root');
const canvas = root.locator('.board canvas');
const say = root.locator('.say');
const PAD = 8, SQ = 40;
for (const [from, to] of answer.line) {
  const pt = ([r, c]) => ({ x: PAD + c * SQ + SQ / 2, y: PAD + r * SQ + SQ / 2 });
  await canvas.click({ position: pt(from) });
  await page.waitForTimeout(80);
  console.log('after FROM click, say:', JSON.stringify(await say.textContent()));
  await canvas.click({ position: pt(to) });
  await page.waitForTimeout(700);
  console.log('after TO+700ms, say:', JSON.stringify(await say.textContent()));
}
await root.getByRole('button', { name: /Swear the road/i }).click();
await page.waitForTimeout(800);
console.log('ceremony visible:', await page.locator('.ceremony-overlay').count());
console.log('near line:', JSON.stringify(await root.locator('.tell, .near, .nearline').allTextContents().catch(() => [])));
const journal = await page.evaluate(() => (JSON.parse(localStorage.getItem('oathwood.v1')) || {}).journal?.slice(-6));
console.log('journal tail:', JSON.stringify(journal, null, 1).slice(0, 800));
await page.screenshot({ path: '/private/tmp/claude-501/-Users-ramon-project-andrea/55082f63-5576-4f00-b45f-c735baaab58c/scratchpad/probe07.png' });
await browser.close();
srv.close();
