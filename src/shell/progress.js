// Progression + hint-arming logic. Pure — no DOM. docs/SHELL.md "Hints",
// docs/CONTRACT.md §6.

// Frozen thresholds: three wrong answers arms hint 1, six arms hint 2, ten arms hint 3.
export const HINT_THRESHOLDS = [3, 6, 10];

// How many hints (0..3) are armed for a given wrong-attempt count.
export function hintsArmed(attemptCount) {
  return HINT_THRESHOLDS.filter((t) => attemptCount >= t).length;
}

// 0-based index of the hint newly armed going from prevAttempts -> nextAttempts,
// or -1 if none crossed a threshold this step.
export function hintIndexJustArmed(prevAttempts, nextAttempts) {
  for (let i = 0; i < HINT_THRESHOLDS.length; i++) {
    if (prevAttempts < HINT_THRESHOLDS[i] && nextAttempts >= HINT_THRESHOLDS[i]) return i;
  }
  return -1;
}

// Locks unlock in ordinal order, no skipping. `locks` must already be
// ordinal-sorted (main.js guarantees this before constructing the shell).
export function nextLockId(locks, save) {
  for (const l of locks) {
    if (!save.opened.includes(l.id)) return l.id;
  }
  return null; // all opened
}

export function lockState(locks, save, lockId) {
  if (save.opened.includes(lockId)) return 'open';
  return lockId === nextLockId(locks, save) ? 'next' : 'sealed';
}

// Only the next lock (to make progress) or an already-open lock (to revisit) is
// ever clickable; sealed locks are inert.
export function isAccessible(locks, save, lockId) {
  const st = lockState(locks, save, lockId);
  return st === 'next' || st === 'open';
}

export function progressFraction(locks, save) {
  if (!locks.length) return 0;
  return save.opened.length / locks.length;
}

export function isComplete(locks, save) {
  return locks.length > 0 && save.opened.length >= locks.length;
}
