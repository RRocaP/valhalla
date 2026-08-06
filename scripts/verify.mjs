// OATHWOOD deterministic gates (docs/CONTRACT.md §7, gates 1–6).
// Usage: node scripts/verify.mjs [--partial] [--seeds N] [--only 04]
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rng } from '../src/kernel/rng.js';
import { SHARDS } from '../src/kernel/shards.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PARTIAL = args.includes('--partial');
// a flag's value, or null when absent/missing (never let a typo silently weaken the run)
const flagValue = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return null;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? null : v;
};
const SEEDS = args.includes('--seeds') ? Number(flagValue('--seeds')) : 200;
const ONLY = flagValue('--only');
if (!Number.isInteger(SEEDS) || SEEDS < 1) {
  console.error('verify: --seeds needs a positive integer');
  process.exit(2);
}
if (args.includes('--only') && !ONLY) {
  console.error('verify: --only needs a lock prefix, e.g. --only 04');
  process.exit(2);
}

// minSteps / estMinutes floors per ordinal (docs/LOCKS.md)
// ENTRY-CURVE AMENDMENT (2026-08-07): the estMinutes floors for 02–05 drop by
// one each (3/4/5/6 -> 2/3/4/5) so the gentler gauntlet-I instances can declare
// honest times. minSteps floors are unchanged, and both columns stay
// non-decreasing across all fifteen. Keep this table in lockstep with
// docs/LOCKS.md.
const FLOORS = {
  1: [6, 2], 2: [8, 2], 3: [10, 3], 4: [12, 4], 5: [14, 5],
  6: [16, 8], 7: [18, 10], 8: [20, 12], 9: [22, 13], 10: [24, 15],
  11: [26, 16], 12: [28, 18], 13: [30, 20], 14: [32, 22], 15: [34, 25],
};

const LOCK_RE = /^(\d{2})-[a-z0-9-]+\.js$/;
const files = readdirSync(join(ROOT, 'src/locks')).filter((f) => LOCK_RE.test(f)).sort()
  .filter((f) => !ONLY || f.startsWith(ONLY));

const failures = [];
const report = { when: new Date().toISOString(), seeds: SEEDS, locks: {}, failures };
const fail = (lock, gate, msg) => failures.push(`[${lock}] ${gate}: ${msg}`);

// ---- global sabotage for the purity gate ----
const G = globalThis;
const orig = { Math_random: Math.random, Date: G.Date, document: G.document, window: G.window };
const boom = (what) => () => { throw new Error(`purity violation: ${what} used in pure lock logic`); };
// trap form: names the exact access (document.querySelector, 'x' in window, …)
const boomProp = (what) => (_t, prop) => {
  throw new Error(`purity violation: ${what}.${String(prop)} used in pure lock logic`);
};
function sabotage() {
  Math.random = boom('Math.random');
  G.document = new Proxy({}, { get: boomProp('document'), has: boomProp('document') });
  G.window = new Proxy({}, { get: boomProp('window'), has: boomProp('window') });
  // construct/apply alone leave the static clock reachable (CONTRACT §4.2 bans Date.now).
  G.Date = new Proxy(orig.Date, {
    construct: boom('new Date'),
    apply: boom('Date()'),
    get(t, prop, recv) {
      if (prop === 'now') boomProp('Date')(t, prop);
      return Reflect.get(t, prop, recv);
    },
  });
}
function restore() {
  Math.random = orig.Math_random;
  G.Date = orig.Date;
  if (orig.document === undefined) delete G.document; else G.document = orig.document;
  if (orig.window === undefined) delete G.window; else G.window = orig.window;
}

const canon = (v) => JSON.stringify(sortKeys(v));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  }
  // JSON.stringify flattens NaN/±Infinity/undefined onto null, which would let two
  // different answers (or two different instances) compare equal.
  if (v === undefined) return '\u0000undefined';
  if (typeof v === 'number' && !Number.isFinite(v)) return `\u0000${String(v)}`;
  return v;
}

// generic structural mutator: returns a mutated deep copy, or null.
// Mutants stay inside the answer's own alphabet where possible — an out-of-domain
// mutant ('a' dropped into a rune string) is trivially rejected and proves nothing.
function mutate(answer, r) {
  let copy;
  try { copy = JSON.parse(JSON.stringify(answer)); } catch { return null; }
  if (copy === undefined) return null;
  const leaves = [];
  const alphabet = new Set();
  (function walk(node, path) {
    if (Array.isArray(node)) {
      if (node.length > 1) leaves.push({ node, path, kind: 'swap' });
      node.forEach((v, i) => walk(v, path.concat(i)));
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) walk(node[k], path.concat(k));
    } else {
      if (typeof node === 'string') for (const c of node) alphabet.add(c);
      leaves.push({ path, kind: node === null ? 'null' : typeof node });
    }
  })(copy, []);
  if (!leaves.length) return null;
  const t = r.pick(leaves);
  if (t.kind === 'swap') {
    const i = r.int(t.node.length); let j = r.int(t.node.length);
    if (i === j) j = (j + 1) % t.node.length;
    [t.node[i], t.node[j]] = [t.node[j], t.node[i]];
    return copy;
  }
  // read the leaf (path may be empty: the whole answer is a scalar)
  let parent = null, key = null, val = copy;
  if (t.path.length) {
    parent = copy;
    for (let i = 0; i < t.path.length - 1; i++) parent = parent[t.path[i]];
    key = t.path[t.path.length - 1];
    val = parent[key];
  }
  let next;
  if (t.kind === 'boolean') next = !val;
  else if (t.kind === 'null') next = 0;
  else if (t.kind === 'number') {
    next = val + (r.chance(0.5) ? 1 : -1) * r.range(1, 3);
    if (!Number.isFinite(next) || next === val) next = val === 0 ? 1 : 0; // huge/imprecise values
  } else if (t.kind === 'string') {
    const pool = [...alphabet];
    const at = val.length ? r.int(val.length) : 0;
    const choices = pool.filter((c) => c !== val[at]);
    const ch = choices.length ? r.pick(choices) : String.fromCharCode(97 + r.int(26));
    next = val.slice(0, at) + ch + val.slice(at + 1);
    if (next === val) return null;
  } else return null;
  if (!t.path.length) return next;
  parent[key] = next;
  return copy;
}

const locks = [];
for (const f of files) {
  const id = f.replace(/\.js$/, '');
  let mod;
  // one unparsable module must not take the whole report down with it
  try { mod = await import(pathToFileURL(join(ROOT, 'src/locks', f)).href); }
  catch (e) { fail(id, 'import', `${e.constructor.name}: ${e.message.split('\n')[0]}`); continue; }
  const lock = mod.default;
  if (!lock || typeof lock !== 'object') { fail(id, 'iface', 'no default export object'); continue; }
  if (lock.id !== id) fail(id, 'iface', `id "${lock.id}" != filename "${id}"`);
  if (lock.ordinal !== Number(f.slice(0, 2))) fail(id, 'iface', 'ordinal != filename prefix');
  if (!(lock.ordinal >= 1 && lock.ordinal <= 15)) fail(id, 'iface', `ordinal ${lock.ordinal} outside 1..15`);
  if (!Array.isArray(lock.hints) || lock.hints.length !== 3) fail(id, 'iface', 'hints must be exactly 3');
  if (![1, 2, 3, 4].includes(lock.tier)) fail(id, 'iface', 'tier must be 1..4');
  for (const fn of ['makePuzzle', 'solve', 'verify', 'wrongAnswers', 'shard', 'mount']) {
    if (typeof lock[fn] !== 'function') fail(id, 'iface', `missing function ${fn}`);
  }
  locks.push(lock);
}

// a count of 15 does not imply ordinals 1..15 are covered (two files may share a prefix)
const ordinals = locks.map((l) => l.ordinal);
const dupes = [...new Set(ordinals.filter((o, i) => ordinals.indexOf(o) !== i))];
if (dupes.length) fail('suite', 'ordinals', `duplicate ordinal(s): ${dupes.join(', ')}`);
if (!files.length) fail('suite', 'count', `no lock files matched${ONLY ? ` --only ${ONLY}` : ''}`);
if (!PARTIAL && !ONLY) {
  if (locks.length !== 15) fail('suite', 'count', `expected 15 locks, found ${locks.length}`);
  const missing = [];
  for (let i = 1; i <= 15; i++) if (!ordinals.includes(i)) missing.push(i);
  if (missing.length) fail('suite', 'count', `missing ordinal(s): ${missing.join(', ')}`);
}

for (const lock of locks) {
  const t0 = Date.now();
  const L = { solverOk: 0, rejected: 0, mutantsTried: 0, mutantsRejected: 0 };
  report.locks[lock.id] = L;
  let broken = false;

  sabotage();
  try {
    for (let s = 0; s < SEEDS && !broken; s++) {
      const seed = `ow-${lock.id}-${s}`;
      let inst, inst2, ans;
      try {
        inst = lock.makePuzzle(rng(seed));
        inst2 = lock.makePuzzle(rng(seed));
      } catch (e) { fail(lock.id, 'purity/make', `seed ${s}: ${e.message}`); broken = true; break; }
      if (canon(inst) !== canon(inst2)) { fail(lock.id, 'determinism', `seed ${s}: unstable instance`); broken = true; break; }
      try { ans = lock.solve(inst); } catch (e) { fail(lock.id, 'solve', `seed ${s}: threw ${e.message}`); broken = true; break; }
      let cans;
      try { cans = canon(ans); } catch (e) { fail(lock.id, 'solve', `seed ${s}: answer not JSON-serialisable: ${e.message}`); broken = true; break; }
      let v;
      try { v = lock.verify(inst, ans); } catch (e) { fail(lock.id, 'verify', `seed ${s}: threw on canonical answer: ${e.message}`); broken = true; break; }
      if (!v || v.ok !== true) { fail(lock.id, 'solver-gate', `seed ${s}: canonical answer rejected`); broken = true; break; }
      L.solverOk++;

      // totality on junk
      for (const junk of [null, undefined, 42, 'skål', [], {}, { ring: null }]) {
        let jv;
        try { jv = lock.verify(inst, junk); } catch (e) { fail(lock.id, 'totality', `verify threw on junk: ${e.message}`); broken = true; break; }
        if (jv && jv.ok === true) { fail(lock.id, 'totality', `junk answer ${JSON.stringify(junk)} accepted`); broken = true; break; }
      }
      if (broken) break;

      // wrong answers
      let wrongs;
      try { wrongs = lock.wrongAnswers(inst); } catch (e) { fail(lock.id, 'wrongs', `threw: ${e.message}`); broken = true; break; }
      if (!Array.isArray(wrongs) || wrongs.length < 6) { fail(lock.id, 'wrongs', `need >=6, got ${wrongs && wrongs.length}`); broken = true; break; }
      const seen = new Set();
      for (const w of wrongs) {
        let cw;
        try { cw = canon(w); } catch (e) { fail(lock.id, 'wrongs', `seed ${s}: wrong answer not JSON-serialisable: ${e.message}`); broken = true; break; }
        if (cw === cans) { fail(lock.id, 'wrongs', `seed ${s}: a "wrong" answer equals the solution`); broken = true; break; }
        seen.add(cw);
        let wv;
        try { wv = lock.verify(inst, w); } catch (e) { fail(lock.id, 'totality', `seed ${s}: verify threw on a wrong answer: ${e.message}`); broken = true; break; }
        if (wv && wv.ok === true) { fail(lock.id, 'rejection-gate', `seed ${s}: wrong answer accepted: ${cw.slice(0, 120)}`); broken = true; break; }
        L.rejected++;
      }
      if (broken) break;
      if (seen.size < 6) { fail(lock.id, 'wrongs', `seed ${s}: need >=6 distinct wrong answers, got ${seen.size} of ${wrongs.length}`); broken = true; break; }

      // mutations of the canonical answer
      const mr = rng(`mut-${lock.id}-${s}`);
      for (let m = 0; m < 3; m++) {
        const mut = mutate(ans, mr);
        if (mut === null || canon(mut) === cans) continue;
        L.mutantsTried++;
        let mv;
        try { mv = lock.verify(inst, mut); } catch (e) { fail(lock.id, 'totality', `seed ${s}: verify threw on a mutated answer: ${e.message}`); broken = true; break; }
        if (mv && mv.ok === true) { fail(lock.id, 'mutation-gate', `seed ${s}: mutated answer accepted: ${canon(mut).slice(0, 120)}`); broken = true; break; }
        L.mutantsRejected++;
      }
      if (broken) break;

      // shard constancy
      let sh;
      try { sh = lock.shard(inst); } catch (e) { fail(lock.id, 'shard', `seed ${s}: threw ${e.message}`); broken = true; break; }
      if (lock.ordinal <= 14) {
        const want = SHARDS[lock.id];
        if (!want) { fail(lock.id, 'shard', `no frozen shard for id "${lock.id}" (docs/LOCKS.md)`); broken = true; }
        else if (!sh || sh.rune !== want.rune || sh.value !== want.value) {
          fail(lock.id, 'shard', `must equal frozen ${JSON.stringify(want)}, got ${JSON.stringify(sh)}`);
          broken = true;
        }
      }
    }
  } finally {
    restore();
  }

  // difficulty declarations
  const d = lock.difficulty || {};
  const floor = FLOORS[lock.ordinal];
  if (floor) {
    if (!(Number.isFinite(d.minSteps) && d.minSteps >= floor[0])) fail(lock.id, 'difficulty', `minSteps ${d.minSteps} < floor ${floor[0]}`);
    if (!(Number.isFinite(d.estMinutes) && d.estMinutes >= floor[1])) fail(lock.id, 'difficulty', `estMinutes ${d.estMinutes} < floor ${floor[1]}`);
  }
  L.ms = Date.now() - t0;
}

// monotonic ramp
const sorted = locks.slice().sort((a, b) => a.ordinal - b.ordinal);
for (let i = 1; i < sorted.length; i++) {
  const a = sorted[i - 1].difficulty || {}, b = sorted[i].difficulty || {};
  if (sorted[i].ordinal === sorted[i - 1].ordinal + 1) {
    if (b.minSteps < a.minSteps) fail(sorted[i].id, 'ramp', `minSteps decreases (${a.minSteps} -> ${b.minSteps})`);
    if (b.estMinutes < a.estMinutes) fail(sorted[i].id, 'ramp', `estMinutes decreases (${a.estMinutes} -> ${b.estMinutes})`);
  }
}

// bundle gate (only when index.html exists)
const idx = join(ROOT, 'index.html');
if (existsSync(idx)) {
  const html = readFileSync(idx, 'utf8');
  const bytes = Buffer.byteLength(html);
  report.bundleBytes = bytes;
  if (bytes > 2 * 1048576) fail('bundle', 'size', `${bytes} > 2.0MB`);
  else if (bytes > 1.5 * 1048576) console.warn(`WARN: index.html ${(bytes / 1048576).toFixed(2)} MB — over the 1.5 MB warn line`);
  // CONTRACT §2 exempts comments and the xmlns attribute; data URIs are stripped to
  // their own charset so an encoded payload cannot swallow the text that follows it.
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\bxmlns(:[a-zA-Z]+)?=(["'])https?:\/\/[^"']*\2/g, '')
    .replace(/data:[a-zA-Z0-9+/=;,.\-_]+/g, '');
  const ext = stripped.match(/https?:\/\//g);
  if (ext) fail('bundle', 'external', `${ext.length} external URL(s)`);
  if (/\beval\s*\(/.test(stripped) || /new\s+Function\s*\(/.test(stripped) || /\(\s*0\s*,\s*eval\s*\)/.test(stripped)) {
    fail('bundle', 'eval', 'eval/new Function present');
  }
} else if (!PARTIAL) {
  fail('bundle', 'missing', 'index.html not built');
}

mkdirSync(join(ROOT, 'artifacts'), { recursive: true });
writeFileSync(join(ROOT, 'artifacts/gates.json'), JSON.stringify(report, null, 2));

for (const [id, L] of Object.entries(report.locks)) {
  console.log(`${id}: solver ${L.solverOk}/${SEEDS} wrongs ${L.rejected} mutants ${L.mutantsRejected}/${L.mutantsTried} (${L.ms}ms)`);
}
if (failures.length) {
  console.error(`\nGATES FAILED (${failures.length}):`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`\nGATES GREEN — ${locks.length} lock(s), ${SEEDS} seeds${PARTIAL ? ' (partial)' : ''}`);
