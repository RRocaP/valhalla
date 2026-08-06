// Save schema + persistence. Pure — no DOM. Storage is injected (getItem/setItem
// interface) so this is importable and testable under plain Node; the real
// caller passes window.localStorage (itself accessed defensively — see index.js).
// docs/SHELL.md "Save (FROZEN key oathwood.v1)".

import { LANGS, resolveLang } from '../kernel/i18n.js';

export const SAVE_KEY = 'oathwood.v1';

export function freshSave(now = new Date()) {
  return {
    opened: [],
    attempts: {},
    hints: {},
    journal: [],
    settings: { muted: false, reducedMotion: null },
    startedAt: now.toISOString(),
  };
}

function isPlainObject(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

// Field-by-field fallback: a partially-malformed save still keeps whatever
// fields are well-shaped rather than discarding the whole thing.
function normalizeSave(parsed, now) {
  const fresh = freshSave(now);
  if (!isPlainObject(parsed)) return fresh;
  const settingsIn = isPlainObject(parsed.settings) ? parsed.settings : {};
  return {
    opened: Array.isArray(parsed.opened) ? parsed.opened.filter((x) => typeof x === 'string') : fresh.opened,
    attempts: isPlainObject(parsed.attempts) ? parsed.attempts : fresh.attempts,
    hints: isPlainObject(parsed.hints) ? parsed.hints : fresh.hints,
    journal: Array.isArray(parsed.journal) ? parsed.journal.filter((x) => typeof x === 'string') : fresh.journal,
    settings: {
      muted: typeof settingsIn.muted === 'boolean' ? settingsIn.muted : fresh.settings.muted,
      reducedMotion: [true, false, null].includes(settingsIn.reducedMotion)
        ? settingsIn.reducedMotion
        : fresh.settings.reducedMotion,
      // settings.lang is ADDITIVE (CONTRACT §4.1 amendment 2026-08-06): kept
      // only when a valid 'en'|'es'|'ca' was stored, so pre-amendment saves
      // (and their exact round-trip shape) are untouched.
      ...(LANGS.includes(settingsIn.lang) ? { lang: settingsIn.lang } : {}),
    },
    startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : fresh.startedAt,
  };
}

// Never throws: missing key, unparsable JSON, or a throwing storage all fall
// back to a fresh save. When `nav` (navigator.language) is supplied, the
// additive settings.lang field is defaulted via resolveLang(saved, nav) —
// callers that omit it (pure Node tests) get the untouched legacy shape.
export function loadSave(storage, now = new Date(), nav) {
  const withLang = (save) => {
    if (nav !== undefined) save.settings.lang = resolveLang(save.settings.lang, nav);
    return save;
  };
  if (!storage) return withLang(freshSave(now));
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return withLang(freshSave(now));
  }
  if (!raw) return withLang(freshSave(now));
  try {
    return withLang(normalizeSave(JSON.parse(raw), now));
  } catch {
    return withLang(freshSave(now));
  }
}

// Write-through. Never throws (quota errors, unavailable storage, etc. are
// swallowed — in-memory state stays authoritative for the session).
export function writeSave(storage, save) {
  if (!storage) return;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

export function hasSave(storage) {
  if (!storage) return false;
  try {
    return !!storage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}
