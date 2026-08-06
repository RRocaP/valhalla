// The five duels, played: banner on the lid, dare card, keyboard, the yield
// beat with a real solve behind it, journal echo, order, Aerya last.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const FROZEN = {
  3: { key: 'bourj', name: 'JARL BOURJ', taunt: 'I have watched a thousand nights of beacons. You will miscount before I blink.', yield: 'So the fires do answer you. Take the road, counter of nights.' },
  6: { key: 'rois', name: 'GUDJA RØIS', taunt: "The giants twisted these words. Untwist them, or wear the fool's hood at my fire.", yield: 'You read what the giants hid. Røis names you rune-wise.' },
  9: { key: 'andreas', name: 'JARL ÅNDREAS', taunt: 'The hound-jarl speaks no dare. He looses it. Find the sun he already smells.', yield: 'Åndreas lowers his bow — and bows.' },
  12: { key: 'folklore', name: 'JARL FOLKLORE', taunt: 'Seat my quarrelsome kin without blood on the boards. Even I gave up and drank.', yield: "Folklore raises his cup. 'The benches hold. Drink.'" },
  15: { key: 'arya', name: 'QUEEN ÄRYÄ STÖRK — the last', taunt: 'Fourteen shards, one law, and me. None has closed the ring while I held the horn.', yield: 'The Queen lowers her horn. Skål, ring-closer. The chest is yours.' },
};
const F14 = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚱ', 'ᚴ', 'ᚼ', 'ᚾ', 'ᛁ', 'ᛅ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛘ', 'ᛚ'];

const SOLVE = {
  3: async (page) => {
    const t = (await page.evaluate(() => window.__OW.answerOf('03-beacons'))).night;
    await page.locator('.ow3-dial').focus();
    for (let guard = 0; guard < 400; guard++) {
      const cur = Number(await page.locator('.ow3-dial').getAttribute('aria-valuenow'));
      if (cur === t) break;
      const d = t - cur;
      await page.keyboard.press(Math.abs(d) >= 10 ? (d > 0 ? 'ArrowUp' : 'ArrowDown') : (d > 0 ? 'ArrowRight' : 'ArrowLeft'));
    }
    await page.locator('.ow3-act').click();
  },
  6: async (page) => {
    const words = (await page.evaluate(() => window.__OW.answerOf('06-jotunvillur'))).words;
    for (let i = 0; i < 4; i++) {
      await page.locator('.ow-jotun .rows .row').nth(i).click();
      await page.locator('.ow-jotun .slate button', { hasText: new RegExp(`^${words[i]}$`) }).first().click();
    }
    await page.locator('.ow-jotun .send').click();
  },
  9: async (page) => {
    const a = await page.evaluate(() => window.__OW.answerOf('09-sunstone'));
    await page.locator('.ow-sunstone .stone button', { hasText: new RegExp(`^${a.azimuth}$`) }).first().click();
    await page.locator('.ow-sunstone .stone').nth(a.wet).locator('button.wet').click();
    await page.locator('.ow-sunstone .send').click();
  },
  12: async (page) => {
    const a = await page.evaluate(() => window.__OW.answerOf('12-veitsla'));
    const flat = a.benches[0].concat(a.benches[1]);
    for (let i = 0; i < 8; i++) {
      await page.locator('.ow12-chip', { hasText: new RegExp(`^${flat[i]}$`) }).first().click();
      await page.locator('.ow12-seat').nth(i).click();
    }
    await page.locator('.ow12-boast').nth(a.boast).click();
    await page.locator('button', { hasText: 'Swear the seating' }).click();
  },
  15: async (page) => {
    const ring = (await page.evaluate(() => window.__OW.answerOf('15-oathring'))).ring;
    const labels = await page.locator('.ow15-chip').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    const byRune = Object.fromEntries(F14.map((ch, k) => [ch, labels[k]]));
    for (let i = 0; i < 14; i++) {
      await page.locator(`.ow15-chip[aria-label="${byRune[ring[i]]}"]`).click();
      await page.locator('.ow15-slot').nth(i).click();
    }
    await page.locator('button', { hasText: 'Close the ring' }).click();
  },
};

const browser = await H.launch();
const out = [];
for (const ord of [3, 6, 9, 12, 15]) {
  const d = FROZEN[ord];
  const rec = { ord, key: d.key };
  const page = await H.newPage(browser, H.DESKTOP);
  await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
  await H.crossThreshold(page);

  // beat 1 — banner on the lid + journal
  rec.banner = await page.evaluate(() => {
    const b = document.querySelector('.duel-banner');
    return b ? { text: b.textContent.trim(), shown: getComputedStyle(b).display !== 'none' } : null;
  });
  rec.lidJournal = (await H.journal(page)).filter((l) => l.includes('bars the'));
  await H.shot(page, `duel-${ord}-lid`);

  // beat 2 — the dare card
  await H.enterLock(page, ord);
  await page.waitForTimeout(300);
  rec.dare = await page.evaluate(() => {
    const c = document.querySelector('.dare-card');
    if (!c) return null;
    const cv = c.querySelector('canvas');
    let ink = 0;
    let distinct = new Set();
    try {
      const g = cv.getContext('2d');
      const im = g.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < im.length; i += 4 * 97) { if (im[i + 3] > 8) ink++; distinct.add(`${im[i] >> 4},${im[i + 1] >> 4},${im[i + 2] >> 4}`); }
    } catch (e) {}
    const btn = c.querySelector('button');
    return {
      name: c.querySelector('.dare-name').textContent,
      taunt: c.querySelector('.dare-taunt').textContent,
      portraitInk: ink, portraitColours: distinct.size,
      buttonLabel: btn.textContent, buttonFocused: document.activeElement === btn,
      btnBox: (() => { const r = btn.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
    };
  });
  rec.dareJournal = (await H.journal(page)).filter((l) => l.includes(d.taunt)).length;
  await H.shot(page, `duel-${ord}-dare`);

  // keyboard: Esc backs out to the lid without forfeiting, Enter answers
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  rec.escBacksOut = await page.locator('.screen-lid').count() > 0;
  await H.enterLock(page, ord);
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  rec.enterAnswersDare = await page.locator('.dare-card').count() === 0;

  // beat 3 — the yield, behind a real solve
  const t0 = Date.now();
  try {
    await SOLVE[ord](page);
    await page.waitForSelector('.ceremony-overlay', { timeout: 8000 });
    const first = await page.evaluate(() => {
      const o = document.querySelector('.ceremony-overlay');
      return { line: o.querySelector('.ceremony-line')?.textContent || '', hasCanvas: !!o.querySelector('canvas'), focused: document.activeElement === o };
    });
    rec.yield = { ...first, appearedMs: Date.now() - t0 };
    await H.shot(page, `duel-${ord}-yield`);
    // sample the bow tween: portrait pixels must change over the ~1.2 s beat
    const frames = [];
    for (let i = 0; i < 7; i++) {
      frames.push(await page.evaluate(() => {
        const c = document.querySelector('.ceremony-overlay canvas');
        if (!c) return null;
        try {
          const im = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let s = 0; for (let k = 0; k < im.length; k += 4 * 211) s += im[k] + im[k + 1] + im[k + 2];
          return s;
        } catch (e) { return null; }
      }));
      await page.waitForTimeout(170);
    }
    rec.bowFrames = frames;
    rec.bowMoved = new Set(frames.filter((x) => x !== null)).size > 1;
    // what follows the yield
    await page.waitForTimeout(2500);
    rec.after = await page.evaluate(() => ({
      screen: document.querySelector('.screen')?.className || '',
      ceremony: document.querySelector('.ceremony-line')?.textContent || null,
    }));
    const j = await H.journal(page);
    rec.yieldJournal = j.filter((l) => l.includes(FROZEN[ord].yield)).length;
  } catch (e) {
    rec.yield = { error: String(e).split('\n')[0] };
  }
  rec.errors = page.__errors;
  await page.context().close();
  out.push(rec);
}

writeFileSync('artifacts/wip-qplay/duels.json', JSON.stringify(out, null, 1));
for (const r of out) {
  const d = FROZEN[r.ord];
  console.log(`\n=== duel at lock ${r.ord} (${r.key}) ===`);
  console.log('  banner        :', JSON.stringify(r.banner), 'journal:', JSON.stringify(r.lidJournal));
  console.log('  name exact    :', r.dare && r.dare.name === d.name, JSON.stringify(r.dare && r.dare.name));
  console.log('  taunt exact   :', r.dare && r.dare.taunt === `"${d.taunt}"`);
  console.log('  portrait      : ink', r.dare && r.dare.portraitInk, 'colours', r.dare && r.dare.portraitColours);
  console.log('  dare button   :', r.dare && r.dare.buttonLabel, r.dare && r.dare.btnBox, 'focused', r.dare && r.dare.buttonFocused);
  console.log('  Esc/Enter     :', r.escBacksOut, r.enterAnswersDare);
  console.log('  yield line    :', JSON.stringify(r.yield && r.yield.line), 'exact:', r.yield && r.yield.line === d.yield);
  console.log('  bow moved     :', r.bowMoved, JSON.stringify(r.bowFrames));
  console.log('  after yield   :', JSON.stringify(r.after));
  console.log('  errors        :', JSON.stringify(r.errors));
}
await browser.close();
