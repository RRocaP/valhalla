// Save schema + persistence. Pure — no DOM. Storage is injected (getItem/setItem
// interface) so this is importable and testable under plain Node; the real
// caller passes window.localStorage (itself accessed defensively — see index.js).
// docs/SHELL.md "Save (FROZEN key oathwood.v1)".

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
    },
    startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : fresh.startedAt,
  };
}

// Never throws: missing key, unparsable JSON, or a throwing storage all fall
// back to a fresh save.
export function loadSave(storage, now = new Date()) {
  if (!storage) return freshSave(now);
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return freshSave(now);
  }
  if (!raw) return freshSave(now);
  try {
    return normalizeSave(JSON.parse(raw), now);
  } catch {
    return freshSave(now);
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
