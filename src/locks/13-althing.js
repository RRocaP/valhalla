// 13 — THE ALTHING VERDICT (tier 4)
//
// Nine speakers stand at the law-rock. One of them broke the peace. Every
// speaker is either a truth-teller — whose every statement is true — or a liar,
// whose every statement is false. Brand all nine, and name the peace-breaker.
//
// GRAMMAR (docs/LOCKS.md §13; the whole vocabulary, nothing else is uttered):
//   true(x)        "X speaks true."               -> x is a truth-teller
//   false(x)       "X speaks false."              -> x is a liar
//   xor(x,y)       "Either X lies or Y lies —     -> exactly one of them lies
//                   not both."
//   imp(x,y)       "If X speaks true, then Y      -> X lies OR Y lies
//                   lies."
//   among(S,±)     "The peace-breaker is (not)    -> culprit in / not in S
//                   among {…}."
//   notme          "I am not the peace-breaker."  -> culprit is not the speaker
// No statement refers to its own speaker except `notme`, and no binary
// statement names the same man twice.
//
// LAW: statement value === (speaker is a truth-teller). A liar cannot utter a
// true sentence, even by accident.
//
// UNIQUENESS: makePuzzle sweeps all 2^9 liar-sets against all 9 candidate
// culprits — the 4,608 hypotheses of docs/LOCKS.md §13 — and requires exactly
// one consistent (liar-set, culprit). Because the hypothesis is unique, verify
// checks consistency rather than storing the verdict in the instance.
//
// Difficulty accounting (docs/CONTRACT.md §4): 12–18 statements read (each one
// tapped to light the men it names) + 9 brandings + naming the peace-breaker +
// sealing, plus at least one re-branding pass when the first assumption fails
// = 30.
//
// PURE HALF: no DOM, no Date, no Math.random, no module-level mutable state.

import { SHARDS } from '../kernel/shards.js';
import { rng } from '../kernel/rng.js';

const SPEAKERS = [
  'Ketil', 'Hjalti', 'Ulfar', 'Steinar', 'Ragnvald', 'Eyvind', 'Thorfast',
  'Bjolan', 'Nokkvi', 'Dagfinn', 'Gunnstein', 'Ljot', 'Vigdis', 'Arnfast',
];
const N = 9;

function evaluate(st, liars, culprit) {
  switch (st.kind) {
    case 'true': return !liars[st.x];
    case 'false': return !!liars[st.x];
    case 'xor': return !!liars[st.x] !== !!liars[st.y];
    case 'imp': return !!liars[st.x] || !!liars[st.y];
    case 'among': return st.polarity ? st.set.includes(culprit) : !st.set.includes(culprit);
    case 'notme': return culprit !== st.speaker;
    default: return false;
  }
}

function consistent(statements, liars, culprit) {
  for (const st of statements) {
    if (evaluate(st, liars, culprit) !== !liars[st.speaker]) return false;
  }
  return true;
}

function contradictions(statements, liars, culprit) {
  let n = 0;
  for (const st of statements) if (evaluate(st, liars, culprit) !== !liars[st.speaker]) n++;
  return n;
}

// All 2^9 x 9 hypotheses. Small enough to sweep whole, every time.
function sweepRock(statements) {
  const found = [];
  const liars = new Array(N).fill(false);
  for (let bits = 0; bits < (1 << N); bits++) {
    for (let i = 0; i < N; i++) liars[i] = (bits & (1 << i)) !== 0;
    for (let culprit = 0; culprit < N; culprit++) {
      if (consistent(statements, liars, culprit)) found.push({ liars: liars.slice(), culprit });
    }
    if (found.length > 4) return found; // more than enough to reject this draw
  }
  return found;
}

function nameList(names, set) {
  const chosen = set.map((i) => names[i]);
  if (chosen.length === 1) return chosen[0];
  return `${chosen.slice(0, -1).join(', ')} and ${chosen[chosen.length - 1]}`;
}

function textFor(st, names) {
  switch (st.kind) {
    case 'true': return `${names[st.x]} speaks true.`;
    case 'false': return `${names[st.x]} speaks false.`;
    case 'xor': return `Either ${names[st.x]} lies or ${names[st.y]} lies — not both.`;
    case 'imp': return `If ${names[st.x]} speaks true, then ${names[st.y]} lies.`;
    case 'among': return st.polarity
      ? `The peace-breaker is among ${nameList(names, st.set)}.`
      : `The peace-breaker is not among ${nameList(names, st.set)}.`;
    default: return 'I am not the peace-breaker.';
  }
}

// A statement by `speaker` whose truth value is forced to `want`.
function makeStatement(r, speaker, liars, culprit, want, allowCulpritKinds) {
  const pool = allowCulpritKinds ? ['among', 'among', 'notme', 'true', 'false', 'xor', 'imp']
    : ['true', 'false', 'xor', 'imp', 'xor', 'imp'];
  for (let tries = 0; tries < 40; tries++) {
    const kind = r.pick(pool);
    let st = null;
    if (kind === 'notme') {
      st = { speaker, kind };
    } else if (kind === 'among') {
      const size = r.range(2, 4);
      const bag = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, size).sort((a, b) => a - b);
      st = { speaker, kind, set: bag, polarity: r.chance(0.5) };
    } else {
      const x = r.int(N);
      if (x === speaker) continue;
      if (kind === 'true' || kind === 'false') st = { speaker, kind, x };
      else {
        let y = r.int(N);
        if (y === x || y === speaker) continue;
        st = { speaker, kind, x, y };
      }
    }
    if (evaluate(st, liars, culprit) === want) return st;
  }
  return null;
}

function buildRock(r, liars, culprit) {
  const statements = [];
  let culpritKinds = 0;
  for (let speaker = 0; speaker < N; speaker++) {
    const count = r.chance(0.55) ? 2 : 1;
    for (let k = 0; k < count; k++) {
      // Keep at least a third of the rock talking about the peace-breaker,
      // or the culprit can never be pinned down.
      const allowCulprit = culpritKinds < 5 && (k === 0 ? r.chance(0.45) : r.chance(0.3));
      const st = makeStatement(r, speaker, liars, culprit, !liars[speaker], allowCulprit);
      if (!st) return null;
      if (st.kind === 'among' || st.kind === 'notme') culpritKinds++;
      statements.push(st);
    }
  }
  return culpritKinds >= 3 ? statements : null;
}

// ============================================================== THE VIEW HALF
// Nothing below is reachable from makePuzzle/solve/verify. The board never
// consults the solution: every light it shows is derived from the brands the
// player has laid, which is what keeps the implication web honest.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  plate: 'Brand every speaker true or false so all their words hold together — then collar the peace-breaker.',
  tally: '{n} of 9 stones stand consistent',
  tallyAll: 'All nine stones stand consistent. Give the verdict.',
  brandNone: 'unbranded',
  brandTrue: 'speaks true',
  brandLies: 'lies',
  ariaNone: '{name} is unbranded.',
  ariaTrue: '{name} is branded true.',
  ariaLies: '{name} is branded a liar.',
  ariaWaits: ' His words wait on other brands.',
  ariaStands: ' His words hold.',
  ariaBreaks: ' His words break at the rock.',
  ariaBurn: ' Burn the brand.',
  accuse: 'the collar',
  ariaAccuse: 'Name {name} the peace-breaker.',
  clear: 'Cool every iron',
  verdict: 'Give the verdict',
  skip: 'Skip the showing',
  demoSay: 'Watch once: the iron burns a stone. Burn it again and the mark turns to tar.',
  sayTrue: '{name} is seared true.',
  sayLies: '{name} is seared a liar.',
  sayOff: 'The brand is struck off {name}.',
  sayReach: 'That mark settles {n} more words at the rock.',
  sayReachOne: 'That mark settles one more word at the rock.',
  sayAccuse: 'The iron collar hangs on {name}.',
  sayWithdraw: 'The collar is lifted off.',
  sayClear: 'Every iron is cooled; the rock stands unjudged.',
  sayOpen: 'Nine stones at the law-rock: {names}. {n} statements are carved on them.',
  solvedLine: 'The verdict stands.',
  deny: 'The rock will not have that verdict.',
  sceneAria: 'The assembly ground: nine standing stones in a shallow arc behind the law-rock. {states}',
  stateNone: '{name} unbranded',
  stateTrue: '{name} seared true',
  stateLies: '{name} seared a liar',
  stateCollar: ' The iron collar hangs on {name}.',
  stateNoCollar: ' No collar hangs yet.',
  // the carved words themselves. English is the instance's own `text`; other
  // tongues are recomposed in the view from the statement's structured fields,
  // so the pure half stays untouched.
  stTrue: '{x} speaks true.',
  stFalse: '{x} speaks false.',
  stXor: 'Either {x} lies or {y} lies — not both.',
  stImp: 'If {x} speaks true, then {y} lies.',
  stAmongIn: 'The peace-breaker is among {set}.',
  stAmongOut: 'The peace-breaker is not among {set}.',
  stNotMe: 'I am not the peace-breaker.',
  listAnd: 'and',
};

// ---- view-side colour maths (the frozen art API exports tokens, not mixing)
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa, sb) => Math.round(sa + (sb - sa) * t);
  const r = ch(pa >> 16, pb >> 16);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}
function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---- the implication web ---------------------------------------------------
// A statement is SETTLED when the brands laid so far (plus a hung collar, for
// the two culprit kinds) already fix its truth value. Settled words have said
// everything they can say; the board greys them so the player can see the reach
// of each brand one step at a time. This decides nothing for the player — it
// only reports what the player's own marks have already forced.
function isSettled(st, branded, liars, culprit) {
  switch (st.kind) {
    case 'true':
    case 'false': return !!branded[st.x];
    case 'xor': return !!branded[st.x] && !!branded[st.y];
    // liars[x] || liars[y]: one branded liar settles it true on its own
    case 'imp': return (!!branded[st.x] && !!liars[st.x]) || (!!branded[st.y] && !!liars[st.y])
      || (!!branded[st.x] && !!branded[st.y]);
    case 'among':
    case 'notme': return culprit >= 0;
    default: return false;
  }
}

// live -> still has reach; held -> settled and standing; broken -> settled and
// contradicting the brand its own speaker wears.
function statementState(st, branded, liars, culprit) {
  if (!isSettled(st, branded, liars, culprit)) return 'live';
  if (!branded[st.speaker]) return 'held';
  return evaluate(st, liars, culprit) === !liars[st.speaker] ? 'held' : 'broken';
}

// ---- stone ------------------------------------------------------------------
// One material recipe for every stone on this board (docs/QUALITY.md texture
// law: base grain -> weathering/lichen -> chip history, three layers minimum).
function stoneTones(p) {
  return {
    deep: mixHex(p.bone, p.tar, 0.9),
    base: mixHex(p.bone, p.tar, 0.84),
    lit: mixHex(p.bone, p.tar, 0.66),
    arris: mixHex(p.oakLight, p.goldBright, 0.35),
    lichen: mixHex(p.pineLight, p.bone, 0.42),
    moss: mixHex(p.pine, p.boneDim, 0.3),
  };
}

/**
 * Grain, weathering, lichen and chip history inside whatever path the caller
 * has already clipped to. `w`/`h` bound the face; `seed` keeps it deterministic.
 */
function stoneSkin(c, p, x, y, w, h, seed, opts = {}) {
  const S = stoneTones(p);
  const r = rng(`althing-stone:${seed}`);
  const face = c.createLinearGradient(x, y, x + w * 0.55, y + h);
  face.addColorStop(0, S.lit);
  face.addColorStop(0.42, S.base);
  face.addColorStop(1, S.deep);
  c.fillStyle = face;
  c.fillRect(x, y, w, h);

  // bedding planes — the rock was split along these. Few, faint and tilted:
  // five parallel dark/light pairs corrugated the stone like card.
  const beds = opts.beds ?? 3;
  c.lineWidth = Math.max(0.8, h * 0.008);
  for (let i = 0; i < beds; i++) {
    const gy = y + h * (0.16 + r() * 0.72);
    const tilt = (r() - 0.5) * h * 0.06;
    c.strokeStyle = alpha(p.tar, 0.07 + r() * 0.06);
    c.beginPath();
    c.moveTo(x, gy);
    c.quadraticCurveTo(x + w * 0.5, gy + tilt * 0.6, x + w, gy + tilt);
    c.stroke();
  }

  // mineral speckle
  const grains = Math.max(24, Math.round(w * h / 240));
  for (let i = 0; i < grains; i++) {
    const gx = x + r() * w;
    const gy = y + r() * h;
    const s = 0.5 + r() * 1.1;
    c.fillStyle = r.chance(0.55) ? alpha(p.tar, 0.14 + r() * 0.12) : alpha(p.bone, 0.06 + r() * 0.07);
    c.fillRect(gx, gy, s, s);
  }

  // weather runoff — rain has run off the top for three hundred winters
  for (let i = 0; i < 3; i++) {
    const rx = x + w * (0.12 + r() * 0.76);
    const rw = w * (0.05 + r() * 0.09);
    const g = c.createLinearGradient(0, y, 0, y + h * (0.5 + r() * 0.5));
    g.addColorStop(0, alpha(p.tar, 0.2));
    g.addColorStop(1, alpha(p.tar, 0));
    c.fillStyle = g;
    c.fillRect(rx, y, rw, h);
  }

  // lichen — clustered low and on the weather side
  const patches = opts.lichen ?? 6;
  for (let i = 0; i < patches; i++) {
    const lx = x + w * (0.06 + r() * 0.88);
    const ly = y + h * (0.34 + r() * 0.62);
    const lr = Math.max(2.2, Math.min(w, h) * (0.035 + r() * 0.06));
    c.fillStyle = alpha(r.chance(0.5) ? S.lichen : S.moss, 0.1 + r() * 0.11);
    c.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = lr * (0.62 + r() * 0.6);
      const px = lx + Math.cos(a) * rr;
      const py = ly + Math.sin(a) * rr * 0.72;
      if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  // chip history: struck flakes, each a dark socket under a lit arris. Kept
  // small — at card scale a big flake reads as a pasted triangle, not stone.
  const chips = opts.chips ?? 5;
  for (let i = 0; i < chips; i++) {
    const cx0 = x + w * (0.04 + r() * 0.92);
    const cy0 = y + h * (0.06 + r() * 0.88);
    const cs = Math.max(2, Math.min(w, h) * (0.022 + r() * 0.032));
    const a0 = r() * Math.PI * 2;
    const pt = (k) => [cx0 + Math.cos(a0 + k) * cs * (0.7 + r() * 0.5), cy0 + Math.sin(a0 + k) * cs * (0.7 + r() * 0.5)];
    const q = [pt(0), pt(2.1), pt(4.2)];
    c.fillStyle = alpha(p.tar, 0.22);
    c.beginPath();
    c.moveTo(q[0][0], q[0][1]);
    c.lineTo(q[1][0], q[1][1]);
    c.lineTo(q[2][0], q[2][1]);
    c.closePath();
    c.fill();
    c.strokeStyle = alpha(S.arris, 0.26);
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(q[1][0], q[1][1]);
    c.lineTo(q[2][0], q[2][1]);
    c.stroke();
  }

  // form: one hearth key from the upper left, so the face is a solid, not a
  // flat swatch — lit weather side, core shade, and a reflected kick at the
  // shade edge. This is the layer that made the stones stop reading as card.
  if (opts.form !== false) {
    // a raised stone is a PRISM, not a cylinder: a lit weather facet, a hard
    // arris, then a facet in shade. The smooth wash alone read as cut card.
    const form = c.createLinearGradient(x, y, x + w, y);
    form.addColorStop(0, alpha(p.bone, 0.18));
    form.addColorStop(0.36, alpha(p.bone, 0.05));
    form.addColorStop(0.48, alpha(p.tar, 0.16));
    form.addColorStop(0.78, alpha(p.tar, 0.46));
    form.addColorStop(0.95, alpha(p.tar, 0.56));
    form.addColorStop(1, alpha(S.lit, 0.1));
    c.fillStyle = form;
    c.fillRect(x, y, w, h);
    const foot = c.createLinearGradient(0, y + h * 0.62, 0, y + h);
    foot.addColorStop(0, alpha(p.tar, 0));
    foot.addColorStop(1, alpha(p.tar, 0.42));
    c.fillStyle = foot;
    c.fillRect(x, y + h * 0.62, w, h * 0.38);
  }
}

/**
 * A fire-mark burned into stone. `kind` 'true' is a gold sear — the iron went
 * in hot and the rock still holds the heat; 'lie' is a tar sear, cold char
 * that swallows the light. Both carry a burned rune so the two never rely on
 * colour alone.
 */
function sear(c, art, p, x, y, r, kind) {
  c.save();
  // scorch halo: the rock around the iron took the heat too
  const scorch = c.createRadialGradient(x, y, r * 0.4, x, y, r * 1.85);
  scorch.addColorStop(0, alpha(p.tar, kind === 'lie' ? 0.55 : 0.4));
  scorch.addColorStop(1, alpha(p.tar, 0));
  c.fillStyle = scorch;
  c.beginPath();
  c.arc(x, y, r * 1.85, 0, Math.PI * 2);
  c.fill();

  if (kind === 'true') {
    art.glow(c, x, y, r * 2.1, p.goldBright, 0.5);
    const hot = c.createRadialGradient(x - r * 0.22, y - r * 0.26, r * 0.1, x, y, r);
    hot.addColorStop(0, alpha(p.goldBright, 0.92));
    hot.addColorStop(0.55, alpha(p.gold, 0.72));
    hot.addColorStop(1, alpha(mixHex(p.ember, p.tar, 0.55), 0.66));
    c.fillStyle = hot;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = alpha(p.goldBright, 0.85);
    c.lineWidth = Math.max(1, r * 0.11);
    c.stroke();
    art.drawRune(c, 'ᛏ', x - r * 0.52, y - r * 0.6, r * 1.2, {
      color: alpha(p.bone, 0.95), weight: Math.max(1.4, r * 0.2),
    });
  } else {
    const char = c.createRadialGradient(x - r * 0.2, y - r * 0.24, r * 0.1, x, y, r);
    char.addColorStop(0, alpha(mixHex(p.tar, p.boneDim, 0.16), 0.95));
    char.addColorStop(1, alpha(p.tar, 0.97));
    c.fillStyle = char;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    // a cold rim: burnt-out iron leaves a grey lip, never a glow
    c.strokeStyle = alpha(mixHex(p.fjordLight, p.bone, 0.3), 0.4);
    c.lineWidth = Math.max(1, r * 0.09);
    c.stroke();
    art.drawRune(c, 'ᚦ', x - r * 0.5, y - r * 0.6, r * 1.2, {
      color: alpha(mixHex(p.boneDim, p.tar, 0.06), 0.82), weight: Math.max(1.4, r * 0.2),
    });
  }
  c.restore();
}

// Cold forged iron: grey steel with only a breath of fjord in it. Blue iron
// reads as a web chip; this reads as metal in hearth light.
const IRON = (p) => ({
  cold: mixHex(mixHex(p.bone, p.tar, 0.7), p.fjord, 0.2),
  lit: mixHex(mixHex(p.bone, p.tar, 0.24), p.fjordLight, 0.14),
});

/** The iron collar: forged, hammer-faceted, hung round one stone's neck. */
function ironCollar(c, p, cx, cy, w, h) {
  const { cold, lit } = IRON(p);
  c.save();
  c.lineCap = 'round';
  // the band, seen slightly from above: an ellipse with weight below
  const band = Math.max(3, h * 0.34);
  c.strokeStyle = alpha(p.tar, 0.55);
  c.lineWidth = band * 1.5;
  c.beginPath();
  c.ellipse(cx, cy + band * 0.28, w / 2, h / 2, 0, 0, Math.PI * 2);
  c.stroke();
  const iron = c.createLinearGradient(cx - w / 2, cy - h, cx + w / 2, cy + h);
  iron.addColorStop(0, lit);
  iron.addColorStop(0.35, cold);
  iron.addColorStop(1, mixHex(p.tar, p.fjord, 0.4));
  c.strokeStyle = iron;
  c.lineWidth = band;
  c.beginPath();
  c.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  c.stroke();
  // hammer facets along the top of the band
  c.strokeStyle = alpha(lit, 0.5);
  c.lineWidth = Math.max(0.8, band * 0.16);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    const px = cx + Math.cos(a) * (w / 2);
    const py = cy + Math.sin(a) * (h / 2);
    c.beginPath();
    c.moveTo(px - band * 0.22, py - band * 0.18);
    c.lineTo(px + band * 0.22, py + band * 0.1);
    c.stroke();
  }
  // rivet boss and the hanging link
  c.fillStyle = alpha(lit, 0.85);
  c.beginPath();
  c.arc(cx, cy + h / 2, band * 0.42, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = alpha(cold, 0.95);
  c.lineWidth = Math.max(1.2, band * 0.34);
  c.beginPath();
  c.arc(cx, cy + h / 2 + band * 1.15, band * 0.72, Math.PI * 0.1, Math.PI * 0.9);
  c.stroke();
  c.restore();
}

/**
 * The words as the player reads them. English is the instance's own frozen
 * `text`; other tongues are recomposed here from the statement's structured
 * fields, so localizing the rock never reaches into the pure half.
 */
function statementText(st, names, T, lang) {
  if (lang === 'en') return st.text;
  const list = (set) => {
    const chosen = set.map((i) => names[i]);
    if (chosen.length === 1) return chosen[0];
    return `${chosen.slice(0, -1).join(', ')} ${T('listAnd')} ${chosen[chosen.length - 1]}`;
  };
  switch (st.kind) {
    case 'true': return T('stTrue', { x: names[st.x] });
    case 'false': return T('stFalse', { x: names[st.x] });
    case 'xor': return T('stXor', { x: names[st.x], y: names[st.y] });
    case 'imp': return T('stImp', { x: names[st.x], y: names[st.y] });
    case 'among': return T(st.polarity ? 'stAmongIn' : 'stAmongOut', { set: list(st.set) });
    default: return T('stNotMe');
  }
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields below; `nearMap` keys are the canonical English near-lines
// returned by verify().
const I18N = {
  es: {
    title: 'El Veredicto del Althing',
    epigraph: 'Ante la roca de la ley un hombre es su palabra. Quiebra la paz, y contigo se quiebra cada palabra que tienes.',
    hints: [
      'Aquí un hombre es de una pieza. Si una palabra suya es falsa, todas sus palabras lo son.',
      'Empieza donde un hombre habla de otro hombre y no del quebrantador de la paz: esas palabras atan las marcas de dos en dos, y probarlas no cuesta nada.',
      'Fijadas las marcas, el quebrantador de la paz se sigue sin discusión: quien dice verdad lo acota, y quien miente lo acota igual de fuerte, por lo contrario de lo que dice.',
    ],
    nearMap: {
      'One voice at the rock cannot stand under that verdict.': 'Una voz en la roca no se sostiene bajo ese veredicto.',
      'Several voices at the rock cannot stand under that verdict.': 'Varias voces en la roca no se sostienen bajo ese veredicto.',
      'The whole rock roars against that verdict.': 'La roca entera ruge contra ese veredicto.',
    },
    board: {
      plate: 'Marca a hierro a cada hombre como verdadero o falso hasta que todas sus palabras se sostengan — y luego pon el collar al quebrantador de la paz.',
      tally: '{n} de 9 piedras se sostienen sin contradecirse',
      tallyAll: 'Las nueve piedras se sostienen sin contradecirse. Dicta el veredicto.',
      brandNone: 'sin marca',
      brandTrue: 'dice verdad',
      brandLies: 'miente',
      ariaNone: '{name} está sin marca.',
      ariaTrue: '{name} está marcado como verdadero.',
      ariaLies: '{name} está marcado como mentiroso.',
      ariaWaits: ' Sus palabras esperan a otras marcas.',
      ariaStands: ' Sus palabras se sostienen.',
      ariaBreaks: ' Sus palabras se quiebran ante la roca.',
      ariaBurn: ' Quema la marca.',
      accuse: 'el collar',
      ariaAccuse: 'Señala a {name} como quebrantador de la paz.',
      clear: 'Enfriar todos los hierros',
      verdict: 'Dictar el veredicto',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: el hierro quema una piedra. Quémala otra vez y la marca se vuelve alquitrán.',
      sayTrue: '{name} queda marcado verdadero.',
      sayLies: '{name} queda marcado mentiroso.',
      sayOff: 'Se borra la marca de {name}.',
      sayReach: 'Esa marca zanja {n} palabras más en la roca.',
      sayReachOne: 'Esa marca zanja una palabra más en la roca.',
      sayAccuse: 'El collar de hierro cuelga de {name}.',
      sayWithdraw: 'Se retira el collar.',
      sayClear: 'Todos los hierros se enfrían; la roca queda sin juicio.',
      sayOpen: 'Nueve piedras ante la roca de la ley: {names}. Llevan {n} declaraciones talladas.',
      solvedLine: 'El veredicto se sostiene.',
      deny: 'La roca no admite ese veredicto.',
      sceneAria: 'El campo de la asamblea: nueve piedras alzadas en arco abierto tras la roca de la ley. {states}',
      stateNone: '{name} sin marca',
      stateTrue: '{name} marcado verdadero',
      stateLies: '{name} marcado mentiroso',
      stateCollar: ' El collar de hierro cuelga de {name}.',
      stateNoCollar: ' Aún no cuelga ningún collar.',
      stTrue: '{x} dice verdad.',
      stFalse: '{x} dice falsedad.',
      stXor: 'O miente {x} o miente {y} — no los dos.',
      stImp: 'Si {x} dice verdad, entonces {y} miente.',
      stAmongIn: 'El quebrantador de la paz está entre {set}.',
      stAmongOut: 'El quebrantador de la paz no está entre {set}.',
      stNotMe: 'Yo no soy el quebrantador de la paz.',
      listAnd: 'y',
    },
  },
  ca: {
    title: 'El Veredicte de l’Althing',
    epigraph: 'Davant la roca de la llei un home és la seva paraula. Trenca la pau, i amb tu es trenca cada paraula que tens.',
    hints: [
      'Aquí un home és d’una peça. Si una paraula seva és falsa, totes les seves ho són.',
      'Comença on un home parla d’un altre home i no del trencador de la pau: aquestes paraules lliguen les marques de dues en dues, i provar-les no costa res.',
      'Fixades les marques, el trencador de la pau se segueix sense discussió: qui diu veritat l’acota, i qui menteix l’acota igual de fort, pel contrari del que diu.',
    ],
    nearMap: {
      'One voice at the rock cannot stand under that verdict.': 'Una veu a la roca no s’aguanta sota aquest veredicte.',
      'Several voices at the rock cannot stand under that verdict.': 'Diverses veus a la roca no s’aguanten sota aquest veredicte.',
      'The whole rock roars against that verdict.': 'La roca sencera rugeix contra aquest veredicte.',
    },
    board: {
      plate: 'Marca a foc cada home com a verdader o fals fins que totes les seves paraules s’aguantin — i després posa el collar al trencador de la pau.',
      tally: '{n} de 9 pedres s’aguanten sense contradir-se',
      tallyAll: 'Les nou pedres s’aguanten sense contradir-se. Dicta el veredicte.',
      brandNone: 'sense marca',
      brandTrue: 'diu veritat',
      brandLies: 'menteix',
      ariaNone: '{name} està sense marca.',
      ariaTrue: '{name} està marcat com a verdader.',
      ariaLies: '{name} està marcat com a mentider.',
      ariaWaits: ' Les seves paraules esperen altres marques.',
      ariaStands: ' Les seves paraules s’aguanten.',
      ariaBreaks: ' Les seves paraules es trenquen davant la roca.',
      ariaBurn: ' Crema la marca.',
      accuse: 'el collar',
      ariaAccuse: 'Assenyala {name} com a trencador de la pau.',
      clear: 'Refredar tots els ferros',
      verdict: 'Dictar el veredicte',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: el ferro crema una pedra. Crema-la un altre cop i la marca es torna quitrà.',
      sayTrue: '{name} queda marcat verdader.',
      sayLies: '{name} queda marcat mentider.',
      sayOff: 'S’esborra la marca de {name}.',
      sayReach: 'Aquesta marca resol {n} paraules més a la roca.',
      sayReachOne: 'Aquesta marca resol una paraula més a la roca.',
      sayAccuse: 'El collar de ferro penja de {name}.',
      sayWithdraw: 'Es retira el collar.',
      sayClear: 'Tots els ferros es refreden; la roca queda sense judici.',
      sayOpen: 'Nou pedres davant la roca de la llei: {names}. Duen {n} declaracions tallades.',
      solvedLine: 'El veredicte s’aguanta.',
      deny: 'La roca no admet aquest veredicte.',
      sceneAria: 'El camp de l’assemblea: nou pedres alçades en arc obert darrere la roca de la llei. {states}',
      stateNone: '{name} sense marca',
      stateTrue: '{name} marcat verdader',
      stateLies: '{name} marcat mentider',
      stateCollar: ' El collar de ferro penja de {name}.',
      stateNoCollar: ' Encara no penja cap collar.',
      stTrue: '{x} diu veritat.',
      stFalse: '{x} diu falsedat.',
      stXor: 'O menteix {x} o menteix {y} — no tots dos.',
      stImp: 'Si {x} diu veritat, aleshores {y} menteix.',
      stAmongIn: 'El trencador de la pau és entre {set}.',
      stAmongOut: 'El trencador de la pau no és entre {set}.',
      stNotMe: 'Jo no sóc el trencador de la pau.',
      listAnd: 'i',
    },
  },
};

export default {
  id: '13-althing',
  ordinal: 13,
  tier: 4,
  title: 'The Althing Verdict',
  epigraph: 'At the law-rock a man is his word. Break the peace, and every word you own breaks with it.',

  makePuzzle(rng) {
    const names = rng.shuffle(SPEAKERS).slice(0, N);
    for (let attempt = 0; attempt < 400; attempt++) {
      const culprit = rng.int(N);
      const liars = new Array(N).fill(false);
      const liarCount = rng.range(2, 4);
      for (const i of rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, liarCount)) liars[i] = true;
      const statements = buildRock(rng, liars, culprit);
      if (!statements) continue;
      const found = sweepRock(statements);
      if (found.length !== 1) continue;
      return {
        names,
        statements: statements.map((st) => ({ ...st, set: st.set ? st.set.slice() : undefined, text: textFor(st, names) })),
      };
    }
    return { names, statements: [] };
  },

  solve(instance) {
    const found = sweepRock(instance.statements);
    if (found.length !== 1) return { culprit: -1, liars: new Array(N).fill(false) };
    return { culprit: found[0].culprit, liars: found[0].liars };
  },

  verify(instance, answer) {
    try {
      if (!instance || !answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
      const { culprit, liars } = answer;
      if (!Number.isInteger(culprit) || culprit < 0 || culprit >= N) return { ok: false };
      if (!Array.isArray(liars) || liars.length !== N || !liars.every((b) => typeof b === 'boolean')) return { ok: false };
      if (!Array.isArray(instance.statements) || !instance.statements.length) return { ok: false };
      const wrong = contradictions(instance.statements, liars, culprit);
      if (wrong === 0) return { ok: true };
      if (wrong === 1) return { ok: false, near: 'One voice at the rock cannot stand under that verdict.' };
      if (wrong <= 3) return { ok: false, near: 'Several voices at the rock cannot stand under that verdict.' };
      return { ok: false, near: 'The whole rock roars against that verdict.' };
    } catch {
      return { ok: false };
    }
  },

  wrongAnswers(instance) {
    const self = this;
    const found = sweepRock(instance.statements);
    const out = [];
    const seen = new Set();
    if (found.length !== 1) return out;
    const truth = found[0];
    const push = (culprit, liars) => {
      const ans = { culprit, liars: liars.slice() };
      const key = JSON.stringify(ans);
      if (seen.has(key) || self.verify(instance, ans).ok) return;
      seen.add(key);
      out.push(ans);
    };

    for (let i = 0; i < N && out.length < 4; i++) {
      const flipped = truth.liars.slice();
      flipped[i] = !flipped[i];
      push(truth.culprit, flipped);
    }
    for (let d = 1; d <= 3; d++) push((truth.culprit + d) % N, truth.liars);
    push(truth.culprit, new Array(N).fill(false));
    push(truth.culprit, new Array(N).fill(true));
    push(truth.culprit, truth.liars.map((b) => !b));
    push((truth.culprit + 4) % N, truth.liars.map((b) => !b));
    return out;
  },

  shard() {
    return { ...SHARDS['13-althing'] };
  },

  difficulty: { searchSpace: 4.6e3, minSteps: 30, estMinutes: 20 },

  hints: [
    'A man is all of a piece here. If one word of his is false, every word of his is false.',
    'Start where a man speaks of another man rather than of the peace-breaker: those words bind the brands together, two at a time, and cost nothing to test.',
    'Once the brands are fixed, the peace-breaker follows without argument — a truth-teller narrows him down, and a liar narrows him down just as hard, by the opposite of what he says.',
  ],

  i18n: I18N,

  mount(ctx) {
    const art = ctx.art;
    const p = art.palette;
    const inst = ctx.instance;
    const self = this;
    const lang = ctx.lang || 'en';
    const LB = (I18N[lang] && I18N[lang].board) || {};
    const T = (key, params) => {
      let s = key in LB ? LB[key] : BOARD_EN[key];
      if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
      return s;
    };
    const S = stoneTones(p);

    const cleanup = [];
    const timers = [];
    let motions = [];
    const on = (el, ev, fn, opts) => {
      el.addEventListener(ev, fn, opts);
      cleanup.push(() => el.removeEventListener(ev, fn, opts));
    };
    const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
    const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
    const say = (t) => { try { ctx.note && ctx.note(t); } catch (e) { /* no journal */ } };
    const node = (tag, css, text) => {
      const n = document.createElement(tag);
      if (css) n.style.cssText = css;
      if (text != null) n.textContent = text;
      return n;
    };
    const calm = (() => {
      try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch (e) { return false; }
    })();

    const names = inst.names;
    const saidBy = [];
    for (let i = 0; i < N; i++) saidBy.push(inst.statements.filter((st) => st.speaker === i));

    // ---- state -----------------------------------------------------------
    const truth = ctx.solved ? self.solve(inst) : null;
    const liars = truth ? truth.liars.slice() : new Array(N).fill(false);
    const branded = new Array(N).fill(!!truth);
    let culprit = truth ? truth.culprit : -1;
    let reach = null;             // {from, to:[i], at} — the last brand's reach
    let touched = !!ctx.solved;   // the player has taken the iron

    // a stone STANDS when it wears a brand and every word carved on it is
    // settled and holding. Nine standing stones is exactly a sound verdict.
    const stands = (i) => {
      if (!branded[i]) return false;
      for (const st of saidBy[i]) if (statementState(st, branded, liars, culprit) !== 'held') return false;
      return true;
    };
    const tally = () => {
      let n = 0;
      for (let i = 0; i < N; i++) if (stands(i)) n++;
      return n;
    };
    const settledSet = () => inst.statements.map((st) => isSettled(st, branded, liars, culprit));

    // ---- frame -----------------------------------------------------------
    const wrap = node('div', `display:grid;gap:11px;font-family:${SERIF};color:${p.bone}`);
    const style = node('style');
    style.textContent = `
      .ow13-plate{position:relative;padding:13px 18px;border-radius:5px;overflow:hidden}
      .ow13-platetext{position:relative;z-index:1;margin:0;font-size:15px;line-height:1.5;color:${p.bone};
        text-align:center;letter-spacing:.015em;max-width:62ch;margin-inline:auto;
        text-shadow:${art.reliefShadowCss || 'none'}}
      .ow13-scene{position:relative;line-height:0}
      .ow13-tally{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
      .ow13-tallytext{margin:0;font-size:14px;color:${p.bone};letter-spacing:.02em}
      .ow13-gridwrap{position:relative}
      .ow13-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(226px,1fr));gap:10px}
      /* the foot strip is reserved on every stone, accused or not, so hanging
         the collar never shifts the layout under the player's thumb */
      .ow13-card{position:relative;border-radius:6px;padding:11px 13px 26px;display:grid;gap:8px;
        border:1px solid ${alpha(p.tar, 0.9)};
        box-shadow:0 4px 10px ${alpha(p.tar, 0.5)},inset 0 1px 0 ${alpha(p.bone, 0.09)}}
      .ow13-face{position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;border-radius:6px}
      .ow13-name,.ow13-said,.ow13-row{position:relative;z-index:1}
      .ow13-name{font-size:16.5px;color:${p.bone};letter-spacing:.05em;padding-right:46px;
        text-shadow:${art.reliefShadowCss || 'none'}}
      .ow13-said{display:grid;gap:6px}
      .ow13-say{margin:0;font-size:13.5px;line-height:1.45;color:${p.bone};padding-left:9px;
        border-left:2px solid ${alpha(p.gold, 0.55)}}
      .ow13-say[data-state="held"]{color:${p.boneDim};border-left-color:${alpha(p.bone, 0.16)}}
      .ow13-say[data-state="broken"]{color:${p.bone};border-left-color:${p.blood};
        text-decoration:line-through;text-decoration-color:${p.blood};text-decoration-thickness:2px}
      .ow13-row{display:flex;gap:7px;flex-wrap:wrap}
      .ow13-brand,.ow13-culprit{font-family:${SERIF};font-size:13px;color:${p.boneDim};
        background:${alpha(p.tar, 0.55)};border:1px solid ${alpha(p.bone, 0.22)};border-radius:999px;
        padding:9px 14px;min-height:44px;min-width:44px;cursor:pointer;letter-spacing:.02em}
      .ow13-brand:focus-visible,.ow13-culprit:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow13-brand[data-state="true"]{border-color:${p.gold};color:${p.goldBright};background:${alpha(p.gold, 0.16)}}
      .ow13-brand[data-state="liar"]{border-color:${alpha(p.bone, 0.3)};color:${p.bone};background:${alpha(p.tar, 0.95)}}
      .ow13-culprit[aria-pressed="true"]{border-color:${IRON(p).lit};color:${p.bone};
        background:${alpha(IRON(p).cold, 0.95)}}
      .ow13-act{font-family:${SERIF};font-size:14px;color:${p.boneDim};background:transparent;
        border:1px solid ${alpha(p.oakLight, 0.9)};border-radius:3px;padding:11px 16px;min-height:44px;
        min-width:44px;cursor:pointer}
      .ow13-act:hover{color:${p.bone};border-color:${p.oakLight}}
      .ow13-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow13-act[disabled]{opacity:.45;cursor:default}
      .ow13-ghost{position:absolute;left:0;top:0;pointer-events:none;z-index:4;line-height:0}
      #app .ow13-brand,#app .ow13-culprit,#app .ow13-act{min-width:44px}
    `;
    wrap.append(style);

    // the comprehension plate: the whole win condition in one sentence, cut
    // into a stone tablet pinned above the ground
    const plate = node('div');
    plate.className = 'ow13-plate';
    const plateFace = { canvas: null, ctx: null, w: 0, h: 0 };
    const plateText = node('p', null, T('plate'));
    plateText.className = 'ow13-platetext';
    plate.append(plateText);

    const sceneHost = node('div');
    sceneHost.className = 'ow13-scene';
    const scene = { canvas: null, ctx: null, w: 0, h: 0 };
    let ground = null;            // baked assembly ground, keyed by size
    let groundKey = '';

    const tallyWrap = node('div');
    tallyWrap.className = 'ow13-tally';
    const tallyGfx = { canvas: null, ctx: null, w: 0, h: 0 };
    const tallyHost = node('div', 'line-height:0');
    const tallyText = node('p');
    tallyText.className = 'ow13-tallytext';
    tallyWrap.append(tallyHost, tallyText);

    const gridWrap = node('div');
    gridWrap.className = 'ow13-gridwrap';
    const grid = node('div');
    grid.className = 'ow13-grid';
    gridWrap.append(grid);

    const cards = [];
    for (let i = 0; i < N; i++) {
      const card = node('div');
      card.className = 'ow13-card';
      const face = { canvas: null, ctx: null, w: 0, h: 0 };
      const name = node('div', null, names[i]);
      name.className = 'ow13-name';
      const said = node('div');
      said.className = 'ow13-said';
      const lines = [];
      for (const st of saidBy[i]) {
        const line = node('p', null, `“${statementText(st, names, T, lang)}”`);
        line.className = 'ow13-say';
        said.append(line);
        lines.push(line);
      }
      const row = node('div');
      row.className = 'ow13-row';
      const brand = node('button', null, T('brandNone'));
      brand.className = 'ow13-brand';
      brand.type = 'button';
      on(brand, 'click', () => cycleBrand(i));
      const acc = node('button', null, T('accuse'));
      acc.className = 'ow13-culprit';
      acc.type = 'button';
      acc.setAttribute('aria-pressed', 'false');
      on(acc, 'click', () => accuse(i));
      row.append(brand, acc);
      card.append(name, said, row);
      grid.append(card);
      cards.push({ card, face, brand, acc, lines });
    }

    // the ghost hand: three seconds of a brand-iron finding a stone
    const ghostHost = node('div');
    ghostHost.className = 'ow13-ghost';
    ghostHost.setAttribute('aria-hidden', 'true');
    ghostHost.style.display = 'none';
    const ghost = { canvas: null, ctx: null, w: 0, h: 0 };
    gridWrap.append(ghostHost);

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center');
    const clearBtn = node('button', null, T('clear'));
    clearBtn.className = 'ow13-act';
    clearBtn.type = 'button';
    const skipBtn = node('button', null, T('skip'));
    skipBtn.className = 'ow13-act';
    skipBtn.type = 'button';
    skipBtn.style.display = 'none';
    const verdictBtn = node('button', null, T('verdict'));
    verdictBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
    verdictBtn.type = 'button';
    actions.append(verdictBtn, clearBtn, skipBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};scroll-margin:28px`);
    status.setAttribute('aria-live', 'polite');

    wrap.append(plate, sceneHost, tallyWrap, gridWrap, actions, status);
    ctx.root.append(wrap);

    // ---- canvas plumbing -------------------------------------------------
    const fit = (host, slot, w, h, css) => {
      if (slot.canvas && slot.w === w && slot.h === h) return false;
      const made = art.makeCanvas(w, h);
      made.canvas.setAttribute('aria-hidden', 'true');
      if (css) made.canvas.style.cssText = css;
      if (slot.canvas) slot.canvas.remove();
      host.append(made.canvas);
      slot.canvas = made.canvas;
      slot.ctx = made.ctx;
      slot.w = w;
      slot.h = h;
      return true;
    };
    const boxOf = (el) => {
      try { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }
      catch (e) { return { w: 0, h: 0 }; }
    };

    // ---- the assembly ground (baked once per size) -----------------------
    function bakeGround(W, H) {
      const off = art.makeCanvas(W, H);
      const c = off.ctx;
      const band = Math.max(12, Math.round(Math.min(W, H) * 0.042));
      const ix = band;
      const iy = band;
      const iw = W - band * 2;
      const ih = H - band * 2;
      const horizon = iy + ih * 0.37;
      art.paintWood(c, W, H, 1303);
      // tool history lives where the puzzle does not
      if (typeof art.wear === 'function') {
        art.wear(c, W, H, 'althing-ground', {
          avoid: { x: ix + iw * 0.04, y: horizon - ih * 0.30, w: iw * 0.92, h: ih * 0.94 },
        });
      }

      c.save();
      c.beginPath();
      c.rect(ix, iy, iw, ih);
      c.clip();

      // night over the thing-field. The wood beneath runs vertically; the sky
      // has to be built from horizontal bands or the grain reads as palings.
      const r = rng('althing-field');
      const sky = c.createLinearGradient(0, iy, 0, horizon + ih * 0.06);
      sky.addColorStop(0, alpha(p.tar, 0.9));
      sky.addColorStop(0.55, alpha(p.tar, 0.74));
      sky.addColorStop(1, alpha(p.tar, 0.34));
      c.fillStyle = sky;
      c.fillRect(ix, iy, iw, horizon - iy + ih * 0.06);
      for (let i = 0; i < 11; i++) {
        const cy = iy + (horizon - iy) * (0.06 + r() * 0.92);
        c.strokeStyle = alpha(r.chance(0.5) ? p.boneDim : p.fjordLight, 0.02 + r() * 0.035);
        c.lineWidth = 3 + r() * 12;
        c.beginPath();
        c.moveTo(ix, cy);
        c.bezierCurveTo(ix + iw * 0.3, cy - 6, ix + iw * 0.7, cy + 6, ix + iw, cy);
        c.stroke();
      }
      // far hills: one horizontal silhouette that seats the whole field
      c.fillStyle = alpha(p.tar, 0.55);
      c.beginPath();
      c.moveTo(ix, horizon);
      let hx = ix;
      let hy = horizon - ih * 0.05;
      c.lineTo(hx, hy);
      while (hx < ix + iw) {
        const nx = hx + iw * (0.07 + r() * 0.1);
        const ny = horizon - ih * (0.015 + r() * 0.075);
        c.quadraticCurveTo((hx + nx) / 2, Math.min(hy, ny) - ih * 0.012, nx, ny);
        hx = nx;
        hy = ny;
      }
      c.lineTo(ix + iw, horizon);
      c.closePath();
      c.fill();
      // the hearth of the assembly, burning low behind the law-rock. Kept
      // small and weak: a wide ember pool turned the whole field to mud.
      art.glow(c, ix + iw / 2, horizon + ih * 0.01, iw * 0.19, p.ember, 0.14);
      const mist = c.createLinearGradient(0, horizon - ih * 0.05, 0, horizon + ih * 0.08);
      mist.addColorStop(0, alpha(p.boneDim, 0));
      mist.addColorStop(0.5, alpha(p.boneDim, 0.07));
      mist.addColorStop(1, alpha(p.boneDim, 0));
      c.fillStyle = mist;
      c.fillRect(ix, horizon - ih * 0.05, iw, ih * 0.13);

      // The booths of the men who came to hear: turf-roofed shelters with a
      // banner pole over each. They sit BEHIND the horizon, near-silhouette —
      // dead-zone furniture that must never compete with a stone. Flat coloured
      // cloth alone read as bookmarks; the roof mass is what makes it a camp.
      const booth = (bx, bw, bh, tint, seed) => {
        const rb = rng(`althing-booth:${seed}`);
        const base = horizon + ih * 0.012;
        c.save();
        // gable end + long turf roof, one dark mass
        c.beginPath();
        c.moveTo(bx - bw / 2, base);
        c.lineTo(bx - bw / 2, base - bh * 0.4);
        c.lineTo(bx - bw * 0.1, base - bh);
        c.lineTo(bx + bw * 0.42, base - bh * 0.94);
        c.lineTo(bx + bw / 2, base - bh * 0.34);
        c.lineTo(bx + bw / 2, base);
        c.closePath();
        const roof = c.createLinearGradient(bx - bw / 2, base - bh, bx + bw / 2, base);
        roof.addColorStop(0, alpha(mixHex(p.tar, p.pine, 0.3), 0.88));
        roof.addColorStop(1, alpha(p.tar, 0.94));
        c.fillStyle = roof;
        c.fill();
        // ridge line and a doorway cut
        c.strokeStyle = alpha(p.oakLight, 0.16);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(bx - bw * 0.1, base - bh);
        c.lineTo(bx + bw * 0.42, base - bh * 0.94);
        c.stroke();
        c.fillStyle = alpha(p.ember, 0.16);
        c.fillRect(bx - bw * 0.07, base - bh * 0.36, bw * 0.15, bh * 0.36);
        // the pole and its pennant
        const poleTop = base - bh * 1.5;
        c.strokeStyle = alpha(p.oakLight, 0.34);
        c.lineWidth = Math.max(1.2, bh * 0.045);
        c.beginPath();
        c.moveTo(bx + bw * 0.44, base);
        c.lineTo(bx + bw * 0.44, poleTop);
        c.stroke();
        c.beginPath();
        c.moveTo(bx + bw * 0.44, poleTop);
        c.lineTo(bx + bw * 0.44 + bw * 0.34, poleTop + bh * 0.1);
        c.quadraticCurveTo(bx + bw * 0.44 + bw * 0.2, poleTop + bh * 0.2, bx + bw * 0.44, poleTop + bh * 0.3);
        c.closePath();
        c.fillStyle = alpha(mixHex(tint, p.tar, 0.42), 0.62);
        c.fill();
        c.strokeStyle = alpha(p.tar, 0.5);
        c.lineWidth = 0.9;
        c.stroke();
        for (let k = 0; k < 2; k++) {
          c.strokeStyle = alpha(p.tar, 0.16 + rb() * 0.08);
          c.beginPath();
          c.moveTo(bx + bw * (0.5 + k * 0.1), poleTop + bh * 0.04);
          c.lineTo(bx + bw * (0.48 + k * 0.1), poleTop + bh * 0.24);
          c.stroke();
        }
        c.restore();
      };
      booth(ix + iw * 0.085, iw * 0.16, ih * 0.19, p.blood, 'a');
      booth(ix + iw * 0.235, iw * 0.12, ih * 0.14, p.fjordLight, 'b');
      booth(ix + iw * 0.915, iw * 0.15, ih * 0.175, p.pineLight, 'c');
      booth(ix + iw * 0.775, iw * 0.115, ih * 0.13, p.ember, 'd');

      const banner = (bx, poleH, tint, seed) => {
        const rb = rng(`althing-banner:${seed}`);
        const w2 = poleH * 0.34;
        const top = horizon - poleH;
        c.save();
        // pole, with the crossbar the cloth is slung from
        c.strokeStyle = alpha(p.tar, 0.72);
        c.lineWidth = Math.max(1.4, poleH * 0.03);
        c.beginPath();
        c.moveTo(bx, horizon + ih * 0.005);
        c.lineTo(bx, top);
        c.moveTo(bx - w2 * 0.1, top + poleH * 0.04);
        c.lineTo(bx + w2 * 1.02, top + poleH * 0.07);
        c.stroke();
        c.strokeStyle = alpha(p.oakLight, 0.24);
        c.lineWidth = Math.max(0.8, poleH * 0.014);
        c.beginPath();
        c.moveTo(bx - 1, horizon + ih * 0.005);
        c.lineTo(bx - 1, top);
        c.stroke();
        // cloth: slung, sagging, with a swallow-tail hem catching a little wind
        c.beginPath();
        c.moveTo(bx, top + poleH * 0.05);
        c.lineTo(bx + w2, top + poleH * 0.08);
        c.quadraticCurveTo(bx + w2 * 1.06, top + poleH * 0.4, bx + w2 * 0.88, top + poleH * 0.62);
        c.lineTo(bx + w2 * 0.5, top + poleH * 0.52);
        c.lineTo(bx + w2 * 0.1, top + poleH * 0.66);
        c.closePath();
        const cloth = c.createLinearGradient(bx, top, bx + w2, top + poleH * 0.6);
        cloth.addColorStop(0, alpha(mixHex(tint, p.tar, 0.34), 0.5));
        cloth.addColorStop(1, alpha(mixHex(tint, p.tar, 0.72), 0.5));
        c.fillStyle = cloth;
        c.fill();
        c.strokeStyle = alpha(p.tar, 0.45);
        c.lineWidth = 1;
        c.stroke();
        // fold shadows down the cloth
        for (let k = 0; k < 3; k++) {
          const fx = bx + w2 * (0.24 + k * 0.26);
          c.strokeStyle = alpha(p.tar, 0.14 + rb() * 0.08);
          c.lineWidth = Math.max(0.8, w2 * 0.06);
          c.beginPath();
          c.moveTo(fx, top + poleH * 0.07);
          c.quadraticCurveTo(fx + w2 * 0.04, top + poleH * 0.35, fx - w2 * 0.03, top + poleH * 0.58);
          c.stroke();
        }
        c.restore();
      };
      if (iw > 520) {
        banner(ix + iw * 0.32, ih * 0.13, p.gold, 'e');
        banner(ix + iw * 0.655, ih * 0.115, p.blood, 'f');
      }

      // the ground itself: turf worn to earth where the assembly stands
      // the turf, feathered into the horizon rather than butted against it —
      // a hard top edge read as a green rectangle laid on the panel
      const turf = c.createLinearGradient(0, horizon - ih * 0.06, 0, iy + ih);
      turf.addColorStop(0, alpha(mixHex(p.pine, p.tar, 0.55), 0));
      turf.addColorStop(0.12, alpha(mixHex(p.pine, p.tar, 0.42), 0.5));
      turf.addColorStop(0.42, alpha(mixHex(p.pine, p.oakDeep, 0.5), 0.6));
      turf.addColorStop(1, alpha(mixHex(p.oakDeep, p.tar, 0.45), 0.8));
      c.fillStyle = turf;
      c.fillRect(ix, horizon - ih * 0.06, iw, ih - (horizon - iy) + ih * 0.06);
      // uneven ground: broad tonal swells so the field is not one flat slab
      for (let i = 0; i < 9; i++) {
        const sx = ix + r() * iw;
        const sy3 = horizon + (iy + ih - horizon) * (0.05 + r() * 0.95);
        const sr = iw * (0.09 + r() * 0.16);
        const swell = c.createRadialGradient(sx, sy3, 0, sx, sy3, sr);
        const up = r.chance(0.5);
        swell.addColorStop(0, alpha(up ? p.pineLight : p.tar, up ? 0.05 : 0.11));
        swell.addColorStop(1, alpha(up ? p.pineLight : p.tar, 0));
        c.fillStyle = swell;
        c.beginPath();
        c.ellipse(sx, sy3, sr, sr * 0.42, 0, 0, Math.PI * 2);
        c.fill();
      }
      // the worn path: bare earth where every man walks up to the rock
      const path = c.createLinearGradient(0, horizon, 0, iy + ih);
      path.addColorStop(0, alpha(p.oakDeep, 0));
      path.addColorStop(1, alpha(p.oakDeep, 0.4));
      c.save();
      c.beginPath();
      c.moveTo(ix + iw * 0.44, horizon);
      c.lineTo(ix + iw * 0.56, horizon);
      c.lineTo(ix + iw * 0.78, iy + ih);
      c.lineTo(ix + iw * 0.22, iy + ih);
      c.closePath();
      c.fillStyle = path;
      c.fill();
      c.restore();
      // trampled grass: short strokes, laid over by many feet, low contrast
      const blades = Math.round(iw * 3.2);
      for (let i = 0; i < blades; i++) {
        const t = r();
        const gy = horizon + (iy + ih - horizon) * (t * t);
        const gx = ix + r() * iw;
        const len = 2.4 + (gy - horizon) / ih * 9;
        const lean = (r() - 0.5) * 1.5;
        c.strokeStyle = r.chance(0.5)
          ? alpha(mixHex(p.pineLight, p.oakLight, 0.45), 0.07 + r() * 0.09)
          : alpha(p.oakDeep, 0.1 + r() * 0.12);
        c.lineWidth = 0.8 + r() * 0.6;
        c.beginPath();
        c.moveTo(gx, gy);
        c.lineTo(gx + lean * len * 0.5, gy - len);
        c.stroke();
      }
      // trample rings: the ground is bare where men have stood for generations
      for (let i = 0; i < 5; i++) {
        const cx0 = ix + iw * (0.12 + r() * 0.76);
        const cy0 = horizon + (iy + ih - horizon) * (0.2 + r() * 0.7);
        const rr = iw * (0.05 + r() * 0.09);
        c.fillStyle = alpha(p.oakDeep, 0.1 + r() * 0.06);
        c.beginPath();
        c.ellipse(cx0, cy0, rr, rr * 0.3, 0, 0, Math.PI * 2);
        c.fill();
      }
      // The oak beneath runs vertically and its grain was reading straight
      // through the field as palings. A horizontal striation scrim at the
      // threshold of visibility cancels that read without adding a texture.
      let sy2 = horizon - ih * 0.06;
      while (sy2 < iy + ih) {
        sy2 += 2 + r() * 9;
        c.strokeStyle = alpha(r.chance(0.5) ? p.bone : p.tar, 0.008 + r() * 0.012);
        c.lineWidth = 1 + r() * 3;
        c.beginPath();
        c.moveTo(ix, sy2);
        c.bezierCurveTo(ix + iw * 0.3, sy2 + (r() - 0.5) * 3, ix + iw * 0.7, sy2 + (r() - 0.5) * 3, ix + iw, sy2 + (r() - 0.5) * 3);
        c.stroke();
      }
      // corner falloff: the hearth does not reach the edges of the field
      const vig = c.createRadialGradient(ix + iw / 2, horizon + ih * 0.2, ih * 0.15,
        ix + iw / 2, horizon + ih * 0.2, Math.max(iw, ih) * 0.72);
      vig.addColorStop(0, alpha(p.tar, 0));
      vig.addColorStop(1, alpha(p.tar, 0.5));
      c.fillStyle = vig;
      c.fillRect(ix, iy, iw, ih);
      c.restore();

      if (typeof art.tray === 'function') art.tray(c, band, band, iw, ih, { band, ribbon: true, seed: 'althing' });
      else art.paintPanel(c, band, band, iw, ih);
      return { canvas: off.canvas, band, ix, iy, iw, ih, horizon };
    }

    // where each stone stands: a shallow arc behind the law-rock
    function arcAt(i, g) {
      const a0 = Math.PI * 1.13;
      const a1 = Math.PI * 1.87;
      const a = a0 + (i / (N - 1)) * (a1 - a0);
      const rx = g.iw * 0.415;
      const ry = g.ih * 0.155;
      const cx = g.ix + g.iw / 2;
      const cy = g.horizon + g.ih * 0.235;
      const y = cy + Math.sin(a) * ry;
      const depth = (y - (cy - ry)) / (ry * 2);     // 0 farthest, 1 nearest
      const k = 0.74 + depth * 0.46;
      return { x: cx + Math.cos(a) * rx, y, k };
    }

    function standingStone(c, x, yBase, w, h, seed, o) {
      const lean = ((seed * 37) % 7 - 3) * 0.008;
      c.save();
      // planted: a mound of turf heaped round the socket it was raised in
      c.fillStyle = alpha(mixHex(p.pine, p.oakDeep, 0.5), 0.42);
      c.beginPath();
      c.ellipse(x, yBase + h * 0.005, w * 0.92, h * 0.05, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = alpha(p.oakDeep, 0.3);
      c.beginPath();
      c.ellipse(x, yBase - h * 0.006, w * 0.66, h * 0.028, 0, 0, Math.PI * 2);
      c.fill();
      // cast shadow on the turf, thrown by the hearth key up-left
      c.fillStyle = alpha(p.tar, 0.5);
      c.beginPath();
      c.ellipse(x + w * 0.5, yBase + h * 0.004, w * 1.05, h * 0.032, 0, 0, Math.PI * 2);
      c.fill();
      // the menhir silhouette: split base, tapered head, chipped crown
      const topW = w * 0.72;
      const topY = yBase - h;
      c.save();
      c.translate(x, yBase);
      c.rotate(lean);
      c.beginPath();
      c.moveTo(-w / 2, 0);
      c.lineTo(-w / 2 + w * 0.03, -h * 0.5);
      c.lineTo(-topW / 2, -h * 0.9);
      c.lineTo(-topW * 0.28, -h);
      c.lineTo(topW * 0.2, -h * 0.965);
      c.lineTo(topW / 2, -h * 0.86);
      c.lineTo(w / 2 - w * 0.02, -h * 0.44);
      c.lineTo(w / 2, 0);
      c.closePath();
      c.save();
      c.clip();
      stoneSkin(c, p, -w / 2, -h, w, h, seed, { lichen: 5, chips: 4 });
      c.restore();
      // lit arris up the weather side, tar seat down the shade side
      c.strokeStyle = alpha(S.arris, 0.3);
      c.lineWidth = Math.max(1, w * 0.035);
      c.beginPath();
      c.moveTo(-w / 2 + w * 0.03, -h * 0.5);
      c.lineTo(-topW / 2, -h * 0.9);
      c.lineTo(-topW * 0.28, -h);
      c.stroke();
      c.strokeStyle = alpha(p.tar, 0.62);
      c.lineWidth = Math.max(1, w * 0.05);
      c.beginPath();
      c.moveTo(topW / 2, -h * 0.86);
      c.lineTo(w / 2 - w * 0.02, -h * 0.44);
      c.lineTo(w / 2, 0);
      c.stroke();
      c.restore();

      if (o.brand) sear(c, art, p, x, topY + h * 0.30, Math.max(6, w * 0.3), o.brand);
      if (o.collar) ironCollar(c, p, x, topY + h * 0.62, w * 1.1, h * 0.13);
      if (o.name) {
        // a low name-stone set at the foot, so the label sits on carved
        // furniture instead of floating over the turf
        const size = Math.max(9, Math.min(14, w * 0.38));
        const lw = Math.max(w * 1.4, size * o.name.length * 0.58);
        // neighbouring stones sit close in y at the ends of the arc, so the
        // plinths are laid in two rows — at 390px they collided outright
        const ly = yBase + h * 0.05 + (o.row ? size * 2 : 0);
        c.fillStyle = alpha(p.tar, 0.62);
        c.beginPath();
        if (c.roundRect) c.roundRect(x - lw / 2, ly, lw, size * 1.5, 2);
        else c.rect(x - lw / 2, ly, lw, size * 1.5);
        c.fill();
        c.strokeStyle = alpha(S.arris, 0.22);
        c.lineWidth = 1;
        c.stroke();
        art.carveText(c, o.name, x, ly + size * 1.12, size, {
          color: o.brand ? p.bone : p.boneDim, depth: 0.8, align: 'center',
        });
      }
      c.restore();
    }

    function lawRock(c, g, n) {
      const w = Math.max(150, g.iw * 0.36);
      const h = Math.max(68, g.ih * 0.36);
      const x = g.ix + g.iw / 2;
      const yBase = g.iy + g.ih * 0.985;
      const top = yBase - h;
      c.save();
      // it is the one thing the hearth truly lights
      art.glow(c, x, top + h * 0.3, w * 0.8, p.ember, 0.26);
      c.fillStyle = alpha(p.tar, 0.6);
      c.beginPath();
      c.ellipse(x + w * 0.1, yBase, w * 0.66, h * 0.11, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(x - w / 2, yBase);
      c.lineTo(x - w / 2 + w * 0.05, top + h * 0.22);
      c.lineTo(x - w * 0.34, top + h * 0.03);
      c.lineTo(x + w * 0.31, top);
      c.lineTo(x + w / 2 - w * 0.03, top + h * 0.26);
      c.lineTo(x + w / 2, yBase);
      c.closePath();
      c.save();
      c.clip();
      stoneSkin(c, p, x - w / 2, top, w, h, 913, { lichen: 7, chips: 7 });
      // the top is worn bright: three hundred years of men standing on it
      const pol = c.createLinearGradient(0, top, 0, top + h * 0.34);
      pol.addColorStop(0, alpha(p.bone, 0.16));
      pol.addColorStop(1, alpha(p.bone, 0));
      c.fillStyle = pol;
      c.fillRect(x - w / 2, top, w, h * 0.34);
      c.restore();
      c.strokeStyle = alpha(S.arris, 0.34);
      c.lineWidth = Math.max(1.2, w * 0.014);
      c.beginPath();
      c.moveTo(x - w * 0.34, top + h * 0.03);
      c.lineTo(x + w * 0.31, top);
      c.stroke();
      c.strokeStyle = alpha(p.tar, 0.7);
      c.lineWidth = Math.max(1.2, w * 0.018);
      c.beginPath();
      c.moveTo(x + w * 0.31, top);
      c.lineTo(x + w / 2 - w * 0.03, top + h * 0.26);
      c.lineTo(x + w / 2, yBase);
      c.stroke();

      // the law cut into its face: maðr, and a notch struck for every stone
      // that stands consistent under the brands laid so far
      // the rune sits in a sunk panel, chip-carved round its edge, so the face
      // has structure instead of being one dressed slab
      const pw = w * 0.34;
      const ph = h * 0.5;
      const px0 = x - pw / 2;
      const py0 = top + h * 0.22;
      c.fillStyle = alpha(p.tar, 0.26);
      c.beginPath();
      if (c.roundRect) c.roundRect(px0, py0, pw, ph, 3); else c.rect(px0, py0, pw, ph);
      c.fill();
      c.strokeStyle = alpha(p.tar, 0.6);
      c.lineWidth = 1.4;
      c.stroke();
      c.strokeStyle = alpha(S.arris, 0.24);
      c.lineWidth = 1;
      c.beginPath();
      if (c.roundRect) c.roundRect(px0 + 1.2, py0 + 1.2, pw, ph, 3); else c.rect(px0 + 1.2, py0 + 1.2, pw, ph);
      c.stroke();
      if (typeof art.chipBorder === 'function' && w > 190) {
        art.chipBorder(c, px0 - w * 0.05, py0 - h * 0.05, pw + w * 0.1, ph + h * 0.1,
          { size: Math.max(6, w * 0.038), alpha: 0.5 });
      }
      art.drawRune(c, 'ᛘ', x - w * 0.075, top + h * 0.3, Math.max(20, h * 0.4), {
        color: alpha(p.bone, 0.6), weight: Math.max(2.4, h * 0.058),
      });
      const nw = w * 0.56;
      const ny = yBase - h * 0.155;
      // the score line the notches are struck against
      c.strokeStyle = alpha(p.tar, 0.5);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x - nw / 2 - w * 0.03, ny + h * 0.1);
      c.lineTo(x + nw / 2 + w * 0.03, ny + h * 0.1);
      c.stroke();
      const step = nw / N;
      for (let i = 0; i < N; i++) {
        const nx = x - nw / 2 + step * (i + 0.5);
        const lit = i < n;
        c.strokeStyle = alpha(p.tar, 0.75);
        c.lineWidth = Math.max(2, step * 0.26);
        c.beginPath();
        c.moveTo(nx, ny - h * 0.075);
        c.lineTo(nx, ny + h * 0.075);
        c.stroke();
        c.strokeStyle = lit ? alpha(p.goldBright, 0.85) : alpha(S.lit, 0.34);
        c.lineWidth = Math.max(1, step * 0.13);
        c.beginPath();
        c.moveTo(nx + 0.9, ny - h * 0.075);
        c.lineTo(nx + 0.9, ny + h * 0.075);
        c.stroke();
      }
      c.restore();
    }

    function paintScene() {
      if (!scene.ctx) return;
      const c = scene.ctx;
      const W = scene.w;
      const H = scene.h;
      const key = `${W}x${H}`;
      if (!ground || groundKey !== key) { ground = bakeGround(W, H); groundKey = key; }
      const g = ground;
      c.clearRect(0, 0, W, H);
      c.drawImage(g.canvas, 0, 0, W, H);

      const pos = [];
      for (let i = 0; i < N; i++) pos.push(arcAt(i, g));

      // the reach of the last brand, drawn on the ground under the stones:
      // one step of the implication web, never the whole of it
      if (reach && reach.to.length) {
        c.save();
        const a = pos[reach.from];
        for (const j of reach.to) {
          const b = pos[j];
          const mx = (a.x + b.x) / 2;
          const my = Math.max(a.y, b.y) + g.ih * 0.075;
          c.strokeStyle = alpha(p.goldBright, 0.3);
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.quadraticCurveTo(mx, my, b.x, b.y);
          c.stroke();
          art.glow(c, b.x, b.y, g.ih * 0.05, p.goldBright, 0.22);
        }
        c.restore();
      }

      // back to front, so the nearer stones overlap the farther ones
      const order = pos.map((q, i) => i).sort((i, j) => pos[i].y - pos[j].y);
      for (const i of order) {
        const q = pos[i];
        const w = Math.max(15, g.iw * 0.062 * q.k);
        const h = Math.max(36, g.ih * 0.40 * q.k);
        standingStone(c, q.x, q.y, w, h, 101 + i * 17, {
          brand: branded[i] ? (liars[i] ? 'lie' : 'true') : null,
          collar: culprit === i,
          name: names[i],
          row: i % 2,
        });
      }
      lawRock(c, g, tally());
    }

    // ---- the stone slabs the words are carved on -------------------------
    const slabCache = new Map();
    function slabFor(i, w, h) {
      const key = `${i}:${w}x${h}`;
      const hit = slabCache.get(key);
      if (hit) return hit;
      const off = art.makeCanvas(w, h);
      const c = off.ctx;
      const rad = 6;
      c.save();
      c.beginPath();
      if (c.roundRect) c.roundRect(0, 0, w, h, rad); else c.rect(0, 0, w, h);
      c.clip();
      stoneSkin(c, p, 0, 0, w, h, 401 + i * 29, { lichen: 7, chips: 6 });
      // a struck border run so the slab reads as dressed stone, not a fill
      if (typeof art.chipBorder === 'function' && w > 120) {
        art.chipBorder(c, 5, 5, w - 10, h - 10, { size: Math.max(6, w / 30), alpha: 0.3 });
      }
      if (typeof art.insetFace === 'function') art.insetFace(c, 0, 0, w, h, { depth: 0.42, lipLight: 0.16 });
      // the socket the iron is set into, top right — empty until it is burned
      const sx = w - 26;
      const sy = 25;
      c.strokeStyle = alpha(p.tar, 0.6);
      c.lineWidth = 2.4;
      c.beginPath();
      c.arc(sx, sy, 13, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = alpha(S.arris, 0.24);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(sx + 0.9, sy + 0.9, 13, 0, Math.PI * 2);
      c.stroke();
      // the reserved foot: a scribe line and two peg holes from the raising,
      // so the strip carries quiet tool history while no collar hangs there
      const fy = h - 15;
      c.strokeStyle = alpha(p.bone, 0.055);
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(14, fy);
      c.lineTo(w - 14, fy + 0.6);
      c.stroke();
      for (const px2 of [w * 0.24, w * 0.76]) {
        c.fillStyle = alpha(p.tar, 0.34);
        c.beginPath();
        c.arc(px2, fy - 3, 2.2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = alpha(S.arris, 0.2);
        c.lineWidth = 0.8;
        c.beginPath();
        c.arc(px2 + 0.7, fy - 2.3, 2.2, Math.PI * 0.1, Math.PI * 0.9);
        c.stroke();
      }
      c.restore();
      if (slabCache.size > 40) slabCache.clear();
      slabCache.set(key, off.canvas);
      return off.canvas;
    }

    function paintCard(i) {
      const f = cards[i].face;
      if (!f.ctx) return;
      const c = f.ctx;
      const w = f.w;
      const h = f.h;
      c.clearRect(0, 0, w, h);
      c.drawImage(slabFor(i, w, h), 0, 0, w, h);
      if (branded[i]) sear(c, art, p, w - 26, 25, 13, liars[i] ? 'lie' : 'true');
      if (culprit === i) ironCollar(c, p, w * 0.5, h - 15, w * 0.46, 13);
    }

    function paintTally(n) {
      if (!tallyGfx.ctx) return;
      const c = tallyGfx.ctx;
      const w = tallyGfx.w;
      const h = tallyGfx.h;
      c.clearRect(0, 0, w, h);
      const step = w / N;
      for (let i = 0; i < N; i++) {
        const x = step * (i + 0.5);
        c.strokeStyle = alpha(p.tar, 0.8);
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(x, 3);
        c.lineTo(x, h - 3);
        c.stroke();
        c.strokeStyle = i < n ? p.goldBright : alpha(p.boneDim, 0.32);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x + 0.8, 3);
        c.lineTo(x + 0.8, h - 3);
        c.stroke();
      }
    }

    function paintPlate() {
      if (!plateFace.ctx) return;
      const c = plateFace.ctx;
      const w = plateFace.w;
      const h = plateFace.h;
      c.clearRect(0, 0, w, h);
      c.save();
      c.beginPath();
      if (c.roundRect) c.roundRect(0, 0, w, h, 5); else c.rect(0, 0, w, h);
      c.clip();
      stoneSkin(c, p, 0, 0, w, h, 77, { lichen: 3, chips: 4 });
      const wash = c.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0, alpha(p.tar, 0.28));
      wash.addColorStop(1, alpha(p.tar, 0.5));
      c.fillStyle = wash;
      c.fillRect(0, 0, w, h);
      if (typeof art.chipBorder === 'function' && w > 200) {
        art.chipBorder(c, 4, 4, w - 8, h - 8, { size: Math.max(6, w / 44), alpha: 0.42 });
      }
      c.restore();
      c.strokeStyle = alpha(p.gold, 0.42);
      c.lineWidth = 1;
      c.beginPath();
      if (c.roundRect) c.roundRect(0.5, 0.5, w - 1, h - 1, 5); else c.rect(0.5, 0.5, w - 1, h - 1);
      c.stroke();
    }

    function paintGhost() {
      if (!ghost.ctx) return;
      const c = ghost.ctx;
      const w = ghost.w;
      const h = ghost.h;
      c.clearRect(0, 0, w, h);
      c.save();
      c.globalAlpha = 0.9;
      // the brand-iron: a hot ring on a haft, held over the socket
      c.strokeStyle = alpha(p.goldBright, 0.55);
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(w * 0.5, h * 0.06);
      c.lineTo(w * 0.5, h * 0.36);
      c.stroke();
      sear(c, art, p, w * 0.5, h * 0.62, Math.min(w, h) * 0.25, 'true');
      c.strokeStyle = alpha(p.goldBright, 0.75);
      c.lineWidth = 1.6;
      if (c.setLineDash) c.setLineDash([4, 4]);
      c.beginPath();
      if (c.roundRect) c.roundRect(2, h * 0.34, w - 4, h * 0.62, 999); else c.rect(2, h * 0.34, w - 4, h * 0.62);
      c.stroke();
      if (c.setLineDash) c.setLineDash([]);
      c.restore();
    }

    // ---- layout ----------------------------------------------------------
    function layout() {
      const rootW = Math.max(280, Math.min(880, ctx.root.clientWidth || 720));
      const pb = boxOf(plate);
      if (pb.w > 0 && pb.h > 0 && fit(plate, plateFace, pb.w, pb.h,
        'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;border-radius:5px')) {
        paintPlate();
      }
      const sw = rootW;
      const sh = Math.round(sw * (sw < 470 ? 0.78 : 0.54));
      if (fit(sceneHost, scene, sw, sh, 'width:100%;height:auto;display:block;border-radius:5px')) {
        scene.canvas.setAttribute('aria-hidden', 'false');
        scene.canvas.setAttribute('role', 'img');
      }
      fit(tallyHost, tallyGfx, Math.min(170, Math.max(108, Math.round(rootW * 0.2))), 20, 'display:block');
      for (let i = 0; i < N; i++) {
        const b = boxOf(cards[i].card);
        if (b.w > 0 && b.h > 0) {
          fit(cards[i].card, cards[i].face, b.w, b.h,
            'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;border-radius:6px');
        }
      }
    }

    // ---- interaction -----------------------------------------------------
    function takeTheIron() {
      if (touched) return;
      touched = true;
      endShowing(true);
    }

    function cycleBrand(i) {
      if (ctx.solved) return;
      takeTheIron();
      const before = settledSet();
      if (!branded[i]) { branded[i] = true; liars[i] = false; }
      else if (!liars[i]) liars[i] = true;
      else { branded[i] = false; liars[i] = false; }
      const after = settledSet();
      const to = [];
      if (branded[i]) {
        for (let k = 0; k < inst.statements.length; k++) {
          const st = inst.statements[k];
          if (!before[k] && after[k] && st.speaker !== i && to.indexOf(st.speaker) < 0) to.push(st.speaker);
        }
      }
      reach = branded[i] ? { from: i, to } : null;
      sfx(branded[i] ? (liars[i] ? 'knock' : 'confirm') : 'flip');
      say(branded[i] ? T(liars[i] ? 'sayLies' : 'sayTrue', { name: names[i] }) : T('sayOff', { name: names[i] }));
      if (to.length) say(to.length === 1 ? T('sayReachOne') : T('sayReach', { n: to.length }));
      render('');
    }

    function accuse(i) {
      if (ctx.solved) return;
      takeTheIron();
      culprit = culprit === i ? -1 : i;
      reach = null;
      sfx(culprit === i ? 'confirm' : 'knock');
      say(culprit === i ? T('sayAccuse', { name: names[i] }) : T('sayWithdraw'));
      render('');
    }

    // ---- render ----------------------------------------------------------
    function verdictWords() {
      const parts = names.map((nm, i) => T(!branded[i] ? 'stateNone' : liars[i] ? 'stateLies' : 'stateTrue', { name: nm }));
      return T('sceneAria', { states: parts.join('; ') })
        + (culprit >= 0 ? T('stateCollar', { name: names[culprit] }) : T('stateNoCollar'));
    }

    function render(announce) {
      layout();
      const n = tally();
      paintScene();
      paintTally(n);
      if (scene.canvas) scene.canvas.setAttribute('aria-label', verdictWords());
      tallyText.textContent = n === N ? T('tallyAll') : T('tally', { n });
      for (let i = 0; i < N; i++) {
        const state = !branded[i] ? 'none' : liars[i] ? 'liar' : 'true';
        const b = cards[i].brand;
        b.dataset.state = state;
        b.textContent = T(state === 'none' ? 'brandNone' : state === 'liar' ? 'brandLies' : 'brandTrue');
        let mood = 'ariaWaits';
        if (branded[i]) {
          const broken = saidBy[i].some((st) => statementState(st, branded, liars, culprit) === 'broken');
          mood = broken ? 'ariaBreaks' : (stands(i) ? 'ariaStands' : 'ariaWaits');
        }
        b.setAttribute('aria-label',
          T(state === 'none' ? 'ariaNone' : state === 'liar' ? 'ariaLies' : 'ariaTrue', { name: names[i] })
          + T(mood) + T('ariaBurn'));
        cards[i].card.dataset.brand = state === 'none' ? '' : state;
        cards[i].card.dataset.culprit = culprit === i ? '1' : '0';
        cards[i].acc.setAttribute('aria-pressed', culprit === i ? 'true' : 'false');
        cards[i].acc.setAttribute('aria-label', T('ariaAccuse', { name: names[i] }));
        for (let k = 0; k < cards[i].lines.length; k++) {
          cards[i].lines[k].dataset.state = statementState(saidBy[i][k], branded, liars, culprit);
        }
        paintCard(i);
      }
      verdictBtn.disabled = !!ctx.solved || culprit < 0 || branded.some((b2) => !b2);
      if (announce !== undefined) status.textContent = announce;
    }

    // ---- the showing -----------------------------------------------------
    function endShowing(quiet) {
      if (ghostHost.style.display === 'none') return;
      for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
      motions = [];
      ghostHost.style.display = 'none';
      skipBtn.style.display = 'none';
      if (!quiet) status.textContent = '';
    }

    function showTheWay() {
      if (ctx.solved || touched) return;
      let host;
      let target;
      try {
        host = gridWrap.getBoundingClientRect();
        target = cards[0].brand.getBoundingClientRect();
      } catch (e) { return; }
      if (!host || !target || !target.width) return;
      const size = 46;
      fit(ghostHost, ghost, size, size, 'display:block');
      paintGhost();
      const x = Math.round(target.left - host.left + target.width / 2 - size / 2);
      const y = Math.round(target.top - host.top + target.height / 2 - size / 2);
      ghostHost.style.display = 'block';
      ghostHost.style.transform = `translate(${x}px,${y}px)`;
      skipBtn.style.display = '';
      status.textContent = T('demoSay');
      if (!calm && typeof ghostHost.animate === 'function') {
        const m = ghostHost.animate([
          { transform: `translate(${x}px,${y - 40}px)`, opacity: 0 },
          { transform: `translate(${x}px,${y - 14}px)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${x}px,${y}px)`, opacity: 1, offset: 0.62 },
          { transform: `translate(${x}px,${y}px)`, opacity: 1, offset: 0.86 },
          { transform: `translate(${x}px,${y - 8}px)`, opacity: 0 },
        ], { duration: 2800, easing: 'ease-in-out' });
        motions.push(m);
      }
      later(() => endShowing(false), 3000);
    }

    // ---- wiring ----------------------------------------------------------
    on(clearBtn, 'click', () => {
      if (ctx.solved) return;
      takeTheIron();
      branded.fill(false);
      liars.fill(false);
      culprit = -1;
      reach = null;
      sfx('knock');
      say(T('sayClear'));
      render('');
    });
    on(skipBtn, 'click', () => { takeTheIron(); status.textContent = ''; });
    on(verdictBtn, 'click', () => {
      if (ctx.solved || culprit < 0 || branded.some((b) => !b)) { sfx('deny'); return; }
      takeTheIron();
      say(verdictWords());
      const res = ctx.submit({ culprit, liars: liars.slice() }) || {};
      if (!res.ok) {
        status.textContent = res.near || T('deny');
        if (status.scrollIntoView) status.scrollIntoView({ block: 'nearest' });
      }
    });

    let resizeTimer = 0;
    if (typeof window !== 'undefined' && window.addEventListener) {
      const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = later(() => render(undefined), 120);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));
    }

    if (ctx.solved) {
      clearBtn.disabled = true;
      verdictBtn.disabled = true;
      for (const c of cards) { c.brand.disabled = true; c.acc.disabled = true; }
    }

    say(T('sayOpen', { names: names.join(', '), n: inst.statements.length }));
    render(ctx.solved ? T('solvedLine') : '');
    // a second pass once the grid has really laid out (fonts, wrapping)
    later(() => render(undefined), 60);
    if (!ctx.solved) later(showTheWay, 480);

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        for (const id of timers) clearTimeout(id);
        timers.length = 0;
        for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
        motions = [];
        slabCache.clear();
        ground = null;
        wrap.remove();
      },
    };
  },
};
