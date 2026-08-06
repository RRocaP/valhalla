// A genuine wrong attempt per lock, driven through the real controls, and the
// hint ladder measured at 3 / 6 / 10 wrong attempts.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const RECIPES = {
  6: async (page) => {
    for (let i = 0; i < 4; i++) {
      await page.locator('.ow-jotun .rows .row').nth(i).click();
      await page.locator('.ow-jotun .slate button').nth(i).click();
    }
    return '.ow-jotun .send';
  },
  7: async (page) => {
    const box = await page.locator('.ow-tafl .board canvas').boundingBox();
    const SQ = box.width / 7.4; // 7*40 + 2*8 padding
    const cell = (r, c) => ({ x: box.x + (8 + c * 40 + 20) * (box.width / 296), y: box.y + (8 + r * 40 + 20) * (box.height / 296) });
    // lift the king (f6 -> r=1,c=5), then take any offered target
    let k = cell(1, 5);
    await page.mouse.click(k.x, k.y);
    await page.waitForTimeout(120);
    // sweep the row/column for an accepted target: try g6 then f7
    for (const t of [[1, 6], [0, 5], [2, 5], [1, 4]]) {
      const p = cell(t[0], t[1]);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(350);
      if (!(await page.locator('.ow-tafl .send').isDisabled())) break;
      await page.mouse.click(k.x, k.y);
      await page.waitForTimeout(120);
    }
    return '.ow-tafl .send';
  },
  8: async (page) => {
    await page.locator('.ow-hacksilver .dial').nth(0).locator('button').nth(0).click();
    await page.locator('.ow-hacksilver .dial').nth(1).locator('button').nth(0).click();
    return '.ow-hacksilver .send';
  },
  9: async (page) => {
    await page.locator('.ow-sunstone .stone').nth(0).locator('button').nth(0).click();
    await page.locator('.ow-sunstone .stone').nth(0).locator('button.wet').click();
    return '.ow-sunstone .send';
  },
  10: async (page) => {
    for (let i = 0; i < 8; i++) {
      await page.locator('.ow-drott .tray .frag').nth(0).click();  // take from the tray, not from a filled slot
      await page.locator('.ow-drott .slot').nth(i).click();
    }
    return '.ow-drott .send';
  },
  11: async (page) => {
    await page.locator('.ow11-leg').first().click();
    return '.ow11-act:has-text("Seal the route")';
  },
  12: async (page) => {
    for (let i = 0; i < 8; i++) {
      await page.locator('.ow12-chip:not([disabled])').nth(0).click();
      await page.locator('.ow12-seat').nth(i).click();
    }
    await page.locator('.ow12-boast').nth(0).click();
    return 'button:has-text("Swear the seating")';
  },
  13: async (page) => {
    for (let i = 0; i < 9; i++) await page.locator('.ow13-brand').nth(i).click();
    await page.locator('.ow13-culprit').nth(0).click();
    return 'button:has-text("Give the verdict")';
  },
  14: async (page) => {
    await page.locator('.ow14-cand, button[aria-pressed]').nth(0).click();
    await page.locator('.ow14-cand, button[aria-pressed]').nth(1).click();
    return 'button:has-text("Name the bound runes")';
  },
  15: async (page) => {
    for (let i = 0; i < 14; i++) {
      await page.locator('.ow15-chip:not([disabled])').nth(0).click();
      await page.locator('.ow15-slot').nth(i).click();
    }
    return 'button:has-text("Close the ring")';
  },
};

const ORDS = process.argv[2] ? process.argv[2].split(',').map(Number) : Object.keys(RECIPES).map(Number);
const browser = await H.launch();
const results = [];

for (const ord of ORDS) {
  const id = H.LOCK_IDS[ord - 1];
  const rec = { ord, id };
  for (const preload of [0, 9]) {
    const page = await H.newPage(browser, H.DESKTOP);
    const attempts = preload ? { [id]: preload } : {};
    await H.boot(page, { save: H.saveWithOpenedUpTo(ord, { attempts }) });
    await H.crossThreshold(page);
    await H.enterLock(page, ord);
    await H.answerDare(page);
    await page.waitForTimeout(350);
    try {
      const sendSel = await RECIPES[ord](page);
      const send = page.locator(sendSel).first();
      await send.waitFor({ timeout: 5000 });
      const disabled = await send.isDisabled();
      const t0 = Date.now();
      await send.click();
      // wait for the shell to answer
      await page.waitForFunction(
        () => (document.querySelector('.near-line')?.textContent || '').trim().length > 0
          || document.querySelector('.ceremony-overlay'),
        null, { timeout: 4000 }
      ).catch(() => {});
      const latency = Date.now() - t0;
      const after = await page.evaluate(() => ({
        near: (document.querySelector('.near-line')?.textContent || '').trim(),
        shudder: !!document.querySelector('.lockroom-frame.shudder'),
        dots: document.querySelectorAll('.attempts-dots .dot').length,
        hints: [...document.querySelectorAll('.hint-slot')].map((b) => b.dataset.state),
        solved: !!document.querySelector('.ceremony-overlay'),
        localStatus: (document.querySelector('.ow-lock [aria-live]')?.textContent || '').trim().slice(0, 120),
        localEcho: [...document.querySelectorAll('.lock-root [aria-live]')].map((e) => e.textContent.trim()).filter(Boolean),
        echoVisible: (() => {
          const cands = [...document.querySelectorAll('.lock-root [aria-live]')].filter((e) => e.textContent.trim());
          return cands.some((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
        })(),
      }));
      rec[`p${preload}`] = { sendWasDisabled: disabled, latency, ...after };
      if (preload === 9) {
        // take all three hints
        const slots = page.locator('.hint-slot');
        for (let k = 0; k < 3; k++) await slots.nth(k).click();
        await page.waitForTimeout(200);
        rec.hintText = await page.locator('.hint-text').innerText();
        await H.shot(page, `hints-${String(ord).padStart(2, '0')}`);
      } else {
        await H.shot(page, `wrong-${String(ord).padStart(2, '0')}`);
      }
    } catch (e) {
      rec[`p${preload}`] = { error: String(e).split('\n')[0] };
    }
    rec.errors = page.__errors;
    await page.context().close();
  }
  results.push(rec);
  console.log(`--- ${ord} ---`);
  console.log('  first wrong :', JSON.stringify(rec.p0));
  console.log('  at 10 wrongs:', JSON.stringify(rec.p9 && { hints: rec.p9.hints, dots: rec.p9.dots, near: rec.p9.near }));
  console.log('  console errors:', JSON.stringify(rec.errors));
}
writeFileSync('artifacts/wip-qplay/wrong-drive.json', JSON.stringify(results, null, 1));
await browser.close();
