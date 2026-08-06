// VALHALLA localization kernel (lead-owned). Languages: en, es, ca.
// Design law: the game speaks the player's language; runic artifacts
// (Old-Norse lexicon words, carved half-lines) keep their tongue.
//
// Shell owns the language STATE (save.settings.lang, additive field, default
// resolved here). Lock views receive `ctx.lang` (additive, CONTRACT §4.1
// amendment 2026-08-06) and resolve their own text via lockText().

export const LANGS = ['en', 'es', 'ca'];

export function resolveLang(saved, nav) {
  if (LANGS.includes(saved)) return saved;
  const n = String(nav || '').toLowerCase();
  if (n.startsWith('ca')) return 'ca';
  if (n.startsWith('es')) return 'es';
  return 'en';
}

// t(dict, lang, key, params?) — dictionaries are { key: { en, es, ca } }.
// Missing translation falls back to en (never throws, never blanks).
export function t(dict, lang, key, params) {
  const entry = dict[key];
  let s = entry ? (entry[lang] || entry.en || '') : key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

// lockText(lock, lang) — locks carry an additive `i18n: { es: {...}, ca: {...} }`
// block (title, epigraph, hints[3], optional nearMap {canonicalEn: localized},
// optional board strings table). English lives in the frozen top-level fields.
export function lockText(lock, lang) {
  const base = { title: lock.title, epigraph: lock.epigraph, hints: lock.hints, nearMap: {}, board: {} };
  if (lang === 'en' || !lock.i18n || !lock.i18n[lang]) return base;
  const L = lock.i18n[lang];
  return {
    title: L.title || base.title,
    epigraph: L.epigraph || base.epigraph,
    hints: Array.isArray(L.hints) && L.hints.length === 3 ? L.hints : base.hints,
    nearMap: L.nearMap || {},
    board: L.board || {},
  };
}

// near-line localization: verify() stays pure and returns canonical English;
// the shell passes it through the lock's nearMap for display.
export function localizeNear(near, nearMap) {
  if (!near) return near;
  return nearMap[near] || near;
}
