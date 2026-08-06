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

  mount(ctx) {
    const art = ctx.art;
    const p = art.palette;
    const inst = ctx.instance;
    const self = this;

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
    const names = inst.names;

    // ---- state -----------------------------------------------------------
    const truth = ctx.solved ? self.solve(inst) : null;
    const liars = truth ? truth.liars.slice() : new Array(N).fill(false);
    const branded = new Array(N).fill(!!truth);
    let culprit = truth ? truth.culprit : -1;

    // ---- frame -----------------------------------------------------------
    const wrap = node('div', `display:grid;gap:12px;font-family:${SERIF};color:${p.bone}`);
    const style = node('style');
    style.textContent = `
      .ow13-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${p.gold};border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
      .ow13-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow13-act[disabled]{opacity:.45;cursor:default}
      .ow13-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:9px}
      .ow13-card{border:1px solid ${p.oakLight};border-radius:4px;background:${p.oakDeep};padding:10px 12px;display:grid;gap:8px}
      .ow13-card[data-brand="true"]{border-color:${p.gold}}
      .ow13-card[data-brand="liar"]{border-color:${p.blood}}
      .ow13-card[data-culprit="1"]{box-shadow:inset 0 0 0 2px ${p.blood}}
      .ow13-name{font-size:16px;color:${p.bone};letter-spacing:.04em}
      .ow13-said{margin:0;font-size:13.5px;color:${p.boneDim};line-height:1.45}
      .ow13-row{display:flex;gap:7px;flex-wrap:wrap}
      .ow13-brand,.ow13-culprit{font-family:${SERIF};font-size:13px;color:${p.boneDim};background:none;
        border:1px solid ${p.oakLight};border-radius:999px;padding:8px 12px;min-height:44px;cursor:pointer}
      .ow13-brand:focus-visible,.ow13-culprit:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow13-brand[data-state="true"]{border-color:${p.gold};color:${p.goldBright}}
      .ow13-brand[data-state="liar"]{border-color:${p.blood};color:${p.bone};background:${p.blood}}
      .ow13-culprit[aria-pressed="true"]{border-color:${p.blood};color:${p.bone};background:${p.blood}}
    `;
    wrap.append(style);

    const rock = art.makeCanvas(660, 400);
    rock.canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:4px';
    rock.canvas.setAttribute('role', 'img');

    const law = node('p', `margin:0;font-size:12.5px;color:${p.boneDim};max-width:64ch`,
      'A man is all of a piece: a truth-teller\'s every word is true, a liar\'s every word is false. '
      + 'Brand all nine, then name the peace-breaker.');

    const grid = node('div');
    grid.className = 'ow13-grid';

    const cards = [];
    for (let i = 0; i < N; i++) {
      const card = node('div');
      card.className = 'ow13-card';
      const name = node('div', null, names[i]);
      name.className = 'ow13-name';
      const said = node('div', 'display:grid;gap:4px');
      for (const st of inst.statements.filter((s) => s.speaker === i)) {
        const line = node('p', null, `“${st.text}”`);
        line.className = 'ow13-said';
        said.append(line);
      }
      const row = node('div');
      row.className = 'ow13-row';
      const brand = node('button', null, 'unbranded');
      brand.className = 'ow13-brand';
      brand.type = 'button';
      on(brand, 'click', () => cycleBrand(i));
      const acc = node('button', null, 'peace-breaker');
      acc.className = 'ow13-culprit';
      acc.type = 'button';
      acc.setAttribute('aria-pressed', 'false');
      on(acc, 'click', () => accuse(i));
      row.append(brand, acc);
      card.append(name, said, row);
      grid.append(card);
      cards.push({ card, brand, acc });
    }

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center');
    const clearBtn = node('button', null, 'Unbrand them all');
    const verdictBtn = node('button', null, 'Give the verdict');
    for (const b of [clearBtn, verdictBtn]) { b.className = 'ow13-act'; b.type = 'button'; }
    actions.append(clearBtn, verdictBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim}`);
    status.setAttribute('aria-live', 'polite');

    wrap.append(rock.canvas, law, grid, actions, status);
    ctx.root.append(wrap);

    // ---- interaction -----------------------------------------------------
    function cycleBrand(i) {
      if (ctx.solved) return;
      if (!branded[i]) { branded[i] = true; liars[i] = false; }
      else if (!liars[i]) liars[i] = true;
      else { branded[i] = false; liars[i] = false; }
      sfx('flip');
      say(`${names[i]} is branded ${branded[i] ? (liars[i] ? 'a liar' : 'true') : 'unbranded'}.`);
      render('');
    }
    function accuse(i) {
      if (ctx.solved) return;
      culprit = culprit === i ? -1 : i;
      sfx(culprit === i ? 'confirm' : 'knock');
      say(culprit === i ? `${names[i]} is named the peace-breaker.` : 'The accusation is withdrawn.');
      render('');
    }

    // ---- painting --------------------------------------------------------
    function paint() {
      const c = rock.ctx;
      const W = rock.w;
      const H = rock.h;
      c.clearRect(0, 0, W, H);
      art.paintWood(c, W, H, 1303);
      art.paintPanel(c, 6, 6, W - 12, H - 12);
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) / 2 - 62;

      c.save();
      c.strokeStyle = p.oakLight;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = p.boneDim;
      c.font = `13px ${SERIF}`;
      c.textAlign = 'center';
      c.fillText('the law-rock', cx, cy + 5);
      c.restore();

      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const x = cx + Math.cos(a) * R;
        const y = cy + Math.sin(a) * R;
        const colour = !branded[i] ? p.oakLight : liars[i] ? p.blood : p.gold;
        if (i === culprit) art.glow(c, x, y, 30, p.blood, 0.55);
        c.save();
        c.beginPath();
        c.arc(x, y, 15, 0, Math.PI * 2);
        c.fillStyle = p.oakDeep;
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = colour;
        c.stroke();
        c.fillStyle = branded[i] ? p.bone : p.boneDim;
        c.font = `13px ${SERIF}`;
        c.textAlign = 'center';
        const label = names[i];
        const ly = y + (Math.sin(a) < -0.3 ? -24 : 30);
        c.fillText(label, x, ly);
        if (branded[i]) {
          c.fillStyle = colour;
          c.font = `12px ${SERIF}`;
          c.fillText(liars[i] ? 'lies' : 'true', x, y + 4);
        }
        c.restore();
      }
    }

    function verdictWords() {
      const parts = names.map((nm, i) => `${nm}: ${branded[i] ? (liars[i] ? 'lies' : 'true') : 'unbranded'}`);
      return `${parts.join('; ')}. ${culprit >= 0 ? `Named peace-breaker: ${names[culprit]}.` : 'No peace-breaker is named.'}`;
    }

    function render(announce) {
      paint();
      rock.canvas.setAttribute('aria-label', verdictWords());
      for (let i = 0; i < N; i++) {
        const state = !branded[i] ? 'none' : liars[i] ? 'liar' : 'true';
        cards[i].brand.dataset.state = state;
        cards[i].brand.textContent = state === 'none' ? 'unbranded' : state === 'liar' ? 'lies' : 'speaks true';
        cards[i].brand.setAttribute('aria-label', `${names[i]} is ${state === 'none' ? 'unbranded' : state === 'liar' ? 'branded a liar' : 'branded a truth-teller'}. Change the brand.`);
        cards[i].card.dataset.brand = state === 'none' ? '' : state;
        cards[i].card.dataset.culprit = culprit === i ? '1' : '0';
        cards[i].acc.setAttribute('aria-pressed', culprit === i ? 'true' : 'false');
        cards[i].acc.setAttribute('aria-label', `Name ${names[i]} the peace-breaker.`);
      }
      verdictBtn.disabled = !!ctx.solved || culprit < 0 || branded.some((b) => !b);
      if (announce !== undefined) status.textContent = announce;
    }

    on(clearBtn, 'click', () => {
      if (ctx.solved) return;
      branded.fill(false);
      liars.fill(false);
      culprit = -1;
      sfx('knock');
      say('Every brand is struck off; the rock stands unjudged.');
      render('');
    });
    on(verdictBtn, 'click', () => {
      if (ctx.solved || culprit < 0 || branded.some((b) => !b)) { sfx('deny'); return; }
      say(verdictWords());
      const res = ctx.submit({ culprit, liars: liars.slice() }) || {};
      if (!res.ok) status.textContent = res.near || 'The rock will not have that verdict.';
    });

    if (ctx.solved) {
      clearBtn.disabled = true;
      verdictBtn.disabled = true;
      for (const c of cards) { c.brand.disabled = true; c.acc.disabled = true; }
    }

    say(`Nine at the law-rock: ${names.join(', ')}. ${inst.statements.length} statements were made.`);
    render(ctx.solved ? 'The verdict stands.' : '');

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        wrap.remove();
      },
    };
  },
};
