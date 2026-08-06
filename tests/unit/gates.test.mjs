// The gate infrastructure is the project's acceptance authority, so it is gated here too.
// Each case builds a throwaway tree of synthetic locks in the OS temp dir, runs the real
// scripts/verify.mjs against it, and asserts the exit code and the attributed failure.
// Nothing here touches the repo tree. No dependencies beyond node: builtins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function runGates(locks, args = ['--partial', '--seeds', '5'], indexHtml) {
  const base = mkdtempSync(join(tmpdir(), 'oathwood-gates-'));
  try {
    mkdirSync(join(base, 'scripts'), { recursive: true });
    mkdirSync(join(base, 'src/kernel'), { recursive: true });
    mkdirSync(join(base, 'src/locks'), { recursive: true });
    copyFileSync(join(ROOT, 'scripts/verify.mjs'), join(base, 'scripts/verify.mjs'));
    for (const f of ['rng.js', 'shards.js']) {
      copyFileSync(join(ROOT, 'src/kernel', f), join(base, 'src/kernel', f));
    }
    for (const [name, body] of Object.entries(locks)) writeFileSync(join(base, 'src/locks', name), body);
    if (indexHtml !== undefined) writeFileSync(join(base, 'index.html'), indexHtml);
    try {
      const out = execFileSync(process.execPath, [join(base, 'scripts/verify.mjs'), ...args], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

// a minimal lock that satisfies every gate; `patch` swaps one fragment to break exactly one thing
const LOCK = (id, ord, rune, value) => `
export default {
  id: '${id}', ordinal: ${ord}, tier: 1, title: 't', epigraph: 'e',
  makePuzzle(rng) { return { n: rng.int(50) + 1 }; },
  solve(inst) { return { pick: inst.n, word: 'skald' }; },
  verify(inst, a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return { ok: false };
    return { ok: a.pick === inst.n && a.word === 'skald' };
  },
  wrongAnswers(inst) { return [1,2,3,4,5,6].map((k) => ({ pick: inst.n + k, word: 'skald' })); },
  shard() { return { rune: '${rune}', value: ${value} }; },
  difficulty: { searchSpace: 1e3, minSteps: 99, estMinutes: 99 },
  hints: ['a','b','c'],
  mount() { return { unmount() {} }; },
};`;

const L1 = (patch = (s) => s) => ({ '01-runerow.js': patch(LOCK('01-runerow', 1, 'ᚠ', 8)) });
const expect = (r, code, ...must) => {
  assert.equal(r.code, code, `exit ${r.code}, want ${code}\n${r.out}`);
  for (const m of must) assert.ok(r.out.includes(m), `missing ${JSON.stringify(m)} in:\n${r.out}`);
};

test('a correct lock passes every gate', () => {
  expect(runGates(L1()), 0, 'GATES GREEN');
});

// ---- purity gate (CONTRACT §7.5) ----

test('Date.now inside makePuzzle is a purity violation', () => {
  const r = runGates(L1((s) => s.replace('return { n:', 'const z = Date.now(); return { n:')));
  expect(r, 1, 'purity/make', 'Date.now');
});

test('Math.random inside makePuzzle is a purity violation', () => {
  const r = runGates(L1((s) => s.replace('return { n:', 'const z = Math.random(); return { n:')));
  expect(r, 1, 'purity/make', 'Math.random');
});

test('a DOM read names the exact access', () => {
  const r = runGates(L1((s) => s.replace('return { n:', 'const z = document.querySelector; return { n:')));
  expect(r, 1, 'document.querySelector');
});

test('sabotaged globals do not leak past a failing lock', () => {
  const r = runGates({
    '01-runerow.js': LOCK('01-runerow', 1, 'ᚠ', 8).replace('return { n:', 'const z = Date.now(); return { n:'),
    '02-bismer.js': LOCK('02-bismer', 2, 'ᚢ', 9),
    '03-beacons.js': LOCK('03-beacons', 3, 'ᚦ', 13),
  });
  expect(r, 1, 'purity violation', '02-bismer: solver 5/5', '03-beacons: solver 5/5');
});

// ---- answer gates (CONTRACT §7.1, §7.2) ----

test('six identical wrong answers do not satisfy "six wrong answers"', () => {
  const r = runGates(L1((s) => s.replace('[1,2,3,4,5,6]', '[1,1,1,1,1,1]')));
  expect(r, 1, 'distinct wrong answers, got 1');
});

test('a wrong answer that verifies true fails the rejection gate', () => {
  const r = runGates(L1((s) => s.replace("a.pick === inst.n && a.word === 'skald'", "a.word === 'skald'")));
  expect(r, 1, 'rejection-gate');
});

test('a lock that accepts a mutated answer fails the mutation gate', () => {
  // verify ignores `pick`, so the declared wrongs (different word) are still rejected and
  // only a mutation of `pick` can expose the hole
  const r = runGates({
    '01-runerow.js': LOCK('01-runerow', 1, 'ᚠ', 8)
      .replace("a.pick === inst.n && a.word === 'skald'", "a.word === 'skald'")
      .replace("({ pick: inst.n + k, word: 'skald' })", "({ pick: inst.n, word: 'w' + k })"),
  });
  expect(r, 1, 'mutation-gate');
});

test('verify throwing on a wrong answer is attributable, not a crash', () => {
  const r = runGates({
    '01-runerow.js': LOCK('01-runerow', 1, 'ᚠ', 8)
      .replace('return { ok: a.pick', "if (a.word === 'BOOM') throw new Error('boom');\n    return { ok: a.pick")
      .replace("({ pick: inst.n + k, word: 'skald' })", "({ pick: inst.n + k, word: k === 3 ? 'BOOM' : 'skald' })"),
  });
  expect(r, 1, 'totality', 'verify threw on a wrong answer');
});

test('an unstable instance fails the determinism gate', () => {
  const r = runGates(L1((s) => s.replace('makePuzzle(rng) { return { n: rng.int(50) + 1 };',
    'makePuzzle(rng) { globalThis.__c = (globalThis.__c || 0) + 1; return { n: rng.int(50) + globalThis.__c };')));
  expect(r, 1, 'determinism');
});

test('a scalar answer is mutated, not a crash', () => {
  // strict-mode assignment onto a primitive used to kill the whole run
  const r = runGates({
    '01-runerow.js': `
export default {
  id: '01-runerow', ordinal: 1, tier: 1, title: 't', epigraph: 'e',
  makePuzzle(rng) { return { n: rng.int(50) + 1 }; },
  solve(inst) { return inst.n; },
  verify(inst, a) { return { ok: a === inst.n }; },
  wrongAnswers(inst) { return [1,2,3,4,5,6].map((k) => inst.n + k); },
  shard() { return { rune: 'ᚠ', value: 8 }; },
  difficulty: { searchSpace: 1e3, minSteps: 99, estMinutes: 99 },
  hints: ['a','b','c'], mount() { return { unmount() {} }; },
};`,
  });
  expect(r, 0, 'GATES GREEN');
  assert.ok(Number(r.out.match(/mutants \d+\/(\d+)/)[1]) >= 1, `no mutants generated:\n${r.out}`);
});

test('a rune-string answer is mutated inside its own alphabet', () => {
  const r = runGates({
    '01-runerow.js': `
export default {
  id: '01-runerow', ordinal: 1, tier: 1, title: 't', epigraph: 'e',
  makePuzzle(rng) { return { i: rng.int(3) }; },
  solve(inst) { return ['ᚠᚢᚦ','ᚱᚴᚼ','ᚾᛁᛅ'][inst.i]; },
  verify(inst, a) { return { ok: a === ['ᚠᚢᚦ','ᚱᚴᚼ','ᚾᛁᛅ'][inst.i] }; },
  wrongAnswers() { return ['a','b','c','d','e','f']; },
  shard() { return { rune: 'ᚠ', value: 8 }; },
  difficulty: { searchSpace: 1e3, minSteps: 99, estMinutes: 99 },
  hints: ['a','b','c'], mount() { return { unmount() {} }; },
};`,
  });
  expect(r, 0, 'GATES GREEN');
  assert.ok(Number(r.out.match(/mutants \d+\/(\d+)/)[1]) >= 5, `too few mutants:\n${r.out}`);
});

test('a shard that disagrees with the frozen table fails', () => {
  const r = runGates(L1((s) => s.replace("value: 8", "value: 7")));
  expect(r, 1, 'shard');
});

// ---- suite integrity ----

test('an unparsable lock is attributable and the other locks still run', () => {
  const r = runGates({
    '01-runerow.js': LOCK('01-runerow', 1, 'ᚠ', 8),
    '02-bismer.js': 'export default { this is not javascript',
  }, ['--partial', '--seeds', '3']);
  expect(r, 1, '[02-bismer] import', '01-runerow: solver 3/3');
});

test('duplicate ordinals are caught', () => {
  const r = runGates({
    '01-runerow.js': LOCK('01-runerow', 1, 'ᚠ', 8),
    '01-other.js': LOCK('01-other', 1, 'ᚠ', 8),
  }, ['--partial', '--seeds', '3']);
  expect(r, 1, 'duplicate ordinal');
});

test('fifteen lock files with ordinal 15 absent is not a full suite', () => {
  const ids = ['01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork', '06-jotunvillur',
    '07-tafl', '08-hacksilver', '09-sunstone', '10-drottkvaett', '11-skerry', '12-veitsla',
    '13-althing', '14-bindrune'];
  const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚱ', 'ᚴ', 'ᚼ', 'ᚾ', 'ᛁ', 'ᛅ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛘ', 'ᛚ'];
  const vals = [8, 9, 13, 11, 11, 9, 13, 5, 12, 8, 5, 5, 1, 2];
  const locks = {};
  ids.forEach((id, i) => { locks[`${id}.js`] = LOCK(id, i + 1, runes[i], vals[i]); });
  locks['01-extra.js'] = LOCK('01-extra', 1, 'ᚠ', 8);
  expect(runGates(locks, ['--seeds', '2']), 1, 'missing ordinal(s): 15');
});

test('string-typed difficulty does not satisfy the floors', () => {
  const r = runGates(L1((s) => s.replace('minSteps: 99, estMinutes: 99', "minSteps: '99', estMinutes: '99'")));
  expect(r, 1, 'difficulty');
});

// ---- argument handling (a typo must never produce a green run) ----

test('--seeds with no value refuses to run', () => {
  expect(runGates(L1(), ['--partial', '--seeds']), 2, 'positive integer');
});

test('--seeds 0 refuses to run', () => {
  expect(runGates(L1(), ['--partial', '--seeds', '0']), 2, 'positive integer');
});

test('--only with no value refuses to run', () => {
  expect(runGates(L1(), ['--partial', '--only']), 2, '--only needs');
});

test('--only matching no lock is not green', () => {
  expect(runGates(L1(), ['--partial', '--seeds', '3', '--only', '99']), 1, 'no lock files matched');
});

// ---- bundle gate (CONTRACT §1 sound-track exception, §2 xmlns exemption, §7.6) ----

const bundle = (html) => runGates(L1(), ['--partial', '--seeds', '2'], html);
const B64 = Buffer.from('x'.repeat(300)).toString('base64');

test('inline SVG xmlns is not an external URL', () => {
  expect(bundle('<html><body><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg></body></html>'), 0, 'GATES GREEN');
});

test('xmlns inside a script string is not an external URL', () => {
  expect(bundle(`<html><script>var s='<svg xmlns="http://www.w3.org/2000/svg"/>';</script></html>`), 0, 'GATES GREEN');
});

test('an inlined jpeg data URI passes', () => {
  expect(bundle(`<html><style>.a{background:url(data:image/jpeg;base64,${B64})}</style></html>`), 0, 'GATES GREEN');
});

test('the two permitted relative audio fetches pass', () => {
  expect(bundle(`<html><script>new Audio('./music.mp3');fetch('credits.mp3')</script></html>`), 0, 'GATES GREEN');
});

test('an html comment holding a URL is exempt', () => {
  expect(bundle('<html><!-- see https://example.com/spec --><body>x</body></html>'), 0, 'GATES GREEN');
});

test('a real external URL fails', () => {
  expect(bundle(`<html><script>fetch('https://cdn.example.com/x.js')</script></html>`), 1, 'external');
});

test('a URL smuggled after a parenthesised data URI fails', () => {
  expect(bundle('<html><style>.a{background:url(data:image/svg+xml,%3Csvg(x)%3E)}</style>'
    + '<script>fetch("http://evil.example/x")</script></html>'), 1, 'external');
});

// the three fixtures below are strings the gate must REJECT; they are never executed
test('direct eval fails', () => {
  expect(bundle(`<html><script>eval('1+1')</script></html>`), 1, 'eval');
});

test('indirect eval fails', () => {
  expect(bundle(`<html><script>(0,eval)('1+1')</script></html>`), 1, 'eval');
});

test('new Function fails', () => {
  expect(bundle(`<html><script>new Function('return 1')()</script></html>`), 1, 'eval');
});
