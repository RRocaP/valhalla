// Shared driving + assertion helpers for the OATHWOOD e2e suite (QA-owned,
// docs/CONTRACT.md §7 gates 7-8). Every lock is driven through its REAL
// mounted UI with real click/keyboard events — never a programmatic bypass of
// ctx.submit (the shell does not expose one; see docs/SHELL.md "Test hook").
//
// Frozen data (DUELS, BY_CH) is imported directly from its source of truth
// instead of copied, so this file never drifts from docs/JARLS.md /
// docs/CONTRACT.md's frozen rune table.
import { expect } from '@playwright/test';
import { DUELS, DUEL_ORDER } from '../../src/shell/duels.js';
import { BY_CH } from '../../src/kernel/futhark.js';

export const SCREENS_DIR = 'artifacts/screens';

export function escapeCss(s) {
  return String(s).replace(/[\\"]/g, '\\$&');
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- boot -------------------------------------------------------------

export async function gotoAutotest(page) {
  await page.goto('/#autotest');
  await expect(page).toHaveTitle(/VALHALLA|OATHWOOD/i);
  await expect(page.locator('#app')).not.toBeEmpty();
  // window.__OW is installed synchronously in createShell().start(); a real
  // gate here (not a sleep) covers the rare case the script tag is still
  // parsing when goto() resolves.
  await expect.poll(() => page.evaluate(() => typeof window.__OW === 'object' && !!window.__OW)).toBe(true);
}

// ---- window.__OW diagnostics (read-only, docs/SHELL.md "Test hook") ---

export async function owLockMeta(page) {
  return page.evaluate(() => window.__OW.locks.map((l) => ({
    id: l.id, ordinal: l.ordinal, tier: l.tier, title: l.title, hints: l.hints,
  })));
}

export async function owAnswerAndInstance(page, id) {
  return page.evaluate((lockId) => ({
    answer: window.__OW.answerOf(lockId),
    instance: window.__OW.instanceOf(lockId),
  }), id);
}

export async function owSave(page) {
  return page.evaluate(() => window.__OW.save);
}

// ---- screenshots --------------------------------------------------------

// Sequential, per-project-numbered screenshots: NN-desc-viewport.png.
export function makeShotter(page, testInfo) {
  let n = 0;
  const project = testInfo.project.name;
  return async function shot(desc) {
    n += 1;
    const name = `${String(n).padStart(2, '0')}-${desc}-${project}.png`;
    await page.screenshot({ path: `${SCREENS_DIR}/${name}` });
    return name;
  };
}

// ---- lid / navigation ---------------------------------------------------

export async function beginFromThreshold(page) {
  const begin = page.getByRole('button', { name: 'Lay hands on the chest', exact: true });
  await expect(begin).toBeVisible();
  await begin.click();
  await expect(page.locator('.screen-lid')).toBeVisible();
}

export async function openLockFromLid(page, ordinal) {
  const medallion = page.locator(`.medallion-hit[aria-label^="Lock ${ordinal}:"]`);
  await expect(medallion).toBeEnabled();
  await medallion.click();
  await expect(page.locator('.screen-lockroom')).toBeVisible();
}

// ---- duel dare card / ceremonies ----------------------------------------

export function duelFor(ordinal) {
  return DUELS[ordinal] || null;
}
export { DUEL_ORDER };

export async function expectDareCard(page, ordinal) {
  const duel = duelFor(ordinal);
  const card = page.locator('.dare-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.dare-name')).toHaveText(duel.name);
  await expect(card.locator('.dare-taunt')).toHaveText(`"${duel.taunt}"`);
  return duel;
}

export async function expectNoDareCard(page) {
  await expect(page.locator('.dare-card')).toHaveCount(0);
}

export async function answerTheDare(page) {
  await page.locator('.dare-card').getByRole('button', { name: 'Answer the dare', exact: true }).click();
}

// After a correct submit: skip the yield-beat overlay (duels only) and the
// shard-ceremony overlay (everyone except lock 15, which flows straight into
// the finale — docs/JARLS.md "The last bow"). src/shell/dom.js's playBeat
// intends both to be tap-skippable, but src/shell/style.js sets
// `.ceremony-overlay { pointer-events: none }` (product bug, reported in
// artifacts/handoffs/OW-QA.md — verified via style.js line ~87), so a real
// mouse click on it is silently swallowed by whatever sits behind it. The
// overlay IS explicitly `.focus()`ed by lockroom.js right when it mounts, and
// playBeat's own keydown handler treats Enter/Space/Escape as the same skip
// gesture, so Enter is used here — a real, working input path for the same
// affordance, not a bypass of it.
export async function resolveCeremony(page, { ordinal }) {
  const duel = duelFor(ordinal);
  const overlay = page.locator('.ceremony-overlay');

  if (duel) {
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.ceremony-line')).toHaveText(duel.yield);
    await page.keyboard.press('Enter');
  }

  if (ordinal === 15) {
    // no shard overlay for the final lock — straight to the finale intro.
    await expect(page.locator('.screen-finale')).toBeVisible();
    return;
  }

  const shardOverlay = page.locator('.ceremony-overlay');
  await expect(shardOverlay).toBeVisible();
  await expect(shardOverlay.locator('.ceremony-line')).toHaveText(/^Shard sealed: \d+$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.screen-lid')).toBeVisible();
}

// ---- generic reorder: real mouse drag ------------------------------------
// docs/CONTRACT.md §8 also requires a full keyboard path (lift with Space,
// move with Arrow keys, drop with Space) and locks 01/04 both implement one.
// It is NOT used here: driving it exposed a real product bug (see
// artifacts/handoffs/OW-QA.md) — the shared `render()` in both locks
// unconditionally re-appends every reorderable item on each interaction
// (`rowWrap.append(tile.btn)` for all 16, every render). Re-inserting a node
// that currently holds DOM focus OR active pointer capture makes Chromium
// silently drop that focus/capture, even though the node lands back at an
// unchanged or intentionally-new position. Two consequences verified by
// hand: (a) Space-to-lift moves focus to <body>, so subsequent Arrow presses
// go nowhere; (b) a single mouse drag that crosses more than one slot loses
// pointer capture after its first internal move-and-render, so only the
// first slot-crossing actually lands and the tile is left stuck "lifted".
//
// The workaround that stays entirely within real input events: perform each
// reorder as ONE mousedown, ONE mousemove straight from the source tile to
// the exact pixel of the destination slot (not an interpolated multi-step
// path), then mouseup — a single `moveTo` + `render()` cycle per drag, which
// is exactly what the multi-slot splice needs and lands mouseup on the
// tile's own new position (ordinary hit-testing, not capture) so `finish()`
// still resolves correctly. `order` is mutated in place to track live DOM
// order; `itemLocator` must resolve to the reorderable buttons in current
// left-to-right (or top-to-bottom) DOM order. Target pixel geometry is read
// fresh per-move from the CURRENT occupant of the destination slot — slot
// positions in the flex/grid layout are stable even as occupancy changes.
export async function reorderByDrag(page, itemLocator, order, targetOrder) {
  for (let pos = 0; pos < targetOrder.length; pos++) {
    const targetId = targetOrder[pos];
    const curIndex = order.indexOf(targetId, pos);
    if (curIndex === pos) continue;

    const src = await itemLocator.nth(curIndex).boundingBox();
    const dst = await itemLocator.nth(pos).boundingBox();
    const sx = src.x + src.width / 2, sy = src.y + src.height / 2;
    const dx = dst.x + dst.width / 2, dy = dst.y + dst.height / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(dx, dy);
    await page.mouse.up();

    const [id] = order.splice(curIndex, 1);
    order.splice(pos, 0, id);
  }
}

async function clickButton(root, name) {
  await root.getByRole('button', { name, exact: true }).click();
}

// ---- per-lock drivers -----------------------------------------------------
// Each driver performs the full real-input sequence for its lock, ending
// with the click on the lock's own submit control (which calls ctx.submit
// internally — there is no external hook to call it directly).

export const drivers = {
  async '01-runerow'(page, root, answer) {
    const tiles = root.locator('.ow1-tile');
    const order = Array.from({ length: 16 }, (_, i) => i);
    await reorderByDrag(page, tiles, order, answer.order);
    for (let k = 0; k < answer.flips.length; k++) {
      if (!answer.flips[k]) continue;
      await tiles.nth(k).click(); // a stationary tap (no movement) flips it
    }
    await clickButton(root, 'Set the row');
  },

  async '02-bismer'(page, root, answer) {
    await root.locator('[role="radio"].ow2-pouch').nth(answer.pouch).click();
    await clickButton(root, 'Name the pouch');
  },

  async '03-beacons'(page, root, answer, instance) {
    const dial = root.locator('canvas[role="slider"]');
    await dial.focus();
    await page.keyboard.press('Home');
    const longest = Math.max(...instance.beacons.map((b) => b.cycle));
    let remaining = answer.night - 1;
    while (remaining >= longest) { await page.keyboard.press('PageUp'); remaining -= longest; }
    while (remaining >= 10) { await page.keyboard.press('ArrowUp'); remaining -= 10; }
    while (remaining >= 1) { await page.keyboard.press('ArrowRight'); remaining -= 1; }
    await expect(dial).toHaveAttribute('aria-valuenow', String(answer.night));
    await clickButton(root, 'Set the dial');
  },

  async '04-strakes'(page, root, answer, instance) {
    // keyboard path (Space lift, arrows move, Space settle) — deterministic on
    // every viewport, unlike mouse drag under touch emulation
    const planks = root.locator('.ow4-plank');
    const markOf = (id) => instance.planks[id].mark;
    const domIndexOf = async (id) => {
      const labels = await planks.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
      return labels.findIndex((l) => l.startsWith(markOf(id) + ','));
    };
    const targetStack = answer.order.slice().reverse(); // DOM is top->bottom
    for (let pos = 0; pos < targetStack.length; pos++) {
      const id = targetStack[pos];
      let cur = await domIndexOf(id);
      if (cur === pos) continue;
      await planks.nth(cur).click();          // focus (no movement threshold crossed)
      await page.keyboard.press('Space');      // lift
      while (cur > pos) { await page.keyboard.press('ArrowUp'); cur--; }
      await page.keyboard.press('Space');      // settle
      await expect.poll(() => domIndexOf(id)).toBe(pos);
    }
    await root.locator('[role="radio"].ow4-say').nth(answer.liar).click();
    await clickButton(root, 'Raise the stack');
  },

  async '05-knotwork'(page, root, answer, instance) {
    for (let k = 0; k < instance.free.length; k++) {
      if (instance.initial[k] === answer.states[k]) continue;
      await root.locator('.ow5-cell').nth(instance.free[k]).click();
    }
    await clickButton(root, 'Bind the knot');
  },

  async '06-jotunvillur'(page, root, answer) {
    const rows = root.locator('[role="listbox"] [role="option"]');
    for (let i = 0; i < answer.words.length; i++) {
      await rows.nth(i).click();
      // aria-label is "word — gloss", so match the visible text, not the accessible name
      await root.locator(`.slate button:text-is("${answer.words[i]}")`).click();
    }
    await clickButton(root, 'Read the manifest');
  },

  async '07-tafl'(page, root, answer) {
    const PAD = 8, SQ = 40; // mirrors src/locks/07-tafl.js's own board constants (SIZE=7, frozen)
    const canvas = root.locator('.board canvas');
    for (const [from, to] of answer.line) {
      const say = root.locator('.say');
      const before = ((await say.textContent()) || '').trim();
      const pt = ([r, c]) => ({ x: PAD + c * SQ + SQ / 2, y: PAD + r * SQ + SQ / 2 });
      await canvas.click({ position: pt(from) });
      await canvas.click({ position: pt(to) });
      // the from-click writes "Move k of 3 …" immediately; the commit() text
      // 260ms later is the only safe go-signal — it always starts with the
      // attacker's reply or the escape line. Anything earlier races the
      // `if (anim) return` guard and the next from-click gets swallowed.
      await expect.poll(async () => ((await say.textContent()) || '').trim())
        .toMatch(/^(Attacker |The king is out)/);
      void before;
    }
    await clickButton(root, 'Swear the road');
  },

  async '08-hacksilver'(page, root, answer) {
    await root.locator('[role="radio"]').nth(answer.piece).click();
    await root.getByRole('button', { name: answer.heavier ? 'heavy — salted' : 'light — clipped', exact: true }).click();
    await clickButton(root, 'Swear the accusation');
  },

  async '09-sunstone'(page, root, answer) {
    await root.locator(`button[aria-label^="take bearing ${answer.azimuth},"]`).first().click();
    await root.locator('.stone').nth(answer.wet).locator('.wet').click();
    await clickButton(root, 'Swear the bearing');
  },

  async '10-drottkvaett'(page, root, answer, instance) {
    for (let line = 0; line < answer.lines.length; line++) {
      for (const half of [0, 1]) {
        const fragIdx = answer.lines[line][half];
        const fragText = instance.fragments[fragIdx].text;
        const re = new RegExp(`^${escapeRegExp(fragText)}\\s*\\d+$`);
        await root.locator('.frag').filter({ hasText: re }).first().click();
        await root.locator('.slot').nth(line * 2 + half).click();
      }
    }
    await clickButton(root, 'Speak the verse');
  },

  async '11-skerry'(page, root, answer, instance) {
    for (let i = 1; i < answer.route.length; i++) {
      const name = instance.nodes[answer.route[i]].name;
      const re = new RegExp(`(Row to|Haul over to) ${escapeRegExp(name)} —`);
      await root.locator('.ow11-leg').filter({ hasText: re }).click();
    }
    await clickButton(root, 'Seal the route');
  },

  async '12-veitsla'(page, root, answer) {
    for (let b = 0; b < 2; b++) {
      for (let i = 0; i < 4; i++) {
        const name = answer.benches[b][i];
        await root.locator('.ow12-chip').getByText(name, { exact: true }).click();
        await root.locator('.ow12-seat').nth(b * 4 + i).click();
      }
    }
    await root.locator('.ow12-boast').nth(answer.boast).click();
    await clickButton(root, 'Swear the seating');
  },

  async '13-althing'(page, root, answer) {
    const brands = root.locator('.ow13-brand');
    for (let i = 0; i < answer.liars.length; i++) {
      await brands.nth(i).click();
      if (answer.liars[i]) await brands.nth(i).click();
    }
    await root.locator('.ow13-culprit').nth(answer.culprit).click();
    await clickButton(root, 'Give the verdict');
  },

  async '14-bindrune'(page, root, answer, instance) {
    for (const ch of answer.runes) {
      const idx = instance.candidates.indexOf(ch);
      await root.locator('.ow14-cand').nth(idx).click();
    }
    await clickButton(root, 'Name the bound runes');
  },

  async '15-oathring'(page, root, answer, instance) {
    for (let slot = 0; slot < answer.ring.length; slot++) {
      const rune = answer.ring[slot];
      const runeName = BY_CH[rune] ? BY_CH[rune].name : rune;
      // chips leave the hasp once placed, so positional nth() drifts — the
      // aria-label ("Shard <name>, number <v>") is the only stable handle
      const chip = root.locator(`.ow15-chip[aria-label^="Shard ${escapeCss(runeName)},"]`);
      await chip.click();
      await root.locator('.ow15-slot').nth(slot).click();
    }
    await clickButton(root, 'Close the ring');
  },
};

// ---- accessibility floors -------------------------------------------------

// Every visible interactive control in `containerSelector` must be >= minPx
// in both dimensions (docs/CONTRACT.md §8, docs/SHELL.md "Touch targets").
export async function assertTouchTargets(page, containerSelector, minPx = 44) {
  const selector = `${containerSelector} button, ${containerSelector} a[href], `
    + `${containerSelector} input, ${containerSelector} select, `
    + `${containerSelector} [role="radio"], ${containerSelector} [role="switch"]`;
  const els = page.locator(selector);
  const count = await els.count();
  const failures = [];
  for (let i = 0; i < count; i++) {
    const el = els.nth(i);
    const box = await el.boundingBox();
    if (!box) continue; // not rendered / zero-size ancestor (e.g. display:none) — not an on-screen target
    const eps = 0.5; // subpixel rounding tolerance
    if (box.width + eps < minPx || box.height + eps < minPx) {
      const label = (await el.getAttribute('aria-label')) || (await el.textContent()) || '(unlabeled)';
      failures.push(`${label.trim().slice(0, 40)} — ${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
    }
  }
  expect(failures, `touch targets under ${minPx}px in ${containerSelector}:\n${failures.join('\n')}`).toEqual([]);
}

// Approximate WCAG contrast spot-check: walks up from the text element for
// the first ancestor with an opaque CSS background-color; if none is found
// (the wood is a <canvas> painted behind the DOM, docs/SHELL.md "Styling"),
// samples the average pixel colour from the nearest earlier-in-stack <canvas>
// under the text's own bounding box instead. This is an average-over-region
// approximation, not a worst-case per-pixel check — adequate for a spot
// check per docs/QUALITY.md, not a substitute for the QUALITY.md screenshot
// review.
export async function sampleContrastRatio(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    function parseRgb(str) {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }

    let bg = null;
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const c = parseRgb(cs.backgroundColor);
      if (c && c.a > 0.98) { bg = c; break; }
      node = node.parentElement;
    }

    if (!bg) {
      // find a canvas painted earlier in the same screen (the wood backdrop)
      const screen = el.closest('.screen') || document.body;
      const canvases = Array.from(screen.querySelectorAll('canvas'));
      const canvas = canvases[0];
      if (!canvas) return null;
      const cRect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      const scaleX = canvas.width / cRect.width;
      const scaleY = canvas.height / cRect.height;
      const bx = Math.max(0, Math.round((rect.left - cRect.left) * scaleX));
      const by = Math.max(0, Math.round((rect.top - cRect.top) * scaleY));
      const bw = Math.max(1, Math.min(canvas.width - bx, Math.round(rect.width * scaleX)));
      const bh = Math.max(1, Math.min(canvas.height - by, Math.round(rect.height * scaleY)));
      if (bw <= 0 || bh <= 0) return null;
      const data = ctx.getImageData(bx, by, bw, bh).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      bg = { r: r / n, g: g / n, b: b / n };
    }

    const fg = parseRgb(getComputedStyle(el).color);
    if (!fg) return null;

    const lum = ({ r, g, b }) => {
      const chan = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
    };
    const L1 = Math.max(lum(fg), lum(bg));
    const L2 = Math.min(lum(fg), lum(bg));
    return (L1 + 0.05) / (L2 + 0.05);
  }, selector);
}
