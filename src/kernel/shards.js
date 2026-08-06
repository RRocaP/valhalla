// The shard table and the oath-ring. FROZEN — computed once (seed 793),
// recorded in docs/LOCKS.md. Locks 1–14 return their constant; lock 15
// verifies against RING.
//
// Law of the ring (never shown to the player): each shard's value is the
// clockwise slot-distance from its own slot to the slot of the rune that
// follows it in the futhark row (ᛚ wraps to ᚠ); ᚠ hangs on the north nail
// (slot 0).

export const FUTHARK14 = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚱ', 'ᚴ', 'ᚼ', 'ᚾ', 'ᛁ', 'ᛅ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛘ', 'ᛚ'];

export const SHARDS = {
  '01-runerow':     { rune: 'ᚠ', value: 8 },
  '02-bismer':      { rune: 'ᚢ', value: 9 },
  '03-beacons':     { rune: 'ᚦ', value: 13 },
  '04-strakes':     { rune: 'ᚱ', value: 11 },
  '05-knotwork':    { rune: 'ᚴ', value: 11 },
  '06-jotunvillur': { rune: 'ᚼ', value: 9 },
  '07-tafl':        { rune: 'ᚾ', value: 13 },
  '08-hacksilver':  { rune: 'ᛁ', value: 5 },
  '09-sunstone':    { rune: 'ᛅ', value: 12 },
  '10-drottkvaett': { rune: 'ᛋ', value: 8 },
  '11-skerry':      { rune: 'ᛏ', value: 5 },
  '12-veitsla':     { rune: 'ᛒ', value: 5 },
  '13-althing':     { rune: 'ᛘ', value: 1 },
  '14-bindrune':    { rune: 'ᛚ', value: 2 },
};

// Clockwise from the north nail. The unique solution of lock 15.
export const RING = ['ᚠ', 'ᛏ', 'ᚱ', 'ᚦ', 'ᛁ', 'ᚾ', 'ᛒ', 'ᛋ', 'ᚢ', 'ᛅ', 'ᚼ', 'ᛘ', 'ᛚ', 'ᚴ'];
