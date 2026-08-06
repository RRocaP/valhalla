// OW-B15: the showing (ghost hand) — caught mid-flight, and its skip proven.
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
for (const [name, vp, rm] of [['desk', H.DESKTOP, 'no-preference'], ['phone', H.PHONE, 'no-preference'], ['calm', H.DESKTOP, 'reduce']]) {
  const page = await H.newPage(b, vp, { reducedMotion: rm });
  await H.boot(page, { save: H.saveWithOpenedUpTo(15) });
  await cross(page);
  await H.enterLock(page, 15);
  await H.answerDare(page);
  await page.waitForTimeout(1100);
  const mid = await page.evaluate(() => {
    const gh = document.querySelector('.ow15-ghost');
    const sk = [...document.querySelectorAll('.ow15-act')].find((b) => /Skip/.test(b.textContent));
    return {
      ghostShown: gh ? getComputedStyle(gh).display : 'missing',
      ghostTransform: gh ? gh.style.transform : null,
      skipVisible: sk ? getComputedStyle(sk).display !== 'none' : false,
      status: (document.querySelector('.ow15-status') || {}).textContent,
    };
  });
  await page.screenshot({ path: `artifacts/wip-b15/shots/showing-${name}.png` });
  await page.waitForTimeout(2600);
  const after = await page.evaluate(() => {
    const gh = document.querySelector('.ow15-ghost');
    const sk = [...document.querySelectorAll('.ow15-act')].find((b) => /Skip/.test(b.textContent));
    return { ghostShown: gh ? getComputedStyle(gh).display : 'missing', skipVisible: sk ? getComputedStyle(sk).display !== 'none' : false };
  });
  console.log(name, JSON.stringify({ mid, after }), 'errs', page.__errors.length);
  await page.context().close();
}
await b.close();
