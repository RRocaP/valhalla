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
import { localizeNear } from '../kernel/i18n.js';

const LOCK_IDS = Object.keys(SHARDS).sort();
const VALUE_OF = Object.fromEntries(Object.values(SHARDS).map((s) => [s.rune, s.value]));

const rotate = (arr, k) => arr.slice(k).concat(arr.slice(0, k));

function swapped(arr, i, j) {
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ------------------------------------------------------------------ the view
//
// Queen Ärya's lock is the finale, so the prop is the finale too: a real
// twisted arm-ring — two gold rods laid together, hammer-faceted, fourteen
// sockets upset into the twist, and an IRON rivet forged through the north.
// The shards are bone chips with painted runes and their numbers in blood.
// Light: the hall's one hearth key from above-left, plus a cold throne fill
// from the dais — gold that reads cold, which is Ärya's and no one else's.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";
const TAU = Math.PI * 2;

// View-side colour math (the frozen art API exposes palette tokens, not mixers).
const hexOf = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function mix(a, b, t) {
  const A = hexOf(a);
  const B = hexOf(b);
  const v = A.map((x, i) => Math.round(x + (B[i] - x) * t));
  return `#${((v[0] << 16) | (v[1] << 8) | v[2]).toString(16).padStart(6, '0')}`;
}
const rgba = (c, a) => { const [r, g, b] = hexOf(c); return `rgba(${r},${g},${b},${a})`; };

// Deterministic per-index noise — the view's only randomness (never the puzzle's).
function h01(n) {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapPi = (a) => { let x = a; while (x > Math.PI) x -= TAU; while (x < -Math.PI) x += TAU; return x; };

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and resolve through ctx.lang at mount.
// `plate` stays deliberately spare: the law of this ring is the puzzle, and
// docs/LOCKS.md §15 forbids stating it — mystery IS the design here.
const BOARD_EN = {
  plate: 'Hang all fourteen shards. The ring knows its own law.',
  hasp: 'The hasp — your hoard, one shard off every lock you opened',
  help: 'Tap a shard, then a socket — or drag it there. The iron rivet is slot 0; the ring runs sunwise from it.',
  clear: 'Take the ring apart',
  close: 'Close the ring',
  skip: 'Skip the showing',
  showing: 'Watch once: a shard comes off the hasp, hangs on a socket, and comes off again.',
  filled: '{n} of fourteen sockets hang full',
  filledAll: 'All fourteen sockets hang full. Close the ring.',
  inHand: '{name} is in your hand.',
  liftedFrom: '{name} lifted from slot {i}.',
  hung: '{name} hangs in slot {i}.',
  hungNail: '{name} hangs in slot {i}, on the iron rivet.',
  apart: 'The ring is taken apart; every shard back on the hasp.',
  closed: 'The ring is closed.',
  refused: 'The ring will not close on that order.',
  opening: 'Fourteen shards, fourteen sockets, and an iron rivet at the north. Every shard carries a rune and a number.',
  ringBare: 'The ring is bare. Fourteen sockets, fourteen shards.',
  ringLaid: 'Sunwise from the rivet — {laid}. {empty} sockets still empty.',
  slotFull: 'Slot {i}{nail}: {name}, number {v}. Lift it.',
  slotEmpty: 'Slot {i}{nail}, empty.',
  nailAria: ', the iron rivet',
  nailWord: 'north nail',
  shard: 'Shard {name}, number {v}',
  shardHung: 'Shard {name}, number {v}, hanging in slot {i}. Take it back.',
  keysNote: 'By key: tab walks the hasp then the sockets; Enter or space lifts a shard and hangs it.',
};

const I18N = {
  es: {
    title: 'El Anillo del Juramento',
    epigraph: 'Catorce cerraduras entregaron catorce nombres. El anillo solo pregunta dónde estaba cada uno de ellos.',
    hints: [
      'Los números de las esquirlas no son pesos ni cuentas. Son zancadas.',
      'Avanza en el sentido del sol desde una esquirla, tantos puestos como su propio número, y caerás sobre su vecina — no la vecina del anillo, sino la que la sigue en la hilera antigua.',
      'La hilera cierra: el agua vuelve a zancadas hasta la riqueza, ᛚ hasta ᚠ. Cuelga la riqueza del clavo del norte, y todas las demás se siguen contando.',
    ],
    nearMap: {
      'Fourteen shards, fourteen slots, each rune once.': 'Catorce esquirlas, catorce puestos, cada runa una sola vez.',
      'The ring is read from the north nail, and something else is hanging on it.': 'El anillo se lee desde el clavo del norte, y de él cuelga otra cosa.',
      'Two shards have each other\'s slot.': 'Dos esquirlas se han cambiado el puesto.',
      'The strides do not close the row.': 'Las zancadas no cierran la hilera.',
    },
    board: {
      plate: 'Cuelga las catorce esquirlas. El anillo conoce su propia ley.',
      hasp: 'La abrazadera — tu botín, una esquirla de cada cerradura abierta',
      help: 'Toca una esquirla y luego un alvéolo — o arrástrala hasta él. El remache de hierro de arriba es el puesto 0, y el anillo corre con el sol desde él.',
      clear: 'Desarmar el anillo',
      close: 'Cerrar el anillo',
      skip: 'Saltar la muestra',
      showing: 'Mira una vez: una esquirla sale de la abrazadera, cuelga de un alvéolo y vuelve a salir.',
      filled: '{n} de catorce alvéolos van llenos',
      filledAll: 'Los catorce alvéolos van llenos. Cierra el anillo.',
      inHand: '{name} queda en tu mano.',
      liftedFrom: '{name} sale del puesto {i}.',
      hung: '{name} cuelga del puesto {i}.',
      hungNail: '{name} cuelga del puesto {i}, del remache de hierro.',
      apart: 'El anillo queda desarmado; cada esquirla vuelve a la abrazadera.',
      closed: 'El anillo está cerrado.',
      refused: 'El anillo no cierra con ese orden.',
      opening: 'Catorce esquirlas, catorce alvéolos y un remache de hierro al norte. Cada esquirla lleva una runa y un número.',
      ringBare: 'El anillo está desnudo. Catorce alvéolos, catorce esquirlas.',
      ringLaid: 'Con el sol desde el remache — {laid}. Quedan {empty} alvéolos vacíos.',
      slotFull: 'Puesto {i}{nail}: {name}, número {v}. Sácala.',
      slotEmpty: 'Puesto {i}{nail}, vacío.',
      nailAria: ', el remache de hierro',
      nailWord: 'clavo del norte',
      shard: 'Esquirla {name}, número {v}',
      shardHung: 'Esquirla {name}, número {v}, colgada del puesto {i}. Recupérala.',
      keysNote: 'Con el teclado: el tabulador recorre la abrazadera y luego los alvéolos; Intro o espacio alza una esquirla y la cuelga.',
    },
  },
  ca: {
    title: 'L’Anell del Jurament',
    epigraph: 'Catorze panys van lliurar catorze noms. L’anell només pregunta on era cadascun d’ells.',
    hints: [
      'Els números de les esquerdes no són pesos ni comptes. Són gambades.',
      'Avança en el sentit del sol des d’una esquerda, tants llocs com el seu propi número, i cauràs damunt la seva veïna — no la veïna de l’anell, sinó la que la segueix a la filera antiga.',
      'La filera tanca: l’aigua torna a gambades fins a la riquesa, ᛚ fins a ᚠ. Penja la riquesa del clau del nord, i totes les altres se segueixen comptant.',
    ],
    nearMap: {
      'Fourteen shards, fourteen slots, each rune once.': 'Catorze esquerdes, catorze llocs, cada runa una sola vegada.',
      'The ring is read from the north nail, and something else is hanging on it.': 'L’anell es llegeix des del clau del nord, i d’ell en penja una altra cosa.',
      'Two shards have each other\'s slot.': 'Dues esquerdes s’han canviat el lloc.',
      'The strides do not close the row.': 'Les gambades no tanquen la filera.',
    },
    board: {
      plate: 'Penja les catorze esquerdes. L’anell coneix la seva pròpia llei.',
      hasp: 'La baga — el teu botí, una esquerda de cada pany obert',
      help: 'Toca una esquerda i després un alvèol — o arrossega-la fins allà. El rebló de ferro de dalt és el lloc 0, i l’anell corre amb el sol des d’ell.',
      clear: 'Desfer l’anell',
      close: 'Tancar l’anell',
      skip: 'Saltar la mostra',
      showing: 'Mira-ho un cop: una esquerda surt de la baga, penja d’un alvèol i en torna a sortir.',
      filled: '{n} de catorze alvèols van plens',
      filledAll: 'Els catorze alvèols van plens. Tanca l’anell.',
      inHand: '{name} queda a la teva mà.',
      liftedFrom: '{name} surt del lloc {i}.',
      hung: '{name} penja del lloc {i}.',
      hungNail: '{name} penja del lloc {i}, del rebló de ferro.',
      apart: 'L’anell queda desfet; cada esquerda torna a la baga.',
      closed: 'L’anell és tancat.',
      refused: 'L’anell no tanca amb aquest ordre.',
      opening: 'Catorze esquerdes, catorze alvèols i un rebló de ferro al nord. Cada esquerda duu una runa i un número.',
      ringBare: 'L’anell és nu. Catorze alvèols, catorze esquerdes.',
      ringLaid: 'Amb el sol des del rebló — {laid}. Queden {empty} alvèols buits.',
      slotFull: 'Lloc {i}{nail}: {name}, número {v}. Treu-la.',
      slotEmpty: 'Lloc {i}{nail}, buit.',
      nailAria: ', el rebló de ferro',
      nailWord: 'clau del nord',
      shard: 'Esquerda {name}, número {v}',
      shardHung: 'Esquerda {name}, número {v}, penjada al lloc {i}. Recupera-la.',
      keysNote: 'Amb el teclat: el tabulador recorre la baga i després els alvèols; Retorn o espai alça una esquerda i la penja.',
    },
  },
};

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

  i18n: I18N,

  mount(ctx) {
    const art = ctx.art;
    const p = art.palette;
    const inst = ctx.instance;

    // Board copy resolves against ctx.lang; en falls through to BOARD_EN
    // (#autotest pins the shell to en, so the driver label contracts hold).
    const lang = ctx.lang || 'en';
    const LOC = I18N[lang] || {};
    const L = LOC.board || {};
    const T = (key, params) => {
      let s = key in L ? L[key] : BOARD_EN[key];
      if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
      return s;
    };
    const nearOf = (near) => localizeNear(near, LOC.nearMap || {});

    const cleanup = [];
    const timers = [];
    let motions = [];
    const on = (el, ev, fn, opts) => {
      el.addEventListener(ev, fn, opts);
      cleanup.push(() => el.removeEventListener(ev, fn, opts));
    };
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
    const say = (t) => { try { ctx.note && ctx.note(t); } catch (e) { /* no journal */ } };
    const node = (tag, css, text) => {
      const n = document.createElement(tag);
      if (css) n.style.cssText = css;
      if (text != null) n.textContent = text;
      return n;
    };
    const calm = (() => {
      try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch (e) { return false; }
    })();
    const live = typeof window !== 'undefined';   // a real browser, not the unit stub
    const rafFn = live && typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;

    const SLOTS = inst.slots;
    const shards = inst.shards;
    const shardOf = (rune) => shards.find((s) => s.rune === rune);
    const runeName = (ch) => (BY_CH[ch] ? BY_CH[ch].name : ch);
    const angleOf = (i) => -Math.PI / 2 + (i / SLOTS) * TAU;

    // ---- state: ring[slot] = rune or null --------------------------------
    const ring = new Array(SLOTS).fill(null);
    if (ctx.solved) RING.forEach((ch, i) => { ring[i] = ch; });
    let held = null;
    let hot = -1;             // the socket that just took a shard (it still rings)
    let refusal = null;       // {kind, t0} — the near-line, read on the metal
    let touched = false;
    const filledCount = () => ring.reduce((n, x) => n + (x ? 1 : 0), 0);

    // ---- frame -----------------------------------------------------------
    const wrap = node('div', `display:flex;flex-direction:column;gap:7px;min-height:0;
      font-family:${SERIF};color:${p.bone};align-items:stretch`);
    const style = node('style');
    style.textContent = `
      .ow15-plate{margin:0;text-align:center;font-size:14.5px;line-height:1.45;letter-spacing:.045em;
        color:${p.bone};text-shadow:${art.reliefShadowCss}}
      .ow15-haspname{margin:0;text-align:center;font-size:11.5px;letter-spacing:.12em;color:${p.boneDim};
        font-variant-caps:all-small-caps}
      .ow15-hasp{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;padding:5px 7px;border-radius:3px;
        background:linear-gradient(180deg,${rgba(p.oakLight, 0.32)},${rgba(p.tar, 0.55)});
        box-shadow:inset 0 1px 0 ${rgba(p.bone, 0.14)},inset 0 -2px 3px ${rgba(p.tar, 0.7)},
          0 2px 6px ${rgba(p.tar, 0.55)}}
      .ow15-chip{background:none;border:0;padding:0;line-height:0;border-radius:3px;cursor:pointer;
        touch-action:none;display:block}
      .ow15-chip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow15-chip canvas{display:block}
      .ow15-stage{position:relative;display:flex;flex-direction:column;gap:6px;min-height:0}
      .ow15-haspcol{display:flex;flex-direction:column;gap:5px;min-width:0}
      .ow15-stage[data-wide="1"]{flex-direction:row;align-items:center;justify-content:center;gap:16px}
      .ow15-stage[data-wide="1"] .ow15-haspcol{flex:0 0 auto;width:112px}
      .ow15-stage[data-wide="1"] .ow15-hasp{width:106px}
      .ow15-stage[data-wide="1"] .ow15-haspname{font-size:10px;letter-spacing:.05em;line-height:1.4}
      .ow15-stage[data-wide="1"] .ow15-progress{font-size:11.5px;line-height:1.4}
      .ow15-stage[data-wide="1"] .ow15-ring{flex:0 0 auto}
      .ow15-ring{position:relative;min-height:236px;width:100%}
      .ow15-ring canvas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
      .ow15-slot{position:absolute;transform:translate(-50%,-50%);background:none;border:0;padding:0;
        border-radius:50%;cursor:pointer;font-size:0;color:transparent}
      .ow15-slot:focus-visible{outline:2px solid ${p.goldBright};outline-offset:1px}
      .ow15-ghost{position:absolute;left:0;top:0;pointer-events:none;z-index:3;line-height:0;display:none}
      .ow15-progress{margin:0;text-align:center;font-size:12.5px;letter-spacing:.05em;color:${p.boneDim}}
      .ow15-status{margin:0;min-height:19px;font-size:13.5px;color:${p.boneDim};text-align:center;
        scroll-margin:28px}
      .ow15-help{margin:0;font-size:12px;line-height:1.5;color:${p.boneDim};max-width:66ch;text-align:center;
        align-self:center}
      .ow15-acts{display:flex;gap:9px;flex-wrap:wrap;align-items:center;justify-content:center}
      .ow15-act{font-family:${SERIF};font-size:14.5px;color:${p.bone};background:${rgba(p.oakDeep, 0.85)};
        border:1px solid ${p.oakLight};border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
      .ow15-act:hover{border-color:${p.gold}}
      .ow15-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow15-act[disabled]{opacity:.45;cursor:default}
      /* the shell sets \`#app *{min-width:0}\`, which outranks a bare class rule
         and flattened these to ~12 px wide; re-assert the floor at equal weight */
      #app .ow15-slot{min-width:44px}
      #app .ow15-chip{min-width:44px}
      #app .ow15-act{min-width:44px}
    `;
    wrap.append(style);

    const plateP = node('p', null, T('plate'));
    plateP.className = 'ow15-plate';

    const stage = node('div');
    stage.className = 'ow15-stage';

    const haspName = node('p', null, T('hasp'));
    haspName.className = 'ow15-haspname';
    const hasp = node('div');
    hasp.className = 'ow15-hasp';

    const ringBox = node('div');
    ringBox.className = 'ow15-ring';
    let ringCv = art.makeCanvas(10, 10);
    ringCv.canvas.setAttribute('role', 'img');
    ringBox.append(ringCv.canvas);

    const ghostHost = node('div');
    ghostHost.className = 'ow15-ghost';
    ghostHost.setAttribute('aria-hidden', 'true');
    let ghostCv = null;

    const progress = node('p', null, '');
    progress.className = 'ow15-progress';
    const haspCol = node('div');
    haspCol.className = 'ow15-haspcol';
    haspCol.append(haspName, hasp, progress);
    stage.append(haspCol, ringBox, ghostHost);

    const status = node('p', null, '');
    status.className = 'ow15-status';
    status.setAttribute('aria-live', 'polite');
    const help = node('p', null, T('help'));
    help.className = 'ow15-help';

    const acts = node('div');
    acts.className = 'ow15-acts';
    const clearBtn = node('button', null, T('clear'));
    clearBtn.className = 'ow15-act';
    clearBtn.type = 'button';
    const skipBtn = node('button', null, T('skip'));
    skipBtn.className = 'ow15-act';
    skipBtn.type = 'button';
    skipBtn.style.display = 'none';
    const closeBtn = node('button', null, T('close'));
    closeBtn.className = 'btn-carved';   // one primary-action language across the chest
    closeBtn.type = 'button';
    acts.append(skipBtn, clearBtn, closeBtn);

    wrap.append(plateP, stage, status, acts, help);
    ctx.root.append(wrap);

    // ---- the shards, on the hasp -----------------------------------------
    // Every chip keeps its notch on the rail for the whole game: a hung shard
    // leaves an empty socket behind rather than collapsing the row, so nothing
    // under the player's thumb ever moves.
    const CHIP_W = 44;
    const CHIP_H = 52;
    const chips = shards.map((sh, ix) => {
      const b = node('button');
      b.className = 'ow15-chip';
      b.type = 'button';
      const face = art.makeCanvas(CHIP_W, CHIP_H);
      b.append(face.canvas);
      on(b, 'click', () => touchChip(sh.rune));
      on(b, 'pointerdown', (ev) => { dragFrom = { rune: sh.rune, x: ev.clientX, y: ev.clientY }; });
      hasp.append(b);
      return { rune: sh.rune, value: sh.value, ix, b, face, key: '' };
    });

    // ---- the sockets (hit targets over the painted metal) ----------------
    const slotBtns = [];
    for (let i = 0; i < SLOTS; i++) {
      const b = node('button');
      b.className = 'ow15-slot';
      b.type = 'button';
      if (i === inst.northNail) b.dataset.nail = '1';
      on(b, 'click', () => touchSlot(i));
      ringBox.append(b);
      slotBtns.push(b);
    }

    // ---- geometry --------------------------------------------------------
    let G = null;
    let plate = null;
    let plateKey = '';

    // `.lock-root` is content-sized, so `flex:1` buys the ring nothing: the
    // height it may take is whatever the lock room has left over once its own
    // header/footer and this board's other furniture are paid for. Measured
    // off stable siblings, so growing the ring never feeds back into the sum.
    function freeHeight() {
      let screenEl = ctx.root.parentElement;
      while (screenEl && !(screenEl.classList && screenEl.classList.contains('screen'))) {
        screenEl = screenEl.parentElement;
      }
      if (!screenEl || !screenEl.children) return 0;
      let used = 0;
      for (const ch of screenEl.children) {
        if (ch.contains && ch.contains(ctx.root)) continue;
        used += ch.getBoundingClientRect().height;
      }
      let other = 0;
      for (const ch of wrap.children) {
        if (ch === stage || ch.tagName === 'STYLE') continue;
        other += ch.getBoundingClientRect().height;
      }
      if (stage.dataset.wide !== '1') {
        for (const ch of stage.children) {
          if (ch === ringBox || ch === ghostHost) continue;
          other += ch.getBoundingClientRect().height;
        }
      }
      return screenEl.getBoundingClientRect().height - used - other - 74;
    }

    // The shards hang INSIDE the hoop — that is where a ring's pendants sit
    // when it lies on a board, and it buys the rod a far bigger radius than
    // splaying them outward would, while spending the dead centre honestly.
    function geometry(want) {
      const stageW = stage.getBoundingClientRect().width || 420;
      const wide = stageW >= 640;
      stage.dataset.wide = wide ? '1' : '0';
      const box = ringBox.getBoundingClientRect();
      const hostW = Math.round(clamp(wide ? stageW - 128 : (box.width || 420), 240, 1200));
      const free = freeHeight();
      const cap = Math.min(hostW, free > 220 ? free : 520);
      const S = Math.round(clamp(want != null ? want : cap, 236, 520));
      const plinthR = S / 2 - 5;
      const tube = clamp(S * 0.092, 16, 40);
      const R = plinthR - 27 - tube * 0.5;   // 27px band: rim teeth, then the socket numbers
      const chipH = Math.round(clamp(S * 0.125, 32, 56));
      const chipW = Math.round(chipH * 0.8);
      const chipR = R - tube * 0.5 - chipH * 0.5 - 4;
      const spacing = (TAU * R) / SLOTS;
      const hitR = clamp(spacing * 0.92, 44, 60);
      return { S, hostW, hostH: S, cx: S / 2, cy: S / 2, R, tube, chipH, chipW, chipR, plinthR, hitR };
    }

    // ======================================================================
    // THE METAL
    // ======================================================================

    // The oak plinth the ring lies on: a round board with a carved rim, so the
    // canvas has an OBJECT edge and the room's own wood shows past its corners
    // (no seam between two different wood seeds).
    function paintPlinth(g) {
      const { S, cx, cy, plinthR, R, tube } = G;
      g.clearRect(0, 0, S, S);

      // contact shadow onto the room's boards
      g.save();
      for (const [rr, a] of [[plinthR + 9, 0.20], [plinthR + 5, 0.26], [plinthR + 2, 0.30]]) {
        g.fillStyle = rgba(p.tar, a);
        g.beginPath();
        g.arc(cx + 3, cy + 6, rr, 0, TAU);
        g.fill();
      }
      g.restore();

      // the board itself
      g.save();
      g.beginPath();
      g.arc(cx, cy, plinthR, 0, TAU);
      g.clip();
      art.paintWood(g, S, S, 1505);
      if (typeof art.hearth === 'function') art.hearth(g, S, S, { x: 0.4, y: 0.1, strength: 0.85, progress: 1 });
      // Ärya's dais answers the hearth with a cold fill — throne-light, hers alone
      const cold = g.createLinearGradient(0, 0, S * 0.35, S);
      cold.addColorStop(0, rgba(p.fjordLight, 0.14));
      cold.addColorStop(0.4, rgba(p.fjord, 0.06));
      cold.addColorStop(1, rgba(p.tar, 0.34));
      g.fillStyle = cold;
      g.fillRect(0, 0, S, S);

      // dead-zone law: the empty stretches carry the smith's own setting-out
      const scribe = (rr, a, w) => {
        g.strokeStyle = rgba(p.tar, a);
        g.lineWidth = w;
        g.beginPath();
        g.arc(cx, cy, rr, 0, TAU);
        g.stroke();
        g.strokeStyle = rgba(p.oakLight, a * 0.55);
        g.beginPath();
        g.arc(cx + 0.8, cy + 0.9, rr, 0, TAU);
        g.stroke();
      };
      const inner = G.chipR - G.chipH * 0.5 - 4;      // free dais inside the pendants
      scribe(inner * 0.42, 0.26, 1);
      scribe(inner * 0.72, 0.22, 1);
      scribe(inner, 0.3, 1.2);
      scribe(plinthR - 24, 0.24, 1);
      // fourteen setting-out ticks: where the smith marked his sockets
      for (let i = 0; i < SLOTS; i++) {
        const a = angleOf(i);
        g.strokeStyle = rgba(p.tar, 0.3);
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * inner * 0.72, cy + Math.sin(a) * inner * 0.72);
        g.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        g.stroke();
        g.strokeStyle = rgba(p.oakLight, 0.16);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * inner * 0.72 + 0.9, cy + Math.sin(a) * inner * 0.72 + 0.9);
        g.lineTo(cx + Math.cos(a) * inner + 0.9, cy + Math.sin(a) * inner + 0.9);
        g.stroke();
      }
      if (typeof art.rosette === 'function') art.rosette(g, cx, cy, Math.max(14, inner * 0.3), { alpha: 0.3 });
      // an incised border round the dais, and the tonal fall-off that gives a
      // dead zone its layers: lit pool up-left, tar gathering at the rim
      g.strokeStyle = rgba(p.tar, 0.5);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, inner + 4, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(p.oakLight, 0.3);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, inner + 6, 0, TAU);
      g.stroke();
      const teeth0 = Math.max(20, Math.round(inner * 0.32));
      for (let k = 0; k < teeth0; k++) {
        const a0 = (k / teeth0) * TAU;
        const a1 = ((k + 0.55) / teeth0) * TAU;
        g.beginPath();
        g.moveTo(cx + Math.cos(a0) * (inner + 4), cy + Math.sin(a0) * (inner + 4));
        g.lineTo(cx + Math.cos(a1) * (inner + 4), cy + Math.sin(a1) * (inner + 4));
        g.lineTo(cx + Math.cos((a0 + a1) / 2) * (inner - 4), cy + Math.sin((a0 + a1) / 2) * (inner - 4));
        g.closePath();
        g.fillStyle = rgba(p.tar, 0.3);
        g.fill();
      }
      const pool = g.createRadialGradient(cx - inner * 0.4, cy - inner * 0.5, 0, cx, cy, plinthR);
      pool.addColorStop(0, rgba(p.bone, 0.13));
      pool.addColorStop(0.4, rgba(p.oakLight, 0.05));
      pool.addColorStop(0.78, rgba(p.tar, 0.16));
      pool.addColorStop(1, rgba(p.tar, 0.34));
      g.fillStyle = pool;
      g.fillRect(0, 0, S, S);
      // the cold fill off the dais answers the hearth key, so the shaded half
      // stays material rather than collapsing to one flat dark value
      const fill = g.createLinearGradient(S, S, S * 0.35, 0);
      fill.addColorStop(0, rgba(p.fjordLight, 0.15));
      fill.addColorStop(0.45, rgba(p.fjordLight, 0.06));
      fill.addColorStop(1, rgba(p.fjordLight, 0));
      g.fillStyle = fill;
      g.fillRect(0, 0, S, S);
      if (typeof art.wear === 'function') {
        // no avoid box: the rod is laid over this afterwards, so tool history
        // may run right under it — and the dais needs the density
        art.wear(g, S, S, 'oathring-dais');
        art.wear(g, S, S, 'oathring-throne');
      }
      // an interlace band between the setting-out and the rim: the throne-panel
      if (typeof art.drawKnot === 'function') {
        const band = plinthR - 15;
        const pts = [];
        for (let k = 0; k <= 40; k++) {
          const a = (k / 40) * TAU - Math.PI / 2;
          pts.push([cx + Math.cos(a) * (band + (k % 2 ? 4.5 : -4.5)), cy + Math.sin(a) * (band + (k % 2 ? 4.5 : -4.5))]);
        }
        g.save();
        g.globalAlpha = 0.3;
        art.drawKnot(g, pts, { width: 3.2, color: p.gold, gapAtCrossings: 6 });
        g.restore();
      }
      g.restore();

      // the rim: a stepped carved arris, chip-carved teeth, gold bead
      g.save();
      g.strokeStyle = rgba(p.tar, 0.9);
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, plinthR - 1.5, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(p.oakLight, 0.4);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(cx, cy, plinthR - 4.5, 0, TAU);
      g.stroke();
      // wolf-tooth chips cut round the rim
      const teeth = Math.max(24, Math.round(plinthR * 0.42));
      for (let k = 0; k < teeth; k++) {
        const a0 = (k / teeth) * TAU;
        const a1 = ((k + 0.62) / teeth) * TAU;
        const rOut = plinthR - 6;
        const rIn = plinthR - 6 - Math.max(4, plinthR * 0.035);
        g.beginPath();
        g.moveTo(cx + Math.cos(a0) * rOut, cy + Math.sin(a0) * rOut);
        g.lineTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
        g.lineTo(cx + Math.cos((a0 + a1) / 2) * rIn, cy + Math.sin((a0 + a1) / 2) * rIn);
        g.closePath();
        g.fillStyle = rgba(p.tar, 0.4);
        g.fill();
        g.strokeStyle = rgba(mix(p.oakLight, p.goldBright, 0.3), 0.24);
        g.lineWidth = 0.8;
        g.stroke();
      }
      g.strokeStyle = rgba(p.gold, 0.5);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(cx, cy, plinthR - 6 - Math.max(4, plinthR * 0.035) - 2.5, 0, TAU);
      g.stroke();
      g.restore();
    }

    // The rod: two gold strands laid together. Painted as a real cross-section
    // ramp inside the annulus (roundness), then the twist grooves that cross it
    // at the lay angle, then hammer facets, speculars, and the patina that
    // settles in the grooves. Baked once per size — this is the expensive pass.
    function paintRod(g) {
      const { cx, cy, R, tube } = G;
      const half = tube / 2;

      // the ring's own shadow, thrown down-right by the hearth key
      g.save();
      for (const [w, a, dx, dy] of [[tube * 1.7, 0.26, 4, 6], [tube * 1.35, 0.28, 3, 4], [tube * 1.1, 0.3, 2, 3]]) {
        g.strokeStyle = rgba(p.tar, a);
        g.lineWidth = w;
        g.beginPath();
        g.arc(cx + dx, cy + dy, R, 0, TAU);
        g.stroke();
      }
      g.restore();

      g.save();
      // annulus clip (outer forward, inner reversed — the donut rule)
      g.beginPath();
      g.arc(cx, cy, R + half, 0, TAU, false);
      g.arc(cx, cy, R - half, 0, TAU, true);
      g.clip();

      // 1. cross-section ramp: the rod is round, and the light sits above-left
      const ramp = g.createRadialGradient(cx, cy, Math.max(0, R - half), cx, cy, R + half);
      ramp.addColorStop(0, mix(p.tar, p.gold, 0.14));
      ramp.addColorStop(0.14, mix(p.gold, p.tar, 0.58));
      ramp.addColorStop(0.44, mix(p.gold, p.tar, 0.2));
      ramp.addColorStop(0.62, p.gold);
      ramp.addColorStop(0.88, mix(p.gold, p.tar, 0.6));
      ramp.addColorStop(1, mix(p.tar, p.gold, 0.06));
      g.fillStyle = ramp;
      g.fillRect(cx - R - tube, cy - R - tube, (R + tube) * 2, (R + tube) * 2);

      // 2. the one key light: bright up-left, falling to tar down-right
      const key = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      key.addColorStop(0, rgba(p.bone, 0.24));
      key.addColorStop(0.34, rgba(p.goldBright, 0.04));
      key.addColorStop(0.7, rgba(p.tar, 0.26));
      key.addColorStop(1, rgba(p.tar, 0.6));
      g.fillStyle = key;
      g.fillRect(cx - R - tube, cy - R - tube, (R + tube) * 2, (R + tube) * 2);

      // 3. the twist: grooves crossing the tube at the lay angle. Even grooves
      //    are the seam between the two strands (deep); odd ones are the
      //    strand's own hammer line (shallow).
      const NG = Math.max(48, Math.round((TAU * R) / Math.max(5, tube * 0.36)));
      const lay = Math.min(0.85, (tube * 2.1) / R);
      for (let i = 0; i < NG; i++) {
        const a = (i / NG) * TAU;
        const deep = i % 2 === 0;                    // seam between the two rods
        const x0 = cx + Math.cos(a + lay) * (R - half * 1.15);
        const y0 = cy + Math.sin(a + lay) * (R - half * 1.15);
        const x1 = cx + Math.cos(a - lay) * (R + half * 1.15);
        const y1 = cy + Math.sin(a - lay) * (R + half * 1.15);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;                        // across the cut
        const ny = dx / len;
        g.lineCap = 'round';
        // the shade wall the cut casts, then the cut, then the arris it lifts.
        // Kept shallow on purpose: a twisted rod is gold with grooves in it,
        // not a wheel of dark spokes.
        g.strokeStyle = rgba(p.tar, deep ? 0.17 : 0.08);
        g.lineWidth = Math.max(1.4, tube * (deep ? 0.2 : 0.12));
        g.beginPath();
        g.moveTo(x0 - nx * tube * 0.08, y0 - ny * tube * 0.08);
        g.lineTo(x1 - nx * tube * 0.08, y1 - ny * tube * 0.08);
        g.stroke();
        g.strokeStyle = rgba(p.tar, deep ? 0.44 : 0.2);
        g.lineWidth = Math.max(1, tube * (deep ? 0.085 : 0.05));
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
        g.strokeStyle = rgba(deep ? p.goldBright : p.gold, deep ? 0.26 : 0.14);
        g.lineWidth = Math.max(0.8, tube * (deep ? 0.055 : 0.04));
        g.beginPath();
        g.moveTo(x0 + nx * tube * 0.1, y0 + ny * tube * 0.1);
        g.lineTo(x1 + nx * tube * 0.1, y1 + ny * tube * 0.1);
        g.stroke();
        // hammer facet on the crown of each strand
        const f = h01(i * 7 + 13);
        const am = a + (0.5 / NG) * TAU;
        const rr = R + (f - 0.5) * half * 0.8;
        g.fillStyle = rgba(p.goldBright, 0.06 + f * 0.1);
        g.beginPath();
        g.ellipse(cx + Math.cos(am) * rr, cy + Math.sin(am) * rr,
          Math.max(1.4, tube * 0.16), Math.max(1, tube * 0.085), am, 0, TAU);
        g.fill();
      }

      // 3b. THE TWIST ITSELF: each rod's crown wanders across the tube as the
      //     pair winds round, so the highlight travels with it. Two crowns, a
      //     half-turn apart — that is what makes a cable read as a cable and
      //     not as a band with lines drawn on it.
      const steps = NG * 4;
      for (let strand = 0; strand < 2; strand++) {
        const phase = strand * Math.PI;
        for (let i = 0; i < steps; i++) {
          const a0 = (i / steps) * TAU;
          const a1 = ((i + 1.2) / steps) * TAU;
          const u = Math.sin((NG / 2) * a0 + phase);
          const rr = R + u * half * 0.46;
          const facing = Math.max(0, Math.cos(a0 + Math.PI * 0.78)) * 0.72 + 0.28;
          const crown = Math.max(0, 1 - Math.abs(u) * 0.4);
          g.strokeStyle = rgba(p.goldBright, 0.04 + 0.3 * facing * crown);
          g.lineWidth = Math.max(1, half * 0.32);
          g.beginPath();
          g.arc(cx, cy, rr, a0, a1);
          g.stroke();
          // the shaded flank of the same rod, half a tube away
          g.strokeStyle = rgba(p.tar, 0.08 + 0.26 * (1 - facing));
          g.lineWidth = Math.max(0.9, half * 0.3);
          g.beginPath();
          g.arc(cx, cy, R - u * half * 0.6, a0, a1);
          g.stroke();
        }
      }

      // 4. sparse speculars, only where the key can reach
      for (let i = 0; i < NG; i += 3) {
        const a = (i / NG) * TAU;
        const face = Math.cos(a + Math.PI * 0.75);
        if (face < 0.25) continue;
        const f = h01(i * 31 + 5);
        const rr = R - half * 0.25 + (f - 0.5) * half * 0.4;
        g.strokeStyle = rgba(p.bone, 0.28 + face * 0.4);
        g.lineWidth = Math.max(0.7, tube * 0.055);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx + Math.cos(a - 0.02) * rr, cy + Math.sin(a - 0.02) * rr);
        g.lineTo(cx + Math.cos(a + 0.02) * rr, cy + Math.sin(a + 0.02) * rr);
        g.stroke();
      }

      // 5. patina settled in the low-light half, and old nicks
      const pat = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      pat.addColorStop(0, rgba(p.tar, 0));
      pat.addColorStop(0.55, rgba(p.tar, 0.05));
      pat.addColorStop(1, rgba(p.pine, 0.16));
      g.fillStyle = pat;
      g.fillRect(cx - R - tube, cy - R - tube, (R + tube) * 2, (R + tube) * 2);
      for (let i = 0; i < 11; i++) {
        const a = h01(i * 97 + 3) * TAU;
        const rr = R + (h01(i * 61) - 0.5) * half * 1.2;
        g.strokeStyle = rgba(p.tar, 0.3);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        g.lineTo(cx + Math.cos(a + 0.03) * (rr + half * 0.4), cy + Math.sin(a + 0.03) * (rr + half * 0.4));
        g.stroke();
      }
      g.restore();

      // 6. the two arrises that seat the rod against the board
      g.save();
      g.strokeStyle = rgba(p.tar, 0.85);
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(cx, cy, R + half, 0, TAU);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, R - half, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(p.goldBright, 0.24);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, R + half - 1.6, 0, TAU);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, R - half + 1.6, 0, TAU);
      g.stroke();
      g.restore();
    }

    function bake() {
      const key = `${G.S}`;
      if (plate && plateKey === key) return plate;
      const off = art.makeCanvas(G.S, G.S);
      paintPlinth(off.ctx);
      paintRod(off.ctx);
      plate = off.canvas;
      plateKey = key;
      return plate;
    }

    // A socket upset into the twist: the smith swelled the rod and drilled it.
    function paintSocket(g, i, full) {
      const { cx, cy, R, tube } = G;
      const a = angleOf(i);
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      g.save();
      g.translate(x, y);
      g.rotate(a);                                   // local +x runs outward
      // the metal upset around the hole — a swelling ON the rod, not a boss over it
      const bw = tube * 0.4;
      const bh = tube * 0.47;
      const boss = g.createLinearGradient(-bw, -bh, bw, bh);
      boss.addColorStop(0, rgba(p.goldBright, 0.5));
      boss.addColorStop(0.5, rgba(p.gold, 0.32));
      boss.addColorStop(1, rgba(mix(p.gold, p.tar, 0.5), 0.5));
      g.fillStyle = boss;
      g.beginPath();
      g.ellipse(0, 0, bw, bh, 0, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(p.tar, 0.22);
      g.lineWidth = 0.8;
      g.stroke();
      // the drilled eye: a hole through gold, dark, with a lit lower lip
      const er = Math.max(2, tube * 0.135);
      g.fillStyle = rgba(p.tar, 0.82);
      g.beginPath();
      g.arc(0, 0, er, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(p.tar, 0.85);
      g.lineWidth = Math.max(1, tube * 0.05);
      g.beginPath();
      g.arc(0, -0.4, er, Math.PI * 1.05, Math.PI * 2.0);
      g.stroke();
      g.strokeStyle = rgba(p.goldBright, 0.75);
      g.lineWidth = Math.max(0.8, tube * 0.045);
      g.beginPath();
      g.arc(0, 0.4, er, Math.PI * 0.05, Math.PI * 1.0);
      g.stroke();
      if (full) {
        // the split ring the shard hangs from, threaded through the eye
        g.strokeStyle = rgba(p.tar, 0.5);
        g.lineWidth = Math.max(1.4, tube * 0.085);
        g.beginPath();
        g.arc(-er * 0.7, 0.9, er * 1.15, -Math.PI * 0.62, Math.PI * 0.62, true);
        g.stroke();
        g.strokeStyle = rgba(p.goldBright, 0.92);
        g.lineWidth = Math.max(1.1, tube * 0.07);
        g.beginPath();
        g.arc(-er * 0.7, 0, er * 1.15, -Math.PI * 0.62, Math.PI * 0.62, true);
        g.stroke();
      } else {
        // an empty eye keeps a cold spark of the throne-light
        g.fillStyle = rgba(p.fjordLight, 0.3);
        g.beginPath();
        g.arc(-er * 0.3, -er * 0.3, Math.max(0.7, er * 0.3), 0, TAU);
        g.fill();
      }
      g.restore();
    }

    // Slot 0 is not gold: an iron rivet, forged and peened through the ring.
    function paintRivet(g) {
      const { cx, cy, R, tube } = G;
      const a = angleOf(inst.northNail);
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      const r = tube * 0.72;
      const iron = mix(p.tar, p.bone, 0.42);
      const ironLo = mix(p.tar, p.fjordLight, 0.2);
      g.save();
      g.translate(x, y);
      // seating shadow — the head stands proud of the gold
      g.fillStyle = rgba(p.tar, 0.6);
      g.beginPath();
      g.arc(1.6, 2.4, r * 1.02, 0, TAU);
      g.fill();
      // the forged head: struck flats, not a turned dome
      g.beginPath();
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * TAU - Math.PI / 2;
        const rr = r * (0.86 + h01(k * 17 + 2) * 0.2);
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = ironLo;
      g.fill();
      g.strokeStyle = rgba(p.tar, 0.95);
      g.lineWidth = 1.5;
      g.stroke();
      // struck flats: a forged head is planes, not a turned dome
      const facet = (a0, a1, tone) => {
        g.beginPath();
        g.moveTo(0, 0);
        for (let k = 0; k <= 3; k++) {
          const ang = a0 + ((a1 - a0) * k) / 3;
          const rr = r * (0.86 + h01(Math.round(ang * 40) * 17 + 2) * 0.2);
          g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        g.closePath();
        g.fillStyle = tone;
        g.fill();
      };
      facet(-Math.PI * 0.95, -Math.PI * 0.3, mix(iron, p.bone, 0.42));
      facet(-Math.PI * 0.3, Math.PI * 0.12, iron);
      facet(Math.PI * 0.12, Math.PI * 0.62, mix(ironLo, iron, 0.45));
      facet(Math.PI * 0.62, Math.PI * 1.05, mix(p.tar, ironLo, 0.55));
      g.strokeStyle = rgba(p.tar, 0.5);
      g.lineWidth = 0.9;
      for (const ang of [-Math.PI * 0.3, Math.PI * 0.12, Math.PI * 0.62]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(ang) * r * 0.95, Math.sin(ang) * r * 0.95);
        g.stroke();
      }
      // peening marks — the hammer left the head dished and dented
      for (let k = 0; k < 6; k++) {
        const ang = h01(k * 41 + 9) * TAU;
        const rr = r * (0.2 + h01(k * 23) * 0.42);
        g.strokeStyle = rgba(p.tar, 0.4);
        g.lineWidth = 1.1;
        g.beginPath();
        g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, r * 0.24, ang - 1.1, ang + 0.8);
        g.stroke();
        g.strokeStyle = rgba(p.bone, 0.16);
        g.beginPath();
        g.arc(Math.cos(ang) * rr + 0.7, Math.sin(ang) * rr + 0.8, r * 0.24, ang - 1.1, ang + 0.8);
        g.stroke();
      }
      // rust bloom in the low corner, cold specular in the high one
      g.fillStyle = rgba(p.blood, 0.13);
      g.beginPath();
      g.ellipse(r * 0.3, r * 0.34, r * 0.42, r * 0.3, 0.6, 0, TAU);
      g.fill();
      g.fillStyle = rgba(p.bone, 0.4);
      g.beginPath();
      g.ellipse(-r * 0.36, -r * 0.4, r * 0.24, r * 0.055, -0.62, 0, TAU);
      g.fill();
      g.restore();
    }

    // A bone chip off a broken lock: painted rune, number in blood.
    function paintShard(g, w, h, rune, value, mood) {
      const s = shardOf(rune);
      const v = value != null ? value : (s ? s.value : '');
      const seed = FUTHARK14.indexOf(rune) + 1;
      const bone = mood === 'gone' ? mix(p.oakDeep, p.bone, 0.16) : mix(p.bone, p.oakLight, 0.2);
      const halfW = w / 2;
      const halfH = h / 2;

      g.save();
      g.translate(halfW, halfH);
      // the chip's broken outline — never a rounded rectangle
      const pts = [];
      const N = 9;
      for (let k = 0; k < N; k++) {
        const ang = (k / N) * TAU - Math.PI / 2;
        const jag = 0.84 + h01(seed * 31 + k * 7) * 0.22;
        pts.push([Math.cos(ang) * halfW * jag, Math.sin(ang) * halfH * jag]);
      }
      const outline = (c) => {
        c.beginPath();
        pts.forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py)));
        c.closePath();
      };
      // seated shadow
      g.save();
      g.translate(1.4, 2);
      g.fillStyle = rgba(p.tar, mood === 'gone' ? 0.35 : 0.6);
      outline(g);
      g.fill();
      g.restore();

      if (mood === 'gone') {
        // the empty notch the shard left on the hasp
        g.fillStyle = rgba(p.tar, 0.72);
        outline(g);
        g.fill();
        g.strokeStyle = rgba(p.oakLight, 0.4);
        g.lineWidth = 1;
        outline(g);
        g.stroke();
        g.restore();
        return;
      }

      const face = g.createLinearGradient(-halfW, -halfH, halfW * 0.6, halfH);
      face.addColorStop(0, mix(bone, p.boneDim, 0.12));
      face.addColorStop(0.5, mix(bone, p.oakLight, 0.14));
      face.addColorStop(1, mix(bone, p.oakLight, 0.62));
      g.fillStyle = face;
      outline(g);
      g.fill();
      // bone grain: pores and old stain
      for (let k = 0; k < 7; k++) {
        const f = h01(seed * 13 + k * 29);
        g.fillStyle = rgba(mix(p.oakLight, p.tar, 0.4), 0.06 + f * 0.09);
        g.beginPath();
        g.ellipse((f - 0.5) * w * 0.7, (h01(seed + k * 3) - 0.5) * h * 0.72,
          1.2 + f * 3.4, 0.7 + f * 1.4, f * 3, 0, TAU);
        g.fill();
      }
      // the broken edge: dark under-cut, lit arris on the light side
      g.strokeStyle = rgba(p.tar, 0.82);
      g.lineWidth = 1.2;
      outline(g);
      g.stroke();
      g.save();
      g.translate(-0.8, -1);
      g.strokeStyle = rgba(p.bone, 0.3);
      g.lineWidth = 0.9;
      outline(g);
      g.stroke();
      g.restore();
      // graded into the hearth: warm on the lit side, tar gathering below-right
      const grade = g.createLinearGradient(-halfW, -halfH, halfW, halfH);
      grade.addColorStop(0, rgba(p.ember, 0.05));
      grade.addColorStop(0.55, rgba(p.tar, 0.06));
      grade.addColorStop(1, rgba(p.tar, 0.3));
      g.fillStyle = grade;
      outline(g);
      g.fill();
      // the drilled hole it hangs by
      g.fillStyle = rgba(p.tar, 0.85);
      g.beginPath();
      g.arc(0, -halfH * 0.72, Math.max(1.6, w * 0.055), 0, TAU);
      g.fill();
      g.strokeStyle = rgba(mix(p.tar, p.bone, 0.5), 0.5);
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(0, -halfH * 0.72, Math.max(1.6, w * 0.055), Math.PI * 0.1, Math.PI * 1.05);
      g.stroke();
      g.restore();

      // the rune, painted into the bone in blood
      const rs = Math.min(w * 0.58, h * 0.5);
      art.drawRune(g, rune, halfW - rs / 2, halfH - rs * 0.72, rs, {
        color: mood === 'held' ? mix(p.blood, p.ember, 0.4) : p.blood,
        weight: Math.max(1.6, rs / 8),
      });
      // and its number, same red hand
      g.save();
      g.font = `${Math.max(9, Math.round(h * 0.19))}px ${MONO}`;
      g.textAlign = 'center';
      g.fillStyle = rgba(p.tar, 0.55);
      g.fillText(String(v), halfW + 0.7, halfH + h * 0.365 + 0.8);
      g.fillStyle = mix(p.blood, p.ember, 0.22);
      g.fillText(String(v), halfW, halfH + h * 0.365);
      g.restore();
    }

    // The hoard read at a glance: fourteen pips and the count, cut into the dais.
    function paintTally(g) {
      const { cx, cy, R } = G;
      const n = filledCount();
      const heart = Math.max(26, G.chipR - G.chipH * 0.5 - 6);
      const pipR = Math.max(2.4, heart * 0.05);
      const ring0 = heart * 0.68;
      // the count sits in a gold-inlaid channel cut into the dais
      g.save();
      g.strokeStyle = rgba(p.tar, 0.65);
      g.lineWidth = Math.max(3, pipR * 1.9);
      g.beginPath();
      g.arc(cx, cy, ring0, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(p.gold, 0.55);
      g.lineWidth = Math.max(1.4, pipR * 0.8);
      g.beginPath();
      g.arc(cx, cy, ring0, 0, TAU);
      g.stroke();
      g.strokeStyle = rgba(p.goldBright, 0.4);
      g.lineWidth = Math.max(0.8, pipR * 0.34);
      g.beginPath();
      g.arc(cx, cy - 0.8, ring0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      g.restore();
      for (let i = 0; i < SLOTS; i++) {
        const a = angleOf(i);
        const x = cx + Math.cos(a) * ring0;
        const y = cy + Math.sin(a) * ring0;
        g.fillStyle = rgba(p.tar, 0.7);
        g.beginPath();
        g.arc(x + 0.6, y + 0.8, pipR, 0, TAU);
        g.fill();
        if (ring[i]) {
          g.fillStyle = rgba(p.goldBright, 0.9);
          g.beginPath();
          g.arc(x, y, pipR, 0, TAU);
          g.fill();
        } else {
          g.strokeStyle = rgba(p.oakLight, 0.55);
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, y, pipR, 0, TAU);
          g.stroke();
        }
      }
      const size = Math.max(15, Math.round(heart * 0.3));
      art.carveText(g, `${n}/${SLOTS}`, cx, cy + size * 0.36, size, {
        color: n === SLOTS ? p.goldBright : p.boneDim, depth: 0.75, align: 'center',
      });
      // the nail names itself, quietly, under the count
      art.carveText(g, T('nailWord'), cx, cy + size * 1.5, Math.max(9, Math.round(heart * 0.12)),
        { color: p.boneDim, depth: 0.5, align: 'center' });
    }

    // The slot's own number, engraved on the OUTER face of the ring — the band
    // between the rod and the rim, where the smith numbered his sockets.
    function paintIndices(g) {
      const { cx, cy, R, tube } = G;
      g.save();
      g.font = `${Math.max(9, Math.round(tube * 0.4))}px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < SLOTS; i++) {
        const a = angleOf(i);
        const rr = R + tube * 0.5 + 10;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        g.fillStyle = rgba(p.tar, 0.75);
        g.fillText(String(i), x + 0.7, y + 0.8);
        g.fillStyle = rgba(p.boneDim, ring[i] ? 0.55 : 0.85);
        g.fillText(String(i), x, y);
      }
      g.restore();
    }

    // The hung shards, threaded on the ring and lying inside it — each on its
    // own gold wire off the socket, splayed just enough to stay readable.
    function paintHung(g) {
      const { cx, cy, R, tube, chipW, chipH, chipR } = G;
      for (let i = 0; i < SLOTS; i++) {
        const rune = ring[i];
        if (!rune) continue;
        const a = angleOf(i);
        const cxx = cx + Math.cos(a) * chipR;
        const cyy = cy + Math.sin(a) * chipR;
        // the wire from the socket down to the chip
        g.save();
        g.strokeStyle = rgba(p.tar, 0.6);
        g.lineWidth = Math.max(1.8, tube * 0.14);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (R - tube * 0.2) + 1, cy + Math.sin(a) * (R - tube * 0.2) + 1.2);
        g.lineTo(cxx + 1, cyy + 1.2);
        g.stroke();
        g.strokeStyle = rgba(p.goldBright, 0.8);
        g.lineWidth = Math.max(1.2, tube * 0.09);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (R - tube * 0.2), cy + Math.sin(a) * (R - tube * 0.2));
        g.lineTo(cxx, cyy);
        g.stroke();
        g.restore();

        const tilt = clamp(wrapPi(a + Math.PI / 2) * 0.3, -0.38, 0.38);
        g.save();
        g.translate(cxx, cyy);
        g.rotate(tilt);
        g.translate(-chipW / 2, -chipH / 2);
        paintShard(g, chipW, chipH, rune, shardOf(rune).value, 'hung');
        g.restore();
      }
    }

    // The ring is nearly whole and it shows: the gold warms and the sockets
    // that carry a shard keep their own small light.
    function paintCharge(g) {
      const { cx, cy, R, tube } = G;
      const n = filledCount();
      if (!n) return;
      for (let i = 0; i < SLOTS; i++) {
        if (!ring[i]) continue;
        const a = angleOf(i);
        const strength = i === hot ? 0.32 : 0.07 + (n / SLOTS) * 0.07;
        art.glow(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, tube * (i === hot ? 1.5 : 0.95), p.gold, strength);
      }
      if (n >= SLOTS - 2) {
        // the last two sockets: the whole rod takes a charge, but the twist has
        // to stay legible through it — a warming, never a floodlight
        g.save();
        g.globalAlpha = 0.05 + (n - (SLOTS - 3)) * 0.045;
        g.strokeStyle = p.goldBright;
        g.lineWidth = tube * 0.55;
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.stroke();
        g.restore();
      }
    }

    // The near-line, read on the metal — never naming which sockets are wrong.
    function paintRefusal(g, t) {
      if (!refusal) return;
      const { cx, cy, R, tube } = G;
      const k = clamp(t, 0, 1);
      if (refusal.kind === 'nail') {
        const pulse = Math.sin(k * Math.PI) ** 2;
        const a = angleOf(inst.northNail);
        art.glow(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, tube * 3.4, p.fjordLight, 0.75 * pulse);
        return;
      }
      if (refusal.kind === 'swap') {
        // the light runs the whole ring and stalls a hair short of closing
        const sweep = Math.min(0.94, k * 1.25) * TAU;
        const fade = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
        g.save();
        g.globalAlpha = 0.85 * fade;
        g.strokeStyle = p.goldBright;
        g.lineWidth = tube * 0.5;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + sweep);
        g.stroke();
        g.restore();
        const head = -Math.PI / 2 + sweep;
        art.glow(g, cx + Math.cos(head) * R, cy + Math.sin(head) * R, tube * 2.2, p.goldBright, 0.8 * fade);
        return;
      }
      const dull = Math.sin(k * Math.PI);
      g.save();
      g.globalAlpha = 0.35 * dull;
      g.strokeStyle = p.tar;
      g.lineWidth = tube * 1.2;
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.stroke();
      g.restore();
    }

    function paint(t) {
      const g = ringCv.ctx;
      g.clearRect(0, 0, G.S, G.S);
      g.drawImage(bake(), 0, 0, G.S, G.S);
      paintTally(g);
      paintIndices(g);
      paintCharge(g);
      for (let i = 0; i < SLOTS; i++) if (i !== inst.northNail) paintSocket(g, i, !!ring[i]);
      paintRivet(g);
      paintHung(g);
      paintRefusal(g, t == null ? 1 : t);
    }

    // ======================================================================
    // MOTION — the ring answers the hand
    // ======================================================================
    function turnRing(dir) {
      if (calm || !ringCv.canvas.animate) return;
      const deg = 1.7 * dir;
      try {
        motions.push(ringCv.canvas.animate([
          { transform: 'translate(-50%,-50%) rotate(0deg)' },
          { transform: `translate(-50%,-50%) rotate(${deg}deg)`, offset: 0.34 },
          { transform: `translate(-50%,-50%) rotate(${-deg * 0.3}deg)`, offset: 0.68 },
          { transform: 'translate(-50%,-50%) rotate(0deg)' },
        ], { duration: 440, easing: 'ease-out' }));
      } catch (e) { /* no WAAPI: the ring simply stands still */ }
    }

    function shudderRing() {
      if (calm || !ringCv.canvas.animate) return;
      try {
        motions.push(ringCv.canvas.animate([
          { transform: 'translate(-50%,-50%) rotate(0deg)' },
          { transform: 'translate(-50%,-50%) rotate(-2.1deg)', offset: 0.25 },
          { transform: 'translate(-50%,-50%) rotate(2.1deg)', offset: 0.55 },
          { transform: 'translate(-50%,-50%) rotate(-1deg)', offset: 0.8 },
          { transform: 'translate(-50%,-50%) rotate(0deg)' },
        ], { duration: 560, easing: 'ease-in-out' }));
      } catch (e) { /* still ring, same verdict */ }
    }

    let refuseRaf = 0;
    function runRefusal(kind) {
      refusal = { kind };
      if (kind === 'swap') shudderRing();
      if (!rafFn || calm) {
        // reduced motion: the same verdict, held still, then let go
        paint(kind === 'swap' ? 0.75 : 0.5);
        later(() => { refusal = null; render(); }, 1600);
        return;
      }
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const step = () => {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const k = (now - t0) / 1050;
        if (k >= 1) { refuseRaf = 0; refusal = null; render(); return; }
        paint(k);
        refuseRaf = rafFn(step);
      };
      refuseRaf = rafFn(step);
    }

    // The hung rune sounds its own note: the slide of bone on gold, then a
    // strike whose delay is that rune's place in the row — fourteen shards,
    // fourteen chimes, and the ring fills up louder as it nears whole.
    function hangVoice(rune, slot) {
      sfx(slot === inst.northNail ? 'knock' : 'slide');
      const ix = Math.max(0, FUTHARK14.indexOf(rune));
      later(() => sfx('tick'), 58 + ix * 7);
      const n = filledCount();
      if (n >= SLOTS - 2 && n < SLOTS) later(() => sfx('tick'), 150 + ix * 7);
      if (n === SLOTS) later(() => sfx('confirm'), 170);
    }

    // ======================================================================
    // INTERACTION
    // ======================================================================
    let dragFrom = null;
    on(document, 'pointerup', (ev) => {
      if (!dragFrom || ctx.solved) { dragFrom = null; return; }
      const moved = Math.hypot(ev.clientX - dragFrom.x, ev.clientY - dragFrom.y) > 8;
      const rune = dragFrom.rune;
      dragFrom = null;
      if (!moved) return;
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const slot = slotBtns.indexOf(target);
      if (slot >= 0) { takeTheRing(); held = rune; placeAt(slot); }
    });

    function touchChip(rune) {
      if (ctx.solved) return;
      takeTheRing();
      const at = ring.indexOf(rune);
      if (at >= 0) { touchSlot(at); return; }      // hung: this takes it back
      held = held === rune ? null : rune;
      sfx('tick');
      render(held ? T('inHand', { name: runeName(held) }) : '');
    }

    function touchSlot(i) {
      if (ctx.solved) return;
      takeTheRing();
      if (!held) {
        if (!ring[i]) { sfx('deny'); return; }
        held = ring[i];
        ring[i] = null;
        hot = -1;
        sfx('flip');
        say(T('liftedFrom', { name: runeName(held), i }));
        render(T('inHand', { name: runeName(held) }));
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
      hot = i;
      hangVoice(rune, i);
      turnRing(i % 2 ? 1 : -1);
      say(i === inst.northNail
        ? T('hungNail', { name: runeName(rune), i })
        : T('hung', { name: runeName(rune), i }));
      render(held ? T('inHand', { name: runeName(held) }) : '');
    }

    // ---- words for the ring ----------------------------------------------
    function ringWords() {
      const laid = ring.map((ch, i) => (ch ? `${i}: ${runeName(ch)} (${shardOf(ch).value})` : null)).filter(Boolean);
      return laid.length
        ? T('ringLaid', { laid: laid.join(', '), empty: SLOTS - laid.length })
        : T('ringBare');
    }

    function chipKey(c) {
      const at = ring.indexOf(c.rune);
      return `${at}|${held === c.rune ? 1 : 0}`;
    }

    function render(announce) {
      if (!G) G = geometry();
      paint(1);
      ringCv.canvas.setAttribute('aria-label', ringWords());

      const nail = T('nailAria');
      for (let i = 0; i < SLOTS; i++) {
        const b = slotBtns[i];
        const rune = ring[i];
        b.dataset.filled = rune ? '1' : '0';
        b.setAttribute('aria-label', rune
          ? T('slotFull', { i, nail: i === inst.northNail ? nail : '', name: runeName(rune), v: shardOf(rune).value })
          : T('slotEmpty', { i, nail: i === inst.northNail ? nail : '' }));
      }

      for (const c of chips) {
        const at = ring.indexOf(c.rune);
        c.b.dataset.held = held === c.rune ? '1' : '0';
        c.b.dataset.hung = at >= 0 ? '1' : '0';
        c.b.setAttribute('aria-label', at >= 0
          ? T('shardHung', { name: runeName(c.rune), v: c.value, i: at })
          : T('shard', { name: runeName(c.rune), v: c.value }));
        const key = chipKey(c);
        if (key !== c.key) {
          c.key = key;
          c.face.ctx.clearRect(0, 0, CHIP_W, CHIP_H);
          paintShard(c.face.ctx, CHIP_W, CHIP_H, c.rune, c.value, at >= 0 ? 'gone' : (held === c.rune ? 'held' : 'hasp'));
        }
      }

      const n = filledCount();
      progress.textContent = n === SLOTS ? T('filledAll') : T('filled', { n });
      closeBtn.disabled = !!ctx.solved || n < SLOTS;
      if (announce !== undefined) status.textContent = announce;
    }

    // ---- layout ----------------------------------------------------------
    function applySize(want) {
      G = geometry(want);
      ringBox.style.height = `${G.S}px`;
      // as a flex item beside the hasp the host has no intrinsic width (the
      // canvas is absolute), so it has to be told
      ringBox.style.width = stage.dataset.wide === '1' ? `${G.S}px` : '100%';
      G.hostW = stage.dataset.wide === '1' ? G.S : (ringBox.getBoundingClientRect().width || G.S);
      const fresh = art.makeCanvas(G.S, G.S);
      fresh.canvas.setAttribute('role', 'img');
      fresh.canvas.setAttribute('aria-label', ringCv.canvas.getAttribute('aria-label') || '');
      if (ringBox.replaceChild) ringBox.replaceChild(fresh.canvas, ringCv.canvas);
      else { ringCv.canvas.remove(); ringBox.append(fresh.canvas); }
      ringCv = fresh;
      plate = null;
      plateKey = '';
      const left = G.hostW / 2;
      const top = G.S / 2;
      for (let i = 0; i < SLOTS; i++) {
        const a = angleOf(i);
        const b = slotBtns[i];
        b.style.left = `${Math.round(left + Math.cos(a) * G.R)}px`;
        b.style.top = `${Math.round(top + Math.sin(a) * G.R)}px`;
        b.style.width = `${Math.round(G.hitR)}px`;
        b.style.height = `${Math.round(G.hitR)}px`;
      }
      // read-only diagnostic for the density gate (same footing as lock 05's
      // __OW5_BOX): the rod's band in device px, so a capture can tell the
      // puzzle furniture from the dead zones it has to prove are carved.
      if (live) {
        const k = (ringCv.canvas.width || G.S) / G.S;
        window.__OW15_RING = {
          cx: G.cx * k, cy: G.cy * k, rIn: (G.R - G.tube * 0.6) * k, rOut: (G.R + G.tube * 0.6) * k,
        };
      }
      render();
    }

    // The one control the player must reach is `Close the ring`; it never goes
    // under the fold. The ring is the only elastic thing on the board, so it
    // takes whatever is left and gives back whatever is short. Growing it moves
    // the actions by the same amount (or half, when the room centres its
    // content), so three damped passes settle it at either viewport.
    function relayout() {
      applySize(null);
      if (!live) return;
      for (let pass = 0; pass < 3; pass++) {
        const vh = window.innerHeight || 800;
        const slack = vh - 14 - acts.getBoundingClientRect().bottom;
        if (Math.abs(slack) < 10) break;
        const want = Math.round(clamp(G.S + slack, 236, Math.min(G.hostW, 520)));
        if (want === G.S) break;
        applySize(want);
      }
    }

    let resizeRaf = 0;
    if (live) {
      on(window, 'resize', () => {
        if (resizeRaf) return;
        const q = rafFn || ((fn) => setTimeout(fn, 32));
        resizeRaf = q(() => { resizeRaf = 0; relayout(); });
      });
    }

    // ---- the showing: three seconds of a ghost hand ----------------------
    // A deliberately WRONG hang — the verb is taught, the law is not touched.
    const DEMO_RUNE = shards[shards.length - 1].rune;
    const DEMO_SLOT = RING[6] === DEMO_RUNE ? 5 : 6;

    function takeTheRing() {
      if (touched) return;
      touched = true;
      endShowing(true);
    }

    function endShowing(quiet) {
      for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
      motions = [];
      ghostHost.style.display = 'none';
      skipBtn.style.display = 'none';
      if (!quiet) status.textContent = '';
    }

    function showTheWay() {
      if (!live || ctx.solved || touched) return;
      const src = chips.find((c) => c.rune === DEMO_RUNE);
      const dst = slotBtns[DEMO_SLOT];
      if (!src || !dst) return;
      const base = stage.getBoundingClientRect();
      const a = src.b.getBoundingClientRect();
      const b = dst.getBoundingClientRect();
      if (!a.width || !b.width || !base.width) return;

      if (!ghostCv) {
        ghostCv = art.makeCanvas(G.chipW, G.chipH);
        ghostHost.append(ghostCv.canvas);
      }
      const gc = ghostCv.ctx;
      gc.clearRect(0, 0, G.chipW, G.chipH);
      paintShard(gc, G.chipW, G.chipH, DEMO_RUNE, shardOf(DEMO_RUNE).value, 'held');
      gc.save();
      gc.strokeStyle = rgba(p.goldBright, 0.85);
      gc.lineWidth = 2;
      if (gc.setLineDash) gc.setLineDash([5, 4]);
      gc.strokeRect(2, 2, G.chipW - 4, G.chipH - 4);
      gc.restore();
      art.glow(gc, G.chipW / 2, G.chipH / 2, G.chipW * 0.8, p.goldBright, 0.35);

      const x0 = a.left - base.left + a.width / 2 - G.chipW / 2;
      const y0 = a.top - base.top + a.height / 2 - G.chipH / 2;
      const x1 = b.left - base.left + b.width / 2 - G.chipW / 2;
      const y1 = b.top - base.top + b.height / 2 - G.chipH / 2;
      ghostHost.style.display = 'block';
      ghostHost.style.transform = `translate(${Math.round(x0)}px,${Math.round(y0)}px)`;
      skipBtn.style.display = '';
      status.textContent = T('showing');

      if (!calm && ghostHost.animate) {
        try {
          motions.push(ghostHost.animate([
            { transform: `translate(${x0}px,${y0}px)`, opacity: 0 },
            { transform: `translate(${x0}px,${y0 - 8}px)`, opacity: 1, offset: 0.14 },
            { transform: `translate(${x1}px,${y1}px)`, opacity: 1, offset: 0.44 },
            { transform: `translate(${x1}px,${y1}px)`, opacity: 1, offset: 0.62 },
            { transform: `translate(${x0}px,${y0 - 8}px)`, opacity: 1, offset: 0.9 },
            { transform: `translate(${x0}px,${y0}px)`, opacity: 0 },
          ], { duration: 2900, easing: 'ease-in-out' }));
        } catch (e) { /* no WAAPI: the static showing below still teaches it */ }
      } else {
        ghostHost.style.transform = `translate(${Math.round(x1)}px,${Math.round(y1)}px)`;
      }
      later(() => endShowing(false), 3000);
    }

    // ---- submit ----------------------------------------------------------
    function refusalKind(near) {
      if (!near) return 'dull';
      if (near.indexOf('north nail') >= 0) return 'nail';
      if (near.indexOf('each other') >= 0) return 'swap';
      return 'dull';
    }

    on(clearBtn, 'click', () => {
      takeTheRing();
      if (ctx.solved) return;
      ring.fill(null);
      held = null;
      hot = -1;
      refusal = null;
      sfx('knock');
      say(T('apart'));
      render('');
    });

    on(skipBtn, 'click', () => { takeTheRing(); closeBtn.focus && closeBtn.focus(); });

    on(closeBtn, 'click', () => {
      takeTheRing();
      if (ctx.solved || ring.some((x) => !x)) { sfx('deny'); return; }
      say(ringWords());
      let res;
      try { res = ctx.submit({ ring: ring.slice() }) || {}; } catch (e) { return; }
      if (res.ok) return;
      const line = nearOf(res.near) || T('refused');
      status.textContent = line;
      if (status.scrollIntoView) status.scrollIntoView({ block: 'nearest' });
      runRefusal(refusalKind(res.near));
    });

    // ---- open the lock ---------------------------------------------------
    if (ctx.solved) {
      clearBtn.disabled = true;
      closeBtn.disabled = true;
      for (const c of chips) c.b.disabled = true;
      for (const b of slotBtns) b.disabled = true;
      touched = true;
    }
    relayout();
    say(T('opening'));
    say(T('keysNote'));
    render(ctx.solved ? T('closed') : '');
    if (!ctx.solved) later(showTheWay, 60);

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        for (const t of timers) clearTimeout(t);
        timers.length = 0;
        for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
        motions = [];
        if (refuseRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(refuseRaf);
        refuseRaf = 0;
        if (resizeRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(resizeRaf);
        resizeRaf = 0;
        dragFrom = null;
        plate = null;
        wrap.remove();
      },
    };
  },
};
