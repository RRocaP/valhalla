// 06 — THE JÖTUNVILLUR CIPHER
//
// The historical rune-name cipher ("giant-madness"), read only in 2014: a letter
// is carved as the rune whose NAME ends in that letter's sound. Many letters
// therefore share one rune, and reading is many-to-one in the wrong direction.
//
// FROZEN mapping (docs/LOCKS.md §06), plaintext letter -> carved rune (translit):
//   f->i(fé)  u->r(úr)  þ->s(þurs)  o->s(óss)  r->þ(reið)  k->n(kaun)
//   h->l(hagall)  n->r(nauðr)  i->s(íss)  a->r(ár)  s->l(sól)  t->r(týr)
//   b->n(bjarkan)  m->r(maðr)  l->r(lǫgr)
//
// Inverted, the carved runes expand to:
//   i -> {f}                     (1)
//   þ -> {r}                     (1)
//   n -> {k,b}                   (2)
//   l -> {h,s}                   (2)
//   s -> {þ,o,i}                 (3)
//   r -> {u,n,a,t,m,l}           (6)
// so a four-rune cargo word can carry hundreds of raw letter readings. The
// ship-lexicon carved on the lid is the only thing that collapses them.
//
// Answer: { words: [4 plaintext strings, in manifest order] }.

import { SHARDS } from '../kernel/shards.js';
import { localizeNear } from '../kernel/i18n.js';

const ID = '06-jotunvillur';

// ---- frozen cipher ---------------------------------------------------------

const CIPHER = Object.freeze({
  f: 'i', u: 'r', 'þ': 's', o: 's', r: 'þ', k: 'n', h: 'l', n: 'r',
  i: 's', a: 'r', s: 'l', t: 'r', b: 'n', m: 'r', l: 'r',
});

const RUNE_NAME = Object.freeze({
  f: 'fé', u: 'úr', 'þ': 'þurs', o: 'óss', r: 'reið', k: 'kaun', h: 'hagall',
  n: 'nauðr', i: 'íss', a: 'ár', s: 'sól', t: 'týr', b: 'bjarkan', m: 'maðr', l: 'lǫgr',
});

// carved rune character for each cipher letter (kernel futhark glyphs)
const RUNE_OF = Object.freeze({ i: 'ᛁ', 'þ': 'ᚦ', n: 'ᚾ', l: 'ᛚ', s: 'ᛋ', r: 'ᚱ' });

const LETTERS = Object.freeze(Object.keys(CIPHER));

const PREIMAGE = Object.freeze(LETTERS.reduce((acc, letter) => {
  const c = CIPHER[letter];
  (acc[c] || (acc[c] = [])).push(letter);
  return acc;
}, {}));

// ---- the ship-lexicon carved on the lid (41 words) -------------------------

const LEXICON = Object.freeze([
  ['salt', 'salt'], ['korn', 'grain'], ['silfr', 'silver'], ['ull', 'wool'],
  ['torf', 'turf'], ['hamarr', 'hammer'], ['bast', 'bast rope'], ['lin', 'linen'],
  ['stafn', 'prow'], ['knarr', 'cargo ship'], ['skinn', 'hides'], ['hafr', 'he-goat'],
  ['ostr', 'cheese'], ['mork', 'mark of weight'], ['malt', 'malt'], ['hnot', 'nut'],
  ['hlutr', 'share'], ['farmr', 'cargo'], ['skaut', 'sail-corner'], ['roþr', 'rowing'],
  ['þorn', 'thorn'], ['þrall', 'thrall'], ['haf', 'open sea'], ['floti', 'fleet'],
  ['askr', 'ash-wood'], ['naust', 'boathouse'], ['brim', 'surf'], ['botn', 'hold-bottom'],
  ['burþr', 'burden'], ['hilmir', 'helm-lord'], ['stafr', 'stave'], ['runar', 'runes'],
  ['tolf', 'twelve'], ['fimm', 'five'], ['hals', 'bow-neck'], ['rif', 'reef'],
  ['kista', 'chest'], ['malmr', 'ore'], ['horn', 'horn'], ['blot', 'offering'],
  ['laukr', 'leek'],
]);

const WORDS = Object.freeze(LEXICON.map((e) => e[0]));

// ---- pure helpers ----------------------------------------------------------

export function encipher(word) {
  if (typeof word !== 'string' || !word.length) return null;
  let out = '';
  for (const ch of word) {
    const c = CIPHER[ch];
    if (!c) return null;
    out += c;
  }
  return out;
}

/** raw letter-level readings of a carved word, before the lexicon filters them */
export function expansionCount(cipherword) {
  let n = 1;
  for (const c of cipherword) n *= (PREIMAGE[c] || []).length;
  return n;
}

function lexiconPreimages(cipherword) {
  return WORDS.filter((w) => encipher(w) === cipherword);
}

const CIPHER_ROWS = Object.freeze(LETTERS.map((l) => [l, CIPHER[l], RUNE_OF[CIPHER[l]], RUNE_NAME[l]]));

// ---- generator -------------------------------------------------------------

function attempt(rng, minCollide) {
  const pick = rng.shuffle(WORDS).slice(0, 4);
  const cipher = pick.map(encipher);
  if (new Set(cipher).size !== 4) return null;
  for (const c of cipher) if (lexiconPreimages(c).length !== 1) return null;
  const collisions = cipher.map(expansionCount);
  if (collisions.filter((n) => n >= 30).length < minCollide) return null;
  if (new Set(pick.map((w) => w.length)).size < 3) return null;
  return { pick, cipher, collisions };
}

function makePuzzle(rng) {
  let found = null;
  for (let i = 0; i < 300 && !found; i++) found = attempt(rng, 2);
  for (let i = 0; i < 300 && !found; i++) found = attempt(rng, 1);
  while (!found) found = attempt(rng, 0);
  const { cipher, collisions } = found;
  return {
    cipher,                                   // 4 carved words in cipher translit
    runes: cipher.map((c) => [...c].map((ch) => RUNE_OF[ch])),
    collisions,                               // raw readings per word, pre-lexicon
    lexicon: LEXICON.map((e) => [e[0], e[1]]),
    table: CIPHER_ROWS,
    total: collisions.reduce((a, b) => a * b, 1),
  };
}

function solve(instance) {
  return { words: instance.cipher.map((c) => lexiconPreimages(c)[0]) };
}

function verify(instance, answer) {
  if (!instance || !Array.isArray(instance.cipher)) return { ok: false };
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
  const words = answer.words;
  if (!Array.isArray(words) || words.length !== instance.cipher.length) return { ok: false };
  const lex = new Set(instance.lexicon.map((e) => e[0]));
  let right = 0;
  let offLid = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (typeof w !== 'string') return { ok: false };
    if (!lex.has(w)) { offLid++; continue; }
    if (encipher(w) === instance.cipher[i]) right++;
  }
  if (right === words.length) return { ok: true };
  if (offLid) return { ok: false, near: `${offLid} of your words are carved on no board of this lid.` };
  return { ok: false, near: `${right} of the four ring true. The rest are strangers.` };
}

function wrongAnswers(instance) {
  const truth = solve(instance).words;
  const out = [];
  const push = (words) => {
    if (words.some((w, i) => w !== truth[i])) out.push({ words: words.slice() });
  };
  // 1-2: rotations of the true manifest
  push([truth[1], truth[2], truth[3], truth[0]]);
  push([truth[3], truth[2], truth[1], truth[0]]);
  // 3: first pair swapped
  push([truth[1], truth[0], truth[2], truth[3]]);
  // 4-6: raw letter-level readings that are not on the lid
  const lex = new Set(instance.lexicon.map((e) => e[0]));
  for (let k = 0; k < instance.cipher.length && out.length < 9; k++) {
    const decoys = truth.slice();
    const c = instance.cipher[k];
    outer:
    for (let pos = 0; pos < c.length; pos++) {
      for (const letter of PREIMAGE[c[pos]] || []) {
        const cand = truth[k].slice(0, pos) + letter + truth[k].slice(pos + 1);
        if (cand !== truth[k] && !lex.has(cand)) { decoys[k] = cand; break outer; }
      }
    }
    push(decoys);
  }
  // 7+: lid words of the right length but the wrong reading
  for (const [w] of instance.lexicon) {
    if (out.length >= 12) break;
    if (w.length === truth[0].length && w !== truth[0]) push([w, truth[1], truth[2], truth[3]]);
  }
  return out.slice(0, 10);
}

// ---- canonical near-lines --------------------------------------------------
// `verify` stays pure and returns English (CONTRACT §4.1 amendment); these two
// builders restate its two templates verbatim so `i18n.nearMap` can key every
// line it can emit. Four carved words, so offLid runs 1..4 and right runs 0..3.

const NEAR_OFF_LID = (n) => `${n} of your words are carved on no board of this lid.`;
const NEAR_RING = (n) => `${n} of the four ring true. The rest are strangers.`;

export const NEAR_LINES = Object.freeze([
  ...[1, 2, 3, 4].map(NEAR_OFF_LID),
  ...[0, 1, 2, 3].map(NEAR_RING),
]);

// ---- view ------------------------------------------------------------------

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
// Artifact-tongue law: the lid's Old-Norse words keep their tongue in every
// language — only their GLOSSES localize.
const BOARD_EN = {
  ask: 'Each carved word hides a cargo word — the rune says only how its own name ends. Read all four.',
  law: 'Giant-madness: a letter is cut as the rune whose NAME ends in that '
    + 'letter’s sound — so ár, úr, týr, nauðr, maðr and lǫgr all come out as ᚱ. Reading '
    + 'backwards, one carved rune can stand for six letters. Four cargo words are carved '
    + 'below; give each one the ship-word from the lid that enciphers to it.',
  ariaRows: 'Carved cargo words',
  readings: '{n} readings',
  keysHead: 'Rune keys — spell the true letters',
  lexHead: 'The lid’s ship-lexicon',
  submit: 'Read the manifest',
  draftIdle: 'Spell a reading with the rune keys, or take a word from the lid.',
  fits: '(fits the carving)',
  unfits: '(does not fit)',
  ariaKey: 'letter {letter}, carved as {name}',
  ariaBack: 'erase last letter',
  ariaLex: '{word} — {gloss}',
  notePick: 'Word {n} of the manifest read as “{word}” ({gloss}).',
  noteTurn: 'Turned to the {place} carved word: {runes} — {n} raw readings.',
  noteManifest: 'Manifest read: {words}.',
  noteOpen: 'Four cargo words, carved in giant-madness. Each rune stands for every letter whose rune-name ends in it.',
  noteRaw: 'Raw readings before the lid narrows them: {list}.',
  fallback: 'That manifest does not read.',
  places: ['first', 'second', 'third', 'fourth'],
};

/** English glosses, read straight off the frozen lexicon so they cannot drift */
const EN_GLOSS = Object.freeze(LEXICON.reduce((acc, [w, g]) => { acc[w] = g; return acc; }, {}));

// A rune-stick (rúnakefli): the carved word rides a real birch lath — pale
// scraped face, grain ticks, chamfered lit top edge, end-grain caps — and the
// runes are CUT into it at chisel weight, blood pigment surviving in the
// groove under the tar core. (loop-2: interactive runes never hairline.)
function runeStrip(art, chars, size, opts = {}) {
  const P = art.palette;
  const gap = Math.round(size * 0.32);
  const w = chars.length * (size + gap) + gap;
  const h = Math.round(size * 1.25);
  const { canvas, ctx } = art.makeCanvas(w, h);
  // lath face: pale birch over oak
  const face = ctx.createLinearGradient(0, 0, 0, h);
  face.addColorStop(0, 'rgba(233,220,195,.5)');
  face.addColorStop(0.45, 'rgba(233,220,195,.34)');
  face.addColorStop(1, 'rgba(183,169,140,.26)');
  ctx.fillStyle = P.oakLight;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = face;
  ctx.fillRect(0, 0, w, h);
  // grain ticks + lenticel flecks
  for (let i = 0; i < Math.round(w / 9); i++) {
    const gx = ((i * 73) % (w - 6)) + 3;
    const gy = ((i * 37) % (h - 8)) + 4;
    ctx.strokeStyle = i % 3 ? 'rgba(12,9,6,.14)' : 'rgba(90,58,30,.3)';
    ctx.lineWidth = i % 3 ? 0.7 : 1.1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 4 + (i % 5), gy + ((i % 2) ? 0.6 : -0.5));
    ctx.stroke();
  }
  // chamfer: lit top arris, tar under-edge, end-grain caps
  ctx.strokeStyle = 'rgba(233,220,195,.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(1, 1.4); ctx.lineTo(w - 1, 1.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(12,9,6,.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, h - 1); ctx.lineTo(w, h - 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(12,9,6,.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  for (const ex of [0, w - Math.max(3, size * 0.14)]) {
    ctx.fillStyle = 'rgba(90,58,30,.5)';
    ctx.fillRect(ex, 1, Math.max(3, size * 0.14), h - 2);
  }
  // the cut: blood pigment in the groove, tar core over it
  chars.forEach((ch, i) => {
    const x = gap + i * (size + gap);
    ctx.save();
    ctx.globalAlpha = 0.55;
    art.drawRune(ctx, ch, x - size * 0.02, size * 0.1, size, { color: P.blood, weight: size / 4.6 });
    ctx.restore();
    art.drawRune(ctx, ch, x, size * 0.12, size, {
      color: opts.color || P.tar, weight: size / 5.5,
    });
  });
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
  // Board copy resolves against ctx.lang; en falls through to the frozen source
  // (and #autotest pins the shell to en, so the driver label contracts hold).
  const lang = ctx.lang || 'en';
  const LOC = I18N[lang] || {};
  const L = LOC.board || {};
  const T = (key, params) => {
    let s = key in L ? L[key] : BOARD_EN[key];
    if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
    return s;
  };
  const PLACE = (Array.isArray(L.places) && L.places.length === 4) ? L.places : BOARD_EN.places;
  const glossOf = (w) => (L.gloss && L.gloss[w]) || EN_GLOSS[w] || w;
  const nearOf = (near) => localizeNear(near, LOC.nearMap || {});
  // every listener is tracked so unmount can take them all back down
  const bound = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); bound.push([el, type, fn]); };
  const unbind = () => { for (const [el, type, fn] of bound) el.removeEventListener(type, fn); bound.length = 0; };
  const wrap = document.createElement('div');
  wrap.className = 'ow-lock ow-jotun';
  const styleEl = document.createElement('style');
  styleEl.textContent = `
  .ow-jotun{display:flex;flex-direction:column;gap:.7rem;color:${P.bone};font-family:'Iowan Old Style',Palatino,Georgia,serif}
  .ow-jotun .rows{display:flex;flex-direction:column;gap:.4rem}
  .ow-jotun .row{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;background:${P.oakDeep};
    border:1px solid ${P.tar};border-radius:4px;padding:.35rem .5rem;min-height:44px}
  .ow-jotun .row[aria-selected="true"]{outline:2px solid ${P.goldBright};outline-offset:1px}
  .ow-jotun .row .slot{margin-left:auto;font-family:ui-monospace,Menlo,monospace;color:${P.goldBright};min-width:7ch;text-align:right}
  .ow-jotun .row .n{color:${P.boneDim};font-size:.78rem}
  .ow-jotun .keys,.ow-jotun .slate{display:flex;flex-wrap:wrap;gap:.3rem}
  /* the lid's lexicon is a slate: cold stone under chalk-dusted words */
  .ow-jotun .slate{padding:.55rem;border-radius:5px;border:1px solid ${P.tar};
    background:
      radial-gradient(120% 90% at 30% 0%,rgba(63,109,158,.08),rgba(63,109,158,0) 60%),
      repeating-linear-gradient(101deg,rgba(233,220,195,.028) 0 2px,rgba(12,9,6,0) 2px 7px),
      linear-gradient(173deg,#181a1c 0%,#101112 55%,#0b0c0d 100%);
    box-shadow:inset 0 2px 5px rgba(12,9,6,.85),inset 0 -1px 0 rgba(238,207,109,.08),0 1px 0 rgba(233,220,195,.05)}
  .ow-jotun button:not(.btn-carved){background:${P.oak};color:${P.bone};border:1px solid ${P.oakLight};border-radius:3px;
    min-height:44px;min-width:44px;padding:.2rem .5rem;font:inherit;cursor:pointer;
    box-shadow:inset 0 2px 3px rgba(12,9,6,.5),inset 0 -1px 0 rgba(238,207,109,.12),0 2px 3px rgba(12,9,6,.45)}
  .ow-jotun button:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow-jotun button[disabled]:not(.btn-carved){opacity:.4;cursor:default}
  .ow-jotun .slate button{min-width:0;font-size:.85rem;background:rgba(58,36,18,.82)}
  .ow-jotun .slate button.hit{border-color:${P.gold};color:${P.goldBright}}
  .ow-jotun .draft{font-family:ui-monospace,Menlo,monospace;color:${P.boneDim};min-height:1.4em}
  .ow-jotun h4{margin:.2rem 0 0;font-size:.82rem;letter-spacing:.08em;text-transform:uppercase;color:${P.boneDim}}
  .ow-jotun .law{margin:0;font-size:.86rem;line-height:1.45;color:${P.boneDim};max-width:64ch}
  .ow-jotun .tell{margin:0;min-height:1.3em;font-size:.9rem;color:${P.ember};scroll-margin:28px}
  /* the carved plate: one plain sentence saying what the lock asks, always visible */
  .ow-jotun .ask{margin:0;font-size:.92rem;line-height:1.4;color:${P.goldBright};max-width:64ch;
    background:linear-gradient(180deg,${P.oak},${P.oakDeep});border:1px solid ${P.tar};
    border-left:3px solid ${P.gold};border-radius:4px;padding:.5rem .65rem;
    box-shadow:inset 0 1px 0 rgba(233,220,195,.1),0 1px 2px rgba(12,9,6,.5)}
  /* the shell sets \`#app *{min-width:0}\`, which outranks a bare class rule and
     flattens every touch target; these re-assert the 44 px floor at equal weight */
  #app .ow-jotun button{min-width:44px}
  #app .ow-jotun .slate button{min-width:44px}
  #app .ow-jotun .row{min-height:44px}`;
  wrap.appendChild(styleEl);

  const ask = document.createElement('p');
  ask.className = 'ask';
  ask.textContent = T('ask');
  wrap.appendChild(ask);

  const law = document.createElement('p');
  law.className = 'law';
  law.textContent = T('law');
  wrap.appendChild(law);

  const rows = document.createElement('div');
  rows.className = 'rows';
  rows.setAttribute('role', 'listbox');
  rows.setAttribute('aria-label', T('ariaRows'));
  wrap.appendChild(rows);

  const picks = [null, null, null, null];
  let draft = '';
  let sel = 0;
  const rowEls = [];

  instance.cipher.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'option');
    row.tabIndex = 0;
    row.appendChild(runeStrip(art, instance.runes[i], 26));
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = T('readings', { n: instance.collisions[i] });
    row.appendChild(n);
    const slot = document.createElement('span');
    slot.className = 'slot';
    slot.textContent = '·····';
    row.appendChild(slot);
    on(row, 'click', () => select(i));
    on(row, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
    });
    rows.appendChild(row);
    rowEls.push({ row, slot });
  });

  const draftEl = document.createElement('div');
  draftEl.className = 'draft';
  draftEl.setAttribute('aria-live', 'polite');
  wrap.appendChild(draftEl);

  const h1 = document.createElement('h4'); h1.textContent = T('keysHead');
  wrap.appendChild(h1);
  const keys = document.createElement('div');
  keys.className = 'keys';
  wrap.appendChild(keys);

  const h2 = document.createElement('h4'); h2.textContent = T('lexHead');
  wrap.appendChild(h2);
  const slate = document.createElement('div');
  slate.className = 'slate';
  wrap.appendChild(slate);

  const send = document.createElement('button');
  send.className = 'btn-carved'; // one primary-action language: the carved gold plate
  send.type = 'button';
  send.textContent = T('submit');
  send.disabled = true;
  wrap.appendChild(send);

  // The shell's near-line sits below the fold on the taller locks; every lock
  // also answers a wrong reading where the player's eye already is.
  const tell = document.createElement('p');
  tell.className = 'tell';
  tell.setAttribute('aria-live', 'polite');
  wrap.appendChild(tell);

  for (const [letter] of instance.table.map((r) => [r[0]])) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', T('ariaKey', { letter, name: RUNE_NAME[letter] }));
    b.appendChild(runeStrip(art, [RUNE_OF[CIPHER[letter]]], 22));
    const cap = document.createElement('div');
    cap.style.cssText = `font-size:.7rem;color:${P.boneDim}`;
    cap.textContent = letter;
    b.appendChild(cap);
    on(b, 'click', () => { draft += letter; audio.ui('tick'); refresh(); });
    keys.appendChild(b);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '⌫';
  back.setAttribute('aria-label', T('ariaBack'));
  on(back, 'click', () => { draft = draft.slice(0, -1); audio.ui('tick'); refresh(); });
  keys.appendChild(back);

  const slateEls = instance.lexicon.map(([w]) => {
    // artifact tongue: the carved word `w` never translates; its gloss does
    const gloss = glossOf(w);
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = w;
    b.title = gloss;
    b.setAttribute('aria-label', T('ariaLex', { word: w, gloss }));
    on(b, 'click', () => {
      picks[sel] = w;
      draft = '';
      audio.ui('knock');
      ctx.note(T('notePick', { n: sel + 1, word: w, gloss }));
      tell.textContent = '';
      // move the hand on to the next carving still waiting for a reading
      const nextOpen = picks.findIndex((pk, i) => pk === null && i !== sel);
      if (nextOpen >= 0) sel = nextOpen;
      refresh();
    });
    slate.appendChild(b);
    return { b, w };
  });

  function select(i) {
    sel = i;
    draft = '';
    audio.ui('slide');
    ctx.note(T('noteTurn', {
      place: PLACE[i],
      runes: instance.cipher[i].split('').map((c) => RUNE_NAME_OF(c)).join(' '),
      n: instance.collisions[i],
    }));
    refresh();
  }
  const RUNE_NAME_OF = (c) => ({ i: 'íss', 'þ': 'þurs', n: 'nauðr', l: 'lǫgr', s: 'sól', r: 'reið' }[c] || c);

  function refresh() {
    const target = instance.cipher[sel];
    rowEls.forEach((r, i) => {
      r.row.setAttribute('aria-selected', String(i === sel));
      r.slot.textContent = picks[i] || '·'.repeat(instance.cipher[i].length);
    });
    const enc = encipher(draft);
    const fits = draft.length <= target.length && enc !== null && target.startsWith(enc);
    draftEl.textContent = draft
      ? `${draft}  →  ${enc || '?'}   ${fits ? T('fits') : T('unfits')}`
      : T('draftIdle');
    draftEl.style.color = draft ? (fits ? P.goldBright : P.blood) : P.boneDim;
    for (const s of slateEls) {
      const hit = encipher(s.w) === target;
      s.b.classList.toggle('hit', hit);
      s.b.setAttribute('aria-current', hit ? 'true' : 'false');
    }
    send.disabled = picks.some((p) => p === null);
  }

  on(send, 'click', () => {
    if (picks.some((p) => p === null)) return;
    ctx.note(T('noteManifest', { words: picks.join(' · ') }));
    const res = ctx.submit({ words: picks.slice() }) || {};
    if (!res.ok) { tell.textContent = nearOf(res.near) || T('fallback'); if (tell.scrollIntoView) tell.scrollIntoView({ block: 'nearest' }); }
  });

  const onKey = (e) => {
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (e.key >= '1' && e.key <= '4') { select(Number(e.key) - 1); e.preventDefault(); return; }
    if (e.key === 'Backspace') { draft = draft.slice(0, -1); refresh(); e.preventDefault(); return; }
    if (CIPHER[e.key.toLowerCase()]) { draft += e.key.toLowerCase(); refresh(); e.preventDefault(); }
  };
  on(wrap, 'keydown', onKey);

  root.appendChild(wrap);
  ctx.note(T('noteOpen'));
  ctx.note(T('noteRaw', { list: instance.collisions.join(', ') }));
  if (ctx.solved) {
    solve(instance).words.forEach((w, i) => { picks[i] = w; });
    send.disabled = true;
  }
  refresh();

  return {
    unmount() {
      unbind();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields below; `nearMap` keys are the canonical English near-lines.
// The lid's Old-Norse words and the rune-names keep their tongue everywhere —
// only their glosses and the instructions around them localize.
const I18N = {
  es: {
    title: 'La Cifra Jötunvillur',
    epigraph: 'Cada letra lleva el nombre de otra. El tallador lo llamó locura de gigantes.',
    hints: [
      'Aquí una runa no es una letra. Es toda letra cuyo nombre de runa acaba en ese sonido.',
      'Seis letras acaban en el sonido de reið; esa es la runa apretada. Solo la lista de palabras de la tapa la aclara.',
      'Toma primero la talla más corta — su árbol de lecturas es delgado, y enseña la mano que talló las demás.',
    ],
    nearMap: {
      [NEAR_OFF_LID(1)]: '1 de tus palabras no está tallada en tabla alguna de esta tapa.',
      [NEAR_OFF_LID(2)]: '2 de tus palabras no están talladas en tabla alguna de esta tapa.',
      [NEAR_OFF_LID(3)]: '3 de tus palabras no están talladas en tabla alguna de esta tapa.',
      [NEAR_OFF_LID(4)]: 'Ninguna de tus palabras está tallada en tabla alguna de esta tapa.',
      [NEAR_RING(0)]: 'Ninguna de las cuatro suena verdadera. Todas son extrañas.',
      [NEAR_RING(1)]: '1 de las cuatro suena verdadera. Las demás son extrañas.',
      [NEAR_RING(2)]: '2 de las cuatro suenan verdaderas. Las demás son extrañas.',
      [NEAR_RING(3)]: '3 de las cuatro suenan verdaderas. La que falta es extraña.',
    },
    board: {
      ask: 'Cada palabra tallada esconde una palabra de carga — la runa solo dice cómo acaba su propio nombre. Lee las cuatro.',
      law: 'Locura de gigantes: una letra se talla como la runa cuyo NOMBRE acaba en el '
        + 'sonido de esa letra — así ár, úr, týr, nauðr, maðr y lǫgr salen todas como ᚱ. Leída '
        + 'al revés, una sola runa tallada puede valer por seis letras. Abajo hay cuatro palabras '
        + 'de carga talladas; da a cada una la palabra de barco de la tapa que se cifra en ella.',
      ariaRows: 'Palabras de carga talladas',
      readings: '{n} lecturas',
      keysHead: 'Teclas rúnicas — deletrea las letras verdaderas',
      lexHead: 'El léxico de barco de la tapa',
      submit: 'Leer el manifiesto',
      draftIdle: 'Deletrea una lectura con las teclas rúnicas, o toma una palabra de la tapa.',
      fits: '(encaja en la talla)',
      unfits: '(no encaja)',
      ariaKey: 'letra {letter}, tallada como {name}',
      ariaBack: 'borrar la última letra',
      ariaLex: '{word} — {gloss}',
      notePick: 'Palabra {n} del manifiesto leída como “{word}” ({gloss}).',
      noteTurn: 'La mano pasa a la {place} palabra tallada: {runes} — {n} lecturas en bruto.',
      noteManifest: 'Manifiesto leído: {words}.',
      noteOpen: 'Cuatro palabras de carga, talladas en locura de gigantes. Cada runa vale por toda letra cuyo nombre rúnico acaba en ella.',
      noteRaw: 'Lecturas en bruto antes de que la tapa las estreche: {list}.',
      fallback: 'Ese manifiesto no se lee.',
      places: ['primera', 'segunda', 'tercera', 'cuarta'],
      gloss: {
        salt: 'sal', korn: 'grano', silfr: 'plata', ull: 'lana',
        torf: 'turba', hamarr: 'martillo', bast: 'soga de tilo', lin: 'lino',
        stafn: 'roda de proa', knarr: 'nave de carga', skinn: 'pieles', hafr: 'macho cabrío',
        ostr: 'queso', mork: 'marco de peso', malt: 'malta', hnot: 'nuez',
        hlutr: 'parte', farmr: 'carga', skaut: 'puño de vela', 'roþr': 'boga',
        'þorn': 'espina', 'þrall': 'siervo', haf: 'mar abierta', floti: 'flota',
        askr: 'madera de fresno', naust: 'cobertizo de naves', brim: 'rompiente', botn: 'fondo de bodega',
        'burþr': 'fardo', hilmir: 'señor del yelmo', stafr: 'asta', runar: 'runas',
        tolf: 'doce', fimm: 'cinco', hals: 'cuello de proa', rif: 'rizo',
        kista: 'arca', malmr: 'mena', horn: 'cuerno', blot: 'ofrenda',
        laukr: 'puerro',
      },
    },
  },
  ca: {
    title: 'La Xifra Jötunvillur',
    epigraph: 'Cada lletra duu el nom d’una altra. El tallador en deia follia de gegants.',
    hints: [
      'Aquí una runa no és una lletra. És tota lletra el nom rúnic de la qual acaba en aquell so.',
      'Sis lletres acaben en el so de reið; aquella és la runa atapeïda. Només la llista de mots de la tapa l’aclareix.',
      'Pren primer la talla més curta — el seu arbre de lectures és prim, i ensenya la mà que va tallar les altres.',
    ],
    nearMap: {
      [NEAR_OFF_LID(1)]: '1 dels teus mots no és tallat en cap post d’aquesta tapa.',
      [NEAR_OFF_LID(2)]: '2 dels teus mots no són tallats en cap post d’aquesta tapa.',
      [NEAR_OFF_LID(3)]: '3 dels teus mots no són tallats en cap post d’aquesta tapa.',
      [NEAR_OFF_LID(4)]: 'Cap dels teus mots no és tallat en cap post d’aquesta tapa.',
      [NEAR_RING(0)]: 'Cap de les quatre no sona vertadera. Totes són estranyes.',
      [NEAR_RING(1)]: '1 de les quatre sona vertadera. Les altres són estranyes.',
      [NEAR_RING(2)]: '2 de les quatre sonen vertaderes. Les altres són estranyes.',
      [NEAR_RING(3)]: '3 de les quatre sonen vertaderes. La que manca és estranya.',
    },
    board: {
      ask: 'Cada mot tallat amaga un mot de càrrega — la runa només diu com acaba el seu propi nom. Llegeix-los tots quatre.',
      law: 'Follia de gegants: una lletra es talla com la runa el NOM de la qual acaba en el '
        + 'so d’aquella lletra — així ár, úr, týr, nauðr, maðr i lǫgr surten totes com ᚱ. Llegida '
        + 'a l’inrevés, una sola runa tallada pot valer per sis lletres. A sota hi ha quatre mots '
        + 'de càrrega tallats; dona a cadascun el mot de nau de la tapa que s’hi xifra.',
      ariaRows: 'Mots de càrrega tallats',
      readings: '{n} lectures',
      keysHead: 'Tecles rúniques — lletreja les lletres vertaderes',
      lexHead: 'El lèxic de nau de la tapa',
      submit: 'Llegir el manifest',
      draftIdle: 'Lletreja una lectura amb les tecles rúniques, o pren un mot de la tapa.',
      fits: '(encaixa a la talla)',
      unfits: '(no encaixa)',
      ariaKey: 'lletra {letter}, tallada com {name}',
      ariaBack: 'esborrar la darrera lletra',
      ariaLex: '{word} — {gloss}',
      notePick: 'Mot {n} del manifest llegit com a “{word}” ({gloss}).',
      noteTurn: 'La mà passa al {place} mot tallat: {runes} — {n} lectures en brut.',
      noteManifest: 'Manifest llegit: {words}.',
      noteOpen: 'Quatre mots de càrrega, tallats en follia de gegants. Cada runa val per tota lletra el nom rúnic de la qual hi acaba.',
      noteRaw: 'Lectures en brut abans que la tapa les estrengui: {list}.',
      fallback: 'Aquest manifest no es llegeix.',
      places: ['primer', 'segon', 'tercer', 'quart'],
      gloss: {
        salt: 'sal', korn: 'gra', silfr: 'argent', ull: 'llana',
        torf: 'torba', hamarr: 'martell', bast: 'corda de tell', lin: 'lli',
        stafn: 'roda de proa', knarr: 'nau de càrrega', skinn: 'pells', hafr: 'boc',
        ostr: 'formatge', mork: 'marc de pes', malt: 'malt', hnot: 'nou',
        hlutr: 'part', farmr: 'càrrega', skaut: 'puny de vela', 'roþr': 'remada',
        'þorn': 'espina', 'þrall': 'serf', haf: 'mar oberta', floti: 'flota',
        askr: 'fusta de freixe', naust: 'cobert de naus', brim: 'rompent', botn: 'fons de bodega',
        'burþr': 'fardell', hilmir: 'senyor de l’elm', stafr: 'asta', runar: 'runes',
        tolf: 'dotze', fimm: 'cinc', hals: 'coll de proa', rif: 'ris',
        kista: 'arca', malmr: 'mena', horn: 'corn', blot: 'ofrena',
        laukr: 'porro',
      },
    },
  },
};

export default {
  id: ID,
  ordinal: 6,
  tier: 2,
  title: 'The Jötunvillur Cipher',
  epigraph: 'Every letter wears another’s name. The carver called it giant-madness.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS[ID] }),

  difficulty: { searchSpace: 1.2e7, minSteps: 17, estMinutes: 9 },

  hints: [
    'A rune here is not a letter. It is every letter whose rune-name ends in that sound.',
    'Six letters end in the sound of reið; that rune is the crowded one. Only the lid’s word-list can thin it.',
    'Take the shortest carving first — its tree of readings is thin, and it teaches the hand that cut the rest.',
  ],

  i18n: I18N,

  mount,
};
