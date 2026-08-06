// OW-B15: prove the near-line reads on the metal — capture mid-refusal, not after.
import * as H from '../wip-qplay/harness.mjs';

async function cross(page) {
  await page.locator('.screen-threshold .btn-carved').first().click();
  for (let i = 0; i < 5; i++) {
    if (await page.locator('.screen-lid, .screen-finale').count()) return;
    const w = page.locator('.screen-threshold .wager-continue');
    const n = (await w.count()) ? w : page.locator('.screen-threshold .btn-carved');
    await n.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
}
const b = await H.launch();
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(b, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(15) });
  await cross(page);
  await H.enterLock(page, 15);
  await H.answerDare(page);
  await page.waitForTimeout(3900);
  const { ring, names } = await page.evaluate(() => {
    const inst = window.__OW.instanceOf('15-oathring');
    const chips = [...document.querySelectorAll('.ow15-chip')];
    const map = {};
    inst.shards.forEach((s, k) => {
      const m = /^Shard ([^,]+),/.exec(chips[k].getAttribute('aria-label') || '');
      if (m) map[s.rune] = m[1];
    });
    return { ring: window.__OW.answerOf('15-oathring').ring, names: map };
  });
  for (const [label, order] of [
    ['swap', (() => { const o = ring.slice(); const t = o[5]; o[5] = o[9]; o[9] = t; return o; })()],
    ['nail', ring.slice(1).concat(ring.slice(0, 1))],
  ]) {
    await page.getByRole('button', { name: 'Take the ring apart', exact: true }).click();
    for (let i = 0; i < order.length; i++) {
      await page.locator(`.ow15-chip[aria-label^="Shard ${names[order[i]]},"]`).click();
      await page.locator('.ow15-slot').nth(i).click();
    }
    await page.getByRole('button', { name: 'Close the ring', exact: true }).click();
    await page.waitForTimeout(260);
    await page.locator('.ow15-ring canvas').screenshot({ path: `artifacts/wip-b15/shots/refuse-${label}-${name}.png` });
    const said = await page.evaluate(() => (document.querySelector('.ow15-status') || {}).textContent);
    console.log(`${name} ${label}: "${said}"`);
  }
  console.log(`${name} console errors:`, page.__errors.slice(0, 2));
  await page.context().close();
}
await b.close();
