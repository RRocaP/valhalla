// OW-RAMP: solve lock 01 with the keyboard alone, then prove the board unmounts
// clean. Real key events only — no programmatic bypass of ctx.submit.
import { chromium } from 'playwright-core';

const BASE = process.env.OW_BASE || 'http://127.0.0.1:8791';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const url = (m.location() && m.location().url) || '';
  if (/\/(music|act2|act3|credits)\.mp3(\?|$)/.test(url)) return;
  errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${BASE}/#autotest`);
await page.waitForFunction(() => typeof window.__OW === 'object' && !!window.__OW);
await page.getByRole('button', { name: 'Lay hands on the chest', exact: true }).click();
await page.locator('.medallion-hit[aria-label^="Lock 1:"]').click();
await page.locator('.screen-lockroom').waitFor();

const root = page.locator('.lock-root');
const tiles = root.locator('.ow1-tile');
await tiles.first().waitFor();
const { answer } = await page.evaluate(() => ({ answer: window.__OW.answerOf('01-runerow') }));

const order = [0, 1, 2, 3, 4, 5];
let presses = 0;
for (let pos = 0; pos < 6; pos++) {
  const cur = order.indexOf(answer.order[pos], pos);
  if (cur === pos) continue;
  await tiles.nth(cur).focus();
  await page.keyboard.press(' '); presses++;                       // lift
  for (let k = 0; k < cur - pos; k++) { await page.keyboard.press('ArrowLeft'); presses++; }
  await page.keyboard.press(' '); presses++;                       // set down
  const [id] = order.splice(cur, 1);
  order.splice(pos, 0, id);
}
for (let k = 0; k < 6; k++) {
  if (!answer.flips[k]) continue;
  await tiles.nth(k).focus();
  await page.keyboard.press('f'); presses++;
}
const tally = await root.locator('p').filter({ hasText: /stand true/ }).first().textContent();
const focusedIsTile = await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('ow1-tile'));
await root.getByRole('button', { name: 'Set the ætt', exact: true }).press('Enter');
await page.waitForTimeout(900);
const state = await page.evaluate(() => ({
  opened: window.__OW.save.opened.includes('01-runerow'),
  keysNote: window.__OW.save.journal.some((l) => l.includes('By key: arrows walk the six')),
  lawNote: window.__OW.save.journal.some((l) => l.includes('The rail carries the whole row')),
}));

// leave and come back three times: the board must not leave anything behind
let leaked = 0;
for (let k = 0; k < 3; k++) {
  await page.getByRole('button', { name: 'Close the lock', exact: true }).click();
  await page.locator('.screen-lid').waitFor();
  leaked += await page.locator('.ow1-tile').count();
  await page.locator('.medallion-hit[aria-label^="Lock 1:"]').click();
  await page.locator('.screen-lockroom').waitFor();
  await tiles.first().waitFor();
}
await page.getByRole('button', { name: 'Close the lock', exact: true }).click();
await page.locator('.screen-lid').waitFor();
await page.waitForTimeout(500);
leaked += await page.locator('.ow1-tile').count();

console.log(`key presses to solve      : ${presses}`);
console.log(`tally before the setting  : ${JSON.stringify(tally)}`);
console.log(`focus stayed on a stave   : ${focusedIsTile}`);
console.log(`opened by Enter on submit : ${state.opened}`);
console.log(`journal has the key note  : ${state.keysNote}`);
console.log(`journal has the law note  : ${state.lawNote}`);
console.log(`tiles left after unmount  : ${leaked}`);
console.log(`console errors            : ${errors.length ? errors.join(' | ') : 'none'}`);

await browser.close();
const ok = state.opened && state.keysNote && state.lawNote && leaked === 0 && !errors.length && focusedIsTile;
console.log(ok ? 'RAMP KEYBOARD + UNMOUNT GREEN' : 'FAIL');
process.exit(ok ? 0 : 1);
