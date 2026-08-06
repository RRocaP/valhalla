// Dev-only fixture locks — full Lock interface (docs/CONTRACT.md §4), trivial
// puzzles. NEVER imported from shipping code paths; wired only by dev.html.
//
// Fixture 3 deliberately uses ordinal 3 so it exercises the real duel path
// (JARL BOURJ, per docs/JARLS.md's frozen ordinal->challenger mapping) end to
// end through the dev harness, without needing a real lock file.

function makeEchoLock() {
  return {
    id: 'fx-01-echo',
    ordinal: 1,
    tier: 1,
    title: 'The Echo Chamber',
    epigraph: 'A number is spoken. Speak it back.',
    makePuzzle(rng) {
      return { n: rng.int(10) };
    },
    solve(instance) {
      return { n: instance.n };
    },
    verify(instance, answer) {
      if (!answer || typeof answer.n !== 'number') return { ok: false };
      if (answer.n === instance.n) return { ok: true };
      return { ok: false, near: Math.abs(answer.n - instance.n) === 1 ? 'One off — listen again.' : undefined };
    },
    wrongAnswers(instance) {
      const out = [];
      for (let i = 0; i < 10 && out.length < 6; i++) if (i !== instance.n) out.push({ n: i });
      return out;
    },
    shard() { return { rune: 'ᚠ', value: 8 }; },
    difficulty: { searchSpace: 10, minSteps: 1, estMinutes: 1 },
    hints: ['It is less than ten.', 'It is not negative.', 'Count on your fingers.'],
    mount(ctx) {
      const { root, instance, submit, note, solved } = ctx;
      root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
      const label = document.createElement('p');
      label.textContent = solved ? `Solved: ${instance.n}` : 'Pick the number that echoes:';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px';
      const handlers = [];
      for (let i = 0; i < 10; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(i);
        btn.disabled = solved;
        btn.style.cssText = 'min-width:44px;min-height:44px;border-radius:6px;border:1px solid #5a3a1e;background:#3a2412;color:#e9dcc3;cursor:pointer;font-size:1rem';
        const onClick = () => submit({ n: i });
        btn.addEventListener('click', onClick);
        handlers.push([btn, onClick]);
        row.append(btn);
      }
      wrap.append(label, row);
      root.append(wrap);
      note('The echo chamber awaits a number 0 through 9.');
      return {
        unmount() {
          handlers.forEach(([btn, fn]) => btn.removeEventListener('click', fn));
          root.innerHTML = '';
        },
      };
    },
  };
}

function makeHueLock() {
  const HUES = ['red', 'blue', 'green', 'gold', 'bone'];
  return {
    id: 'fx-02-hue',
    ordinal: 2,
    tier: 1,
    title: 'The Hue Ward',
    epigraph: 'One color is true. The rest are dye.',
    makePuzzle(rng) {
      return { target: rng.pick(HUES) };
    },
    solve(instance) {
      return { hue: instance.target };
    },
    verify(instance, answer) {
      if (!answer || typeof answer.hue !== 'string') return { ok: false };
      return { ok: answer.hue === instance.target };
    },
    wrongAnswers(instance) {
      return HUES.filter((h) => h !== instance.target).map((hue) => ({ hue })).concat([{ hue: 'purple' }, { hue: 'silver' }]);
    },
    shard() { return { rune: 'ᚢ', value: 9 }; },
    difficulty: { searchSpace: 5, minSteps: 1, estMinutes: 1 },
    hints: ['It is not red.', 'It is not blue.', 'It is warm, not cool, not neutral.'],
    mount(ctx) {
      const { root, instance, submit, note, solved } = ctx;
      root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
      const label = document.createElement('p');
      label.textContent = solved ? `Solved: ${instance.target}` : 'Pick the true hue:';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:320px';
      const handlers = [];
      HUES.forEach((hue) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = hue;
        btn.disabled = solved;
        btn.style.cssText = 'min-width:44px;min-height:44px;padding:0 14px;border-radius:6px;border:1px solid #5a3a1e;background:#3a2412;color:#e9dcc3;cursor:pointer;font-size:1rem';
        const onClick = () => submit({ hue });
        btn.addEventListener('click', onClick);
        handlers.push([btn, onClick]);
        row.append(btn);
      });
      wrap.append(label, row);
      root.append(wrap);
      note('Five hues are shown; one is true.');
      return {
        unmount() {
          handlers.forEach(([btn, fn]) => btn.removeEventListener('click', fn));
          root.innerHTML = '';
        },
      };
    },
  };
}

function makeTriadLock() {
  return {
    id: 'fx-03-triad',
    ordinal: 3, // duel ordinal (JARL BOURJ) — exercises dare/yield via dev.html
    tier: 2,
    title: 'The Triad Latch',
    epigraph: 'Three choices, in order, never repeated by accident.',
    makePuzzle(rng) {
      return { seq: [rng.int(3), rng.int(3), rng.int(3)] };
    },
    solve(instance) {
      return { seq: instance.seq.slice() };
    },
    verify(instance, answer) {
      if (!answer || !Array.isArray(answer.seq) || answer.seq.length !== 3) return { ok: false };
      const ok = answer.seq.every((v, i) => v === instance.seq[i]);
      if (ok) return { ok: true };
      const matches = answer.seq.filter((v, i) => v === instance.seq[i]).length;
      return { ok: false, near: `${matches} of 3 in the right place.` };
    },
    wrongAnswers(instance) {
      const out = [];
      for (let a = 0; a < 3 && out.length < 6; a++) {
        for (let b = 0; b < 3 && out.length < 6; b++) {
          for (let c = 0; c < 3 && out.length < 6; c++) {
            const seq = [a, b, c];
            if (!seq.every((v, i) => v === instance.seq[i])) out.push({ seq });
          }
        }
      }
      return out;
    },
    shard() { return { rune: 'ᚦ', value: 13 }; },
    difficulty: { searchSpace: 27, minSteps: 3, estMinutes: 2 },
    hints: ['The first choice is not the largest.', 'No two adjacent choices repeat.', 'Try low, high, middle.'],
    mount(ctx) {
      const { root, instance, submit, note, solved } = ctx;
      root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
      const label = document.createElement('p');
      label.textContent = solved ? `Solved: ${instance.seq.join(', ')}` : 'Choose three in order (0, 1, or 2 each):';
      wrap.append(label);
      const picks = [];
      [0, 1, 2].forEach((slot) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px';
        [0, 1, 2].forEach((v) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = String(v);
          btn.disabled = solved;
          btn.style.cssText = 'min-width:44px;min-height:44px;border-radius:6px;border:1px solid #5a3a1e;background:#3a2412;color:#e9dcc3;cursor:pointer;font-size:1rem';
          btn.addEventListener('click', () => {
            picks[slot] = v;
            if (picks.length === 3 && picks.every((x) => x !== undefined)) submit({ seq: picks.slice() });
          });
          row.append(btn);
        });
        wrap.append(row);
      });
      root.append(wrap);
      note('Three slots, each 0 through 2.');
      return { unmount() { root.innerHTML = ''; } };
    },
  };
}

export const FIXTURE_LOCKS = [makeEchoLock(), makeHueLock(), makeTriadLock()];
