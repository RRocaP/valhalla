// Ledger numerals (lock room header) and ordinal words (journal lines).
// Pure, no DOM. Only 1..15 need to be exact (fifteen locks); anything else
// degrades gracefully rather than throwing.

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
const WORDS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth',
];

export function toRoman(n) {
  return ROMAN[n - 1] || String(n);
}

export function ordinalWord(n) {
  return WORDS[n - 1] || `${n}th`;
}
