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
const SEEDS = args.includes('--seeds') ? Number(args[args.indexOf('--seeds') + 1]) : 200;
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

// minSteps / estMinutes floors per ordinal (docs/LOCKS.md)
const FLOORS = {
  1: [6, 2], 2: [8, 3], 3: [10, 4], 4: [12, 5], 5: [14, 6],
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
function sabotage() {
  Math.random = boom('Math.random');
  G.document = new Proxy({}, { get: boom('document'), has: boom('document') });
  G.window = new Proxy({}, { get: boom('window'), has: boom('window') });
  G.Date = new Proxy(orig.Date, { construct: boom('new Date'), apply: boom('Date()') });
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
  return v;
}

// generic structural mutator: returns a mutated deep copy, or null
function mutate(answer, r) {
  const copy = JSON.parse(JSON.stringify(answer));
  const leaves = [];
  (function walk(node, path) {
    if (Array.isArray(node)) {
      if (node.length > 1) leaves.push({ node, kind: 'swap' });
      node.forEach((v, i) => walk(v, path.concat(i)));
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) walk(node[k], path.concat(k));
    } else {
      leaves.push({ path, kind: typeof node });
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
  let parent = copy;
  for (let i = 0; i < t.path.length - 1; i++) parent = parent[t.path[i]];
  const key = t.path[t.path.length - 1];
  const val = parent[key];
  if (t.kind === 'boolean') parent[key] = !val;
  else if (t.kind === 'number') parent[key] = val + (r.chance(0.5) ? 1 : -1) * r.range(1, 3);
  else if (t.kind === 'string' && val.length) {
    const i = r.int(val.length);
    parent[key] = val.slice(0, i) + String.fromCharCode(97 + r.int(26)) + val.slice(i + 1);
  } else return null;
  return copy;
}

const locks = [];
for (const f of files) {
  const mod = await import(pathToFileURL(join(ROOT, 'src/locks', f)).href);
  const lock = mod.default;
  const id = f.replace(/\.js$/, '');
  if (!lock || typeof lock !== 'object') { fail(id, 'iface', 'no default export object'); continue; }
  if (lock.id !== id) fail(id, 'iface', `id "${lock.id}" != filename "${id}"`);
  if (lock.ordinal !== Number(f.slice(0, 2))) fail(id, 'iface', 'ordinal != filename prefix');
  if (!Array.isArray(lock.hints) || lock.hints.length !== 3) fail(id, 'iface', 'hints must be exactly 3');
  if (![1, 2, 3, 4].includes(lock.tier)) fail(id, 'iface', 'tier must be 1..4');
  for (const fn of ['makePuzzle', 'solve', 'verify', 'wrongAnswers', 'shard', 'mount']) {
    if (typeof lock[fn] !== 'function') fail(id, 'iface', `missing function ${fn}`);
  }
  locks.push(lock);
}

if (!PARTIAL && !ONLY && locks.length !== 15) {
  fail('suite', 'count', `expected 15 locks, found ${locks.length}`);
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
      for (const w of wrongs) {
        if (canon(w) === canon(ans)) { fail(lock.id, 'wrongs', `seed ${s}: a "wrong" answer equals the solution`); broken = true; break; }
        const wv = lock.verify(inst, w);
        if (wv && wv.ok === true) { fail(lock.id, 'rejection-gate', `seed ${s}: wrong answer accepted: ${canon(w).slice(0, 120)}`); broken = true; break; }
        L.rejected++;
      }
      if (broken) break;

      // mutations of the canonical answer
      const mr = rng(`mut-${lock.id}-${s}`);
      for (let m = 0; m < 3; m++) {
        const mut = mutate(ans, mr);
        if (!mut || canon(mut) === canon(ans)) continue;
        L.mutantsTried++;
        const mv = lock.verify(inst, mut);
        if (mv && mv.ok === true) { fail(lock.id, 'mutation-gate', `seed ${s}: mutated answer accepted: ${canon(mut).slice(0, 120)}`); broken = true; break; }
        L.mutantsRejected++;
      }

      // shard constancy
      const sh = lock.shard(inst);
      if (lock.ordinal <= 14) {
        const want = SHARDS[lock.id];
        if (!sh || sh.rune !== want.rune || sh.value !== want.value) {
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
    if (!(d.minSteps >= floor[0])) fail(lock.id, 'difficulty', `minSteps ${d.minSteps} < floor ${floor[0]}`);
    if (!(d.estMinutes >= floor[1])) fail(lock.id, 'difficulty', `estMinutes ${d.estMinutes} < floor ${floor[1]}`);
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
  const stripped = html.replace(/data:[^"'` )]+/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const ext = stripped.match(/https?:\/\//g);
  if (ext) fail('bundle', 'external', `${ext.length} external URL(s)`);
  if (/\beval\s*\(/.test(stripped) || /new\s+Function\s*\(/.test(stripped)) fail('bundle', 'eval', 'eval/new Function present');
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
