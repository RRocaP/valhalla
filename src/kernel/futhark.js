// Younger Futhark — canonical data. FROZEN (docs/CONTRACT.md §3).
// Stroke segments are polylines in a unit box (x,y in 0..1, y down). They are
// the logic-canonical skeletons (bind-rune lock, wend-rune mirroring); the art
// layer may render richer copies but never redefines these.

export const STAVE = [[0.5, 0.05], [0.5, 0.95]];

export const FUTHARK = [
  { ch: 'ᚠ', translit: 'f', name: 'fé',      meaning: 'wealth',  segments: [STAVE, [[0.5, 0.22], [0.84, 0.08]], [[0.5, 0.42], [0.84, 0.28]]] },
  { ch: 'ᚢ', translit: 'u', name: 'úr',      meaning: 'drizzle', segments: [[[0.34, 0.08], [0.34, 0.95]], [[0.34, 0.08], [0.68, 0.28]], [[0.68, 0.28], [0.68, 0.95]]] },
  { ch: 'ᚦ', translit: 'þ', name: 'þurs',    meaning: 'giant',   segments: [STAVE, [[0.5, 0.25], [0.82, 0.45], [0.5, 0.65]]] },
  { ch: 'ᚬ', translit: 'o', name: 'óss',     meaning: 'estuary', segments: [STAVE, [[0.5, 0.2], [0.2, 0.4]], [[0.5, 0.38], [0.2, 0.58]]] },
  { ch: 'ᚱ', translit: 'r', name: 'reið',    meaning: 'riding',  segments: [STAVE, [[0.5, 0.1], [0.8, 0.28], [0.5, 0.46]], [[0.5, 0.46], [0.82, 0.8]]] },
  { ch: 'ᚴ', translit: 'k', name: 'kaun',    meaning: 'sore',    segments: [STAVE, [[0.5, 0.16], [0.8, 0.44]]] },
  { ch: 'ᚼ', translit: 'h', name: 'hagall',  meaning: 'hail',    segments: [STAVE, [[0.28, 0.36], [0.72, 0.64]], [[0.72, 0.36], [0.28, 0.64]]] },
  { ch: 'ᚾ', translit: 'n', name: 'nauðr',   meaning: 'need',    segments: [STAVE, [[0.3, 0.36], [0.7, 0.6]]] },
  { ch: 'ᛁ', translit: 'i', name: 'íss',     meaning: 'ice',     segments: [STAVE] },
  { ch: 'ᛅ', translit: 'a', name: 'ár',      meaning: 'harvest', segments: [STAVE, [[0.28, 0.6], [0.72, 0.34]]] },
  { ch: 'ᛋ', translit: 's', name: 'sól',     meaning: 'sun',     segments: [[[0.64, 0.08], [0.42, 0.42]], [[0.42, 0.42], [0.62, 0.52]], [[0.62, 0.52], [0.4, 0.9]]] },
  { ch: 'ᛏ', translit: 't', name: 'týr',     meaning: 'the god', segments: [STAVE, [[0.5, 0.08], [0.26, 0.3]], [[0.5, 0.08], [0.74, 0.3]]] },
  { ch: 'ᛒ', translit: 'b', name: 'bjarkan', meaning: 'birch',   segments: [STAVE, [[0.5, 0.08], [0.78, 0.26], [0.5, 0.46]], [[0.5, 0.5], [0.78, 0.68], [0.5, 0.9]]] },
  { ch: 'ᛘ', translit: 'm', name: 'maðr',    meaning: 'man',     segments: [STAVE, [[0.5, 0.3], [0.24, 0.08]], [[0.5, 0.3], [0.76, 0.08]]] },
  { ch: 'ᛚ', translit: 'l', name: 'lǫgr',    meaning: 'water',   segments: [STAVE, [[0.5, 0.08], [0.8, 0.32]]] },
  { ch: 'ᛦ', translit: 'R', name: 'ýr',      meaning: 'yew',     segments: [STAVE, [[0.5, 0.7], [0.24, 0.94]], [[0.5, 0.7], [0.76, 0.94]]] },
];

export const BY_CH = Object.fromEntries(FUTHARK.map((r) => [r.ch, r]));
export const BY_TRANSLIT = Object.fromEntries(FUTHARK.map((r) => [r.translit, r]));
export const ORDER = FUTHARK.map((r) => r.ch);
