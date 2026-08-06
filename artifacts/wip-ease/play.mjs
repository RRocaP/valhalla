// OW-EASE cold-play harness (entry-curve tuning of locks 02-05).
// Boots the real built bundle in Chromium, walks the real journey with real
// input, and at each of locks 02-05 dumps EXACTLY what the board shows a
// first-timer (visible text + aria) plus a screenshot, before anything is
// touched. Pass 'cold' feeds hand-derived answers instead of __OW's.
//
// node artifacts/wip-ease/play.mjs read
// node artifacts/wip-ease/play.mjs cold '{"02-bismer":{"pouch":3}, ...}'

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODE = process.argv[2] || 'read';
const HAND = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const OUT = 'artifacts/wip-ease';
const BASE = 'http://127.0.0.1:8791';
const WATCH = ['02-bismer', '03-beacons', '04-strakes', '05-knotwork'];

mkdirSync(OUT, { recursive: true });

const clickBtn = (root, name) => root.getByRole('button', { name, exact: true }).click();

async function boardDump(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    if (!root) return null;
    const txt = (el) => (el.innerText || '').replace(/\n{2,}/g, '\n').trim();
    const aria = [...root.querySelectorAll('[aria-label],[role="img"],[role="slider"]')]
      .map((e) => e.getAttribute('aria-label') || e.getAttribute('aria-valuetext'))
      .filter(Boolean);
    return { text: txt(root), aria: [...new Set(aria)] };
  });
}

const drivers = {
  '01-runerow': async (page, root, answer) => {
    const tiles = root.locator('.ow1-tile');
    const order = [0, 1, 2, 3, 4, 5];
    for (let pos = 0; pos < answer.order.length; pos++) {
      const id = answer.order[pos];
      const cur = order.indexOf(id, pos);
      if (cur === pos) continue;
      const s = await tiles.nth(cur).boundingBox();
      const d = await tiles.nth(pos).boundingBox();
      await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
      await page.mouse.down();
      await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
      await page.mouse.up();
      order.splice(pos, 0, order.splice(cur, 1)[0]);
    }
    for (let k = 0; k < answer.flips.length; k++) if (answer.flips[k]) await tiles.nth(k).click();
    await clickBtn(root, 'Set the ætt');
  },
  '02-bismer': async (page, root, answer) => {
    await root.locator('[role="radio"].ow2-pouch').nth(answer.pouch).click();
    await clickBtn(root, 'Name the pouch');
  },
  '03-beacons': async (page, root, answer, instance) => {
    const dial = root.locator('canvas[role="slider"]');
    await dial.focus();
    await page.keyboard.press('Home');
    const longest = Math.max(...instance.beacons.map((b) => b.cycle));
    let left = answer.night - 1;
    while (left >= longest) { await page.keyboard.press('PageUp'); left -= longest; }
    while (left >= 1) { await page.keyboard.press('ArrowRight'); left -= 1; }
    await clickBtn(root, 'Set the dial');
  },
  '04-strakes': async (page, root, answer, instance) => {
    const planks = root.locator('.ow4-plank');
    const markOf = (id) => instance.planks[id].mark;
    const domIndexOf = async (id) => {
      const labels = await planks.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
      return labels.findIndex((l) => l.startsWith(markOf(id) + ','));
    };
    const target = answer.order.slice().reverse();
    for (let pos = 0; pos < target.length; pos++) {
      let cur = await domIndexOf(target[pos]);
      if (cur === pos) continue;
      await planks.nth(cur).click();
      await page.keyboard.press('Space');
      while (cur > pos) { await page.keyboard.press('ArrowUp'); cur--; }
      await page.keyboard.press('Space');
      await page.waitForTimeout(120);
    }
    await root.locator('[role="radio"].ow4-say').nth(answer.liar).click();
    await clickBtn(root, 'Raise the stack');
  },
  '05-knotwork': async (page, root, answer, instance) => {
    for (let k = 0; k < instance.free.length; k++) {
      if (instance.initial[k] === answer.states[k]) continue;
      await root.locator('.ow5-cell').nth(instance.free[k]).click();
    }
    await clickBtn(root, 'Bind the knot');
  },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const u = (m.location() && m.location().url) || '';
  if (/\/(music|credits)\.mp3(\?|$)/.test(u)) return;
  errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${BASE}/#autotest`);
await page.waitForFunction(() => typeof window.__OW === 'object' && !!window.__OW);
await clickBtn(page, 'Lay hands on the chest');
try {
  const w = page.getByRole('button', { name: 'Take the wager', exact: true });
  await w.waitFor({ state: 'visible', timeout: 2500 });
  await w.click();
} catch { /* no wager card */ }

const locks = await page.evaluate(() => window.__OW.locks.map((l) => ({ id: l.id, ordinal: l.ordinal })));
const report = {};

for (const { id, ordinal } of locks) {
  if (ordinal > 5) break;
  await page.locator(`.medallion-hit[aria-label^="Lock ${ordinal}:"]`).click();
  await page.locator('.screen-lockroom').waitFor({ state: 'visible' });
  const card = page.locator('.dare-card');
  if (await card.count()) {
    await card.getByRole('button', { name: 'Answer the dare', exact: true }).click();
  }
  const root = page.locator('.lock-root');
  await root.waitFor({ state: 'visible' });
  await page.waitForTimeout(1400);

  if (WATCH.includes(id)) {
    report[id] = await boardDump(page);
    await page.screenshot({ path: `${OUT}/${MODE}-${id}.png` });
  }

  const { answer, instance } = await page.evaluate((lockId) => ({
    answer: window.__OW.answerOf(lockId), instance: window.__OW.instanceOf(lockId),
  }), id);

  // In cold mode the hand answer is given in BOARD terms — the seal position on
  // the rack, the night on the dial, plank marks and the wright's name, the band
  // that lies over each crossing — and is translated to the module's answer
  // shape here. The reasoning came from the read-pass board dump alone.
  let use = answer;
  if (MODE === 'cold' && HAND[id]) {
    const h = HAND[id];
    if (id === '02-bismer') use = { pouch: h.pouchAt };
    else if (id === '03-beacons') use = { night: h.night };
    else if (id === '04-strakes') {
      use = {
        order: h.stackMarks.map((m) => instance.planks.findIndex((p) => p.mark === m)),
        liar: instance.testimonies.findIndex((t) => t.by === h.liarWright),
      };
    } else if (id === '05-knotwork') {
      use = { states: instance.free.map((cell) => h.over[cell] === 'ns') };
    }
    report[id] = { hand: h, derived: use, truth: answer, agrees: JSON.stringify(use) === JSON.stringify(answer) };
  }

  const t0 = Date.now();
  await drivers[id](page, root, use, instance);
  const overlay = page.locator('.ceremony-overlay');
  await overlay.waitFor({ state: 'visible', timeout: 20000 });
  if (ordinal === 3) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  if (WATCH.includes(id)) {
    report[id] = { ...(report[id] || {}), openedInMs: Date.now() - t0 };
    await page.screenshot({ path: `${OUT}/${MODE}-${id}-solved.png` });
  }
  await page.keyboard.press('Enter');
  await page.locator('.screen-lid').waitFor({ state: 'visible' });
}

writeFileSync(`${OUT}/${MODE}.json`, JSON.stringify({ errors, report }, null, 2));
console.log(JSON.stringify({ errors, report }, null, 2));
await browser.close();
