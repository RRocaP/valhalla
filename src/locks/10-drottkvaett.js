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

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
  // every listener is tracked so unmount can take them all back down
  const bound = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); bound.push([el, type, fn]); };
  const unbind = () => { for (const [el, type, fn] of bound) el.removeEventListener(type, fn); bound.length = 0; };
  const wrap = document.createElement('div');
  wrap.className = 'ow-lock ow-drott';
  const style = document.createElement('style');
  style.textContent = `
  .ow-drott{display:flex;flex-direction:column;gap:.55rem;color:${P.bone};
    font-family:'Iowan Old Style',Palatino,Georgia,serif}
  .ow-drott .verse{display:flex;flex-direction:column;gap:.35rem}
  .ow-drott .long{display:flex;align-items:stretch;gap:.35rem;background:${P.oakDeep};
    border:1px solid ${P.tar};border-radius:4px;padding:.3rem .35rem}
  .ow-drott .stave{display:flex;align-items:center;justify-content:center;min-width:34px}
  .ow-drott .slot{flex:1;min-height:44px;display:flex;align-items:center;padding:.2rem .45rem;
    border:1px dashed ${P.oakLight};border-radius:3px;font-size:.92rem;cursor:pointer;background:transparent}
  .ow-drott .slot.filled{border-style:solid;background:${P.oak}}
  .ow-drott .slot.lit{border-color:${P.gold};box-shadow:inset 0 0 0 1px ${P.gold}}
  .ow-drott .slot:focus-visible,.ow-drott button:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow-drott .tray{display:flex;flex-direction:column;gap:.25rem}
  .ow-drott .frag{display:flex;align-items:center;gap:.5rem;text-align:left;background:${P.oak};
    color:${P.bone};border:1px solid ${P.oakLight};border-radius:3px;min-height:44px;
    padding:.25rem .5rem;font:inherit;font-size:.92rem;cursor:grab;width:100%}
  .ow-drott .frag[aria-pressed="true"]{border-color:${P.goldBright};color:${P.goldBright};background:${P.oakLight}}
  .ow-drott .frag .syl{font-family:ui-monospace,Menlo,monospace;font-size:.72rem;color:${P.boneDim}}
  .ow-drott .send{background:${P.gold};color:${P.tar};font-weight:600;border:none;border-radius:3px;
    min-height:44px;font:inherit;cursor:pointer}
  .ow-drott .send[disabled]{opacity:.45;cursor:default}
  .ow-drott h4{margin:.15rem 0 0;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:${P.boneDim}}
  .ow-drott .glint{font-size:.72rem;color:${P.boneDim};min-height:1.1em}`;
  wrap.appendChild(style);

  const N = instance.fragments.length;
  const slotOf = new Array(N).fill(-1);   // fragment -> slot (0..7) or -1 in tray
  let held = null;

  const head = document.createElement('h4');
  head.textContent = 'The hasp is stamped with four staves — one leads each long line';
  wrap.appendChild(head);

  const verse = document.createElement('div');
  verse.className = 'verse';
  wrap.appendChild(verse);

  const slotEls = [];
  for (let line = 0; line < N / 2; line++) {
    const row = document.createElement('div');
    row.className = 'long';
    const st = document.createElement('div');
    st.className = 'stave';
    const { canvas, ctx: c2 } = art.makeCanvas(26, 32);
    art.drawRune(c2, instance.staveRunes[line], 2, 2, 26, { color: P.goldBright, weight: 'heavy' });
    canvas.setAttribute('aria-hidden', 'true');
    st.appendChild(canvas);
    st.title = `stave ${instance.staves[line]}`;
    row.appendChild(st);
    for (const half of [0, 1]) {
      const slot = document.createElement('div');
      const index = line * 2 + half;
      slot.className = 'slot';
      slot.tabIndex = 0;
      slot.dataset.slot = String(index);
      slot.setAttribute('role', 'button');
      slot.setAttribute('aria-label', `long line ${line + 1}, ${half ? 'even' : 'odd'} half-line, stave ${instance.staves[line]}`);
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
      row.appendChild(slot);
      slotEls.push(slot);
    }
    verse.appendChild(row);
  }

  const glint = document.createElement('div');
  glint.className = 'glint';
  glint.setAttribute('aria-live', 'polite');
  wrap.appendChild(glint);

  const trayHead = document.createElement('h4');
  trayHead.textContent = 'Loose half-lines — six syllables each';
  wrap.appendChild(trayHead);
  const tray = document.createElement('div');
  tray.className = 'tray';
  wrap.appendChild(tray);

  const fragEls = instance.fragments.map((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'frag';
    b.draggable = true;
    b.setAttribute('aria-pressed', 'false');
    const t = document.createElement('span');
    t.textContent = f.text;
    const s = document.createElement('span');
    s.className = 'syl';
    s.textContent = `${f.syllables.length}`;
    b.appendChild(t);
    b.appendChild(s);
    on(b, 'click', () => {
      held = held === i ? null : i;
      audio.ui('tick');
      refresh();
    });
    on(b, 'dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); held = i; });
    return b;
  });

  const send = document.createElement('button');
  send.className = 'send';
  send.type = 'button';
  send.textContent = 'Speak the verse';
  send.disabled = true;
  wrap.appendChild(send);

  function place(slot) {
    if (held === null) {
      const sitting = slotOf.findIndex((s) => s === slot);
      if (sitting >= 0) {
        slotOf[sitting] = -1;
        audio.ui('slide');
        ctx.note(`Lifted “${instance.fragments[sitting].text}” back to the loose staves.`);
        refresh();
      }
      return;
    }
    const evicted = slotOf.findIndex((s) => s === slot);
    if (evicted >= 0) slotOf[evicted] = -1;
    slotOf[held] = slot;
    const line = Math.floor(slot / 2) + 1;
    ctx.note(`“${instance.fragments[held].text}” set as the ${slot % 2 ? 'even' : 'odd'} half of long line ${line} (stave ${instance.staves[line - 1]}).`);
    held = null;
    audio.ui('knock');
    refresh();
  }

  function currentLines() {
    const lines = [];
    for (let line = 0; line < N / 2; line++) {
      const a = slotOf.findIndex((s) => s === line * 2);
      const b = slotOf.findIndex((s) => s === line * 2 + 1);
      lines.push([a, b]);
    }
    return lines;
  }

  function refresh() {
    fragEls.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(held === i));
      if (slotOf[i] === -1 && b.parentElement !== tray) tray.appendChild(b);
      if (slotOf[i] !== -1) {
        const target = slotEls[slotOf[i]];
        if (b.parentElement !== target) target.appendChild(b);
      }
    });
    let standing = 0;
    const lines = currentLines();
    lines.forEach((pair, line) => {
      const ok = pair[0] >= 0 && pair[1] >= 0
        && longLineOk(instance.fragments[pair[0]], instance.fragments[pair[1]], instance.staves[line]);
      if (ok) standing++;
      slotEls[line * 2].classList.toggle('lit', ok);
      slotEls[line * 2 + 1].classList.toggle('lit', ok);
      slotEls[line * 2].classList.toggle('filled', pair[0] >= 0);
      slotEls[line * 2 + 1].classList.toggle('filled', pair[1] >= 0);
    });
    const full = lines.every((p) => p[0] >= 0 && p[1] >= 0);
    glint.textContent = full
      ? `${standing} of four long lines ring true.`
      : 'Set every half-line to hear the staves join.';
    send.disabled = !full;
  }

  on(send, 'click', () => {
    const lines = currentLines();
    if (lines.some((p) => p[0] < 0 || p[1] < 0)) return;
    ctx.note(`Verse spoken:\n${lines.map((p) => `${instance.fragments[p[0]].text}, ${instance.fragments[p[1]].text};`).join('\n')}`);
    ctx.submit({ lines });
  });

  root.appendChild(wrap);
  ctx.note('Court metre: six syllables to a half-line; two props alliterate in the odd half and the even half’s first stress joins them; the odd half rhymes on its coda alone, the even on vowel and coda both.');
  ctx.note(`Staves stamped on the hasp, in order: ${instance.staves.join(' · ')}.`);
  instance.fragments.forEach((f, i) => ctx.note(`Half-line ${i + 1}: “${f.text}” (${f.syllables.length} syllables).`));
  if (ctx.solved) {
    solve(instance).lines.forEach((pair, line) => {
      slotOf[pair[0]] = line * 2;
      slotOf[pair[1]] = line * 2 + 1;
    });
    send.disabled = true;
  }
  refresh();

  return { unmount() { unbind(); wrap.remove(); } };
}

export default {
  id: ID,
  ordinal: 10,
  tier: 3,
  title: 'The Dróttkvætt Lines',
  epigraph: 'Court metre is a lock with three wards: count, stave, and rhyme.',

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

  mount,
};
