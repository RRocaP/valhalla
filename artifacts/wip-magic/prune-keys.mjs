// Remove orphaned per-lock i18n board keys (my own text-purge orphans).
// Strict: only whole single-line `key: '...'` entries; reports every removal;
// fails loudly if a requested key is present but not single-line removable.
import { readFileSync, writeFileSync } from 'node:fs';

const [file, ...keys] = process.argv.slice(2);
const src = readFileSync(file, 'utf8');
const lines = src.split('\n');
const removed = [];
const out = [];
let dropContinuations = false;
for (const line of lines) {
  // continuation lines of a removed multi-line entry: `+ '...'`
  if (dropContinuations && /^\s*\+\s*'(?:[^'\\]|\\.)*',?\s*$/.test(line)) { removed.push('(cont)'); continue; }
  dropContinuations = false;
  const m = line.match(/^\s*([A-Za-z0-9_]+):\s*'(?:[^'\\]|\\.)*'\s*$/);   // open multi-line head (no comma)
  const m1 = line.match(/^\s*([A-Za-z0-9_]+):\s*'(?:[^'\\]|\\.)*',\s*$/); // complete single-line entry
  if (m1 && keys.includes(m1[1])) { removed.push(m1[1]); continue; }
  if (m && keys.includes(m[1])) { removed.push(m[1]); dropContinuations = true; continue; }
  out.push(line);
}
for (const k of keys) {
  const stillThere = out.some((l) => new RegExp(`^\\s*${k}:\\s*`).test(l));
  if (stillThere) {
    console.error(`FAIL: key ${k} still present (multi-line or unusual) in ${file}`);
    process.exit(1);
  }
}
writeFileSync(file, out.join('\n'));
console.log(`${file}: removed ${removed.length} entries (${[...new Set(removed)].join(', ')})`);
