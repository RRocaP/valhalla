// 14 — THE BIND-RUNE SEAL (tier 4)
//
// One deep-cut figure on the hasp: the union of the canonical stroke segments
// (src/kernel/futhark.js, and nowhere else) of a secret five- or six-rune
// subset, all of them hung on the one common stave. Name the runes bound in it.
//
// THE LAW (both halves are enforced by verify):
//   1. Union — the strokes of the named runes must be exactly the carved
//      strokes. Not one stroke short, not one stroke over.
//   2. Minimality — no named rune may be dropped without losing a carved
//      stroke. A rune that adds nothing was never bound.
//
// SEGMENT IDENTITY: a segment is its exact kernel polyline. In the frozen
// futhark the ONLY segment shared between runes is the stave itself — every
// branch belongs to exactly one rune. Two consequences, both load-bearing:
//   · Uniqueness is structural. Every branch of the carving names its own rune,
//     so the generating subsets are exactly {core} and {core, ᛁ}, and the
//     single minimal one is the core. makePuzzle still runs the full 2^16
//     sweep of docs/LOCKS.md §14 to prove it per instance rather than assume it.
//   · TRAPS. ᛁ (íss) is the one rune the kernel data allows to be fully covered
//     by others — its lone stave is shared by all stave-bearing runes — so it
//     is always carved, always tempting, and always wrong, because it is always
//     removable. The generator additionally plants >= 2 one-stroke-short traps:
//     runes whose every branch but one is already carved (necessarily the
//     single-branch runes ᚦ ᚴ ᚾ ᛅ ᛚ that were not chosen). ᚢ and ᛋ carry no
//     stave at all and can never belong. This taxonomy is the amended §14.
//
// ANSWER: { runes: [chars, futhark-sorted] }. The sort is canonical form, not
// decoration — an unsorted correct set is rejected, which is also what makes a
// swapped-pair mutation of the answer fail.
//
// Difficulty accounting (docs/CONTRACT.md §4): all 16 candidates selected once
// to read their strokes against the carving (16), the 10–11 that over-carve
// deselected again (10), minimality re-checked on the survivors (5), sealing
// (1) = 32.
//
// PURE HALF: no DOM, no Date, no Math.random, no module-level mutable state.

import { FUTHARK, ORDER, STAVE } from '../kernel/futhark.js';
import { localizeNear } from '../kernel/i18n.js';
import { SHARDS } from '../kernel/shards.js';

const segKey = (seg) => JSON.stringify(seg);
const STAVE_KEY = segKey(STAVE);

// Bit index per distinct kernel segment (28 of them; the stave is bit 0).
const SEGMENTS = (() => {
  const keys = [STAVE_KEY];
  for (const r of FUTHARK) for (const s of r.segments) {
    const k = segKey(s);
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
})();
const SEG_BIT = new Map(SEGMENTS.map((k, i) => [k, i]));
const RUNE_MASK = Object.fromEntries(FUTHARK.map((r) => [
  r.ch,
  r.segments.reduce((m, s) => m | (1 << SEG_BIT.get(segKey(s))), 0),
]));
const ORDER_INDEX = Object.fromEntries(ORDER.map((ch, i) => [ch, i]));
const BRANCHES = Object.fromEntries(FUTHARK.map((r) => [
  r.ch,
  r.segments.filter((s) => segKey(s) !== STAVE_KEY).length,
]));
// Every rune hung on the common stave, minus ᛁ — which can never be part of an
// answer, since its stave is always carved by somebody else.
const POOL = ORDER.filter((ch) => (RUNE_MASK[ch] & 1) !== 0 && ch !== 'ᛁ');

const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const sortRunes = (chars) => chars.slice().sort((a, b) => ORDER_INDEX[a] - ORDER_INDEX[b]);
const maskOf = (chars) => chars.reduce((m, ch) => m | (RUNE_MASK[ch] || 0), 0);

// docs/LOCKS.md §14: all 2^16 subsets of the row, every union, every minimal
// generating set.
function sweepSubsets(carved) {
  const runeMask = ORDER.map((ch) => RUNE_MASK[ch]);
  const total = 1 << 16;
  const union = new Int32Array(total);
  for (let s = 1; s < total; s++) {
    const low = s & -s;
    union[s] = union[s ^ low] | runeMask[31 - Math.clz32(low)];
  }
  const minimal = [];
  for (let s = 0; s < total; s++) {
    if (union[s] !== carved) continue;
    let isMinimal = true;
    for (let i = 0; i < 16 && isMinimal; i++) {
      if ((s & (1 << i)) !== 0 && union[s ^ (1 << i)] === carved) isMinimal = false;
    }
    if (isMinimal) minimal.push(ORDER.filter((_, i) => (s & (1 << i)) !== 0));
  }
  return minimal;
}

function carvedMaskOf(instance) {
  let mask = 0;
  for (const seg of instance.segments) {
    const bit = SEG_BIT.get(segKey(seg));
    if (bit === undefined) return -1;
    mask |= 1 << bit;
  }
  return mask;
}

function trapsFor(chosen, carved) {
  const full = [];
  const oneShort = [];
  for (const ch of ORDER) {
    if (chosen.includes(ch)) continue;
    const outside = popcount(RUNE_MASK[ch] & ~carved);
    if (outside === 0) full.push(ch);
    else if (outside === 1) oneShort.push(ch);
  }
  return { full, oneShort };
}

// ------------------------------------------------------------------ the view

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";

// View-side colour math. The frozen art API exports palette TOKENS, not colour
// helpers, and src/art/index.js is the only art file a lock may import
// (docs/ART.md) — so the board keeps its own mixer, as 01-runerow does.
const hexRgb = (h) => {
  const n = parseInt(String(h).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return `#${A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join('')}`;
};

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  law: 'Name exactly the runes bound in the carving — every stroke claimed, no rune idle.',
  legend: 'Gold: a stroke your runes claim. Pale: a stroke of the carving still unclaimed. Red: a cut your runes would make that the hasp does not carry.',
  legendShort: 'Gold: claimed. Pale: unclaimed. Red: cut astray.',
  trayLabel: 'The sixteen of the row, loose in the tray',
  tally: '{n} strokes of {m} claimed',
  tallyOne: '{n} stroke of {m} claimed',
  tallyAll: 'All {m} strokes claimed — and nothing idle. Name the bound runes.',
  clear: 'Lift them all out',
  submit: 'Name the bound runes',
  skip: 'Skip the showing',
  demoSay: 'Watch once: a rune laid on the carving burns the strokes it claims.',
  sayClaims: '{name} claims {n} of the carving’s strokes.',
  sayIdle: '{name} claims nothing the others have not already cut.',
  sayWaste: '{name} would cut {n} astray — strokes the hasp does not carry.',
  sayLifted: '{name} lifted off the carving.',
  cleared: 'Every rune lifted off the carving.',
  named: 'Named the bind-rune: {names}.',
  opening: 'A bind-rune of {n} strokes on one stave. Name every rune bound in it — and no rune that is not.',
  solvedLine: 'The carving is read.',
  deny: 'The seal does not answer to those names.',
  ariaNamed: 'Named: {names}. ',
  ariaNone: 'No rune is named yet. ',
  ariaOver: ', {n} cut astray',
  ariaSeal: 'The bind-rune carved in the hasp. {words}{tally}.',
  ariaGauge: '{n} of {m} strokes claimed',
  ariaOn: ', laid on the carving, claims {n}',
  ariaOnIdle: ', laid on the carving, claims nothing',
  ariaOnWaste: ', laid on the carving, cuts {n} astray',
};

const I18N = {
  es: {
    title: 'El Sello de Runas Ligadas',
    epigraph: 'Seis nombres tallados uno sobre otro en una sola asta. El asta es de todos ellos y de ninguno.',
    hints: [
      'Cada trazo del sello pertenece a alguna runa. Halla la runa dueña de cada trazo y habrás hallado el sello.',
      'El asta larga del centro pertenece a toda runa que cuelgue de ella — luego no nombra a ninguna. Juzga una runa solo por sus ramas.',
      'Una runa que pudiera sacarse sin que la talla perdiera un solo trazo nunca estuvo ligada. Esa es toda la prueba, y descarta siempre a la runa del hielo.',
    ],
    nearMap: {
      'Name them in the order of the row, from ᚠ onward.': 'Nómbralas en el orden de la hilera, desde ᚠ en adelante.',
      'Your runes cut strokes the seal does not carry.': 'Tus runas cortan trazos que el sello no lleva.',
      'Strokes in the seal that none of your runes account for.': 'Hay trazos en el sello que ninguna de tus runas explica.',
      'One of those runes adds nothing the others have not already cut.': 'Una de esas runas no añade nada que las otras no hayan cortado ya.',
    },
    board: {
      law: 'Nombra exactamente las runas ligadas en la talla: cada trazo reclamado, ninguna runa ociosa.',
      legend: 'Oro: trazo que tus runas reclaman. Pálido: trazo de la talla aún sin reclamar. Rojo: corte que tus runas harían y que el herraje no lleva.',
      legendShort: 'Oro: reclamado. Pálido: sin reclamar. Rojo: corte perdido.',
      trayLabel: 'Las dieciséis de la hilera, sueltas en la bandeja',
      tally: '{n} trazos de {m} reclamados',
      tallyOne: '{n} trazo de {m} reclamado',
      tallyAll: 'Los {m} trazos reclamados, y nada ocioso. Nombra las runas ligadas.',
      clear: 'Sacarlas todas',
      submit: 'Nombrar las runas ligadas',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: una runa puesta sobre la talla enciende los trazos que reclama.',
      sayClaims: '{name} reclama {n} trazos de la talla.',
      sayIdle: '{name} no reclama nada que las otras no hayan cortado ya.',
      sayWaste: '{name} cortaría {n} de más: trazos que el herraje no lleva.',
      sayLifted: '{name} sacada de la talla.',
      cleared: 'Todas las runas sacadas de la talla.',
      named: 'Nombrada la runa ligada: {names}.',
      opening: 'Una runa ligada de {n} trazos sobre una sola asta. Nombra cada runa ligada en ella, y ninguna que no lo esté.',
      solvedLine: 'La talla queda leída.',
      deny: 'El sello no responde a esos nombres.',
      ariaNamed: 'Nombradas: {names}. ',
      ariaNone: 'Aún no hay ninguna runa nombrada. ',
      ariaOver: ', {n} fuera de la talla',
      ariaSeal: 'La runa ligada tallada en el herraje. {words}{tally}.',
      ariaGauge: '{n} de {m} trazos reclamados',
      ariaOn: ', puesta sobre la talla, reclama {n}',
      ariaOnIdle: ', puesta sobre la talla, no reclama nada',
      ariaOnWaste: ', puesta sobre la talla, corta {n} de más',
    },
  },
  ca: {
    title: 'El Segell de Runes Lligades',
    epigraph: 'Sis noms tallats l’un damunt de l’altre en una sola asta. L’asta és de tots ells i de cap.',
    hints: [
      'Cada traç del segell pertany a alguna runa. Troba la runa amo de cada traç i hauràs trobat el segell.',
      'L’asta llarga del mig pertany a tota runa que hi pengi — per tant no en nomena cap. Jutja una runa només per les seves branques.',
      'Una runa que es pogués treure sense que la talla perdés ni un sol traç no hi va ser mai lligada. Aquesta és tota la prova, i descarta sempre la runa del gel.',
    ],
    nearMap: {
      'Name them in the order of the row, from ᚠ onward.': 'Anomena-les en l’ordre de la filera, des de ᚠ endavant.',
      'Your runes cut strokes the seal does not carry.': 'Les teves runes tallen traços que el segell no duu.',
      'Strokes in the seal that none of your runes account for.': 'Hi ha traços al segell que cap de les teves runes no explica.',
      'One of those runes adds nothing the others have not already cut.': 'Una d’aquestes runes no hi afegeix res que les altres no hagin tallat ja.',
    },
    board: {
      law: 'Anomena exactament les runes lligades a la talla: cada traç reclamat, cap runa ociosa.',
      legend: 'Or: traç que les teves runes reclamen. Pàl·lid: traç de la talla encara sense reclamar. Vermell: tall que les teves runes farien i que el ferratge no duu.',
      legendShort: 'Or: reclamat. Pàl·lid: sense reclamar. Vermell: tall perdut.',
      trayLabel: 'Les setze de la filera, soltes a la safata',
      tally: '{n} traços de {m} reclamats',
      tallyOne: '{n} traç de {m} reclamat',
      tallyAll: 'Els {m} traços reclamats, i res ociós. Anomena les runes lligades.',
      clear: 'Treure-les totes',
      submit: 'Anomenar les runes lligades',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: una runa posada damunt la talla encén els traços que reclama.',
      sayClaims: '{name} reclama {n} traços de la talla.',
      sayIdle: '{name} no reclama res que les altres no hagin tallat ja.',
      sayWaste: '{name} tallaria {n} de més: traços que el ferratge no duu.',
      sayLifted: '{name} treta de la talla.',
      cleared: 'Totes les runes tretes de la talla.',
      named: 'Anomenada la runa lligada: {names}.',
      opening: 'Una runa lligada de {n} traços damunt una sola asta. Anomena cada runa lligada que hi ha, i cap que no hi sigui.',
      solvedLine: 'La talla queda llegida.',
      deny: 'El segell no respon a aquests noms.',
      ariaNamed: 'Anomenades: {names}. ',
      ariaNone: 'Encara no hi ha cap runa anomenada. ',
      ariaOver: ', {n} fora de la talla',
      ariaSeal: 'La runa lligada tallada al ferratge. {words}{tally}.',
      ariaGauge: '{n} de {m} traços reclamats',
      ariaOn: ', posada damunt la talla, reclama {n}',
      ariaOnIdle: ', posada damunt la talla, no reclama res',
      ariaOnWaste: ', posada damunt la talla, talla {n} de més',
    },
  },
};

export default {
  id: '14-bindrune',
  ordinal: 14,
  tier: 4,
  title: 'The Bind-Rune Seal',
  epigraph: 'Six names cut over one another on a single stave. The stave belongs to all of them and to none.',

  makePuzzle(rng) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const size = rng.chance(0.5) ? 5 : 6;
      const chosen = sortRunes(rng.shuffle(POOL).slice(0, size));
      const carved = maskOf(chosen);
      if (popcount(carved) < 10) continue;
      if (chosen.filter((ch) => BRANCHES[ch] === 2).length < 3) continue;
      const { full, oneShort } = trapsFor(chosen, carved);
      if (!full.includes('ᛁ') || oneShort.length < 2) continue;
      const minimal = sweepSubsets(carved);
      if (minimal.length !== 1 || minimal[0].join('') !== chosen.join('')) continue;
      const segments = SEGMENTS
        .filter((k, i) => (carved & (1 << i)) !== 0)
        .sort()
        .map((k) => JSON.parse(k));
      return { segments, candidates: ORDER.slice() };
    }
    // Unreachable in measurement; a bindrune of the six two-branch stave runes
    // always satisfies the law above.
    const chosen = sortRunes(['ᚠ', 'ᚬ', 'ᚱ', 'ᚼ', 'ᛏ', 'ᛒ']);
    const carved = maskOf(chosen);
    return {
      segments: SEGMENTS.filter((k, i) => (carved & (1 << i)) !== 0).sort().map((k) => JSON.parse(k)),
      candidates: ORDER.slice(),
    };
  },

  solve(instance) {
    const minimal = sweepSubsets(carvedMaskOf(instance));
    return { runes: minimal.length === 1 ? sortRunes(minimal[0]) : [] };
  },

  verify(instance, answer) {
    try {
      if (!instance || !answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
      const runes = answer.runes;
      if (!Array.isArray(runes) || runes.length < 2 || runes.length > 16) return { ok: false };
      if (!runes.every((ch) => typeof ch === 'string' && ORDER_INDEX[ch] !== undefined)) return { ok: false };
      if (new Set(runes).size !== runes.length) return { ok: false };
      for (let i = 1; i < runes.length; i++) {
        if (ORDER_INDEX[runes[i]] <= ORDER_INDEX[runes[i - 1]]) {
          return { ok: false, near: 'Name them in the order of the row, from ᚠ onward.' };
        }
      }
      const carved = carvedMaskOf(instance);
      if (carved < 0) return { ok: false };
      const mine = maskOf(runes);
      if ((mine & ~carved) !== 0) return { ok: false, near: 'Your runes cut strokes the seal does not carry.' };
      if ((carved & ~mine) !== 0) return { ok: false, near: 'Strokes in the seal that none of your runes account for.' };
      for (const ch of runes) {
        if (maskOf(runes.filter((r) => r !== ch)) === carved) {
          return { ok: false, near: 'One of those runes adds nothing the others have not already cut.' };
        }
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },

  wrongAnswers(instance) {
    const self = this;
    const carved = carvedMaskOf(instance);
    const minimal = sweepSubsets(carved);
    const out = [];
    const seen = new Set();
    if (minimal.length !== 1) return out;
    const truth = sortRunes(minimal[0]);
    const { oneShort } = trapsFor(truth, carved);
    const push = (runes) => {
      const ans = { runes };
      const key = JSON.stringify(ans);
      if (seen.has(key) || self.verify(instance, ans).ok) return;
      seen.add(key);
      out.push(ans);
    };

    push(sortRunes(truth.concat(['ᛁ'])));                       // the covered trap
    for (const t of oneShort.slice(0, 2)) push(sortRunes(truth.concat([t]))); // one stroke over
    push(truth.slice(0, -1));                                    // one stroke short
    push(truth.slice(1));
    push(sortRunes(truth.slice(0, -1).concat([oneShort[0] || 'ᛁ'])));
    push(truth.slice().reverse());                               // right set, wrong order
    push(sortRunes(truth.concat(['ᚢ'])));                        // no stave at all
    push(sortRunes(truth.concat(['ᛋ'])));
    push(POOL.slice());                                          // every stave rune
    return out;
  },

  shard() {
    return { ...SHARDS['14-bindrune'] };
  },

  difficulty: { searchSpace: 6.6e4, minSteps: 32, estMinutes: 22 },

  hints: [
    'Every stroke in the seal belongs to some rune. Find the rune that owns each stroke, and you have found the seal.',
    'The long stave down the middle belongs to every rune that hangs on it — so it names none of them. Judge a rune by its branches only.',
    'A rune that could be lifted out without the carving losing a single stroke was never bound in. That is the whole test, and it disqualifies the ice-rune every time.',
  ],


  i18n: I18N,

  // THE BOARD. The hasp's deep carving is the subject: the bind-rune cut huge
  // into an iron-strapped oak hasp, aged, its gold leaf worn off the proud
  // edges and clinging only in the grooves. Laying a candidate rune on it
  // OVERLAYS that rune's canonical strokes in living gold, so exact cover is
  // watched, not computed: claimed strokes burn, unclaimed stay tar, and a
  // rune that would cut where the hasp carries nothing scores the wood red.
  // The minimality law is felt on the tile — a rune whose every stroke is
  // already claimed shows an empty socket where its tally pips should be.
  mount(ctx) {
    const art = ctx.art;
    const p = art.palette;
    const inst = ctx.instance;
    const self = this;
    const lang = ctx.lang || 'en';
    const LOC = I18N[lang] || {};
    const L = LOC.board || {};
    const nearOf = (near) => localizeNear(near, LOC.nearMap || {});
    const T = (key, params) => {
      let s = key in L ? L[key] : BOARD_EN[key];
      if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
      return s;
    };

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
      try { return !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch (e) { return false; }
    })();

    const nameOf = (ch) => (FUTHARK.find((r) => r.ch === ch) || {}).name || ch;
    const carved = carvedMaskOf(inst);
    const SEG_PTS = SEGMENTS.map((k) => JSON.parse(k));
    const carvedSegs = SEG_PTS.filter((s, i) => (carved & (1 << i)) !== 0);
    const TOTAL = carvedSegs.length;
    const chosen = new Set(ctx.solved ? self.solve(inst).runes : []);

    // ---- layout, decided once from the room's real width ------------------
    const roomW = (() => {
      try { return Math.round(ctx.root.getBoundingClientRect().width) || 0; } catch (e) { return 0; }
    })() || 820;
    const narrow = roomW < 560;

    const COLS = 4;
    const ROWS = 4;
    const GAP = narrow ? 6 : 8;
    const BAND = narrow ? 12 : 16;
    const BENCH = narrow ? 44 : 96;               // the carver's bench, below the tray
    const TRAY_W = narrow ? Math.min(roomW - 6, 358) : 360;
    const TW = Math.max(44, Math.floor((TRAY_W - BAND * 2 - GAP * (COLS - 1)) / COLS));
    const TH = Math.max(44, Math.round(TW * (narrow ? 0.94 : 1.26)));
    const ROW_W = TW * COLS + GAP * (COLS - 1);
    const ROW_H = TH * ROWS + GAP * (ROWS - 1);
    const TRAY_CW = ROW_W + BAND * 2;
    const TRAY_CH = ROW_H + BAND * 2 + BENCH;
    const SEAL_W = narrow ? Math.min(roomW - 4, 380) : Math.max(360, Math.min(520, roomW - TRAY_CW - 20));
    const SEAL_H = narrow ? 300 : 522;

    // ---- frame -------------------------------------------------------------
    const wrap = node('div', `display:grid;gap:${narrow ? 8 : 11}px;font-family:${SERIF};color:${p.bone};justify-items:center`);
    const style = node('style');
    style.textContent = `
      .ow14-plate{margin:0 auto;padding:${narrow ? '8px 12px' : '10px 20px'};max-width:62ch;text-align:center;
        font-family:${SERIF};font-size:${narrow ? 13.5 : 15}px;line-height:1.42;color:${p.bone};border-radius:3px;
        background:linear-gradient(178deg,${rgba(p.oak, 0.9)},${rgba(p.oakDeep, 0.94)});
        border:1px solid ${rgba(p.oakLight, 0.95)};
        box-shadow:inset 0 1px 0 ${rgba(p.goldBright, 0.16)},inset 0 -2px 5px ${rgba(p.tar, 0.7)},0 2px 6px ${rgba(p.tar, 0.55)};
        text-shadow:${art.reliefShadowCss || `-1px -1px 0 ${rgba(p.tar, 0.85)}`}}
      .ow14-cols{display:flex;gap:${narrow ? 8 : 16}px;align-items:flex-start;justify-content:center;flex-wrap:wrap;
        width:${narrow ? TRAY_CW : SEAL_W + TRAY_CW + 16}px;max-width:100%}
      .ow14-cola{flex:0 0 ${SEAL_W}px;display:grid;gap:${narrow ? 7 : 10}px;justify-items:center}
      .ow14-colb{flex:0 0 ${TRAY_CW}px;display:grid;gap:5px;justify-items:center}
      .ow14-stage{position:relative;width:${SEAL_W}px;max-width:100%;line-height:0}
      .ow14-stage canvas{display:block;width:100%;height:auto;border-radius:4px}
      .ow14-fire{position:absolute;left:0;top:0;pointer-events:none;
        animation:ow14-breathe 5.4s ease-in-out infinite}
      @keyframes ow14-breathe{0%,100%{opacity:.88}52%{opacity:1}}
      .ow14-trayw{position:relative;width:${TRAY_CW}px;height:${TRAY_CH}px;line-height:0}
      .ow14-trayw canvas.ow14-tray{position:absolute;left:0;top:0;display:block;width:${TRAY_CW}px;height:${TRAY_CH}px}
      .ow14-row{position:absolute;left:${BAND}px;top:${BAND}px;display:grid;
        grid-template-columns:repeat(${COLS},${TW}px);gap:${GAP}px}
      .ow14-cand{width:${TW}px;height:${TH}px;padding:0;background:none;border:0;cursor:pointer;
        display:grid;grid-template-rows:1fr auto;justify-items:center;line-height:0;border-radius:5px;
        transition:transform .13s ease}
      .ow14-cand:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow14-cand[aria-pressed="true"]{transform:translateY(-4px)}
      .ow14-cand[disabled]{cursor:default}
      .ow14-cand canvas{display:block}
      .ow14-tag{font-family:${SERIF};font-size:${narrow ? 10 : 11}px;color:${p.boneDim};line-height:1.15;
        letter-spacing:.02em;padding-bottom:2px}
      .ow14-cand[aria-pressed="true"] .ow14-tag{color:${p.goldBright}}
      .ow14-ghost{position:absolute;pointer-events:none;z-index:3;line-height:0}
      .ow14-gauge{display:flex;gap:9px;align-items:center;justify-content:center;flex-wrap:wrap}
      .ow14-gauge canvas{display:block}
      .ow14-count{font-family:${SERIF};font-size:${narrow ? 12.5 : 13.5}px;color:${p.bone};letter-spacing:.03em}
      .ow14-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${rgba(p.oakLight, 0.95)};border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
      .ow14-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow14-act[disabled]{opacity:.45;cursor:default}
      @media (prefers-reduced-motion: reduce){
        .ow14-fire{animation:none;opacity:1}
        .ow14-cand{transition:none}
      }
    `;
    wrap.append(style);

    const plate = node('p', null, T('law'));
    plate.className = 'ow14-plate';

    const cols = node('div');
    cols.className = 'ow14-cols';
    const colA = node('div');
    colA.className = 'ow14-cola';
    const colB = node('div');
    colB.className = 'ow14-colb';

    const stage = node('div');
    stage.className = 'ow14-stage';
    const seal = art.makeCanvas(SEAL_W, SEAL_H);
    seal.canvas.setAttribute('role', 'img');
    const fire = art.makeCanvas(SEAL_W, SEAL_H);
    fire.canvas.className = 'ow14-fire';
    fire.canvas.setAttribute('aria-hidden', 'true');
    stage.append(seal.canvas, fire.canvas);

    const gaugeRow = node('div');
    gaugeRow.className = 'ow14-gauge';
    const GA_W = Math.min(SEAL_W, TOTAL * (narrow ? 15 : 18) + 20);
    const gauge = art.makeCanvas(GA_W, narrow ? 22 : 26);
    gauge.canvas.setAttribute('role', 'img');
    const count = node('span');
    count.className = 'ow14-count';
    gaugeRow.append(gauge.canvas, count);

    const legend = node('p',
      `margin:0;font-size:${narrow ? 11.5 : 12.5}px;line-height:1.4;color:${p.boneDim};max-width:${SEAL_W}px;text-align:center`,
      T(narrow ? 'legendShort' : 'legend'));

    colA.append(stage, gaugeRow, legend);

    const trayLabel = node('p',
      `margin:0;font-size:12px;color:${p.boneDim};letter-spacing:.05em;text-align:center`, T('trayLabel'));
    const trayw = node('div');
    trayw.className = 'ow14-trayw';
    const tray = art.makeCanvas(TRAY_CW, TRAY_CH);
    tray.canvas.className = 'ow14-tray';
    tray.canvas.setAttribute('aria-hidden', 'true');
    const cands = node('div');
    cands.className = 'ow14-row';
    trayw.append(tray.canvas, cands);
    colB.append(trayLabel, trayw);
    cols.append(colA, colB);

    const RUNE_PX = Math.round(Math.min(TW * 0.62, TH * 0.52));
    const candBtns = inst.candidates.map((ch, i) => {
      const b = node('button');
      b.className = 'ow14-cand';
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      const mini = art.makeCanvas(TW, TH - (narrow ? 14 : 16));
      const tag = node('span', null, nameOf(ch));
      tag.className = 'ow14-tag';
      b.append(mini.canvas, tag);
      on(b, 'click', () => { takeTheChisel(); toggle(ch); });
      cands.append(b);
      return { ch, b, mini, slot: i };
    });

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center;justify-content:center');
    const skipBtn = node('button', null, T('skip'));
    const clearBtn = node('button', null, T('clear'));
    const sealBtn = node('button', null, T('submit'));
    for (const b of [skipBtn, clearBtn, sealBtn]) { b.className = 'ow14-act'; b.type = 'button'; }
    skipBtn.style.display = 'none';
    actions.append(skipBtn, clearBtn, sealBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};scroll-margin:28px;text-align:center;max-width:60ch`);
    status.setAttribute('aria-live', 'polite');

    wrap.append(plate, cols, actions, status);
    ctx.root.append(wrap);

    // ---- carving geometry ---------------------------------------------------
    // The hasp fills the plate; the figure is fitted to the carved bbox so the
    // bind-rune is as large as the iron straps allow.
    const HM = narrow ? 16 : 26;
    const HX = HM;
    const HY = HM;
    const HW = SEAL_W - HM * 2;
    const HH = SEAL_H - HM * 2;
    const HBAND = Math.max(12, Math.min(22, Math.min(HW, HH) * 0.05));
    const STRAP = Math.max(14, Math.round(HH * 0.045));
    const fit = (() => {
      let x0 = 1; let y0 = 1; let x1 = 0; let y1 = 0;
      for (const s of carvedSegs) for (const [x, y] of s) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const pad = Math.max(16, HBAND * 0.9);
      const fx = HX + pad;
      const fy = HY + STRAP + pad;
      const fw = HW - pad * 2;
      const fh = HH - STRAP * 2 - pad * 2;
      const s = Math.min(fw / Math.max(0.05, x1 - x0), fh / Math.max(0.05, y1 - y0));
      return { s, ox: fx + (fw - (x1 - x0) * s) / 2 - x0 * s, oy: fy + (fh - (y1 - y0) * s) / 2 - y0 * s };
    })();
    const CUT = Math.max(8, fit.s * 0.052);          // trough width of the deep cut
    const path = (c, seg) => {
      c.beginPath();
      seg.forEach(([x, y], i) => {
        const px = fit.ox + x * fit.s;
        const py = fit.oy + y * fit.s;
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
      });
    };
    const runSegs = (c, segs, colour, width, opts = {}) => {
      c.save();
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (opts.dash) c.setLineDash(opts.dash);
      if (opts.dx || opts.dy) c.translate(opts.dx || 0, opts.dy || 0);
      if (opts.blur) { c.shadowColor = opts.blurColour || p.goldBright; c.shadowBlur = opts.blur; }
      for (const seg of segs) { path(c, seg); c.stroke(); }
      c.restore();
    };

    // rounded rect via arcTo (available in every context this board runs in)
    const rr = (c, x, y, w, h, r) => {
      const q = Math.max(1, Math.min(r, Math.min(w, h) / 2));
      c.beginPath();
      c.moveTo(x + q, y);
      c.arcTo(x + w, y, x + w, y + h, q);
      c.arcTo(x + w, y + h, x, y + h, q);
      c.arcTo(x, y + h, x, y, q);
      c.arcTo(x, y, x + w, y, q);
      c.closePath();
    };
    // deterministic view-side noise (the pure half never sees it)
    const h32 = (n) => {
      let x = (n | 0) + 0x9e3779b9;
      x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
      x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
      return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
    };

    // Surviving gold leaf: irregular flecks lying along the groove floor,
    // struck once per stroke at deterministic intervals. Fine, off-centre,
    // never evenly spaced — the eye reads regularity as beadwork.
    function goldLeaf(g, segs) {
      let k = 0;
      g.save();
      g.lineCap = 'round';
      for (const seg of segs) {
        for (let i = 1; i < seg.length; i++) {
          const ax = fit.ox + seg[i - 1][0] * fit.s;
          const ay = fit.oy + seg[i - 1][1] * fit.s;
          const bx = fit.ox + seg[i][0] * fit.s;
          const by = fit.oy + seg[i][1] * fit.s;
          const len = Math.hypot(bx - ax, by - ay);
          const nx = (bx - ax) / (len || 1);
          const ny = (by - ay) / (len || 1);
          let t = CUT * 0.6;
          while (t < len - CUT * 0.5) {
            const r1 = h32(3100 + k * 37);
            const r2 = h32(4400 + k * 53);
            const r3 = h32(5900 + k * 71);
            k++;
            const fl = CUT * (0.12 + r1 * 0.5);
            const off = (r2 - 0.5) * CUT * 0.42;
            const px = ax + nx * t - ny * off;
            const py = ay + ny * t + nx * off;
            g.strokeStyle = rgba(r3 > 0.72 ? p.goldBright : p.gold, 0.3 + r3 * 0.48);
            g.lineWidth = CUT * (0.06 + r2 * 0.12);
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(px + nx * fl, py + ny * fl);
            g.stroke();
            t += fl + CUT * (0.5 + r1 * 2.4);
          }
        }
      }
      g.restore();
    }

    // ---- the cold hasp: everything that never changes ----------------------
    function ironStrap(g, x, y, w, h, seed) {
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, mix(p.oakLight, p.bone, 0.24));
      grad.addColorStop(0.16, mix(p.tar, p.fjordLight, 0.22));
      grad.addColorStop(0.62, p.tar);
      grad.addColorStop(1, mix(p.tar, p.oakDeep, 0.5));
      g.save();
      g.fillStyle = rgba(p.tar, 0.5);
      g.fillRect(x, y + h * 0.7, w, h * 0.6);
      g.fillStyle = grad;
      g.fillRect(x, y, w, h);
      // hammer facets along the strap
      for (let i = 0; i < Math.round(w / 11); i++) {
        const fx = x + (i + 0.5) * (w / Math.round(w / 11));
        const t = h32(seed + i * 31);
        g.fillStyle = rgba(t > 0.5 ? p.bone : p.tar, 0.06 + t * 0.07);
        g.beginPath();
        g.ellipse(fx, y + h * (0.3 + t * 0.4), h * 0.34, h * 0.22, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = rgba(p.bone, 0.16);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y + 0.6); g.lineTo(x + w, y + 0.6); g.stroke();
      g.strokeStyle = rgba(p.tar, 0.9);
      g.beginPath(); g.moveTo(x, y + h - 0.6); g.lineTo(x + w, y + h - 0.6); g.stroke();
      g.restore();
      // iron rivets, not gold: the art kit's nailhead is a gilded fitting, and
      // a gold stud on a hasp strap reads as jewellery instead of ironwork.
      const rivets = Math.max(3, Math.round(w / 62));
      const rr0 = Math.max(2.6, h * 0.28);
      for (let i = 0; i < rivets; i++) {
        const rx = x + (w * (i + 0.5)) / rivets;
        const ry = y + h / 2;
        g.save();
        g.fillStyle = rgba('#000000', 0.6);
        g.beginPath();
        g.arc(rx + rr0 * 0.22, ry + rr0 * 0.28, rr0 * 1.05, 0, Math.PI * 2);
        g.fill();
        const dome = g.createRadialGradient(rx - rr0 * 0.34, ry - rr0 * 0.4, 0, rx, ry, rr0);
        dome.addColorStop(0, mix(p.bone, p.fjordLight, 0.34));
        dome.addColorStop(0.45, mix(p.boneDim, p.tar, 0.5));
        dome.addColorStop(1, mix(p.tar, p.fjord, 0.3));
        g.fillStyle = dome;
        g.beginPath();
        g.arc(rx, ry, rr0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba(p.bone, 0.28);
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(rx, ry, rr0 * 0.96, Math.PI * 1.05, Math.PI * 1.75);
        g.stroke();
        g.restore();
      }
    }

    function paintColdSeal() {
      const off = art.makeCanvas(SEAL_W, SEAL_H);
      const g = off.ctx;
      art.paintWood(g, SEAL_W, SEAL_H, 1414);
      art.hearth(g, SEAL_W, SEAL_H, { x: 0.14, y: 0.08, r: 0.86, strength: 0.85, progress: 0.55 });
      art.wear(g, SEAL_W, SEAL_H, 'b14-bench', { avoid: { x: HX - 6, y: HY - 6, w: HW + 12, h: HH + 12 } });

      // the hasp face: darker oak, grain running down the plate
      g.save();
      rr(g, HX, HY, HW, HH, 7);
      g.clip();
      const face = g.createLinearGradient(HX, HY, HX + HW * 0.55, HY + HH);
      face.addColorStop(0, mix(p.oak, p.oakLight, 0.28));
      face.addColorStop(0.45, p.oak);
      face.addColorStop(1, mix(p.oakDeep, p.oak, 0.35));
      g.fillStyle = face;
      g.fillRect(HX, HY, HW, HH);
      for (let i = 0; i < 46; i++) {
        const t = h32(1400 + i * 7);
        const gx = HX + t * HW;
        g.strokeStyle = rgba(t > 0.6 ? p.oakLight : p.oakDeep, 0.1 + t * 0.16);
        g.lineWidth = 0.6 + t * 1.5;
        g.beginPath();
        g.moveTo(gx, HY);
        for (let y = HY; y <= HY + HH; y += 26) g.lineTo(gx + Math.sin((y + i * 13) * 0.019) * 4.2, y);
        g.stroke();
      }
      // age: a soot wash at the foot, a hand-polish pool where the seal is read
      const soot = g.createLinearGradient(0, HY + HH * 0.5, 0, HY + HH);
      soot.addColorStop(0, rgba(p.tar, 0));
      soot.addColorStop(1, rgba(p.tar, 0.5));
      g.fillStyle = soot;
      g.fillRect(HX, HY, HW, HH);
      art.glow(g, HX + HW * 0.36, HY + HH * 0.34, HW * 0.62, mix(p.ember, p.goldBright, 0.5), 0.11);
      g.restore();

      art.tray(g, HX, HY, HW, HH, { band: HBAND, ribbon: true, seed: 'b14-hasp', chipAlpha: 0.9 });

      // iron straps top and foot — this is a hasp, not a picture frame
      ironStrap(g, HX + 1, HY + 1, HW - 2, STRAP, 71);
      ironStrap(g, HX + 1, HY + HH - STRAP - 1, HW - 2, STRAP, 137);

      // ---- THE CARVING ----------------------------------------------------
      // A V-groove under an upper-left key: the wall whose face turns back into
      // the light (the DOWN-RIGHT interior wall) catches it, the up-left wall
      // falls to black, and the arris where the cut breaks the surface keeps a
      // hairline of lit wood. That reversal is the whole difference between a
      // cut and an embossed noodle, so nothing here paints a halo around the
      // stroke — every pass lives inside the trough.
      g.save();
      rr(g, HX + 2, HY + STRAP, HW - 4, HH - STRAP * 2, 4);
      g.clip();
      // 1. the groove's own occlusion, tight against the down-right rim
      runSegs(g, carvedSegs, rgba(p.tar, 0.3), CUT * 1.14, { dx: CUT * 0.1, dy: CUT * 0.13 });
      // 2. the trough
      runSegs(g, carvedSegs, mix(p.tar, p.oakDeep, 0.22), CUT);
      // 3. the up-left wall, fallen to black
      runSegs(g, carvedSegs, rgba('#000000', 0.72), CUT * 0.62, { dx: -CUT * 0.17, dy: -CUT * 0.2 });
      // 4. the down-right wall — a bounce, not a highlight. Anything brighter
      //    or warmer than this and the stroke inflates into a raised tube.
      runSegs(g, carvedSegs, rgba(mix(p.oak, p.ember, 0.3), 0.44), CUT * 0.34, { dx: CUT * 0.28, dy: CUT * 0.32 });
      runSegs(g, carvedSegs, rgba(mix(p.oakLight, p.ember, 0.34), 0.3), CUT * 0.16, { dx: CUT * 0.4, dy: CUT * 0.46 });
      // 5. the arris: the hairline of lit wood where the chisel broke the
      //    surface. This is the pass that says "cut" — it stays crisp.
      runSegs(g, carvedSegs, rgba(mix(p.oakLight, p.ember, 0.35), 0.2), CUT * 0.44, { dx: -CUT * 0.84, dy: -CUT * 0.96 });
      runSegs(g, carvedSegs, rgba(mix(p.oakLight, p.goldBright, 0.55), 0.6), CUT * 0.15, { dx: -CUT * 0.5, dy: -CUT * 0.58 });
      // 6. patina: a century of soot and hearth grease settled in the groove
      runSegs(g, carvedSegs, rgba(mix(p.pine, p.tar, 0.72), 0.3), CUT * 0.72, { dash: [11, 17] });
      runSegs(g, carvedSegs, rgba('#000000', 0.32), CUT * 0.44, { dash: [6, 29], dx: 1, dy: 1.2 });
      // 7. gold leaf: worn clean off the proud edges, a few flecks still caught
      //    down in the cut where no hand ever reached. Scattered, never dashed
      //    — an even dash reads as a bead chain, not as surviving leaf.
      runSegs(g, carvedSegs, rgba(p.gold, 0.07), CUT * 0.44);
      goldLeaf(g, carvedSegs);
      // 8. dust catching the light — an unclaimed cut must still read as a cut
      runSegs(g, carvedSegs, rgba(p.bone, 0.08), CUT * 0.08, { dx: -0.6, dy: -0.8 });
      g.restore();
      return off.canvas;
    }

    function paintColdFire() {
      const off = art.makeCanvas(SEAL_W, SEAL_H);
      // the candle's own reach, kept in the upper-left corner so its breathing
      // never washes across the carving it is supposed to be raking
      art.hearth(off.ctx, SEAL_W, SEAL_H, { x: 0.04, y: 0.02, r: 0.4, strength: 0.3, progress: 0.3 });
      return off.canvas;
    }

    // ---- the tray, the sockets, and the carver's bench under it ------------
    function benchTools(g, x, y, w, h) {
      const s = Math.min(h * 0.9, w * 0.2);
      g.save();
      g.globalAlpha = 0.55;
      // a chisel laid across the bench, blade to the light
      const cx = x + w * 0.16;
      const cy = y + h * 0.55;
      const len = Math.min(w * 0.4, 150);
      g.save();
      g.translate(cx, cy);
      g.rotate(-0.16);
      g.fillStyle = rgba(p.tar, 0.5);
      g.fillRect(-len * 0.5 + 3, s * 0.16 + 3, len, s * 0.2);
      const handle = g.createLinearGradient(0, -s * 0.18, 0, s * 0.18);
      handle.addColorStop(0, mix(p.oakLight, p.bone, 0.3));
      handle.addColorStop(0.55, p.oak);
      handle.addColorStop(1, p.oakDeep);
      g.fillStyle = handle;
      rr(g, -len * 0.5, -s * 0.2, len * 0.46, s * 0.4, s * 0.18);
      g.fill();
      g.fillStyle = mix(p.gold, p.oakDeep, 0.25);
      g.fillRect(-len * 0.5 + len * 0.44, -s * 0.17, s * 0.2, s * 0.34);
      const steel = g.createLinearGradient(0, -s * 0.14, 0, s * 0.14);
      steel.addColorStop(0, mix(p.bone, p.fjordLight, 0.2));
      steel.addColorStop(0.5, p.boneDim);
      steel.addColorStop(1, mix(p.tar, p.fjord, 0.4));
      g.fillStyle = steel;
      g.beginPath();
      g.moveTo(-len * 0.5 + len * 0.62, -s * 0.13);
      g.lineTo(len * 0.5, -s * 0.05);
      g.lineTo(len * 0.5, s * 0.05);
      g.lineTo(-len * 0.5 + len * 0.62, s * 0.13);
      g.closePath();
      g.fill();
      g.restore();
      // curled shavings
      for (let i = 0; i < 4; i++) {
        const t = h32(910 + i * 17);
        const sx = x + w * (0.58 + t * 0.34);
        const sy = y + h * (0.28 + h32(77 + i) * 0.5);
        const r = s * (0.2 + t * 0.16);
        g.strokeStyle = rgba(mix(p.oakLight, p.bone, 0.28), 0.42);
        g.lineWidth = Math.max(1.4, r * 0.22);
        g.beginPath();
        g.moveTo(sx - r, sy);
        g.bezierCurveTo(sx - r * 0.4, sy - r * 1.1, sx + r * 0.7, sy - r * 0.6, sx + r, sy + r * 0.4);
        g.stroke();
        g.strokeStyle = rgba(p.tar, 0.3);
        g.beginPath();
        g.moveTo(sx - r + 1, sy + 1.4);
        g.bezierCurveTo(sx - r * 0.4 + 1, sy - r * 1.1 + 1.4, sx + r * 0.7 + 1, sy - r * 0.6 + 1.4, sx + r + 1, sy + r * 0.4 + 1.4);
        g.stroke();
      }
      // chips
      for (let i = 0; i < 9; i++) {
        const t = h32(2200 + i * 41);
        const px = x + w * (0.05 + t * 0.9);
        const py = y + h * (0.16 + h32(31 + i * 3) * 0.72);
        g.fillStyle = rgba(t > 0.5 ? p.oakLight : p.oakDeep, 0.3);
        g.beginPath();
        g.ellipse(px, py, 2 + t * 3.2, 1 + t * 1.4, t * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      // the candle stub — the board's own light, on the hearth side
      const kx = x + w * 0.9;
      const ky = y + h * 0.42;
      const ks = Math.max(9, h * 0.3);
      g.save();
      g.globalAlpha = 0.8;
      g.fillStyle = rgba(p.tar, 0.45);
      g.beginPath();
      g.ellipse(kx + 2, ky + ks * 0.95, ks * 0.72, ks * 0.24, 0, 0, Math.PI * 2);
      g.fill();
      const wax = g.createLinearGradient(kx - ks * 0.4, 0, kx + ks * 0.4, 0);
      wax.addColorStop(0, mix(p.bone, p.ember, 0.16));
      wax.addColorStop(0.55, mix(p.bone, p.oak, 0.28));
      wax.addColorStop(1, mix(p.oakDeep, p.bone, 0.3));
      g.fillStyle = wax;
      rr(g, kx - ks * 0.32, ky - ks * 0.1, ks * 0.64, ks, 2.5);
      g.fill();
      g.strokeStyle = rgba(p.tar, 0.55);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(kx, ky - ks * 0.1);
      g.lineTo(kx, ky - ks * 0.42);
      g.stroke();
      art.glow(g, kx, ky - ks * 0.5, ks * 1.5, mix(p.ember, p.goldBright, 0.55), 0.6);
      g.restore();
    }

    function paintTray() {
      const g = tray.ctx;
      g.clearRect(0, 0, TRAY_CW, TRAY_CH);
      art.paintWood(g, TRAY_CW, TRAY_CH, 1441);
      art.hearth(g, TRAY_CW, TRAY_CH, { x: 0.82, y: 0.86, r: 0.55, strength: 0.5, progress: 0.35 });
      art.tray(g, BAND, BAND, ROW_W, ROW_H, {
        band: BAND, ribbon: !narrow, seed: 'b14-tray', chipAlpha: 0.85,
      });
      // a cut socket under every tile, so the bone reads as SITTING in the tray
      for (let i = 0; i < COLS * ROWS; i++) {
        const sx = BAND + (i % COLS) * (TW + GAP);
        const sy = BAND + Math.floor(i / COLS) * (TH + GAP);
        g.save();
        rr(g, sx + 1.5, sy + 1.5, TW - 3, TH - 3 - (narrow ? 12 : 14), 5);
        g.fillStyle = rgba(p.tar, 0.5);
        g.fill();
        g.strokeStyle = rgba(p.tar, 0.8);
        g.lineWidth = 1.2;
        g.stroke();
        g.strokeStyle = rgba(p.goldBright, 0.12);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(sx + 3, sy + TH - 3 - (narrow ? 12 : 14));
        g.lineTo(sx + TW - 4, sy + TH - 3 - (narrow ? 12 : 14));
        g.stroke();
        g.restore();
      }
      benchTools(g, 6, ROW_H + BAND * 2, TRAY_CW - 12, BENCH - 4);
      art.wear(g, TRAY_CW, TRAY_CH, 'b14-traywear', { avoid: { x: BAND, y: BAND, w: ROW_W, h: ROW_H } });
    }

    // ---- bone tiles ---------------------------------------------------------
    const TILE_W = TW;
    const TILE_H = TH - (narrow ? 14 : 16);
    const slabs = [0, 1, 2, 3].map((v) => {
      const off = art.makeCanvas(TILE_W, TILE_H);
      const g = off.ctx;
      const m = 2;
      const w = TILE_W - m * 2;
      const h = TILE_H - m * 2;
      g.save();
      g.fillStyle = rgba(p.tar, 0.5);
      rr(g, m + 1.5, m + 2.5, w, h, 5);
      g.fill();
      const bone = g.createLinearGradient(m, m, m + w * 0.5, m + h);
      bone.addColorStop(0, mix(p.bone, '#ffffff', 0.16));
      bone.addColorStop(0.42, p.bone);
      bone.addColorStop(1, mix(p.bone, p.oak, 0.34 + v * 0.04));
      g.fillStyle = bone;
      rr(g, m, m, w, h, 5);
      g.fill();
      g.save();
      rr(g, m, m, w, h, 5);
      g.clip();
      // bone grain: long fibres down the tile
      for (let i = 0; i < 14; i++) {
        const t = h32(500 + v * 97 + i * 13);
        const gx = m + t * w;
        g.strokeStyle = rgba(mix(p.boneDim, p.oak, 0.35), 0.1 + t * 0.14);
        g.lineWidth = 0.6 + t;
        g.beginPath();
        g.moveTo(gx, m);
        g.lineTo(gx + (t - 0.5) * 5, m + h);
        g.stroke();
      }
      // porosity
      for (let i = 0; i < 40; i++) {
        const t = h32(1200 + v * 41 + i * 7);
        const u = h32(1700 + v * 29 + i * 11);
        g.fillStyle = rgba(mix(p.oakDeep, p.boneDim, 0.4), 0.06 + t * 0.13);
        g.beginPath();
        g.arc(m + t * w, m + u * h, 0.4 + u * 1.1, 0, Math.PI * 2);
        g.fill();
      }
      // a chipped corner and an age stain — no two bone slips alike
      g.fillStyle = rgba(p.oak, 0.2 + v * 0.05);
      g.beginPath();
      g.moveTo(m + w, m + h * (0.12 + v * 0.05));
      g.lineTo(m + w, m);
      g.lineTo(m + w * (0.82 - v * 0.05), m);
      g.closePath();
      g.fill();
      art.glow(g, m + w * 0.2, m + h * 0.86, w * 0.5, mix(p.oakDeep, p.ember, 0.3), 0.1 + v * 0.03);
      g.restore();
      // struck edge: tar seat above-left, catch light below-right
      art.insetFace(g, m, m, w, h, { depth: 0.28, lip: 0.07, lipLight: 0.24 });
      g.strokeStyle = rgba(p.tar, 0.75);
      g.lineWidth = 1.1;
      rr(g, m + 0.5, m + 0.5, w - 1, h - 1, 5);
      g.stroke();
      // the drilled hanging hole every loose slip carries
      const hx = m + w / 2;
      const hy = m + h * 0.085;
      g.fillStyle = rgba(p.tar, 0.85);
      g.beginPath();
      g.arc(hx, hy, Math.max(1.8, w * 0.035), 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = rgba('#ffffff', 0.35);
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(hx, hy + 0.7, Math.max(1.8, w * 0.035), 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      g.restore();
      return off.canvas;
    });

    function pips(g, cx, cy, n, kind) {
      const r = Math.max(2.2, TILE_W * 0.036);
      const step = r * 3;
      const start = cx - ((Math.max(1, n) - 1) * step) / 2;
      for (let i = 0; i < Math.max(1, n); i++) {
        const x = start + i * step;
        g.save();
        g.fillStyle = rgba(p.tar, 0.55);              // the socket, cut in the bone
        g.beginPath();
        g.arc(x, cy, r * 1.25, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba('#ffffff', 0.35);
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(x, cy + 0.6, r * 1.25, 0.1 * Math.PI, 0.9 * Math.PI);
        g.stroke();
        if (kind !== 'empty') {
          const c = kind === 'waste' ? p.blood : p.gold;
          const bead = g.createRadialGradient(x - r * 0.3, cy - r * 0.35, 0, x, cy, r);
          bead.addColorStop(0, kind === 'waste' ? mix(p.blood, p.bone, 0.4) : p.goldBright);
          bead.addColorStop(1, mix(c, p.tar, 0.35));
          g.fillStyle = bead;
          g.beginPath();
          g.arc(x, cy, r, 0, Math.PI * 2);
          g.fill();
        }
        if (kind === 'waste') {                       // struck through: a wasted cut
          g.strokeStyle = rgba(p.blood, 0.95);
          g.lineWidth = 1.3;
          g.beginPath();
          g.moveTo(x - r * 1.5, cy + r * 1.2);
          g.lineTo(x + r * 1.5, cy - r * 1.2);
          g.stroke();
        }
        g.restore();
      }
    }

    function tileState(ch) {
      const m = RUNE_MASK[ch] || 0;
      const waste = popcount(m & ~carved);
      const others = maskOf([...chosen].filter((r) => r !== ch));
      const gain = popcount(m & carved & ~others);
      return { on: chosen.has(ch), waste, gain };
    }

    function paintTile(t) {
      const g = t.mini.ctx;
      const st = tileState(t.ch);
      g.clearRect(0, 0, TILE_W, TILE_H);
      g.drawImage(slabs[t.slot % 4], 0, 0, TILE_W, TILE_H);
      const size = RUNE_PX;
      const rx = (TILE_W - size) / 2;
      const ry = TILE_H * 0.17;
      // the rune is cut INTO the bone: catch light below-right, then the cut
      g.save();
      g.translate(1.4, 1.7);
      art.drawRune(g, t.ch, rx, ry, size, { color: rgba('#ffffff', 0.72), weight: size / 8.5 });
      g.restore();
      const cut = !st.on ? rgba(p.tar, 0.92)
        : st.waste ? p.blood
          : st.gain ? p.gold
            : rgba(p.oakDeep, 0.55);
      if (st.on && st.gain && !st.waste) {
        art.drawRune(g, t.ch, rx, ry, size, { color: rgba(p.gold, 0.5), weight: size / 5.2 });
        art.drawRune(g, t.ch, rx, ry, size, { color: p.goldBright, weight: size / 9, glow: 0.5, glowColor: p.goldBright });
      } else {
        art.drawRune(g, t.ch, rx, ry, size, { color: cut, weight: size / 8.5 });
      }
      // tally pips cut in the tile's foot: what this rune claims, or wastes
      if (st.on) {
        pips(g, TILE_W / 2, TILE_H * 0.87, st.waste || st.gain, st.waste ? 'waste' : st.gain ? 'gain' : 'empty');
      }
      // rim: gold when it claims, blood when it cuts astray, dead when idle
      if (st.on) {
        g.save();
        g.strokeStyle = st.waste ? rgba(p.blood, 0.9) : st.gain ? rgba(p.goldBright, 0.85) : rgba(p.oakDeep, 0.75);
        g.lineWidth = 2;
        if (!st.waste && !st.gain) g.setLineDash([4, 4]);
        rr(g, 3, 3, TILE_W - 6, TILE_H - 6, 5);
        g.stroke();
        g.restore();
        if (!st.gain && !st.waste) {                 // an idle rune is a shadow on the bone
          g.save();
          g.fillStyle = rgba(p.tar, 0.34);
          rr(g, 2, 2, TILE_W - 4, TILE_H - 4, 5);
          g.fill();
          g.restore();
        }
      }
    }

    // ---- gauge ---------------------------------------------------------------
    function paintGauge(n) {
      const g = gauge.ctx;
      const W = gauge.w;
      const H = gauge.h;
      g.clearRect(0, 0, W, H);
      art.paintWood(g, W, H, 1477);
      g.save();
      g.fillStyle = rgba(p.tar, 0.55);
      rr(g, 1, H * 0.22, W - 2, H * 0.56, H * 0.28);
      g.fill();
      g.strokeStyle = rgba(p.tar, 0.9);
      g.lineWidth = 1.2;
      g.stroke();
      g.strokeStyle = rgba(p.goldBright, 0.18);
      g.beginPath();
      g.moveTo(3, H * 0.78);
      g.lineTo(W - 3, H * 0.78);
      g.stroke();
      g.restore();
      const r = Math.max(2.6, Math.min(5, (W - 14) / (TOTAL * 3.1)));
      const step = (W - 14) / Math.max(1, TOTAL);
      for (let i = 0; i < TOTAL; i++) {
        const x = 7 + step * (i + 0.5);
        const y = H / 2;
        g.save();
        g.fillStyle = rgba(p.tar, 0.85);
        g.beginPath();
        g.arc(x, y, r * 1.3, 0, Math.PI * 2);
        g.fill();
        if (i < n) {
          const bead = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r * 1.15);
          bead.addColorStop(0, mix(p.goldBright, p.bone, 0.3));
          bead.addColorStop(1, mix(p.gold, p.tar, 0.3));
          g.fillStyle = bead;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        } else {
          g.strokeStyle = rgba(p.boneDim, 0.3);
          g.lineWidth = 0.9;
          g.beginPath();
          g.arc(x, y, r * 0.9, 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();
      }
    }

    // ---- render --------------------------------------------------------------
    const coldSeal = paintColdSeal();
    const coldFire = paintColdFire();
    paintTray();

    function paintSeal() {
      const c = seal.ctx;
      const f = fire.ctx;
      c.clearRect(0, 0, SEAL_W, SEAL_H);
      c.drawImage(coldSeal, 0, 0, SEAL_W, SEAL_H);
      f.clearRect(0, 0, SEAL_W, SEAL_H);
      f.drawImage(coldFire, 0, 0, SEAL_W, SEAL_H);

      const mine = maskOf([...chosen]);
      const claimed = [];
      const bare = [];
      const astray = [];
      for (let i = 0; i < SEG_PTS.length; i++) {
        const inCarve = (carved & (1 << i)) !== 0;
        const inMine = (mine & (1 << i)) !== 0;
        if (inCarve) (inMine ? claimed : bare).push(SEG_PTS[i]);
        else if (inMine) astray.push(SEG_PTS[i]);
      }

      // cuts the hasp does not carry: raw scores across sound wood
      if (astray.length) {
        c.save();
        rr(c, HX + 2, HY + STRAP, HW - 4, HH - STRAP * 2, 4);
        c.clip();
        runSegs(c, astray, rgba(p.tar, 0.5), CUT * 0.6, { dx: 2, dy: 2.4, dash: [10, 8] });
        runSegs(c, astray, rgba(p.blood, 0.92), CUT * 0.34, { dash: [10, 8] });
        runSegs(c, astray, rgba(mix(p.blood, p.bone, 0.45), 0.6), CUT * 0.1, { dash: [4, 14], dx: -0.8, dy: -1 });
        c.restore();
      }

      // the claimed strokes burn: living gold poured into the trough
      if (claimed.length) {
        f.save();
        rr(f, HX + 2, HY + STRAP, HW - 4, HH - STRAP * 2, 4);
        f.clip();
        runSegs(f, claimed, rgba(p.gold, 0.3), CUT * 0.86, { blur: CUT * 1.1, blurColour: p.goldBright });
        runSegs(f, claimed, mix(p.gold, p.ember, 0.3), CUT * 0.72);
        runSegs(f, claimed, p.gold, CUT * 0.46);
        // the same groove law the cold cut obeys: lit on the down-right wall,
        // one specular fleck along the up-left arris. Gold that ignores the
        // light direction stops being metal and becomes a neon rod.
        runSegs(f, claimed, rgba(p.goldBright, 0.8), CUT * 0.2, { dx: CUT * 0.18, dy: CUT * 0.2 });
        runSegs(f, claimed, rgba(mix(p.goldBright, '#ffffff', 0.45), 0.55), CUT * 0.09, { dx: -CUT * 0.42, dy: -CUT * 0.5 });
        f.restore();
      }
      return { claimed: claimed.length, bare: bare.length, astray: astray.length };
    }

    function render(announce) {
      const n = paintSeal();
      for (const t of candBtns) paintTile(t);
      paintGauge(n.claimed);
      const picked = sortRunes([...chosen]);
      const words = picked.length
        ? T('ariaNamed', { names: picked.map(nameOf).join(', ') })
        : T('ariaNone');
      const tally = n.claimed === TOTAL && n.astray === 0
        ? T('tallyAll', { m: TOTAL })
        : T(n.claimed === 1 ? 'tallyOne' : 'tally', { n: n.claimed, m: TOTAL })
          + (n.astray ? T('ariaOver', { n: n.astray }) : '');
      count.textContent = tally;
      seal.canvas.setAttribute('aria-label', T('ariaSeal', { words, tally }));
      gauge.canvas.setAttribute('aria-label', T('ariaGauge', { n: n.claimed, m: TOTAL }));
      for (const t of candBtns) {
        const st = tileState(t.ch);
        t.b.setAttribute('aria-pressed', st.on ? 'true' : 'false');
        const clause = !st.on ? ''
          : st.waste ? T('ariaOnWaste', { n: st.waste })
            : st.gain ? T('ariaOn', { n: st.gain })
              : T('ariaOnIdle');
        t.b.setAttribute('aria-label', `${nameOf(t.ch)}${clause}`);
      }
      sealBtn.disabled = !!ctx.solved || chosen.size < 2;
      if (announce !== undefined) status.textContent = announce || '';
      return n;
    }

    // ---- interaction ---------------------------------------------------------
    function toggle(ch, quiet) {
      if (ctx.solved) return;
      const nowOn = !chosen.has(ch);
      if (nowOn) chosen.add(ch); else chosen.delete(ch);
      sfx(nowOn ? 'tick' : 'knock');
      const st = tileState(ch);
      const line = !nowOn ? T('sayLifted', { name: nameOf(ch) })
        : st.waste ? T('sayWaste', { name: nameOf(ch), n: st.waste })
          : st.gain ? T('sayClaims', { name: nameOf(ch), n: st.gain })
            : T('sayIdle', { name: nameOf(ch) });
      if (!quiet) say(line);
      render(line);
    }

    // ---- the showing: three seconds of a ghost hand ---------------------------
    // It lays the ICE-RUNE on the carving. ᛁ is the one rune the kernel data
    // lets any stave-bearer cover, so the demonstration ignites exactly the
    // shared stave, gives away not one rune of the answer, and plants the trap
    // the minimality law exists to catch. It lifts back off before you touch it.
    const DEMO_CH = 'ᛁ';
    const ghostHost = node('div');
    ghostHost.className = 'ow14-ghost';
    ghostHost.setAttribute('aria-hidden', 'true');
    ghostHost.style.display = 'none';
    trayw.append(ghostHost);
    let ghost = null;
    let showing = false;
    let demoLaid = false;
    let touched = false;

    // The hand is laid out around its INDEX FINGERTIP at (w/2, h*TIP) so the
    // caller can put that tip exactly on the tile being pressed.
    const GH_TIP = 0.2;
    function paintGhost(g, w, h) {
      g.clearRect(0, 0, w, h);
      const cx = w * 0.5;
      const tipY = h * GH_TIP;
      const s = Math.min(w * 0.62, h * 0.42);
      const knuckle = tipY + s * 0.92;
      art.glow(g, cx, tipY + s * 0.1, s * 1.5, p.goldBright, 0.34);
      g.save();
      g.strokeStyle = rgba(p.goldBright, 0.72);
      g.fillStyle = rgba(p.goldBright, 0.16);
      g.lineWidth = Math.max(1.5, s * 0.17);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      // palm, hanging below the reaching finger
      rr(g, cx - s * 0.56, knuckle, s * 1.12, s * 0.92, s * 0.3);
      g.fill();
      g.stroke();
      // four fingers; the index reaches furthest, onto the tile
      for (let i = 0; i < 4; i++) {
        const fx = cx - s * 0.34 + i * s * 0.3;
        const top = i === 0 ? tipY : knuckle - s * (i === 1 ? 0.62 : i === 2 ? 0.5 : 0.34);
        g.beginPath();
        g.moveTo(fx, knuckle + s * 0.1);
        g.lineTo(fx, top);
        g.stroke();
      }
      // thumb
      g.beginPath();
      g.moveTo(cx - s * 0.5, knuckle + s * 0.34);
      g.lineTo(cx - s * 0.94, knuckle - s * 0.02);
      g.stroke();
      g.restore();
    }

    function endShowing(quiet) {
      if (!showing) return;
      showing = false;
      for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
      motions = [];
      if (demoLaid) { demoLaid = false; chosen.delete(DEMO_CH); }
      ghostHost.style.display = 'none';
      if (ghost) { ghost.canvas.remove(); ghost = null; }
      skipBtn.style.display = 'none';
      render(quiet ? undefined : '');
    }

    function takeTheChisel() {
      if (touched) return;
      touched = true;
      endShowing(true);
    }

    function showTheWay() {
      if (ctx.solved || touched) return;
      const slot = inst.candidates.indexOf(DEMO_CH);
      if (slot < 0) return;
      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const gw = Math.round(TW * 1.15);
      const gh = Math.round(TH * 1.2);
      ghost = art.makeCanvas(gw, gh);
      ghost.canvas.style.cssText = 'display:block';
      paintGhost(ghost.ctx, gw, gh);
      ghostHost.append(ghost.canvas);
      // land the index fingertip on the tile's rune, not on the row beneath it
      const gx = Math.round(BAND + col * (TW + GAP) + TW / 2 - gw / 2);
      const gy = Math.round(BAND + row * (TH + GAP) + TH * 0.4 - gh * GH_TIP);
      ghostHost.style.left = `${gx}px`;
      ghostHost.style.top = `${gy}px`;
      ghostHost.style.display = 'block';
      skipBtn.style.display = '';
      showing = true;
      status.textContent = T('demoSay');

      if (!calm && typeof ghostHost.animate === 'function') {
        motions.push(ghostHost.animate([
          { opacity: 0, transform: 'translateY(-16px)' },
          { opacity: 1, transform: 'translateY(0)', offset: 0.24 },
          { opacity: 1, transform: 'translateY(5px)', offset: 0.4 },
          { opacity: 1, transform: 'translateY(0)', offset: 0.74 },
          { opacity: 0, transform: 'translateY(-12px)' },
        ], { duration: 3000, easing: 'ease-in-out' }));
      }
      later(() => {
        if (!showing) return;
        demoLaid = true;
        chosen.add(DEMO_CH);
        sfx('tick');
        render(T('demoSay'));
      }, calm ? 60 : 900);
      later(() => endShowing(false), 3000);
    }

    on(skipBtn, 'click', () => { takeTheChisel(); sealBtn.focus(); });
    on(clearBtn, 'click', () => {
      takeTheChisel();
      if (ctx.solved) return;
      chosen.clear();
      sfx('knock');
      say(T('cleared'));
      render(T('cleared'));
    });
    on(sealBtn, 'click', () => {
      takeTheChisel();
      if (ctx.solved || chosen.size < 2) { sfx('deny'); return; }
      const runes = sortRunes([...chosen]);
      say(T('named', { names: runes.map(nameOf).join(', ') }));
      const res = ctx.submit({ runes }) || {};
      if (!res.ok) {
        status.textContent = nearOf(res.near) || T('deny');
        if (status.scrollIntoView) status.scrollIntoView({ block: 'nearest' });
      }
    });

    if (ctx.solved) {
      clearBtn.disabled = true;
      sealBtn.disabled = true;
      skipBtn.style.display = 'none';
      for (const { b } of candBtns) b.disabled = true;
    }

    say(T('opening', { n: inst.segments.length }));
    render(ctx.solved ? T('solvedLine') : '');
    if (!ctx.solved) later(showTheWay, 260);

    return {
      unmount() {
        for (const t of timers) clearTimeout(t);
        timers.length = 0;
        for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
        motions = [];
        for (const f of cleanup) f();
        cleanup.length = 0;
        wrap.remove();
      },
    };
  },
};
