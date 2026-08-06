// OW-B11 beat capture: the two moments the board has to teach by itself —
// the moon-dial turning mid-showing (with the sounds cut for the other tide
// closing), and a real committed road with its knots tied in the cord.
// Usage: node artifacts/wip-b11/beats.mjs <tag> [desk|phone]
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'beat';
const which = process.argv[3] || 'desk';
const DIR = 'artifacts/wip-b11/shots';
mkdirSync(DIR, { recursive: true });
const vp = which === 'phone' ? H.PHONE : H.DESKTOP;

async function cross(page) {
  await page.locator('.screen-threshold button').first().click();
  const w = page.locator('.wager-continue');
  if (await w.count() && await w.first().isVisible()) await w.first().click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const page = await H.newPage(browser, vp);
await H.boot(page, { save: H.saveWithOpenedUpTo(11) });
await cross(page);
await H.enterLock(page, 11);
await H.answerDare(page);

const chart = page.locator('.lock-root canvas').first();
const shot = (n) => chart.screenshot({ path: `${DIR}/${tag}-${n}-${which}.png` });

// the showing: before the turn, and after it
await page.waitForTimeout(1150);
await shot('01-showing-ebb');
await page.waitForTimeout(1250);
await shot('02-showing-flood');
await page.waitForTimeout(1200);          // showing ends, board resets to ebb

// now sail it for real, one leg at a time, reading the dial each time
// answer + instance come straight from the shell test hook


const data = await page.evaluate(() => ({
  answer: window.__OW.answerOf('11-skerry'),
  instance: window.__OW.instanceOf('11-skerry'),
}));
const legText = async (i) => {
  const name = data.instance.nodes[data.answer.route[i]].name;
  const re = new RegExp(`(Row to|Haul over to) ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`);
  await page.locator('.ow11-leg').filter({ hasText: re }).click();
};
for (let i = 1; i <= Math.min(4, data.answer.route.length - 1); i++) {
  await legText(i);
  await page.waitForTimeout(i === 1 ? 220 : 520);
  if (i === 1) await shot('03-leg1-turning');
  if (i === 2) await shot('04-leg2-flood-closed');
}
await page.waitForTimeout(600);
await shot('05-knots-on-the-cord');
console.log('tide pill:', await page.locator('.ow11-tide').innerText());
console.log('knots:', await page.locator('.ow11-knots').innerText());
console.log('errors:', page.__errors.length, JSON.stringify(page.__errors.slice(0, 3)));

// and the whole road, sealed
for (let i = 5; i < data.answer.route.length; i++) await legText(i);
await page.getByRole('button', { name: 'Seal the route', exact: true }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${DIR}/${tag}-06-sealed-${which}.png` });
console.log('solved:', await page.evaluate(() => (window.__OW.save.opened || []).includes('11-skerry')));
await browser.close();
