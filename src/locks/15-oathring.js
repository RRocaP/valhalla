// 15 — THE OATH-RING (tier 4, mastery) — the finale
//
// Under the hasp lies an arm-ring with fourteen slots. The north nail marks
// slot 0. The player has fourteen shards, each a rune and a number, one from
// every lock already opened.
//
// THE LAW OF THE RING is never stated to the player, only discoverable:
// each shard's number is the CLOCKWISE distance from its own slot to the slot
// of the rune that FOLLOWS IT IN THE FUTHARK ROW (ᛚ wraps back to ᚠ), and ᚠ
// hangs on the north nail. That forces exactly one arrangement, frozen in
// src/kernel/shards.js as RING and reproduced in docs/LOCKS.md §15.
//
// This lock is frozen end to end: makePuzzle takes no variance (it accepts and
// ignores the rng), the answer is { ring: [14 runes clockwise from the nail] },
// and verify is exact equality against RING — no property check, no leniency.
// shard() returns null: lock 15 consumes shards, it does not give one.
//
// Difficulty accounting (docs/CONTRACT.md §4): 14 shards placed, the law found
// and then re-checked stride by stride around the ring (14), plus the sealing
// = 34 at the floor, and that assumes the law is seen before the first
// placement rather than after.
//
// PURE HALF: no DOM, no Date, no Math.random, no module-level mutable state.

import { FUTHARK14, RING, SHARDS } from '../kernel/shards.js';
import { BY_CH } from '../kernel/futhark.js';

const LOCK_IDS = Object.keys(SHARDS).sort();
const VALUE_OF = Object.fromEntries(Object.values(SHARDS).map((s) => [s.rune, s.value]));

const rotate = (arr, k) => arr.slice(k).concat(arr.slice(0, k));

function swapped(arr, i, j) {
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export default {
  id: '15-oathring',
  ordinal: 15,
  tier: 4,
  title: 'The Oath-Ring',
  epigraph: 'Fourteen locks gave up fourteen names. The ring asks only where each of them was standing.',

  makePuzzle() {
    // Static by contract: every chest carries the same ring.
    return {
      slots: 14,
      northNail: 0,
      futhark: FUTHARK14.slice(),
      shards: LOCK_IDS.map((id) => ({ lock: id, rune: SHARDS[id].rune, value: SHARDS[id].value })),
    };
  },

  solve() {
    return { ring: RING.slice() };
  },

  verify(instance, answer) {
    try {
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
      const ring = answer.ring;
      if (!Array.isArray(ring) || ring.length !== RING.length) return { ok: false };
      if (!ring.every((ch) => typeof ch === 'string')) return { ok: false };
      let placed = 0;
      for (let i = 0; i < RING.length; i++) if (ring[i] === RING[i]) placed++;
      if (placed === RING.length) return { ok: true };
      if (new Set(ring).size !== RING.length || !ring.every((ch) => FUTHARK14.includes(ch))) {
        return { ok: false, near: 'Fourteen shards, fourteen slots, each rune once.' };
      }
      if (ring[0] !== RING[0]) return { ok: false, near: 'The ring is read from the north nail, and something else is hanging on it.' };
      if (placed >= RING.length - 2) return { ok: false, near: 'Two shards have each other\'s slot.' };
      return { ok: false, near: 'The strides do not close the row.' };
    } catch {
      return { ok: false };
    }
  },

  wrongAnswers() {
    const out = [];
    const seen = new Set();
    const push = (ring) => {
      const key = ring.join('');
      if (key === RING.join('') || seen.has(key)) return;
      seen.add(key);
      out.push({ ring });
    };
    for (const k of [1, 2, 7, 13]) push(rotate(RING, k));            // right ring, wrong nail
    push(FUTHARK14.slice());                                          // the row laid clockwise
    push(rotate(FUTHARK14, 1));
    push(FUTHARK14.slice().sort((a, b) => VALUE_OF[a] - VALUE_OF[b]   // sorted by number
      || FUTHARK14.indexOf(a) - FUTHARK14.indexOf(b)));
    push(FUTHARK14.slice().reverse());
    push(RING.slice().reverse());                                     // sunwise read backwards
    push(swapped(RING, 3, 9));                                        // near-rings: two swapped
    push(swapped(RING, 1, 2));
    push(swapped(RING, 6, 11));
    return out;
  },

  shard() {
    return null;
  },

  difficulty: { searchSpace: 8.7e10, minSteps: 34, estMinutes: 25 },

  hints: [
    'The numbers on the shards are not weights and not counts. They are strides.',
    'Stride sunwise from a shard by its own number and you land on its neighbour — not its neighbour on the ring, but the one that follows it in the elder row.',
    'The row closes: water strides back to wealth, ᛚ to ᚠ. Hang wealth on the north nail, and every other shard follows by counting.',
  ],

  mount(ctx) {
    const art = ctx.art;
    const p = art.palette;
    const inst = ctx.instance;

    const cleanup = [];
    const on = (el, ev, fn, opts) => {
      el.addEventListener(ev, fn, opts);
      cleanup.push(() => el.removeEventListener(ev, fn, opts));
    };
    const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
    const say = (t) => { try { ctx.note && ctx.note(t); } catch (e) { /* no journal */ } };
    const node = (tag, css, text) => {
      const n = document.createElement(tag);
      if (css) n.style.cssText = css;
      if (text != null) n.textContent = text;
      return n;
    };

    const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
    const SLOTS = inst.slots;
    const shards = inst.shards;
    const shardOf = (rune) => shards.find((s) => s.rune === rune);
    const runeName = (ch) => (BY_CH[ch] ? BY_CH[ch].name : ch);

    // ---- state: ring[slot] = rune or null --------------------------------
    const ring = new Array(SLOTS).fill(null);
    if (ctx.solved) RING.forEach((ch, i) => { ring[i] = ch; });
    let held = null;

    // ---- frame -----------------------------------------------------------
    const wrap = node('div', `display:grid;gap:12px;font-family:${SERIF};color:${p.bone};justify-items:center`);
    const style = node('style');
    style.textContent = `
      .ow15-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${p.gold};border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
      .ow15-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow15-act[disabled]{opacity:.45;cursor:default}
      .ow15-ring{position:relative;width:100%;max-width:460px;aspect-ratio:1}
      .ow15-ring canvas{position:absolute;inset:0;width:100%;height:100%}
      .ow15-slot{position:absolute;transform:translate(-50%,-50%);min-width:46px;min-height:46px;
        border-radius:50%;border:1px solid ${p.oakLight};background:${p.oakDeep};color:${p.boneDim};
        font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:14px;cursor:pointer;display:flex;
        align-items:center;justify-content:center}
      .ow15-slot:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow15-slot[data-filled="1"]{border-color:${p.gold};color:${p.goldBright};background:transparent}
      .ow15-slot[data-target="1"]{border-color:${p.goldBright};border-style:dashed}
      .ow15-slot[data-nail="1"]{border-width:2px;border-color:${p.ember}}
      .ow15-hasp{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:60px}
      .ow15-chip{background:${p.oakDeep};border:1px solid ${p.oakLight};border-radius:4px;padding:5px 4px 3px;
        min-width:46px;min-height:60px;cursor:grab;touch-action:none;display:grid;justify-items:center;gap:1px;line-height:0}
      .ow15-chip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow15-chip[data-held="1"]{border-color:${p.goldBright};cursor:grabbing}
      .ow15-val{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:12px;color:${p.goldBright};line-height:1.4}
    `;
    wrap.append(style);

    const ringBox = node('div');
    ringBox.className = 'ow15-ring';
    const ringCv = art.makeCanvas(560, 560);
    ringCv.canvas.style.cssText = '';
    ringCv.canvas.setAttribute('role', 'img');
    ringBox.append(ringCv.canvas);

    const slotBtns = [];
    for (let i = 0; i < SLOTS; i++) {
      const a = -Math.PI / 2 + (i / SLOTS) * Math.PI * 2;
      const b = node('button');
      b.className = 'ow15-slot';
      b.type = 'button';
      b.style.left = `${50 + Math.cos(a) * 37}%`;
      b.style.top = `${50 + Math.sin(a) * 37}%`;
      if (i === inst.northNail) b.dataset.nail = '1';
      on(b, 'click', () => touchSlot(i));
      ringBox.append(b);
      slotBtns.push(b);
    }

    const haspLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em;text-align:center`,
      'The shards, still on the hasp');
    const hasp = node('div');
    hasp.className = 'ow15-hasp';
    const chips = shards.map((sh) => {
      const b = node('button');
      b.className = 'ow15-chip';
      b.type = 'button';
      const mini = art.makeCanvas(30, 40);
      mini.canvas.style.cssText = 'width:30px;height:40px;display:block';
      art.drawRune(mini.ctx, sh.rune, 3, 2, 34, { color: p.bone });
      const val = node('span', null, String(sh.value));
      val.className = 'ow15-val';
      b.append(mini.canvas, val);
      b.setAttribute('aria-label', `Shard ${runeName(sh.rune)}, number ${sh.value}`);
      on(b, 'click', () => liftShard(sh.rune));
      on(b, 'pointerdown', (ev) => { dragFrom = { rune: sh.rune, x: ev.clientX, y: ev.clientY }; });
      return { rune: sh.rune, b };
    });

    const help = node('p', `margin:0;font-size:12.5px;color:${p.boneDim};max-width:60ch;text-align:center`,
      'Tap a shard, then tap a slot — or drag it there. The nail at the top is slot 0, and the ring runs sunwise from it.');

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center;justify-content:center');
    const clearBtn = node('button', null, 'Take the ring apart');
    const closeBtn = node('button', null, 'Close the ring');
    for (const b of [clearBtn, closeBtn]) { b.className = 'ow15-act'; b.type = 'button'; }
    actions.append(clearBtn, closeBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
    status.setAttribute('aria-live', 'polite');

    wrap.append(ringBox, haspLabel, hasp, help, actions, status);
    ctx.root.append(wrap);

    // ---- drag ------------------------------------------------------------
    let dragFrom = null;
    on(document, 'pointerup', (ev) => {
      if (!dragFrom || ctx.solved) { dragFrom = null; return; }
      const moved = Math.hypot(ev.clientX - dragFrom.x, ev.clientY - dragFrom.y) > 8;
      const rune = dragFrom.rune;
      dragFrom = null;
      if (!moved) return;
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const slot = slotBtns.indexOf(target);
      if (slot >= 0) { held = rune; placeAt(slot); }
    });

    // ---- interaction -----------------------------------------------------
    function liftShard(rune) {
      if (ctx.solved) return;
      held = held === rune ? null : rune;
      sfx('tick');
      render(held ? `${runeName(held)} is in your hand.` : '');
    }
    function touchSlot(i) {
      if (ctx.solved) return;
      if (!held) {
        if (!ring[i]) { sfx('deny'); return; }
        held = ring[i];
        ring[i] = null;
        sfx('tick');
        say(`${runeName(held)} lifted from slot ${i}.`);
        render(`${runeName(held)} is in your hand.`);
        return;
      }
      placeAt(i);
    }
    function placeAt(i) {
      const rune = held;
      const previous = ring[i];
      const from = ring.indexOf(rune);
      if (from >= 0) ring[from] = previous;
      ring[i] = rune;
      held = previous && from < 0 ? previous : null;
      sfx('slide');
      say(`${runeName(rune)} hangs in slot ${i}${i === inst.northNail ? ', on the north nail' : ''}.`);
      render(held ? `${runeName(held)} is in your hand.` : '');
    }

    // ---- painting --------------------------------------------------------
    function paint() {
      const c = ringCv.ctx;
      const W = ringCv.w;
      const H = ringCv.h;
      c.clearRect(0, 0, W, H);
      art.paintWood(c, W, H, 1505);
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.37;

      c.save();
      c.strokeStyle = p.gold;
      c.lineWidth = 13;
      c.globalAlpha = 0.55;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = p.goldBright;
      c.lineWidth = 3;
      c.globalAlpha = 0.5;
      c.beginPath();
      c.arc(cx, cy, R - 6, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      art.ornament(c, 'nailhead', cx, cy - R, 20);
      c.save();
      c.fillStyle = p.ember;
      c.font = `13px ${SERIF}`;
      c.textAlign = 'center';
      c.fillText('the north nail', cx, cy - R - 30);
      c.restore();

      for (let i = 0; i < SLOTS; i++) {
        const a = -Math.PI / 2 + (i / SLOTS) * Math.PI * 2;
        const x = cx + Math.cos(a) * R;
        const y = cy + Math.sin(a) * R;
        const rune = ring[i];
        if (rune) {
          art.glow(c, x, y, 26, p.gold, 0.35);
          art.drawRune(c, rune, x - 15, y - 22, 44, { color: p.goldBright, glow: true });
          c.save();
          c.fillStyle = p.bone;
          c.font = `12px ui-monospace,'SF Mono',Menlo,monospace`;
          c.textAlign = 'center';
          const lift = Math.sin(a) < -0.1 ? -34 : 38;
          c.fillText(String(shardOf(rune).value), x, y + lift);
          c.restore();
        } else {
          c.save();
          c.strokeStyle = p.oakDeep;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, 15, 0, Math.PI * 2);
          c.stroke();
          c.restore();
        }
      }
    }

    function ringWords() {
      const laid = ring.map((ch, i) => (ch ? `${i}: ${runeName(ch)} (${shardOf(ch).value})` : null)).filter(Boolean);
      return laid.length
        ? `Sunwise from the nail — ${laid.join(', ')}. ${ring.filter((x) => !x).length} slots still empty.`
        : 'The ring is bare. Fourteen slots, fourteen shards.';
    }

    function render(announce) {
      paint();
      ringCv.canvas.setAttribute('aria-label', ringWords());
      for (let i = 0; i < SLOTS; i++) {
        const b = slotBtns[i];
        const rune = ring[i];
        b.dataset.filled = rune ? '1' : '0';
        b.dataset.target = held && !rune ? '1' : '0';
        b.textContent = rune ? String(shardOf(rune).value) : String(i);
        b.setAttribute('aria-label', rune
          ? `Slot ${i}${i === inst.northNail ? ', the north nail' : ''}: ${runeName(rune)}, number ${shardOf(rune).value}. Lift it.`
          : `Slot ${i}${i === inst.northNail ? ', the north nail' : ''}, empty.`);
      }
      hasp.textContent = '';
      for (const { rune, b } of chips) {
        b.dataset.held = held === rune ? '1' : '0';
        if (!ring.includes(rune)) hasp.append(b);
      }
      closeBtn.disabled = !!ctx.solved || ring.some((x) => !x);
      if (announce !== undefined) status.textContent = announce;
    }

    on(clearBtn, 'click', () => {
      if (ctx.solved) return;
      ring.fill(null);
      held = null;
      sfx('knock');
      say('The ring is taken apart; every shard back on the hasp.');
      render('');
    });
    on(closeBtn, 'click', () => {
      if (ctx.solved || ring.some((x) => !x)) { sfx('deny'); return; }
      say(ringWords());
      const res = ctx.submit({ ring: ring.slice() }) || {};
      if (!res.ok) status.textContent = res.near || 'The ring will not close on that order.';
    });

    if (ctx.solved) {
      clearBtn.disabled = true;
      closeBtn.disabled = true;
      for (const { b } of chips) b.disabled = true;
      for (const b of slotBtns) b.disabled = true;
    }

    say('Fourteen shards, fourteen slots, and a nail at the north. Every shard carries a rune and a number.');
    render(ctx.solved ? 'The ring is closed.' : '');

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        wrap.remove();
      },
    };
  },
};
