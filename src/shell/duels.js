// Duel data. Pure, no DOM. Frozen mapping + lines from docs/JARLS.md.
// Presentation only — no Lock interface change, no new save fields (defeated
// === that lock's id is in save.opened).

export const DUELS = {
  3: {
    key: 'bourj', name: 'JARL BOURJ',
    taunt: 'I have watched a thousand nights of beacons. You will miscount before I blink.',
    yield: 'So the fires do answer you. Take the road, counter of nights.',
  },
  6: {
    key: 'rois', name: 'GUDJA RØIS',
    taunt: "The giants twisted these words. Untwist them, or wear the fool's hood at my fire.",
    yield: 'You read what the giants hid. Røis names you rune-wise.',
  },
  9: {
    key: 'andreas', name: 'JARL ÅNDREAS',
    taunt: 'The hound-jarl speaks no dare. He looses it. Find the sun he already smells.',
    yield: 'Åndreas lowers his bow — and bows.',
  },
  12: {
    key: 'folklore', name: 'JARL FOLKLORE',
    taunt: 'Seat my quarrelsome kin without blood on the boards. Even I gave up and drank.',
    // The "true" yield line needs the actual boaster's name from lock 12's own
    // (undocumented, LOCKS-C-private) instance shape. Reaching into another
    // worker's internal instance fields isn't something CONTRACT.md's
    // ownership boundary supports, so this uses the fallback docs/JARLS.md
    // explicitly authorizes: "If that plumbing is awkward, use the fallback."
    yield: "Folklore raises his cup. 'The benches hold. Drink.'",
  },
  15: {
    key: 'arya', name: 'QUEEN ÄRYÄ STÖRK — the last',
    taunt: 'Fourteen shards, one law, and me. None has closed the ring while I held the horn.',
    yield: 'The Queen lowers her horn. Skål, ring-closer. The chest is yours.',
  },
};

export const DUEL_ORDER = [3, 6, 9, 12, 15].map((ord) => DUELS[ord].key);

export function duelFor(ordinal) {
  return DUELS[ordinal] || null;
}

export function isDuelOrdinal(ordinal) {
  return Object.prototype.hasOwnProperty.call(DUELS, ordinal);
}
