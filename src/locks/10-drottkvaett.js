// 10 — THE DRÓTTKVÆTT LINES
//
// Eight carved half-lines must be paired and ordered into four long lines of
// court metre. The laws, simplified to three checkable ones and stated in the
// journal:
//
//   (1) Six syllables to a half-line. (Pre-counted and shown.)
//   (2) The odd half-line carries two alliterating stresses — the props. The
//       even half-line's FIRST stress is the chief stave and must join them.
//   (3) The odd half-line rhymes skothending: its two hending syllables share
//       their coda but not their vowel. The even half-line rhymes aðalhending:
//       its two hending syllables share vowel AND coda.
//
// The hasp is stamped with four staves in order — which sound leads each long
// line. That stamp is what orders the four long lines; without it any ordering
// of four correct long lines would read as well, and no unique assembly could
// exist. It is instance data, like the pre-counted syllables, not a fourth law.
//
// Every fragment is authored here with per-syllable onset/vowel/coda, so all
// three laws are computed from the syllables themselves and never from a
// class tag. The generator proves unique assembly by a full 8! sweep.
//
// Answer: { lines: [[oddIdx, evenIdx] x4] } — indices into instance.fragments.

import { SHARDS } from '../kernel/shards.js';

const ID = '10-drottkvaett';

// syllable = [text, onset, vowel, coda]
const S = (text, onset, vowel, coda) => ({ text, onset, vowel, coda });

// ---- the fragment bank (authored; six long lines' worth) -------------------

const BANK = Object.freeze([
  {
    stave: 's', half: 'odd', text: 'Sea-salt scours the bolt-head',
    syllables: [S('Sea', 's', 'ea', ''), S('salt', 's', 'a', 'lt'), S('scours', 'sk', 'ou', 'rz'),
      S('the', 'th', 'e', ''), S('bolt', 'b', 'o', 'lt'), S('head', 'h', 'ea', 'd')],
    lifts: [0, 1, 4], allitAt: [0, 1], hendingAt: [1, 4],
  },
  {
    stave: 's', half: 'even', text: 'sand-fast, the hold’s gold-hoard',
    syllables: [S('sand', 's', 'a', 'nd'), S('fast', 'f', 'a', 'st'), S('the', 'th', 'e', ''),
      S('hold’s', 'h', 'o', 'ld'), S('gold', 'g', 'o', 'ld'), S('hoard', 'h', 'oa', 'rd')],
    lifts: [0, 3, 4], hendingAt: [3, 4],
  },
  {
    stave: 'h', half: 'odd', text: 'Hail-hand rimes the wind-thole',
    syllables: [S('Hail', 'h', 'ai', 'l'), S('hand', 'h', 'a', 'nd'), S('rimes', 'r', 'i', 'mz'),
      S('the', 'th', 'e', ''), S('wind', 'w', 'i', 'nd'), S('thole', 'th', 'o', 'l')],
    lifts: [0, 1, 4], allitAt: [0, 1], hendingAt: [1, 4],
  },
  {
    stave: 'h', half: 'even', text: 'the helm-wight wakes wave-grave',
    syllables: [S('the', 'th', 'e', ''), S('helm', 'h', 'e', 'lm'), S('wight', 'w', 'i', 't'),
      S('wakes', 'w', 'a', 'ks'), S('wave', 'w', 'a', 'v'), S('grave', 'gr', 'a', 'v')],
    lifts: [1, 4, 5], hendingAt: [4, 5],
  },
  {
    stave: 'b', half: 'odd', text: 'Hand-nail, the bind-rune binds',
    syllables: [S('Hand', 'h', 'a', 'nd'), S('nail', 'n', 'ai', 'l'), S('the', 'th', 'e', ''),
      S('bind', 'b', 'i', 'nd'), S('rune', 'r', 'u', 'n'), S('binds', 'b', 'i', 'nd')],
    lifts: [0, 3, 5], allitAt: [3, 5], hendingAt: [0, 3],
  },
  {
    stave: 'b', half: 'even', text: 'board-lord bears the ring-king',
    syllables: [S('board', 'b', 'oa', 'rd'), S('lord', 'l', 'o', 'rd'), S('bears', 'b', 'ea', 'rz'),
      S('the', 'th', 'e', ''), S('ring', 'r', 'i', 'ng'), S('king', 'k', 'i', 'ng')],
    lifts: [0, 4, 5], hendingAt: [4, 5],
  },
  {
    stave: 'r', half: 'odd', text: 'Rune-hands rive the stave-oak',
    syllables: [S('Rune', 'r', 'u', 'n'), S('hands', 'h', 'a', 'ndz'), S('rive', 'r', 'i', 'v'),
      S('the', 'th', 'e', ''), S('stave', 'st', 'a', 'v'), S('oak', '', 'oa', 'k')],
    lifts: [0, 2, 4], allitAt: [0, 2], hendingAt: [2, 4],
  },
  {
    stave: 'r', half: 'even', text: 'rust-red over bone-stone',
    syllables: [S('rust', 'r', 'u', 'st'), S('red', 'r', 'e', 'd'), S('o', '', 'o', ''),
      S('ver', 'v', 'e', 'r'), S('bone', 'b', 'o', 'n'), S('stone', 'st', 'o', 'n')],
    lifts: [0, 4, 5], hendingAt: [4, 5],
  },
  {
    stave: 'f', half: 'odd', text: 'Fjord-frost bites the keel-board',
    syllables: [S('Fjord', 'f', 'o', 'rd'), S('frost', 'f', 'o', 'st'), S('bites', 'b', 'i', 'ts'),
      S('the', 'th', 'e', ''), S('keel', 'k', 'ee', 'l'), S('board', 'b', 'oa', 'rd')],
    lifts: [0, 1, 5], allitAt: [0, 1], hendingAt: [0, 5],
  },
  {
    stave: 'f', half: 'even', text: 'fetch-wind, the mast-fast rope',
    syllables: [S('fetch', 'f', 'e', 'ch'), S('wind', 'w', 'i', 'nd'), S('the', 'th', 'e', ''),
      S('mast', 'm', 'a', 'st'), S('fast', 'f', 'a', 'st'), S('rope', 'r', 'o', 'p')],
    lifts: [0, 3, 4], hendingAt: [3, 4],
  },
  {
    stave: 'm', half: 'odd', text: 'Mere-mast rimes in salt-frost',
    syllables: [S('Mere', 'm', 'e', 'r'), S('mast', 'm', 'a', 'st'), S('rimes', 'r', 'i', 'mz'),
      S('in', '', 'i', 'n'), S('salt', 's', 'a', 'lt'), S('frost', 'f', 'o', 'st')],
    lifts: [0, 1, 5], allitAt: [0, 1], hendingAt: [1, 5],
  },
  {
    stave: 'm', half: 'even', text: 'moot-hand holds the land-band',
    syllables: [S('moot', 'm', 'oo', 't'), S('hand', 'h', 'a', 'nd'), S('holds', 'h', 'o', 'ldz'),
      S('the', 'th', 'e', ''), S('land', 'l', 'a', 'nd'), S('band', 'b', 'a', 'nd')],
    lifts: [0, 4, 5], hendingAt: [4, 5],
  },
]);

const STAVE_RUNE = Object.freeze({ s: 'ᛋ', h: 'ᚼ', b: 'ᛒ', r: 'ᚱ', f: 'ᚠ', m: 'ᛘ' });
const ALL_STAVES = Object.freeze(['s', 'h', 'b', 'r', 'f', 'm']);

// ---- the three laws, computed from syllables -------------------------------

const syl = (frag, i) => frag.syllables[i];

/** law 1 */
function sixSyllables(frag) {
  return Array.isArray(frag.syllables) && frag.syllables.length === 6;
}

/** law 2, odd side: the two props share an onset. Returns the cluster or null. */
function propStave(frag) {
  if (!Array.isArray(frag.allitAt) || frag.allitAt.length !== 2) return null;
  const [i, j] = frag.allitAt;
  if (!frag.lifts.includes(i) || !frag.lifts.includes(j)) return null;
  const a = syl(frag, i);
  const b = syl(frag, j);
  if (!a || !b || a.onset !== b.onset || a.onset === '') return null;
  return a.onset;
}

/** law 2, even side: the chief stave is the onset of the FIRST stress */
function chiefStave(frag) {
  if (!Array.isArray(frag.lifts) || !frag.lifts.length) return null;
  const first = syl(frag, frag.lifts[0]);
  return first && first.onset ? first.onset : null;
}

/** law 3: 'skot' (shared coda, parted vowel), 'adal' (shared vowel and coda), or null */
function hendingClass(frag) {
  if (!Array.isArray(frag.hendingAt) || frag.hendingAt.length !== 2) return null;
  const [i, j] = frag.hendingAt;
  if (!frag.lifts.includes(i) || !frag.lifts.includes(j)) return null;
  const a = syl(frag, i);
  const b = syl(frag, j);
  if (!a || !b || !a.coda || a.coda !== b.coda) return null;
  return a.vowel === b.vowel ? 'adal' : 'skot';
}

/** does this pair make a lawful long line under the given stave? */
function longLineOk(odd, even, stave) {
  if (!odd || !even || odd === even) return false;
  if (!sixSyllables(odd) || !sixSyllables(even)) return false;
  if (hendingClass(odd) !== 'skot') return false;
  if (hendingClass(even) !== 'adal') return false;
  const props = propStave(odd);
  if (props === null || props !== stave) return false;
  return chiefStave(even) === stave;
}

// ---- generator -------------------------------------------------------------

/** every arrangement of the 8 fragments into 4 stave-ordered long lines */
function countAssemblies(fragments, staves, stopAt) {
  const n = fragments.length;
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  let count = 0;
  let first = null;
  const perm = new Array(n);
  const used = new Array(n).fill(false);

  (function place(slot) {
    if (count >= stopAt) return;
    if (slot === n) {
      count++;
      if (!first) {
        first = [];
        for (let k = 0; k < n; k += 2) first.push([perm[k], perm[k + 1]]);
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      perm[slot] = i;
      // prune the moment a completed long line breaks a law
      if (slot % 2 === 1) {
        const line = slot >> 1;
        if (!longLineOk(fragments[perm[slot - 1]], fragments[i], staves[line])) continue;
      }
      used[i] = true;
      place(slot + 1);
      used[i] = false;
      if (count >= stopAt) return;
    }
  })(0);

  return { count, first };
}

function build(rng) {
  const staves = rng.shuffle(ALL_STAVES.slice()).slice(0, 4);
  const chosen = [];
  for (const st of staves) {
    chosen.push(BANK.find((f) => f.stave === st && f.half === 'odd'));
    chosen.push(BANK.find((f) => f.stave === st && f.half === 'even'));
  }
  const order = rng.shuffle(chosen.map((_, i) => i));
  const fragments = order.map((i) => {
    const f = chosen[i];
    return {
      text: f.text,
      syllables: f.syllables.map((s) => ({ ...s })),
      lifts: f.lifts.slice(),
      allitAt: f.allitAt ? f.allitAt.slice() : null,
      hendingAt: f.hendingAt.slice(),
    };
  });
  return { fragments, staves: staves.slice(), staveRunes: staves.map((s) => STAVE_RUNE[s]) };
}

function makePuzzle(rng) {
  let instance = build(rng);
  for (let i = 0; i < 60; i++) {
    const { count } = countAssemblies(instance.fragments, instance.staves, 2);
    if (count === 1) break;
    instance = build(rng);
  }
  return instance;
}

function solve(instance) {
  const { first } = countAssemblies(instance.fragments, instance.staves, 1);
  return { lines: first || [[0, 1], [2, 3], [4, 5], [6, 7]] };
}

function verify(instance, answer) {
  if (!instance || !Array.isArray(instance.fragments)) return { ok: false };
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
  const lines = answer.lines;
  const n = instance.fragments.length;
  if (!Array.isArray(lines) || lines.length !== n / 2) return { ok: false };
  const seen = new Set();
  for (const pair of lines) {
    if (!Array.isArray(pair) || pair.length !== 2) return { ok: false };
    for (const i of pair) {
      if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) return { ok: false };
      seen.add(i);
    }
  }
  if (seen.size !== n) return { ok: false };
  let standing = 0;
  for (let k = 0; k < lines.length; k++) {
    if (longLineOk(instance.fragments[lines[k][0]], instance.fragments[lines[k][1]], instance.staves[k])) standing++;
  }
  if (standing === lines.length) return { ok: true };
  return { ok: false, near: `${standing} of the four long lines stand. The rest break metre.` };
}

function wrongAnswers(instance) {
  const truth = solve(instance).lines;
  const out = [];
  const key = (l) => JSON.stringify(l);
  const truthKey = key(truth);
  const push = (lines) => {
    if (key(lines) !== truthKey && !out.some((o) => key(o.lines) === key(lines))) out.push({ lines });
  };
  const copy = () => truth.map((p) => p.slice());

  // halves of the right kind, wrong long lines
  for (let a = 0; a < 3; a++) {
    const l = copy();
    const t = l[a][0]; l[a][0] = l[a + 1][0]; l[a + 1][0] = t;
    push(l);
  }
  for (let a = 0; a < 3; a++) {
    const l = copy();
    const t = l[a][1]; l[a][1] = l[a + 1][1]; l[a + 1][1] = t;
    push(l);
  }
  // an odd half set as an even half
  const swapped = copy();
  swapped[0] = [swapped[0][1], swapped[0][0]];
  push(swapped);
  // the long lines read in the wrong order against the stamped staves
  push(copy().reverse());
  push([copy()[1], copy()[0], copy()[2], copy()[3]]);
  // two props crossed
  const crossed = copy();
  crossed[0][0] = truth[2][0];
  crossed[2][0] = truth[0][0];
  push(crossed);
  return out.slice(0, 10);
}

// ---- view ------------------------------------------------------------------
//
// The board is a skald's lectern. Eight half-lines are real carved staves —
// split laths with bark edges, an inked channel, six chisel pips for the six
// syllables, an iron end-band — and the four long lines are rests in a rack,
// each with the hasp's stave stamped on a boss at its head.
//
// The metre is made VISIBLE rather than explained. Every stave carries its own
// marks before it is ever seated: a gold pip over each stress that must agree
// with a stamped stave, and under its two hending syllables either a HOLLOW
// ring (skothending — coda alone) or a FILLED bar (aðalhending — vowel and
// coda). Seat a stave on the side whose law it answers and those marks LIGHT:
// the stresses in gold, the hending in blood-red. Seat both halves of a rest
// under the stave they name and the rest's ledge groove runs gold from the
// stamp through both staves, with a riser to every lit stress. Nobody needs to
// know how to scan a line; the lights say when the sounds bind.
//
// The frozen artifact-tongue rule: the verse text is what the skald cut, so it
// stays as authored in every language. Every instruction and gloss localizes.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";

// View-side colour maths (the frozen art API exposes palette tokens, not maths)
// and a view-side PRNG, so the pure half keeps its imports untouched.
const rgbOf = (hex) => { const v = parseInt(hex.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const rgba = (hex, a) => { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; };
function mixHex(a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, '0')}`;
}
function seeded(n) {
  let s = (Math.imul(n, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and resolve through it at mount.
const BOARD_EN = {
  troughHead: 'Loose staves — six syllables cut in each',
  tally: '{n} of 4 lines bind true',
  tallyDone: 'All 4 lines bind true. Speak the verse.',
  submit: 'Speak the verse',
  skip: 'Skip the showing',
  demoSay: 'Watch once: a loose stave goes onto a rest, and the metre lights answer.',
  keyHelp: 'Tap a stave to lift it, then tap a rest to set it down. Tap a seated stave to take it back. By key: tab to a stave, space to lift, tab to a rest, space to set.',
  restAria: 'Rest {n}, stave {stave}: {half} half-line',
  halfOdd: 'opening',
  halfEven: 'answering',
  restEmpty: 'empty',
  fragAria: '“{text}”, six syllables, {rhyme}',
  rhymeSkot: 'rhymes on its coda alone',
  rhymeAdal: 'rhymes on vowel and coda both',
  lifted: 'Lifted “{text}” back to the loose staves.',
  set: '“{text}” set as the {half} half of rest {n} (stave {stave}).',
  spoken: 'Verse spoken:',
  failed: 'The verse will not stand.',
  openLaw: 'Court metre: six syllables to a half-line; two props alliterate in the opening half and the answering half’s first stress joins them; the opening half rhymes on its coda alone, the answering on vowel and coda both.',
  openStamps: 'Staves stamped on the hasp, in order: {staves}.',
  openFrag: 'Half-line {n}: “{text}” ({count} syllables).',
};

// which syllables must agree with the rest's stamped stave
const isPropPair = (f) => Array.isArray(f.allitAt) && f.allitAt.length === 2;
const allitIdx = (f) => (isPropPair(f) ? f.allitAt.slice() : [f.lifts[0]]);
// side 0 = opening (odd) half, side 1 = answering (even) half
const allitBinds = (f, side, stave) => (side === 0 ? propStave(f) === stave : chiefStave(f) === stave);
const hendBinds = (f, side) => hendingClass(f) === (side === 0 ? 'skot' : 'adal');

/**
 * Split a fragment's authored text into its six syllables plus the separators
 * that stand between them, so each syllable can carry its own carved mark. The
 * scan is a forward walk, so the concatenation is byte-identical to `text` and
 * the e2e driver's `^<text>\s*\d+$` handle on `.frag` is preserved. Returns
 * null if any syllable is not found, and the caller falls back to plain text.
 */
function syllableRuns(frag) {
  const text = frag.text;
  const out = [];
  let cur = 0;
  for (let i = 0; i < frag.syllables.length; i++) {
    const s = frag.syllables[i].text;
    const at = text.indexOf(s, cur);
    if (at < 0) return null;
    if (at > cur) out.push({ gap: text.slice(cur, at) });
    out.push({ i, s });
    cur = at + s.length;
  }
  if (cur < text.length) out.push({ gap: text.slice(cur) });
  return out;
}

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
  const lang = ctx.lang || 'en';
  const LB = (I18N[lang] && I18N[lang].board) || {};
  const T = (key, params) => {
    let s = key in LB ? LB[key] : BOARD_EN[key];
    if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
    return s;
  };
  const calm = (() => {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  })();

  // every listener is tracked so unmount can take them all back down
  const bound = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); bound.push([el, type, fn]); };
  const unbind = () => { for (const [el, type, fn] of bound) el.removeEventListener(type, fn); bound.length = 0; };
  const timers = [];
  const later = (fn, ms) => { const h = setTimeout(fn, ms); timers.push(h); return h; };
  const observers = [];
  let raf = 0;

  // the two lit inks: gold for the stave-binding, blood for the hending hum.
  // `blood` itself sits at 1.4:1 on oak, so the lit mark is blood carried up
  // toward ember — a mark, never text (docs/ART.md: text stays bone/boneDim).
  const BLOOD_LIT = mixHex(P.blood, P.ember, 0.5);
  const BLOOD_DIM = rgba(P.boneDim, 0.5);
  // the shell's relief recipe carried one step deeper: display lettering on
  // this board is CUT, and a single 1px pair does not read as cut at retina
  const CARVED = `0 -1px 0 ${rgba(P.tar, 0.9)}, -1px -1px 0 ${rgba(P.tar, 0.72)},`
    + ` 1px 1px 0 ${rgba(P.goldBright, 0.26)}, 0 2px 3px ${rgba(P.tar, 0.6)}`;

  const wrap = document.createElement('div');
  wrap.className = 'ow-lock ow-drott';
  const style = document.createElement('style');
  style.textContent = `
  .ow-drott{position:relative;display:flex;flex-direction:column;gap:.42rem;color:${P.bone};
    font-family:${SERIF}}

  /* ---- the lectern rack ---- */
  .ow-drott .ow10-lectern{position:relative;padding:13px 11px 11px;display:flex;
    flex-direction:column;gap:7px}
  .ow-drott .ow10-lectern>canvas{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
  .ow-drott .ow10-lights{z-index:3}
  /* A long line IS two half-lines. Wide enough, they stand side by side; on a
     phone they stack under one stamp, which is also how the verse is written. */
  .ow-drott .ow10-rest{position:relative;z-index:2;display:grid;gap:7px;padding-bottom:9px;
    grid-template-columns:46px 1fr;grid-template-areas:"stamp a" "stamp b"}
  .ow-drott.wide .ow10-rest{grid-template-columns:46px 1fr 1fr;grid-template-areas:"stamp a b"}
  .ow-drott .ow10-stamp{grid-area:stamp;position:relative;display:flex;align-items:center;
    justify-content:center;min-height:52px}
  .ow-drott .slot.ow10-a{grid-area:a}
  .ow-drott .slot.ow10-b{grid-area:b}
  .ow-drott .ow10-stamp canvas{display:block}
  .ow-drott .slot{position:relative;flex:1 1 0;min-height:52px;min-width:44px;display:flex;
    align-items:center;justify-content:flex-start;padding:0;background:transparent;border:0;
    border-radius:3px;cursor:pointer}
  .ow-drott .slot::before{content:"";position:absolute;left:0;top:0;right:0;bottom:0;
    border-radius:3px;pointer-events:none;
    box-shadow:inset 0 2px 4px ${rgba(P.tar, 0.66)},inset 0 -1px 0 ${rgba(P.goldBright, 0.1)}}
  .ow-drott .slot.armed::before{box-shadow:inset 0 0 0 1px ${rgba(P.goldBright, 0.5)},
    inset 0 2px 4px ${rgba(P.tar, 0.6)}}
  .ow-drott .slot:focus-visible,.ow-drott button:focus-visible{outline:2px solid ${P.goldBright};
    outline-offset:2px}

  /* ---- a stave: canvas wood under DOM ink ---- */
  .ow-drott .frag{position:relative;display:block;width:100%;min-height:50px;padding:.34rem 2.1rem .5rem .6rem;
    background:transparent;border:0;border-radius:2px;color:${P.bone};font:inherit;
    text-align:left;cursor:grab;-webkit-tap-highlight-color:transparent}
  .ow-drott .frag>canvas{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;
    filter:drop-shadow(0 3px 4px ${rgba(P.tar, 0.72)})}
  .ow-drott .frag .ink{position:relative;display:block;font-size:.93rem;line-height:1.22;
    color:${P.bone};text-shadow:${CARVED};white-space:normal}
  .ow-drott .frag .count{position:absolute;right:.62rem;top:50%;transform:translateY(-50%);
    font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:.68rem;color:${rgba(P.boneDim, 0.9)};
    text-shadow:0 1px 0 ${rgba(P.tar, 0.9)}}
  .ow-drott .frag[aria-pressed="true"]{cursor:grabbing}
  .ow-drott .frag[aria-pressed="true"]>canvas{filter:drop-shadow(0 7px 9px ${rgba(P.tar, 0.8)})
    brightness(1.14)}
  .ow-drott .frag[aria-pressed="true"] .ink{color:${P.goldBright}}

  /* ---- the metre marks, cut on the syllables themselves ---- */
  .ow-drott .sy{position:relative;display:inline-block}
  .ow-drott .sy.lift{color:${mixHex(P.bone, '#ffffff', 0.25)}}
  .ow-drott .sy.allit::before{content:"";position:absolute;left:50%;top:-.4em;width:6px;height:6px;
    margin-left:-3px;border-radius:50%;background:${rgba(P.boneDim, 0.62)};
    box-shadow:0 1px 0 ${rgba(P.tar, 0.9)},inset 0 -1px 0 ${rgba(P.tar, 0.4)};
    transition:background .18s,box-shadow .18s}
  /* skothending: a HOLLOW ring — the coda alone answers */
  .ow-drott .sy.hend::after{content:"";position:absolute;left:0;right:0;bottom:-.34em;height:6px;
    border:1.2px solid ${BLOOD_DIM};border-radius:3px;background:transparent;
    box-shadow:0 1px 0 ${rgba(P.tar, 0.55)};
    transition:border-color .18s,background .18s,box-shadow .18s}
  /* aðalhending: a FILLED bar — vowel and coda both answer */
  .ow-drott .sy.hend.adal::after{background:${BLOOD_DIM};border-color:transparent;
    box-shadow:inset 0 1px 0 ${rgba(P.bone, 0.28)},0 1px 0 ${rgba(P.tar, 0.55)}}
  .ow-drott .frag.lit-allit .sy.allit{color:${P.goldBright}}
  .ow-drott .frag.lit-allit .sy.allit::before{background:${P.goldBright};
    box-shadow:0 0 7px ${rgba(P.goldBright, 0.85)},0 1px 0 ${rgba(P.tar, 0.8)}}
  .ow-drott .frag.lit-hend .sy.hend::after{border-color:${BLOOD_LIT};
    box-shadow:0 0 7px ${rgba(BLOOD_LIT, 0.72)}}
  .ow-drott .frag.lit-hend .sy.hend.adal::after{background:${BLOOD_LIT};border-color:${BLOOD_LIT}}

  /* ---- the desk edge: tally, notches, the scribe's kit ---- */
  /* the right 158px of the strip belong to the notch sockets and the scribe's
     kit, so the tally never runs under them at phone width */
  .ow-drott .ow10-desk{position:relative;display:flex;align-items:center;min-height:50px;
    padding:.35rem 158px .35rem .8rem}
  .ow-drott .ow10-desk>canvas{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
  .ow-drott .ow10-tally{position:relative;margin:0;font-size:.84rem;letter-spacing:.055em;
    color:${P.bone};text-shadow:${art.reliefShadowCss}}

  /* ---- the trough of loose staves ---- */
  .ow-drott .ow10-trough{position:relative;padding:11px 10px}
  .ow-drott .ow10-trough>canvas{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
  .ow-drott .tray{position:relative;display:grid;grid-template-columns:1fr;gap:6px}
  .ow-drott.wide .tray{grid-template-columns:1fr 1fr;gap:7px 9px}
  .ow-drott .ow10-head{position:relative;margin:.1rem 0 0;font-size:.7rem;letter-spacing:.1em;
    text-transform:uppercase;color:${P.boneDim};text-shadow:0 1px 0 ${rgba(P.tar, 0.85)}}

  /* ---- the showing ---- */
  .ow-drott .ow10-showing{position:absolute;left:0;top:0;width:100%;height:100%;
    pointer-events:none;z-index:9}
  .ow-drott .ow10-skip{position:relative;align-self:flex-start;min-height:44px;min-width:44px;
    padding:.2rem .8rem;background:transparent;color:${P.boneDim};font:inherit;font-size:.82rem;
    border:1px solid ${rgba(P.oakLight, 0.9)};border-radius:3px;cursor:pointer}

  .ow-drott .send{position:relative;background:${P.gold};color:${P.tar};font-weight:600;border:none;
    border-radius:3px;min-height:46px;font:inherit;letter-spacing:.03em;cursor:pointer;
    box-shadow:inset 0 1px 0 ${rgba(P.goldBright, 0.6)},inset 0 -2px 3px ${rgba(P.tar, 0.5)},
      0 3px 7px ${rgba(P.tar, 0.55)}}
  .ow-drott .send[disabled]{opacity:.45;cursor:default}
  .ow-drott .tell{position:relative;margin:0;min-height:1.3em;font-size:.9rem;color:${P.ember};
    scroll-margin:28px}
  .ow-drott .glint{position:relative;font-size:.72rem;color:${P.boneDim};min-height:0}
  #app .ow-drott .slot{min-width:44px}
  #app .ow-drott button{min-width:44px}
  @media (max-width:430px){
    .ow-drott .frag .ink{font-size:.86rem}
    .ow-drott .ow10-plate{padding-left:2.9rem}
    .ow-drott .ow10-plate p{font-size:.84rem}
  }
  @media (prefers-reduced-motion:reduce){
    .ow-drott .sy.allit::before,.ow-drott .sy.hend::after{transition:none}
  }`;
  wrap.appendChild(style);

  const N = instance.fragments.length;
  const LINES = N / 2;
  const slotOf = new Array(N).fill(-1);   // fragment -> slot (0..7) or -1 in the trough
  let held = null;

  // ---- the lectern ----------------------------------------------------------
  const lectern = document.createElement('div');
  lectern.className = 'ow10-lectern';
  const rackCv = document.createElement('canvas');
  rackCv.setAttribute('aria-hidden', 'true');
  lectern.appendChild(rackCv);
  wrap.appendChild(lectern);

  const slotEls = [];
  const restEls = [];
  const stampCvs = [];
  for (let line = 0; line < LINES; line++) {
    const rest = document.createElement('div');
    rest.className = 'ow10-rest';
    const stamp = document.createElement('div');
    stamp.className = 'ow10-stamp';
    const { canvas: sc, ctx: sg } = art.makeCanvas(40, 46);
    sc.setAttribute('aria-hidden', 'true');
    drawStamp(sg, 40, 46, instance.staveRunes[line], instance.staves[line], false);
    stamp.appendChild(sc);
    stampCvs.push({ canvas: sc, g: sg, rune: instance.staveRunes[line], letter: instance.staves[line], lit: false });
    rest.appendChild(stamp);
    for (const half of [0, 1]) {
      const slot = document.createElement('div');
      const index = line * 2 + half;
      slot.className = half ? 'slot ow10-b' : 'slot ow10-a';
      slot.tabIndex = 0;
      slot.dataset.slot = String(index);
      slot.setAttribute('role', 'button');
      on(slot, 'click', () => place(index));
      on(slot, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(index); }
      });
      on(slot, 'dragover', (e) => e.preventDefault());
      on(slot, 'drop', (e) => {
        e.preventDefault();
        const f = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(f)) { held = f; place(index); }
      });
      rest.appendChild(slot);
      slotEls.push(slot);
    }
    lectern.appendChild(rest);
    restEls.push(rest);
  }
  const lightsCv = document.createElement('canvas');
  lightsCv.className = 'ow10-lights';
  lightsCv.setAttribute('aria-hidden', 'true');
  lectern.appendChild(lightsCv);

  // ---- the desk edge: tally + notches + the scribe's kit ---------------------
  const desk = document.createElement('div');
  desk.className = 'ow10-desk';
  const deskCv = document.createElement('canvas');
  deskCv.setAttribute('aria-hidden', 'true');
  desk.appendChild(deskCv);
  const tally = document.createElement('p');
  tally.className = 'ow10-tally';
  tally.setAttribute('aria-live', 'polite');
  desk.appendChild(tally);
  wrap.appendChild(desk);

  // ---- the trough of loose staves -------------------------------------------
  const troughHead = document.createElement('p');
  troughHead.className = 'ow10-head';
  troughHead.textContent = T('troughHead');
  wrap.appendChild(troughHead);

  const trough = document.createElement('div');
  trough.className = 'ow10-trough';
  const troughCv = document.createElement('canvas');
  troughCv.setAttribute('aria-hidden', 'true');
  trough.appendChild(troughCv);
  const tray = document.createElement('div');
  tray.className = 'tray';
  trough.appendChild(tray);
  wrap.appendChild(trough);

  // ---- the staves themselves ------------------------------------------------
  const fragEls = instance.fragments.map((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'frag';
    b.draggable = true;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', T('fragAria', {
      text: f.text,
      rhyme: T(hendingClass(f) === 'adal' ? 'rhymeAdal' : 'rhymeSkot'),
    }));

    const grain = document.createElement('canvas');
    grain.setAttribute('aria-hidden', 'true');
    b.appendChild(grain);

    // The ink: the authored text, cut syllable by syllable so each mark sits on
    // the sound it belongs to. Concatenation is byte-identical to `f.text`.
    const ink = document.createElement('span');
    ink.className = 'ink';
    const runs = syllableRuns(f);
    if (!runs) {
      ink.textContent = f.text;
    } else {
      const allit = allitIdx(f);
      const cls = hendingClass(f) === 'adal' ? 'sy hend adal' : 'sy hend';
      for (const run of runs) {
        if (run.gap != null) { ink.appendChild(document.createTextNode(run.gap)); continue; }
        const sp = document.createElement('span');
        const parts = ['sy'];
        if (f.lifts.includes(run.i)) parts.push('lift');
        if (allit.includes(run.i)) parts.push('allit');
        sp.className = f.hendingAt.includes(run.i) ? `${parts.join(' ')} ${cls.slice(3)}` : parts.join(' ');
        sp.textContent = run.s;
        ink.appendChild(sp);
      }
    }
    b.appendChild(ink);

    // the count is the LAST text in the subtree (the e2e handle depends on it)
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${f.syllables.length}`;
    b.appendChild(count);

    on(b, 'click', (e) => {
      stopShowing();
      if (slotOf[i] >= 0) {           // a seated stave: the tap takes it back
        e.stopPropagation();
        lift(i);
        return;
      }
      held = held === i ? null : i;
      audio.ui('tick');
      refresh();
    });
    on(b, 'dragstart', (e) => { stopShowing(); e.dataTransfer.setData('text/plain', String(i)); held = i; });
    b.__grain = grain;
    b.__grainW = 0;
    return b;
  });

  const send = document.createElement('button');
  send.className = 'send';
  send.type = 'button';
  send.textContent = T('submit');
  send.disabled = true;
  wrap.appendChild(send);

  // The shell's near-line sits below the fold on this lock; the verse answers
  // where the player's eye already is.
  const tell = document.createElement('p');
  tell.className = 'tell';
  // visual echo only — the shell's .near-line is the single aria-live deny announcer (LOOP5 ruling)
  wrap.appendChild(tell);

  const keys = document.createElement('p');
  keys.className = 'glint';
  keys.textContent = T('keyHelp');
  wrap.appendChild(keys);

  // ---- painters -------------------------------------------------------------

  // The hasp stamp: an iron boss let into the rack head, the stave's rune cut
  // through it and its sound carved under. Lights when its long line binds.
  function drawStamp(g, w, h, rune, letter, lit) {
    g.clearRect(0, 0, w, h);
    const r = seeded(letter.charCodeAt(0) * 977);
    const cx = w / 2;
    const cy = h * 0.42;
    const rad = Math.min(w, h) * 0.42;
    g.save();
    // seat shadow in the wood
    g.fillStyle = rgba(P.tar, 0.62);
    g.beginPath();
    g.ellipse(cx, cy + rad * 0.16, rad * 1.06, rad * 1.02, 0, 0, Math.PI * 2);
    g.fill();
    // the boss: struck iron, warmed if lit
    const face = g.createRadialGradient(cx - rad * 0.34, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
    face.addColorStop(0, lit ? rgba(P.goldBright, 0.95) : rgba(mixHex(P.oakLight, P.bone, 0.18), 0.75));
    face.addColorStop(0.55, lit ? rgba(P.gold, 0.9) : rgba(mixHex(P.oakDeep, P.oakLight, 0.4), 0.9));
    face.addColorStop(1, rgba(P.tar, 0.95));
    g.fillStyle = face;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
    // hammer facets round the rim
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.2;
      g.strokeStyle = rgba(i % 2 ? P.tar : P.bone, 0.16);
      g.lineWidth = 1.1;
      g.beginPath();
      g.arc(cx, cy, rad * (0.74 + r() * 0.16), a, a + 0.5);
      g.stroke();
    }
    g.strokeStyle = rgba(P.tar, 0.9);
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = rgba(lit ? P.goldBright : P.oakLight, 0.4);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy + 0.9, rad - 1.4, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    g.restore();
    if (lit) art.glow(g, cx, cy, rad * 1.3, P.goldBright, 0.4);
    // drawRune's `weight` is a ribbon width in pixels; the string 'heavy' fed
    // NaN into the ribbon fill and all four hasp staves drew nothing at all.
    const rs = rad * 1.5;
    art.drawRune(g, rune, cx - rs / 2, cy - rs / 2, rs, {
      color: lit ? P.tar : P.goldBright, weight: rs / 7,
    });
    art.carveText(g, letter, cx, h - 2.5, 11, {
      color: lit ? P.goldBright : P.boneDim, depth: 0.85, align: 'center',
    });
  }

  // A stave: a split lath with bark edges, an inked channel for the text, six
  // chisel pips for the six syllables, an iron end-band over the count.
  function drawStave(g, w, h, seed, inkW) {
    const r = seeded(seed * 31 + 7);
    g.clearRect(0, 0, w, h);
    const top = [];
    const bot = [];
    const n = Math.max(7, Math.round(w / 24));
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * w;
      top.push([x, 1.4 + Math.sin(i * 1.63 + seed) * 1.15 + r() * 2]);
      bot.push([x, h - 1.4 - Math.sin(i * 1.27 + seed * 0.7) * 1.15 - r() * 2.2]);
    }
    const lath = (c) => {
      c.beginPath();
      c.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) c.lineTo(x, y);
      c.lineTo(w, bot[n][1]);
      for (let i = n; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]);
      c.closePath();
    };
    g.save();
    lath(g);
    g.clip();
    art.paintWood(g, w, h, 610 + seed * 13);
    // The inked channel: cut only as far as the letters run, so the rest of the
    // lath stays bare wood with its own tool history, the way a carver stops
    // where the text stops instead of ploughing the whole board.
    const bandW0 = Math.min(30, w * 0.14);
    const chanW = Math.max(60, Math.min(w - 10 - bandW0 - 6, (inkW || w * 0.6) + 18));
    const chan = { x: 5, y: h * 0.16, w: chanW, h: h * 0.62 };
    g.fillStyle = rgba(P.tar, 0.34);
    g.fillRect(chan.x, chan.y, chan.w, chan.h);
    art.insetFace(g, chan.x, chan.y, chan.w, chan.h, { depth: 0.52, lipLight: 0.2 });
    // the carver's terminal: a chip rosette closing the channel's run
    const termX = chan.x + chan.w + 11;
    if (termX < w - bandW0 - 6) art.rosette(g, termX, h * 0.47, Math.min(9, h * 0.2), { alpha: 0.34 });
    // six chisel pips along the foot — the pre-counted syllables, made physical
    const pipY = h - 5.2;
    for (let i = 0; i < 6; i++) {
      const px = 9 + i * 8.4;
      g.fillStyle = rgba(P.tar, 0.72);
      g.beginPath();
      g.moveTo(px - 2.6, pipY + 2.6);
      g.lineTo(px, pipY - 2.6);
      g.lineTo(px + 2.6, pipY + 2.6);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(P.goldBright, 0.24);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(px, pipY - 2.4);
      g.lineTo(px + 2.4, pipY + 2.4);
      g.stroke();
    }
    // tool history in the stave's own dead stretch
    g.strokeStyle = rgba(P.oakLight, 0.1);
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = 4 + r() * (h - 8);
      g.beginPath();
      g.moveTo(r() * w * 0.4, y);
      g.lineTo(r() * w * 0.4 + 24 + r() * 40, y + (r() - 0.5) * 3);
      g.stroke();
    }
    // the iron end-band the count is struck on
    const bandW = Math.min(30, w * 0.14);
    const bx = w - bandW - 1;
    const bandG = g.createLinearGradient(bx, 0, bx + bandW, 0);
    bandG.addColorStop(0, rgba(P.tar, 0.86));
    bandG.addColorStop(0.42, rgba(mixHex(P.oakDeep, P.bone, 0.2), 0.8));
    bandG.addColorStop(1, rgba(P.tar, 0.92));
    g.fillStyle = bandG;
    g.fillRect(bx, 0, bandW, h);
    g.strokeStyle = rgba(P.bone, 0.16);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(bx + 0.6, 1);
    g.lineTo(bx + 0.6, h - 1);
    g.stroke();
    g.fillStyle = rgba(P.goldBright, 0.5);
    g.beginPath();
    g.arc(bx + bandW * 0.5, 5.4, 1.7, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(bx + bandW * 0.5, h - 5.4, 1.7, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // bark edges: a dark ragged rim with a lit arris just inside it
    g.save();
    g.lineJoin = 'round';
    g.strokeStyle = rgba(P.tar, 0.92);
    g.lineWidth = 2.4;
    lath(g);
    g.stroke();
    g.strokeStyle = rgba(mixHex(P.oakLight, P.goldBright, 0.35), 0.3);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= n; i++) g.lineTo(bot[i][0], bot[i][1] - 1.8);
    g.stroke();
    g.strokeStyle = rgba(P.tar, 0.4);
    g.beginPath();
    for (let i = 0; i <= n; i++) g.lineTo(top[i][0], top[i][1] + 1.6);
    g.stroke();
    g.restore();
  }

  // The rack the rests are cut into: a carved architrave tray, four shelf
  // recesses with their ledges, and quiet tool history in the dead stretches.
  function drawRack(g, w, h) {
    g.clearRect(0, 0, w, h);
    art.paintWood(g, w, h, 1010);
    const band = Math.max(9, Math.min(13, w * 0.02));
    art.tray(g, band, band, w - band * 2, h - band * 2, {
      band, seed: 'b10-rack', ribbon: w > 300, chipAlpha: 0.7,
    });
    for (const rest of restEls) {
      const box = restBox(rest);
      if (!box) continue;
      // the shelf recess and the ledge the stave leans on
      g.fillStyle = rgba(P.oakDeep, 0.34);
      g.fillRect(box.x, box.y, box.w, box.h);
      art.insetFace(g, box.x, box.y, box.w, box.h, { depth: 0.62, lipLight: 0.16 });
      g.strokeStyle = rgba(mixHex(P.oakLight, P.goldBright, 0.3), 0.26);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(box.x + 2, box.y + box.h - 1);
      g.lineTo(box.x + box.w - 2, box.y + box.h - 1);
      g.stroke();
    }
    // Every rest is a PREPARED rest, never a hole: the carpenter set out each
    // berth with a scribe line and six pip sockets — the same six pips a stave
    // carries on its foot. An empty berth therefore says "six syllables go
    // here" without a word, and the rack reads as furniture rather than a void.
    const lect = lectern.getBoundingClientRect();
    for (let s = 0; s < slotEls.length; s++) {
      const sb = slotEls[s].getBoundingClientRect();
      if (!sb.width) continue;
      const x = sb.left - lect.left;
      const yTop = sb.top - lect.top;
      const sw = sb.width;
      const sh = sb.height;
      const r = seeded(s * 131 + 5);
      // the ghost of the lath that belongs here, incised into the berth floor:
      // outline, setting-out line, six pip sockets, and the recess the iron
      // end-band drops into. An empty berth says "a six-syllable stave, struck
      // and counted, goes here" without a word of instruction.
      const gx = x + 4;
      const gy = yTop + 4;
      const gw = sw - 8;
      const gh = sh - 8;
      g.save();
      g.strokeStyle = rgba(P.tar, 0.45);
      g.lineWidth = 1.6;
      g.setLineDash([7, 5]);
      g.strokeRect(gx, gy, gw, gh);
      g.strokeStyle = rgba(mixHex(P.oakLight, P.goldBright, 0.3), 0.12);
      g.lineWidth = 1;
      g.strokeRect(gx + 1.2, gy + 1.2, gw, gh);
      g.setLineDash([]);
      // the end-band recess and its hollow count socket
      const bw = Math.min(30, gw * 0.14);
      g.fillStyle = rgba(P.tar, 0.34);
      g.fillRect(gx + gw - bw, gy, bw, gh);
      g.strokeStyle = rgba(P.boneDim, 0.16);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(gx + gw - bw / 2, gy + gh / 2, Math.min(6, gh * 0.22), 0, Math.PI * 2);
      g.stroke();
      g.restore();
      // the setting-out line the stave's ink will sit on
      g.strokeStyle = rgba(P.bone, 0.09);
      g.lineWidth = 0.9;
      g.beginPath();
      for (let px = x + 10; px <= x + sw - bw - 8; px += 22) g.lineTo(px, yTop + sh * 0.58 + Math.sin(px * 0.05) * 0.8);
      g.stroke();
      // six pip sockets along the berth foot
      for (let i = 0; i < 6; i++) {
        const px = x + 11 + i * 8.4;
        const py = yTop + sh - 7;
        g.fillStyle = rgba(P.tar, 0.62);
        g.beginPath();
        g.moveTo(px - 2.4, py + 2.4);
        g.lineTo(px, py - 2.4);
        g.lineTo(px + 2.4, py + 2.4);
        g.closePath();
        g.fill();
        g.strokeStyle = rgba(P.oakLight, 0.22);
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(px, py - 2.2);
        g.lineTo(px + 2.2, py + 2.2);
        g.stroke();
      }
      // adze facets and a chip-rosette so the bare berth still carries history
      g.strokeStyle = rgba(P.oakLight, 0.055);
      g.lineWidth = 7;
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ax = x + 40 + r() * Math.max(20, sw - 90);
        const ay = yTop + 8 + r() * Math.max(6, sh - 20);
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(ax + 26 + r() * 40, ay + (r() - 0.5) * 4);
        g.stroke();
      }
      if (sw > 150) art.rosette(g, x + sw - 20, yTop + sh * 0.42, 8.5, { alpha: 0.16 });
    }
    art.wear(g, w, h, 'b10-rack', { avoid: { x: band * 2, y: band * 2, w: w - band * 4, h: h - band * 4 } });
  }

  // The lights: the ledge groove of every rest, dark when nothing binds and
  // running gold from the stamp through both staves when it does, with a riser
  // to each lit stress, and a blood bloom under a half whose hending answers.
  function drawLights(g, w, h) {
    g.clearRect(0, 0, w, h);
    const lect = lectern.getBoundingClientRect();
    const lines = currentLines();
    for (let line = 0; line < LINES; line++) {
      const rest = restEls[line];
      const rb = rest.getBoundingClientRect();
      const pair = lines[line];
      const odd = pair[0] >= 0 ? instance.fragments[pair[0]] : null;
      const even = pair[1] >= 0 ? instance.fragments[pair[1]] : null;
      const st = instance.staves[line];
      const oddLit = !!odd && allitBinds(odd, 0, st);
      const evenLit = !!even && allitBinds(even, 1, st);
      const whole = oddLit && evenLit;

      // Every berth carries its own ledge groove, so the same code reads whether
      // the two halves stand side by side or stack under one stamp on a phone.
      for (const half of [0, 1]) {
        const sb = slotEls[line * 2 + half].getBoundingClientRect();
        if (!sb.width) continue;
        const y = sb.bottom - lect.top + 3.5;
        const x0 = sb.left - lect.left;
        const x1 = sb.right - lect.left;
        const f = half ? even : odd;
        const litHalf = half ? evenLit : oddLit;

        // the groove itself — always cut, so the channel is a fact of the rack
        g.strokeStyle = rgba(P.tar, 0.88);
        g.lineWidth = 3.2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        g.stroke();
        g.strokeStyle = rgba(P.oakLight, 0.22);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0, y + 2.2);
        g.lineTo(x1, y + 2.2);
        g.stroke();

        const stave = slotEls[line * 2 + half].querySelector('.frag');

        // gold seeps into the groove under a half that names the rest's stave
        if (litHalf) {
          const run = g.createLinearGradient(x0, 0, x1, 0);
          run.addColorStop(0, rgba(P.gold, 0.55));
          run.addColorStop(0.5, rgba(P.goldBright, whole ? 0.98 : 0.7));
          run.addColorStop(1, rgba(P.gold, 0.55));
          g.strokeStyle = run;
          g.lineWidth = whole ? 3 : 2.2;
          g.beginPath();
          g.moveTo(x0, y);
          g.lineTo(x1, y);
          g.stroke();
          // a riser from the groove up to every stress that lit
          if (stave) {
            for (const sy of stave.querySelectorAll('.sy.allit')) {
              const yb = sy.getBoundingClientRect();
              const rx = yb.left + yb.width / 2 - lect.left;
              const ry = yb.bottom - lect.top;
              g.strokeStyle = rgba(P.goldBright, whole ? 0.7 : 0.4);
              g.lineWidth = 1.4;
              g.beginPath();
              g.moveTo(rx, y);
              g.lineTo(rx, ry + 1);
              g.stroke();
              art.glow(g, rx, ry, 7, P.goldBright, whole ? 0.34 : 0.22);
            }
          }
        }

        // the blood hum: a short bar humming in the groove directly beneath each
        // hending syllable of a half that rhymes as its side demands. A mark,
        // not a wash — the wood has to keep reading as wood underneath.
        if (f && hendBinds(f, half) && stave) {
          for (const sy of stave.querySelectorAll('.sy.hend')) {
            const yb = sy.getBoundingClientRect();
            const hx = yb.left - lect.left;
            const hw = yb.width;
            g.strokeStyle = rgba(BLOOD_LIT, 0.95);
            g.lineWidth = 2.6;
            g.lineCap = 'butt';
            g.beginPath();
            g.moveTo(hx, y);
            g.lineTo(hx + hw, y);
            g.stroke();
            art.glow(g, hx + hw / 2, y, 8, BLOOD_LIT, 0.3);
          }
        }
      }

      // when both halves name the stamped stave the rest is bound: a gold spine
      // runs from the boss down the whole berth, joining the two grooves
      if (whole) {
        const sp = stampCvs[line].canvas.getBoundingClientRect();
        const sx = sp.right - lect.left + 3;
        g.strokeStyle = rgba(P.goldBright, 0.85);
        g.lineWidth = 2.6;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(sx, rb.top - lect.top + 6);
        g.lineTo(sx, rb.bottom - lect.top - 4);
        g.stroke();
        art.glow(g, sx, (rb.top + rb.bottom) / 2 - lect.top, 12, P.goldBright, 0.3);
      }
    }
  }

  // The desk edge: four notch sockets that fill as lines bind, and the scribe's
  // kit standing in the dead stretch — a horn inkwell, a cut quill, the knife.
  let deskBase = null;
  function deskBaseFor(w, h) {
    if (deskBase && deskBase.w === w && deskBase.h === h) return deskBase.canvas;
    const off = art.makeCanvas(w, h);
    const g = off.ctx;
    art.paintWood(g, w, h, 733);
    g.fillStyle = rgba(P.tar, 0.3);
    g.fillRect(0, 0, w, h);
    art.chipBorder(g, 4, 4, w - 8, h - 8, { size: 8, alpha: 0.55 });
    art.wear(g, w, h, 'b10-desk', { avoid: { x: 8, y: 8, w: w - 90, h: h - 16 } });
    // an interlace rail worked along the desk edge between the tally and the
    // notch sockets, so the middle of the strip carries carving, not nothing
    const railX = Math.max(120, w * 0.42);
    const railLen = w - 168 - railX;
    if (railLen > 60) {
      art.ribbonRail(g, railX, h * 0.5, railLen, {
        amp: Math.max(3, h * 0.11), step: 17, alpha: 0.42, color: P.gold,
      });
    }
    // ---- the scribe's kit, standing where nothing else does ----
    const kx = w - 62;
    const ky = h * 0.5;
    // the knife, laid across
    g.save();
    g.translate(kx + 34, ky + 5);
    g.rotate(-0.42);
    g.fillStyle = rgba(P.tar, 0.85);
    g.fillRect(-19, -1.6, 22, 3.2);
    g.fillStyle = rgba(mixHex(P.oakDeep, P.bone, 0.35), 0.8);
    g.beginPath();
    g.moveTo(3, -2.4);
    g.lineTo(20, -0.4);
    g.lineTo(3, 2.4);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba(P.bone, 0.35);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(3, -1.2);
    g.lineTo(19, -0.4);
    g.stroke();
    g.restore();
    // the horn inkwell
    const iw = 15;
    const ih = Math.min(24, h * 0.5);
    g.save();
    g.fillStyle = rgba(P.tar, 0.55);
    g.beginPath();
    g.ellipse(kx + 2, ky + ih * 0.5 + 2, iw * 1.05, iw * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    const horn = g.createLinearGradient(kx - iw, 0, kx + iw, 0);
    horn.addColorStop(0, rgba(P.tar, 0.95));
    horn.addColorStop(0.42, rgba(mixHex(P.oakLight, P.bone, 0.3), 0.85));
    horn.addColorStop(1, rgba(P.tar, 0.9));
    g.fillStyle = horn;
    g.beginPath();
    g.moveTo(kx - iw * 0.72, ky - ih * 0.5);
    g.lineTo(kx + iw * 0.72, ky - ih * 0.5);
    g.lineTo(kx + iw * 0.5, ky + ih * 0.5);
    g.lineTo(kx - iw * 0.5, ky + ih * 0.5);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba(P.tar, 0.9);
    g.lineWidth = 1.2;
    g.stroke();
    // the ink itself
    g.fillStyle = rgba(P.tar, 0.98);
    g.beginPath();
    g.ellipse(kx, ky - ih * 0.5, iw * 0.72, iw * 0.26, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba(P.goldBright, 0.3);
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(kx, ky - ih * 0.5, iw * 0.72, iw * 0.26, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    // the quill, leaning out of the well
    g.save();
    g.translate(kx, ky - ih * 0.5);
    g.rotate(-0.62);
    g.strokeStyle = rgba(P.bone, 0.62);
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 4);
    g.quadraticCurveTo(2, -14, 6, -30);
    g.stroke();
    g.fillStyle = rgba(P.bone, 0.3);
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const px = 1.6 + t * 4.6;
      const py = -8 - t * 21;
      g.beginPath();
      g.moveTo(px, py);
      g.quadraticCurveTo(px + 5, py - 1.5, px + 7.5, py - 5.5);
      g.lineTo(px + 0.8, py + 1.5);
      g.closePath();
      g.fill();
    }
    g.restore();
    deskBase = { w, h, canvas: off.canvas };
    return off.canvas;
  }
  function drawDesk(g, w, h, standing) {
    g.clearRect(0, 0, w, h);
    g.drawImage(deskBaseFor(w, h), 0, 0, w, h);
    // four notch sockets, cut; a bound line fills its notch with gold
    const nx = w - 148;
    const ny = h * 0.5;
    for (let i = 0; i < LINES; i++) {
      const x = nx + i * 15;
      const lit = i < standing;
      g.save();
      g.strokeStyle = rgba(P.tar, 0.85);
      g.lineWidth = 3.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, ny - 8);
      g.lineTo(x, ny + 8);
      g.stroke();
      if (lit) {
        g.strokeStyle = rgba(P.goldBright, 0.95);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, ny - 7);
        g.lineTo(x, ny + 7);
        g.stroke();
        art.glow(g, x, ny, 10, P.goldBright, 0.45);
      } else {
        g.strokeStyle = rgba(P.oakLight, 0.3);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 1.4, ny - 6);
        g.lineTo(x + 1.4, ny + 6);
        g.stroke();
      }
      g.restore();
    }
  }

  function drawTrough(g, w, h) {
    g.clearRect(0, 0, w, h);
    art.paintWood(g, w, h, 887);
    g.fillStyle = rgba(P.tar, 0.26);
    g.fillRect(0, 0, w, h);
    art.insetFace(g, 2, 2, w - 4, h - 4, { depth: 0.55, lipLight: 0.18 });
    art.chipBorder(g, 3, 3, w - 6, h - 6, { size: 7, alpha: 0.42 });
    art.wear(g, w, h, 'b10-trough', { avoid: { x: 10, y: 10, w: w - 20, h: h - 20 } });
  }

  // ---- geometry + sizing ----------------------------------------------------

  function restBox(rest) {
    const lect = lectern.getBoundingClientRect();
    const rb = rest.getBoundingClientRect();
    if (!rb.width) return null;
    return {
      x: rb.left - lect.left - 3, y: rb.top - lect.top - 3,
      w: rb.width + 6, h: rb.height + 5,
    };
  }

  function fitCanvas(cv, w, h) {
    const d = Math.max(1, Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 3));
    const pw = Math.max(1, Math.round(w * d));
    const ph = Math.max(1, Math.round(h * d));
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw;
      cv.height = ph;
    }
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    return g;
  }

  let lastRackW = 0;
  let lastRackH = 0;
  function repaintSurfaces(force) {
    const lw = lectern.clientWidth;
    const lh = lectern.clientHeight;
    if (lw > 0 && (force || lw !== lastRackW || lh !== lastRackH)) {
      drawRack(fitCanvas(rackCv, lw, lh), lw, lh);
      lastRackW = lw;
      lastRackH = lh;
    }
    const tw = trough.clientWidth;
    const th = trough.clientHeight;
    if (tw > 0) drawTrough(fitCanvas(troughCv, tw, th), tw, th);
  }

  function repaintStaves() {
    for (let i = 0; i < fragEls.length; i++) {
      const b = fragEls[i];
      const w = b.clientWidth;
      const h = b.clientHeight;
      if (w < 8 || h < 8) continue;
      const ink = b.querySelector('.ink');
      const inkW = ink ? ink.getBoundingClientRect().width : 0;
      if (Math.abs(b.__grainW - w) < 1 && b.__grainH === h) continue;
      drawStave(fitCanvas(b.__grain, w, h), w, h, i + 1, inkW);
      b.__grainW = w;
      b.__grainH = h;
    }
  }

  // ---- the showing ----------------------------------------------------------

  let showCv = null;
  let skipBtn = null;
  let showStart = 0;
  function stopShowing() {
    if (!showCv) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    showCv.remove();
    showCv = null;
    if (skipBtn) { skipBtn.remove(); skipBtn = null; }
  }

  // A carver's hand, gripping the stave's top edge: forearm, palm, a thumb
  // laid across the near face and three fingers curled over the far edge.
  function ghostHand(g, x, y, a) {
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = rgba(P.bone, 0.9);
    g.fillStyle = rgba(P.bone, 0.16);
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // forearm running back up out of frame
    g.beginPath();
    g.moveTo(x - 7, y - 8);
    g.lineTo(x - 15, y - 30);
    g.moveTo(x + 9, y - 6);
    g.lineTo(x + 2, y - 30);
    g.stroke();
    // palm
    g.beginPath();
    g.moveTo(x - 9, y - 9);
    g.quadraticCurveTo(x - 13, y + 3, x - 6, y + 10);
    g.quadraticCurveTo(x + 3, y + 15, x + 11, y + 8);
    g.quadraticCurveTo(x + 14, y - 2, x + 10, y - 10);
    g.closePath();
    g.fill();
    g.stroke();
    // three fingers curling over the far edge of the stave
    for (let i = 0; i < 3; i++) {
      const fx = x - 5 + i * 6;
      g.beginPath();
      g.moveTo(fx, y + 4);
      g.quadraticCurveTo(fx + 1.5, y + 13, fx + 5, y + 15);
      g.stroke();
    }
    // the thumb, laid across the near face
    g.beginPath();
    g.moveTo(x - 9, y - 2);
    g.quadraticCurveTo(x - 15, y + 6, x - 10, y + 13);
    g.stroke();
    g.restore();
  }

  function ghostStave(g, x, y, w, h, a, lit) {
    g.save();
    g.globalAlpha = a;
    g.fillStyle = rgba(P.bone, 0.12);
    g.strokeStyle = rgba(P.bone, 0.7);
    g.lineWidth = 1.4;
    g.beginPath();
    g.rect(x, y, w, h);
    g.fill();
    g.stroke();
    for (let i = 0; i < 6; i++) {
      const px = x + 10 + i * 8.4;
      g.fillStyle = rgba(P.bone, 0.45);
      g.fillRect(px - 1, y + h - 5, 2, 3);
    }
    if (lit) {
      for (const px of [x + w * 0.22, x + w * 0.45]) {
        g.fillStyle = rgba(P.goldBright, 0.95);
        g.beginPath();
        g.arc(px, y + 5, 3.2, 0, Math.PI * 2);
        g.fill();
        art.glow(g, px, y + 5, 12, P.goldBright, 0.7);
      }
      g.strokeStyle = rgba(BLOOD_LIT, 0.95);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + w * 0.55, y + h - 10);
      g.lineTo(x + w * 0.72, y + h - 10);
      g.stroke();
      art.glow(g, x + w * 0.63, y + h - 10, 12, BLOOD_LIT, 0.55);
      g.strokeStyle = rgba(P.goldBright, 0.85);
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(x - 26, y + h + 4);
      g.lineTo(x + w, y + h + 4);
      g.stroke();
      art.glow(g, x + w * 0.4, y + h + 4, 34, P.goldBright, 0.45);
    }
    g.restore();
  }

  function startShowing() {
    if (ctx.solved) return;
    const from = fragEls[0].getBoundingClientRect();
    const to = slotEls[0].getBoundingClientRect();
    const wb = wrap.getBoundingClientRect();
    if (!from.width || !to.width) return;
    showCv = document.createElement('canvas');
    showCv.className = 'ow10-showing';
    showCv.setAttribute('aria-hidden', 'true');
    wrap.appendChild(showCv);
    skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'ow10-skip';
    skipBtn.textContent = T('skip');
    on(skipBtn, 'click', (e) => { e.stopPropagation(); stopShowing(); });
    wrap.insertBefore(skipBtn, tell);
    ctx.note(T('demoSay'));

    const W = wb.width;
    const H = wb.height;
    const sw = Math.min(from.width, to.width) * 0.86;
    const sh = Math.min(44, from.height);
    const ax = from.left - wb.left + 6;
    const ay = from.top - wb.top + 3;
    const bx = to.left - wb.left + 4;
    const by = to.top - wb.top + 3;

    const paint = (t) => {
      const g = fitCanvas(showCv, W, H);
      g.clearRect(0, 0, W, H);
      const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);
      let u = 0;
      let lit = false;
      let alpha = 1;
      if (t < 0.12) { u = 0; alpha = t / 0.12; }
      else if (t < 0.2) u = 0;
      else if (t < 0.62) u = ease((t - 0.2) / 0.42);
      else { u = 1; lit = t > 0.66; }
      if (t > 0.9) alpha = Math.max(0, (1 - t) / 0.1);
      const x = ax + (bx - ax) * u;
      const y = ay + (by - ay) * u - Math.sin(u * Math.PI) * 26;
      ghostStave(g, x, y, sw, sh, alpha * 0.95, lit);
      ghostHand(g, x + sw * 0.5, y - 12, alpha * 0.9);
    };

    if (calm) {
      paint(0.78);   // the static variant: set down, with the lights answering
      later(stopShowing, 3000);
      return;
    }
    showStart = 0;
    const step = (now) => {
      if (!showCv) return;
      if (!showStart) showStart = now;
      const t = Math.min(1, (now - showStart) / 3000);
      paint(t);
      if (t >= 1) { stopShowing(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---- state ----------------------------------------------------------------

  function lift(i) {
    const at = slotOf[i];
    if (at < 0) return;
    slotOf[i] = -1;
    held = null;
    audio.ui('slide');
    ctx.note(T('lifted', { text: instance.fragments[i].text }));
    refresh();
  }

  function place(slot) {
    stopShowing();
    if (held === null) {
      const sitting = slotOf.findIndex((s) => s === slot);
      if (sitting >= 0) lift(sitting);
      return;
    }
    const evicted = slotOf.findIndex((s) => s === slot);
    if (evicted >= 0) slotOf[evicted] = -1;
    slotOf[held] = slot;
    const line = Math.floor(slot / 2) + 1;
    ctx.note(T('set', {
      text: instance.fragments[held].text,
      half: T(slot % 2 ? 'halfEven' : 'halfOdd'),
      n: line,
      stave: instance.staves[line - 1],
    }));
    held = null;
    audio.ui('knock');
    refresh();
  }

  function currentLines() {
    const lines = [];
    for (let line = 0; line < LINES; line++) {
      const a = slotOf.findIndex((s) => s === line * 2);
      const b = slotOf.findIndex((s) => s === line * 2 + 1);
      lines.push([a, b]);
    }
    return lines;
  }

  function refresh() {
    fragEls.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(held === i));
      const target = slotOf[i] === -1 ? tray : slotEls[slotOf[i]];
      if (b.parentElement !== target) target.appendChild(b);
    });

    let standing = 0;
    const lines = currentLines();
    lines.forEach((pair, line) => {
      const st = instance.staves[line];
      const ok = pair[0] >= 0 && pair[1] >= 0
        && longLineOk(instance.fragments[pair[0]], instance.fragments[pair[1]], st);
      if (ok) standing++;
      for (const half of [0, 1]) {
        const idx = pair[half];
        const slot = slotEls[line * 2 + half];
        slot.classList.toggle('armed', held !== null && idx < 0);
        slot.setAttribute('aria-label', T('restAria', {
          n: line + 1, stave: st, half: T(half ? 'halfEven' : 'halfOdd'),
        }) + (idx >= 0 ? `: “${instance.fragments[idx].text}”` : `: ${T('restEmpty')}`));
        if (idx < 0) continue;
        const f = instance.fragments[idx];
        fragEls[idx].classList.toggle('lit-allit', allitBinds(f, half, st));
        fragEls[idx].classList.toggle('lit-hend', hendBinds(f, half));
      }
    });
    for (let i = 0; i < N; i++) {
      if (slotOf[i] >= 0) continue;
      fragEls[i].classList.remove('lit-allit', 'lit-hend');
    }
    for (let line = 0; line < LINES; line++) {
      const pair = lines[line];
      const ok = pair[0] >= 0 && pair[1] >= 0
        && longLineOk(instance.fragments[pair[0]], instance.fragments[pair[1]], instance.staves[line]);
      const s = stampCvs[line];
      if (s.lit !== ok) {
        s.lit = ok;
        drawStamp(fitCanvas(s.canvas, 40, 46), 40, 46, s.rune, s.letter, ok);
      }
    }

    const full = lines.every((p) => p[0] >= 0 && p[1] >= 0);
    tally.textContent = standing === LINES ? T('tallyDone') : T('tally', { n: standing });
    send.disabled = !full;

    repaintStaves();
    repaintSurfaces(false);
    const lw = lectern.clientWidth;
    const lh = lectern.clientHeight;
    if (lw > 0) drawLights(fitCanvas(lightsCv, lw, lh), lw, lh);
    const dw = desk.clientWidth;
    const dh = desk.clientHeight;
    if (dw > 0) drawDesk(fitCanvas(deskCv, dw, dh), dw, dh, standing);
  }

  on(send, 'click', () => {
    stopShowing();
    const lines = currentLines();
    if (lines.some((p) => p[0] < 0 || p[1] < 0)) return;
    ctx.note(`${T('spoken')}\n${lines.map((p) => `${instance.fragments[p[0]].text}, ${instance.fragments[p[1]].text};`).join('\n')}`);
    const res = ctx.submit({ lines }) || {};
    if (!res.ok) {
      tell.textContent = res.near || T('failed');
      if (tell.scrollIntoView) tell.scrollIntoView({ block: 'nearest' });
    }
  });

  root.appendChild(wrap);

  // two-column trough once the board is wide enough to hold a full half-line twice
  const gauge = () => {
    wrap.classList.toggle('wide', wrap.clientWidth >= 560);
  };
  gauge();

  ctx.note(T('openLaw'));
  ctx.note(T('openStamps', { staves: instance.staves.join(' · ') }));
  instance.fragments.forEach((f, i) => ctx.note(T('openFrag', { n: i + 1, text: f.text, count: f.syllables.length })));

  if (ctx.solved) {
    solve(instance).lines.forEach((pair, line) => {
      slotOf[pair[0]] = line * 2;
      slotOf[pair[1]] = line * 2 + 1;
    });
    send.disabled = true;
  }

  refresh();
  repaintSurfaces(true);
  refresh();

  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      gauge();
      repaintStaves();
      repaintSurfaces(true);
      const lw = lectern.clientWidth;
      const lh = lectern.clientHeight;
      if (lw > 0) drawLights(fitCanvas(lightsCv, lw, lh), lw, lh);
    });
    ro.observe(wrap);
    observers.push(ro);
  }

  if (!ctx.solved) later(startShowing, 260);

  return {
    unmount() {
      unbind();
      stopShowing();
      for (const h of timers) clearTimeout(h);
      for (const o of observers) o.disconnect();
      if (raf) cancelAnimationFrame(raf);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields below; the carved verse itself never translates — it is the
// artifact's own tongue. Every instruction and gloss does.
const I18N = {
  es: {
    title: 'Los Versos de Dróttkvætt',
    epigraph: 'El metro de corte guarda tres cerrojos:\ncuenta, asta y rima.\nPosa cada palabra hasta que aguanten las tres luces.',
    hints: [
      'Ordénalas antes de emparejarlas: la mitad riman solo por la coda, la otra mitad por vocal y coda. Solo una clase puede abrir un verso.',
      'El asta rectora es el PRIMER acento de la segunda media línea — no su primera palabra. Una sílaba átona puede ir delante.',
      'Lee los apoyos de cada media línea de apertura contra las astas estampadas en la falleba. Ese sello fija qué verso va primero.',
    ],
    nearMap: {
      '1 of the four long lines stand. The rest break metre.': 'Se sostiene 1 de los cuatro versos. Los demás rompen el metro.',
      '2 of the four long lines stand. The rest break metre.': 'Se sostienen 2 de los cuatro versos. Los demás rompen el metro.',
      '3 of the four long lines stand. The rest break metre.': 'Se sostienen 3 de los cuatro versos. El otro rompe el metro.',
      '0 of the four long lines stand. The rest break metre.': 'No se sostiene ninguno de los cuatro versos. Todos rompen el metro.',
    },
    board: {
      troughHead: 'Astas sueltas — seis sílabas talladas en cada una',
      tally: '{n} de 4 versos ligan',
      tallyDone: 'Los 4 versos ligan. Di el verso.',
      submit: 'Decir el verso',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: un asta suelta va a un descanso, y las luces del metro responden.',
      keyHelp: 'Toca un asta para alzarla, luego toca un descanso para posarla. Toca un asta posada para recogerla. Con el teclado: tabulador hasta un asta, espacio para alzarla, tabulador hasta un descanso, espacio para posarla.',
      restAria: 'Descanso {n}, asta {stave}: media línea {half}',
      halfOdd: 'de apertura',
      halfEven: 'de respuesta',
      restEmpty: 'vacío',
      fragAria: '“{text}”, seis sílabas, {rhyme}',
      rhymeSkot: 'rima solo por su coda',
      rhymeAdal: 'rima por vocal y coda',
      lifted: 'Recogida “{text}” de vuelta a las astas sueltas.',
      set: '“{text}” queda como media línea {half} del descanso {n} (asta {stave}).',
      spoken: 'Verso dicho:',
      failed: 'El verso no se sostiene.',
      openLaw: 'Metro de corte: seis sílabas por media línea; dos apoyos aliteran en la media de apertura y el primer acento de la de respuesta se les une; la de apertura rima solo por la coda, la de respuesta por vocal y coda.',
      openStamps: 'Astas estampadas en la falleba, en orden: {staves}.',
      openFrag: 'Media línea {n}: “{text}” ({count} sílabas).',
    },
  },
  ca: {
    title: 'Els Versos de Dróttkvætt',
    epigraph: 'El metre de cort guarda tres forrellats:\ncompte, asta i rima.\nPosa cada mot fins que els tres llums aguantin.',
    hints: [
      'Classifica-les abans d’aparellar-les: la meitat rimen només per la coda, l’altra meitat per vocal i coda. Només una classe pot obrir un vers.',
      'L’asta rectora és el PRIMER accent de la segona mitja línia — no la seva primera paraula. Una síl·laba àtona pot anar-hi davant.',
      'Llegeix els suports de cada mitja línia d’obertura contra les astes estampades al forrellat. Aquell segell fixa quin vers va primer.',
    ],
    nearMap: {
      '1 of the four long lines stand. The rest break metre.': 'S’aguanta 1 dels quatre versos. La resta trenquen el metre.',
      '2 of the four long lines stand. The rest break metre.': 'S’aguanten 2 dels quatre versos. La resta trenquen el metre.',
      '3 of the four long lines stand. The rest break metre.': 'S’aguanten 3 dels quatre versos. L’altre trenca el metre.',
      '0 of the four long lines stand. The rest break metre.': 'No s’aguanta cap dels quatre versos. Tots trenquen el metre.',
    },
    board: {
      troughHead: 'Astes soltes — sis síl·labes tallades a cadascuna',
      tally: '{n} de 4 versos lliguen',
      tallyDone: 'Els 4 versos lliguen. Digues el vers.',
      submit: 'Dir el vers',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: una asta solta va a un descans, i les llums del metre responen.',
      keyHelp: 'Toca una asta per alçar-la, després toca un descans per posar-la. Toca una asta posada per recollir-la. Amb el teclat: tabulador fins a una asta, espai per alçar-la, tabulador fins a un descans, espai per posar-la.',
      restAria: 'Descans {n}, asta {stave}: mitja línia {half}',
      halfOdd: 'd’obertura',
      halfEven: 'de resposta',
      restEmpty: 'buit',
      fragAria: '“{text}”, sis síl·labes, {rhyme}',
      rhymeSkot: 'rima només per la seva coda',
      rhymeAdal: 'rima per vocal i coda',
      lifted: 'Recollida “{text}” de tornada a les astes soltes.',
      set: '“{text}” queda com a mitja línia {half} del descans {n} (asta {stave}).',
      spoken: 'Vers dit:',
      failed: 'El vers no s’aguanta.',
      openLaw: 'Metre de cort: sis síl·labes per mitja línia; dos suports aliteren a la mitja d’obertura i el primer accent de la de resposta s’hi uneix; la d’obertura rima només per la coda, la de resposta per vocal i coda.',
      openStamps: 'Astes estampades al forrellat, en ordre: {staves}.',
      openFrag: 'Mitja línia {n}: “{text}” ({count} síl·labes).',
    },
  },
};

export default {
  id: ID,
  ordinal: 10,
  tier: 3,
  title: 'The Dróttkvætt Lines',
  epigraph: 'Court-metre is a lock of three wards:\ncount, stave and rime.\nSet each word till all three lights hold.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS[ID] }),

  difficulty: { searchSpace: 40320, minSteps: 25, estMinutes: 16 },

  hints: [
    'Sort the eight before you pair them: half of these rhyme on the coda alone, half on vowel and coda both. Only one kind may open a long line.',
    'The chief stave is the FIRST stress of the second half-line — not its first word. An unstressed word may stand in front of it.',
    'Read the props of each opening half-line against the staves stamped on the hasp. That stamp fixes which long line comes first.',
  ],

  i18n: I18N,

  mount,
};
