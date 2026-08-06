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

// ---- view ------------------------------------------------------------------

function runeStrip(art, chars, size, opts = {}) {
  const gap = Math.round(size * 0.32);
  const { canvas, ctx } = art.makeCanvas(chars.length * (size + gap) + gap, size * 1.25);
  chars.forEach((ch, i) => {
    art.drawRune(ctx, ch, gap + i * (size + gap), size * 0.12, size, {
      color: opts.color || art.palette.bone, weight: 'heavy',
    });
  });
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
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
  .ow-jotun button{background:${P.oak};color:${P.bone};border:1px solid ${P.oakLight};border-radius:3px;
    min-height:44px;min-width:44px;padding:.2rem .5rem;font:inherit;cursor:pointer}
  .ow-jotun button:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow-jotun button[disabled]{opacity:.4;cursor:default}
  .ow-jotun .slate button{min-width:0;font-size:.85rem}
  .ow-jotun .slate button.hit{border-color:${P.gold};color:${P.goldBright}}
  .ow-jotun .draft{font-family:ui-monospace,Menlo,monospace;color:${P.boneDim};min-height:1.4em}
  .ow-jotun .send{background:${P.gold};color:${P.tar};font-weight:600}
  .ow-jotun h4{margin:.2rem 0 0;font-size:.82rem;letter-spacing:.08em;text-transform:uppercase;color:${P.boneDim}}
  </style>`;

  const rows = document.createElement('div');
  rows.className = 'rows';
  rows.setAttribute('role', 'listbox');
  rows.setAttribute('aria-label', 'Carved cargo words');
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
    row.appendChild(runeStrip(art, instance.runes[i], 26, { color: P.goldBright }));
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = `${instance.collisions[i]} readings`;
    row.appendChild(n);
    const slot = document.createElement('span');
    slot.className = 'slot';
    slot.textContent = '·····';
    row.appendChild(slot);
    row.addEventListener('click', () => select(i));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
    });
    rows.appendChild(row);
    rowEls.push({ row, slot });
  });

  const draftEl = document.createElement('div');
  draftEl.className = 'draft';
  draftEl.setAttribute('aria-live', 'polite');
  wrap.appendChild(draftEl);

  const h1 = document.createElement('h4'); h1.textContent = 'Rune keys — spell the true letters';
  wrap.appendChild(h1);
  const keys = document.createElement('div');
  keys.className = 'keys';
  wrap.appendChild(keys);

  const h2 = document.createElement('h4'); h2.textContent = 'The lid’s ship-lexicon';
  wrap.appendChild(h2);
  const slate = document.createElement('div');
  slate.className = 'slate';
  wrap.appendChild(slate);

  const send = document.createElement('button');
  send.className = 'send';
  send.textContent = 'Read the manifest';
  send.disabled = true;
  wrap.appendChild(send);

  for (const [letter] of instance.table.map((r) => [r[0]])) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `letter ${letter}, carved as ${RUNE_NAME[letter]}`);
    b.appendChild(runeStrip(art, [RUNE_OF[CIPHER[letter]]], 20));
    const cap = document.createElement('div');
    cap.style.cssText = `font-size:.7rem;color:${P.boneDim}`;
    cap.textContent = letter;
    b.appendChild(cap);
    b.addEventListener('click', () => { draft += letter; audio.ui('tick'); refresh(); });
    keys.appendChild(b);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '⌫';
  back.setAttribute('aria-label', 'erase last letter');
  back.addEventListener('click', () => { draft = draft.slice(0, -1); audio.ui('tick'); refresh(); });
  keys.appendChild(back);

  const slateEls = instance.lexicon.map(([w, gloss]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = w;
    b.title = gloss;
    b.setAttribute('aria-label', `${w} — ${gloss}`);
    b.addEventListener('click', () => {
      picks[sel] = w;
      draft = '';
      audio.ui('knock');
      ctx.note(`Word ${sel + 1} of the manifest read as “${w}” (${gloss}).`);
      refresh();
    });
    slate.appendChild(b);
    return { b, w };
  });

  function select(i) {
    sel = i;
    draft = '';
    audio.ui('slide');
    ctx.note(`Turned to the ${['first', 'second', 'third', 'fourth'][i]} carved word: ${instance.cipher[i].split('').map((c) => RUNE_NAME_OF(c)).join(' ')} — ${instance.collisions[i]} raw readings.`);
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
      ? `${draft}  →  ${enc || '?'}   ${fits ? '(fits the carving)' : '(does not fit)'}`
      : 'Spell a reading with the rune keys, or take a word from the lid.';
    draftEl.style.color = draft ? (fits ? P.goldBright : P.blood) : P.boneDim;
    for (const s of slateEls) {
      const hit = encipher(s.w) === target;
      s.b.classList.toggle('hit', hit);
      s.b.setAttribute('aria-current', hit ? 'true' : 'false');
    }
    send.disabled = picks.some((p) => p === null);
  }

  send.addEventListener('click', () => {
    if (picks.some((p) => p === null)) return;
    ctx.note(`Manifest read: ${picks.join(' · ')}.`);
    ctx.submit({ words: picks.slice() });
  });

  const onKey = (e) => {
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (e.key >= '1' && e.key <= '4') { select(Number(e.key) - 1); e.preventDefault(); return; }
    if (e.key === 'Backspace') { draft = draft.slice(0, -1); refresh(); e.preventDefault(); return; }
    if (CIPHER[e.key.toLowerCase()]) { draft += e.key.toLowerCase(); refresh(); e.preventDefault(); }
  };
  wrap.addEventListener('keydown', onKey);

  root.appendChild(wrap);
  ctx.note('Four cargo words, carved in giant-madness. Each rune stands for every letter whose rune-name ends in it.');
  ctx.note(`Raw readings before the lid narrows them: ${instance.collisions.join(', ')}.`);
  if (ctx.solved) {
    solve(instance).words.forEach((w, i) => { picks[i] = w; });
    send.disabled = true;
  }
  refresh();

  return {
    unmount() {
      wrap.removeEventListener('keydown', onKey);
      wrap.remove();
    },
  };
}

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

  mount,
};
