// OW-B02 state captures: the showing (ghost hand), reduced-motion diagram,
// hover weight-feel, named + struck staging, and the near-miss mark.
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'states';

async function open(browser, vp, reducedMotion) {
  const page = await H.newPage(browser, vp, { reducedMotion });
  await H.boot(page, { save: H.saveWithOpenedUpTo(2) });
  await page.locator('.threshold-actions button').first().click();
  const w = page.locator('.wager-layer .wager-continue');
  if (await w.isVisible().catch(() => false)) await w.click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 2);
  await H.answerDare(page);
  return page;
}

const browser = await H.launch();
const shot = (page, name) => page.locator('.lock-root').screenshot({ path: `artifacts/wip-b02/shots/${tag}-${name}.png` });

// 1. the showing, caught mid-lift
let page = await open(browser, H.DESKTOP, 'no-preference');
await page.waitForTimeout(1100);
await shot(page, 'showing');
console.log('showing: skip button visible =', await page.locator('button:text-is("Skip the showing")').isVisible());
await page.waitForTimeout(2600);
console.log('showing ended: skip hidden =', !(await page.locator('button:text-is("Skip the showing")').isVisible()));

// 2. hover weight-feel + named + struck
await page.locator('[role="radio"].ow2-pouch').nth(4).hover();
await page.waitForTimeout(320);
await shot(page, 'hover');
await page.locator('[role="radio"].ow2-pouch').nth(4).click();
await page.waitForTimeout(360);
await page.locator('[role="radio"].ow2-pouch').nth(1).focus();
await page.keyboard.press('x');
await page.locator('[role="radio"].ow2-pouch').nth(7).focus();
await page.keyboard.press('x');
await page.waitForTimeout(300);
await shot(page, 'named-struck');
console.log('named+struck:', await page.evaluate(() => ({
  checked: [...document.querySelectorAll('.ow2-pouch')].map((e) => e.getAttribute('aria-checked')).join(''),
  struck: [...document.querySelectorAll('.ow2-pouch')].map((e) => e.dataset.struck).join(''),
  submit: !document.querySelector('.lock-root .btn-carved').disabled,
})));

// 3. a wrong naming -> the weighing that clears it is marked
const truth = await page.evaluate(() => window.__OW.answerOf('02-bismer').pouch);
const wrong = (truth + 3) % 9;
await page.locator('[role="radio"].ow2-pouch').nth(wrong).click();
await page.locator('.lock-root').getByRole('button', { name: 'Name the pouch', exact: true }).click();
await page.waitForTimeout(700);
await shot(page, 'near');
console.log('near line:', await page.evaluate(() => document.querySelector('.lock-root p[aria-live]').textContent));

// 4. reckon toggle
await page.getByRole('button', { name: 'Reckon the labels in ertog', exact: true }).click();
await page.waitForTimeout(250);
await shot(page, 'ertog');
await page.context().close();

// 5. reduced motion: the still diagram
page = await open(browser, H.DESKTOP, 'reduce');
await page.waitForTimeout(1200);
await shot(page, 'reduced');
await page.context().close();

// 6. phone: the rack, scrolled into view
page = await open(browser, H.PHONE, 'no-preference');
await page.waitForTimeout(3400);
await page.locator('.ow2-grid').scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
await page.screenshot({ path: `artifacts/wip-b02/shots/${tag}-phone-rack.png` });
const sizes = await H.targetSizes(page, '.lock-root');
console.log('phone targets:', JSON.stringify(sizes.smallest.slice(0, 4)), 'under44 =', sizes.under44);
console.log('phone radio boxes:', await page.evaluate(() => {
  const r = [...document.querySelectorAll('.ow2-pouch')].map((e) => e.getBoundingClientRect());
  return { minW: Math.min(...r.map((b) => +b.width.toFixed(0))), minH: Math.min(...r.map((b) => +b.height.toFixed(0))) };
}));
await page.context().close();
await browser.close();
console.log('states captured');
