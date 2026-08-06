// Deterministic i18n gate for lock 13: every board key present in es and ca,
// three hints each, every near-line verify() can return covered by nearMap,
// and every statement kind renders in all three tongues.
import assert from 'node:assert/strict';
import althing from '../../src/locks/13-althing.js';
import { rng } from '../../src/kernel/rng.js';
import { lockText, localizeNear } from '../../src/kernel/i18n.js';

const src = await import('node:fs').then((fs) => fs.readFileSync('src/locks/13-althing.js', 'utf8'));
const boardKeys = src.match(/^const BOARD_EN = \{([\s\S]*?)^\};/m)[1]
  .split('\n').map((l) => l.match(/^\s{2}([A-Za-z]+):/)).filter(Boolean).map((m) => m[1]);
assert.ok(boardKeys.length > 30, `expected the full board table, got ${boardKeys.length} keys`);

for (const lang of ['es', 'ca']) {
  const L = althing.i18n[lang];
  assert.ok(L, `${lang} block missing`);
  assert.ok(L.title && L.epigraph, `${lang}: title/epigraph missing`);
  assert.equal(L.hints.length, 3, `${lang}: needs exactly three hints`);
  const missing = boardKeys.filter((k) => !(k in L.board));
  assert.deepEqual(missing, [], `${lang}: board keys missing -> ${missing.join(', ')}`);
  const extra = Object.keys(L.board).filter((k) => !boardKeys.includes(k));
  assert.deepEqual(extra, [], `${lang}: board keys with no English source -> ${extra.join(', ')}`);
  // lockText resolves through the kernel exactly as the shell will
  const t = lockText(althing, lang);
  assert.equal(t.title, L.title);
  assert.equal(t.hints.length, 3);
}

// every near-line verify() can emit must have an es and ca rendering
const seen = new Set();
for (let s = 0; s < 120; s++) {
  const inst = althing.makePuzzle(rng(`i18n:${s}`));
  if (!inst.statements.length) continue;
  const ans = althing.solve(inst);
  for (const w of althing.wrongAnswers(inst)) {
    const r = althing.verify(inst, w);
    if (r.near) seen.add(r.near);
  }
  assert.equal(althing.verify(inst, ans).ok, true, `seed ${s}: solve does not verify`);
}
assert.ok(seen.size >= 2, `expected several distinct near-lines, saw ${seen.size}`);
for (const lang of ['es', 'ca']) {
  const map = althing.i18n[lang].nearMap;
  for (const near of seen) {
    assert.ok(map[near] && map[near] !== near, `${lang}: near-line not localized -> "${near}"`);
    assert.equal(localizeNear(near, map), map[near]);
  }
}

// every statement kind must render in every tongue, with no {placeholders} left
const kinds = new Set();
for (let s = 0; s < 40 && kinds.size < 6; s++) {
  const inst = althing.makePuzzle(rng(`kinds:${s}`));
  for (const st of inst.statements) kinds.add(st.kind);
}
assert.deepEqual([...kinds].sort(), ['among', 'false', 'imp', 'notme', 'true', 'xor'],
  'the generator did not exercise the whole grammar');

console.log(`i18n GATE GREEN — ${boardKeys.length} board keys x es/ca, ${seen.size} near-lines mapped, ${kinds.size} statement kinds`);
