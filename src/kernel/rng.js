// Seeded, deterministic PRNG. The only randomness allowed in puzzle logic.
// xmur3 seed hash + mulberry32 stream.

export function rng(seed) {
  const str = String(seed);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^= h >>> 16) >>> 0;

  const r = function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (n) => Math.floor(r() * n);            // 0..n-1
  r.range = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)); // inclusive
  r.pick = (arr) => arr[r.int(arr.length)];
  r.chance = (p) => r() < p;
  r.shuffle = (arr) => {                          // returns a new array
    const a2 = arr.slice();
    for (let i = a2.length - 1; i > 0; i--) {
      const j = r.int(i + 1);
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  return r;
}
