// SHELL unit tests — pure logic only (save, progress, journal, numerals).
// No DOM. Run: node --test tests/unit/shell.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY, freshSave, loadSave, writeSave, hasSave } from '../../src/shell/save.js';
import {
  HINT_THRESHOLDS, hintsArmed, hintIndexJustArmed,
  nextLockId, lockState, isAccessible, progressFraction, isComplete,
} from '../../src/shell/progress.js';
import { formatTimestamp, journalLine, pushJournal, hintTakenLine } from '../../src/shell/journal.js';
import { toRoman, ordinalWord } from '../../src/shell/numerals.js';
import { DUELS, DUEL_ORDER, DUEL_CAST, duelFor, isDuelOrdinal } from '../../src/shell/duels.js';

// In-memory localStorage-shaped mock.
function mockStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    _data: data,
  };
}

describe('save: schema + round-trip', () => {
  test('freshSave has the exact frozen shape', () => {
    const s = freshSave(new Date('2026-01-01T00:00:00.000Z'));
    assert.deepEqual(Object.keys(s).sort(), ['attempts', 'hints', 'journal', 'opened', 'settings', 'startedAt'].sort());
    assert.deepEqual(s.opened, []);
    assert.deepEqual(s.attempts, {});
    assert.deepEqual(s.hints, {});
    assert.deepEqual(s.journal, []);
    assert.deepEqual(s.settings, { muted: false, reducedMotion: null });
    assert.equal(s.startedAt, '2026-01-01T00:00:00.000Z');
  });

  test('write then load round-trips exactly', () => {
    const storage = mockStorage();
    const save = freshSave();
    save.opened.push('01-runerow');
    save.attempts['02-bismer'] = 4;
    save.hints['02-bismer'] = [0];
    save.journal.push('12:00 — The chest is laid before you.');
    save.settings.muted = true;
    save.settings.reducedMotion = true;
    writeSave(storage, save);
    const loaded = loadSave(storage);
    assert.deepEqual(loaded, save);
  });

  test('missing key falls back to fresh state, never throws', () => {
    const storage = mockStorage();
    assert.doesNotThrow(() => loadSave(storage));
    const loaded = loadSave(storage);
    assert.deepEqual(loaded.opened, []);
  });

  test('corrupt JSON falls back to fresh state, never throws', () => {
    const storage = mockStorage({ [SAVE_KEY]: '{not valid json' });
    assert.doesNotThrow(() => loadSave(storage));
    const loaded = loadSave(storage);
    assert.deepEqual(loaded.opened, []);
    assert.deepEqual(loaded.settings, { muted: false, reducedMotion: null });
  });

  test('null storage never throws', () => {
    assert.doesNotThrow(() => loadSave(null));
    assert.doesNotThrow(() => writeSave(null, freshSave()));
    assert.equal(hasSave(null), false);
  });

  test('throwing storage never throws through loadSave/writeSave/hasSave', () => {
    const angry = {
      getItem() { throw new Error('nope'); },
      setItem() { throw new Error('nope'); },
    };
    assert.doesNotThrow(() => loadSave(angry));
    assert.doesNotThrow(() => writeSave(angry, freshSave()));
    assert.doesNotThrow(() => hasSave(angry));
    assert.equal(hasSave(angry), false);
  });

  test('partially-malformed shape keeps well-shaped fields, discards bad ones', () => {
    const storage = mockStorage({
      [SAVE_KEY]: JSON.stringify({
        opened: ['01-runerow', 42, '03-beacons'], // 42 is invalid, should be dropped
        attempts: 'not-an-object', // invalid -> falls back to {}
        hints: { '01-runerow': [0, 1] }, // valid
        journal: ['a line'],
        settings: { muted: true, reducedMotion: 'sideways' }, // invalid reducedMotion -> null
        startedAt: '2020-01-01T00:00:00.000Z',
      }),
    });
    const loaded = loadSave(storage);
    assert.deepEqual(loaded.opened, ['01-runerow', '03-beacons']);
    assert.deepEqual(loaded.attempts, {});
    assert.deepEqual(loaded.hints, { '01-runerow': [0, 1] });
    assert.deepEqual(loaded.journal, ['a line']);
    assert.equal(loaded.settings.muted, true);
    assert.equal(loaded.settings.reducedMotion, null);
    assert.equal(loaded.startedAt, '2020-01-01T00:00:00.000Z');
  });

  test('hasSave reflects raw presence, independent of validity', () => {
    const empty = mockStorage();
    assert.equal(hasSave(empty), false);
    const withJunk = mockStorage({ [SAVE_KEY]: 'garbage' });
    assert.equal(hasSave(withJunk), true);
  });

  test('write-through: every writeSave call is immediately visible to loadSave', () => {
    const storage = mockStorage();
    const save = freshSave();
    for (let i = 1; i <= 3; i++) {
      save.opened.push(`0${i}-x`);
      writeSave(storage, save);
      assert.deepEqual(loadSave(storage).opened, save.opened);
    }
  });
});

describe('progress: hint arming thresholds (3/6/10, frozen)', () => {
  test('hintsArmed at and around each threshold', () => {
    assert.deepEqual(HINT_THRESHOLDS, [3, 6, 10]);
    assert.equal(hintsArmed(0), 0);
    assert.equal(hintsArmed(2), 0);
    assert.equal(hintsArmed(3), 1);
    assert.equal(hintsArmed(5), 1);
    assert.equal(hintsArmed(6), 2);
    assert.equal(hintsArmed(9), 2);
    assert.equal(hintsArmed(10), 3);
    assert.equal(hintsArmed(999), 3); // caps at 3, never invents a 4th hint
  });

  test('hintIndexJustArmed fires exactly on the crossing step', () => {
    assert.equal(hintIndexJustArmed(2, 3), 0);
    assert.equal(hintIndexJustArmed(3, 3), -1);
    assert.equal(hintIndexJustArmed(5, 6), 1);
    assert.equal(hintIndexJustArmed(9, 10), 2);
    assert.equal(hintIndexJustArmed(0, 1), -1);
    assert.equal(hintIndexJustArmed(10, 11), -1); // already fully armed, no new crossing
  });

  test('hintIndexJustArmed reports the earliest newly-crossed threshold on a multi-jump', () => {
    assert.equal(hintIndexJustArmed(0, 10), 0);
  });
});

describe('progress: lock gating (sealed/next/open)', () => {
  const locks = [
    { id: 'a', ordinal: 1 },
    { id: 'b', ordinal: 2 },
    { id: 'c', ordinal: 3 },
  ];

  test('fresh save: only the first lock is next, rest sealed', () => {
    const save = freshSave();
    assert.equal(lockState(locks, save, 'a'), 'next');
    assert.equal(lockState(locks, save, 'b'), 'sealed');
    assert.equal(lockState(locks, save, 'c'), 'sealed');
    assert.equal(isAccessible(locks, save, 'a'), true);
    assert.equal(isAccessible(locks, save, 'b'), false);
    assert.equal(isAccessible(locks, save, 'c'), false);
    assert.equal(nextLockId(locks, save), 'a');
    assert.equal(isComplete(locks, save), false);
    assert.equal(progressFraction(locks, save), 0);
  });

  test('opening in order advances the frontier; no skipping', () => {
    const save = freshSave();
    save.opened.push('a');
    assert.equal(lockState(locks, save, 'a'), 'open');
    assert.equal(lockState(locks, save, 'b'), 'next');
    assert.equal(lockState(locks, save, 'c'), 'sealed');
    assert.equal(isAccessible(locks, save, 'a'), true); // revisitable
    assert.equal(isAccessible(locks, save, 'c'), false);
    assert.equal(nextLockId(locks, save), 'b');
    assert.equal(progressFraction(locks, save), 1 / 3);
  });

  test('all opened: nextLockId is null, isComplete true, fraction 1', () => {
    const save = freshSave();
    save.opened.push('a', 'b', 'c');
    assert.equal(nextLockId(locks, save), null);
    assert.equal(isComplete(locks, save), true);
    assert.equal(progressFraction(locks, save), 1);
    for (const l of locks) assert.equal(lockState(locks, save, l.id), 'open');
  });

  test('empty lock list never divides by zero / never claims completion', () => {
    const save = freshSave();
    assert.equal(progressFraction([], save), 0);
    assert.equal(isComplete([], save), false);
    assert.equal(nextLockId([], save), null);
  });
});

describe('duels (docs/JARLS.md, frozen mapping)', () => {
  test('exactly locks 3/6/9/12/15 are duels; everything else is not', () => {
    for (let ord = 1; ord <= 15; ord++) {
      assert.equal(isDuelOrdinal(ord), [3, 6, 9, 12, 15].includes(ord));
    }
  });

  test('duelFor returns the frozen challenger for a duel ordinal, null otherwise', () => {
    assert.equal(duelFor(3).name, 'JARL BOURJ');
    assert.equal(duelFor(15).key, 'arya');
    assert.equal(duelFor(1), null);
    assert.equal(duelFor(7), null);
  });

  test('every duel entry has a key, name, taunt, and yield line', () => {
    for (const ord of DUEL_ORDER) {
      const d = DUELS[ord];
      assert.equal(typeof d.key, 'string');
      assert.equal(typeof d.name, 'string');
      assert.ok(d.taunt.length > 0);
      assert.ok(d.yield.length > 0);
    }
  });

  test('DUEL_CAST is in duel order (matches the credits "THE CHALLENGERS" order)', () => {
    assert.deepEqual(DUEL_CAST.map((c) => c.key), ['bourj', 'rois', 'andreas', 'folklore', 'arya']);
  });
});

describe('journal formatting', () => {
  test('formatTimestamp pads to HH:MM', () => {
    assert.equal(formatTimestamp(new Date(2026, 0, 1, 4, 5)), '04:05');
  });

  test('journalLine prefixes the timestamp', () => {
    const line = journalLine('The chest is laid before you.', new Date(2026, 0, 1, 9, 30));
    assert.equal(line, '09:30 — The chest is laid before you.');
  });

  test('pushJournal appends without mutating the array reference elsewhere', () => {
    const save = freshSave();
    const before = save.journal;
    pushJournal(save, 'first line', new Date(2026, 0, 1, 1, 1));
    assert.equal(save.journal.length, 1);
    assert.notEqual(save.journal, before);
  });

  test('hintTakenLine matches the SHELL.md example phrasing', () => {
    assert.equal(hintTakenLine('fourth'), 'The horn was sounded on the fourth lock.');
  });
});

describe('numerals', () => {
  test('toRoman covers all fifteen locks', () => {
    assert.equal(toRoman(1), 'I');
    assert.equal(toRoman(4), 'IV');
    assert.equal(toRoman(9), 'IX');
    assert.equal(toRoman(15), 'XV');
  });

  test('ordinalWord covers all fifteen locks', () => {
    assert.equal(ordinalWord(1), 'first');
    assert.equal(ordinalWord(4), 'fourth');
    assert.equal(ordinalWord(15), 'fifteenth');
  });
});
