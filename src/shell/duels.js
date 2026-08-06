// Gauntlet data. Pure, no DOM. Frozen mapping + lines from docs/JARLS.md v3:
// fifteen locks in FIVE GAUNTLETS of three. Each jarl OWNS a gauntlet — the
// dare card fires on its first lock, the heckle lands on its middle lock, the
// yield beat on its last. Presentation only — no Lock interface change, no
// new save fields (defeated === the gauntlet's yieldAt lock is in
// save.opened; wager-seen === the wager line exists in save.journal).
//
// Every player-facing line is trilingual { en, es, ca } (docs/JARLS.md v3,
// VERBATIM), consumed via the src/kernel/i18n.js dictionary shape. Names
// (BOURJ, RØIS, ÅNDREAS, FOLKLORE, ÄRYÄ STÖRK) and VALHALLA never translate.

// The wager (framing card, shown once after the threshold gesture).
export const WAGER = {
  en: "Queen Ärya Störk's sea-chest stands in the hall: fifteen locks, five sworn jarls to bar the way, and the hoard for whoever opens them all before the spring sailing. The first lock waits — and Jarl Bourj already stands over it.",
  es: 'El cofre de la reina Ärya Störk se alza en el salón: quince cerraduras, cinco jarls juramentados cerrando el paso, y el tesoro para quien las abra todas antes de la partida de primavera. La primera cerradura aguarda — y el jarl Bourj ya está plantado sobre ella.',
  ca: "El cofre de la reina Ärya Störk s'alça a la sala: quinze panys, cinc jarls jurats barrant el pas, i el tresor per a qui els obri tots abans de la sortida de primavera. El primer pany espera — i el jarl Bourj ja hi és plantat al damunt.",
};

// GAUNTLET / DESAFÍO / REPTE + Roman numeral + name — chapter titles for the
// lid labels and the chapter-card interstitial (title uses the short name).
const CHAPTER_WORD = { en: 'GAUNTLET', es: 'DESAFÍO', ca: 'REPTE' };

export const GAUNTLETS = [
  {
    key: 'bourj', name: 'JARL BOURJ', shortName: 'JARL BOURJ',
    numeral: 'I', locks: [1, 2, 3], dareAt: 1, heckleAt: 2, yieldAt: 3,
    taunt: {
      en: 'I have watched a thousand hands at this row. Every one left humbler. Three locks are mine — begin.',
      es: 'He visto mil manos en esta hilera. Todas se marcharon más humildes. Tres cerraduras son mías — empieza.',
      ca: 'He vist mil mans en aquesta filera. Totes van marxar més humils. Tres panys són meus — comença.',
    },
    heckle: {
      en: 'Bourj counts your wrong turns aloud. He is enjoying this.',
      es: 'Bourj cuenta en voz alta tus pasos en falso. Está disfrutando.',
      ca: "En Bourj compta en veu alta els teus passos en fals. S'ho està passant bé.",
    },
    yield: {
      en: 'So the fires do answer you. Take the road, counter of nights.',
      es: 'Así que los fuegos te responden. Toma el camino, contador de noches.',
      ca: 'Així que els focs et responen. Pren el camí, comptador de nits.',
    },
  },
  {
    key: 'rois', name: 'GUDJA RØIS', shortName: 'GUDJA RØIS',
    numeral: 'II', locks: [4, 5, 6], dareAt: 4, heckleAt: 5, yieldAt: 6,
    taunt: {
      en: 'Nine planks and one lie — I saw it before the shipwright spoke. My three locks will read you like weather.',
      es: 'Nueve tablones y una mentira — la vi antes de que hablara el carpintero. Mis tres cerraduras te leerán como al tiempo.',
      ca: "Nou taulons i una mentida — la vaig veure abans que parlés el mestre d'aixa. Els meus tres panys et llegiran com el temps.",
    },
    heckle: {
      en: 'Røis turns a cold coin, unsurprised by anything you do.',
      es: 'Røis hace girar una moneda fría, sin sorprenderse de nada de lo que haces.',
      ca: "En Røis fa girar una moneda freda, sense sorprendre's de res del que fas.",
    },
    yield: {
      en: 'You read what the giants hid. Røis names you rune-wise.',
      es: 'Has leído lo que los gigantes ocultaron. Røis te nombra sabio en runas.',
      ca: "Has llegit el que els gegants van amagar. Røis t'anomena savi en runes.",
    },
  },
  {
    key: 'andreas', name: 'JARL ÅNDREAS', shortName: 'JARL ÅNDREAS',
    numeral: 'III', locks: [7, 8, 9], dareAt: 7, heckleAt: 8, yieldAt: 9,
    taunt: {
      en: 'The hound-jarl sets the board and says nothing. Three locks — and he smells your first mistake already.',
      es: 'El jarl-sabueso dispone el tablero y no dice nada. Tres cerraduras — y ya huele tu primer error.',
      ca: 'El jarl-gos para el tauler i no diu res. Tres panys — i ja ensuma el teu primer error.',
    },
    heckle: {
      en: "The hound-jarl's eyes follow your hands. He does not blink.",
      es: 'Los ojos del jarl-sabueso siguen tus manos. No parpadea.',
      ca: 'Els ulls del jarl-gos segueixen les teves mans. No parpelleja.',
    },
    yield: {
      en: 'Åndreas lowers his bow — and bows.',
      es: 'Åndreas baja el arco — y se inclina.',
      ca: "L'Åndreas abaixa l'arc — i s'inclina.",
    },
  },
  {
    key: 'folklore', name: 'JARL FOLKLORE', shortName: 'JARL FOLKLORE',
    numeral: 'IV', locks: [10, 11, 12], dareAt: 10, heckleAt: 11, yieldAt: 12,
    taunt: {
      en: 'Verse, benches, and quarrelsome kin — my three locks. Fill your cup first; you will need the courage.',
      es: 'Versos, bancos y parentela pendenciera — mis tres cerraduras. Llena antes tu copa; te hará falta el valor.',
      ca: "Versos, bancs i parentela busca-raons — els meus tres panys. Omple't abans la copa; et caldrà el coratge.",
    },
    heckle: {
      en: "Folklore refills his cup. 'Take your time. The mead won't.'",
      es: 'Folklore rellena su copa. “Tómate tu tiempo. El hidromiel no lo hará.”',
      ca: "En Folklore s'omple la copa. “Pren-t'ho amb calma. La mel fermentada no ho farà.”",
    },
    // The "true" yield line needs the actual boaster's name from lock 12's own
    // (undocumented, LOCKS-C-private) instance shape. Reaching into another
    // worker's internal instance fields isn't something CONTRACT.md's
    // ownership boundary supports, so this uses the fallback docs/JARLS.md
    // explicitly authorizes: "If that plumbing is awkward, use the fallback."
    yield: {
      en: "Folklore raises his cup. 'The benches hold. Drink.'",
      es: 'Folklore alza la copa. “Los bancos aguantan. Bebe.”',
      ca: 'En Folklore alça la copa. “Els bancs aguanten. Beu.”',
    },
  },
  {
    key: 'arya', name: 'QUEEN ÄRYÄ STÖRK — the last', shortName: 'QUEEN ÄRYÄ STÖRK',
    numeral: 'V', locks: [13, 14, 15], dareAt: 13, heckleAt: 14, yieldAt: 15,
    taunt: {
      en: 'The last three are mine. No one has stood where you stand and left this hall with the hoard.',
      es: 'Las tres últimas son mías. Nadie ha estado donde tú estás y ha salido de este salón con el tesoro.',
      ca: 'Els tres últims són meus. Ningú no ha estat on ets tu i ha sortit d\'aquesta sala amb el tresor.',
    },
    heckle: {
      en: 'The Queen has not looked away since her gauntlet began.',
      es: 'La Reina no ha apartado la mirada desde que empezó su desafío.',
      ca: 'La Reina no ha apartat la mirada des que va començar el seu repte.',
    },
    yield: {
      en: 'The Queen lowers her horn. Skål, ring-closer. The chest is yours.',
      es: 'La Reina baja su cuerno. Skål, cerrador del anillo. El cofre es tuyo.',
      ca: 'La Reina abaixa el corn. Skål, tancador de l\'anell. El cofre és teu.',
    },
  },
];

// "GAUNTLET I — JARL BOURJ" style, per-language chapter word, names verbatim.
for (const g of GAUNTLETS) {
  g.title = {
    en: `${CHAPTER_WORD.en} ${g.numeral} — ${g.shortName}`,
    es: `${CHAPTER_WORD.es} ${g.numeral} — ${g.shortName}`,
    ca: `${CHAPTER_WORD.ca} ${g.numeral} — ${g.shortName}`,
  };
}

export function gauntletFor(ordinal) {
  return GAUNTLETS.find((g) => g.locks.includes(ordinal)) || null;
}
export function dareFor(ordinal) {
  return GAUNTLETS.find((g) => g.dareAt === ordinal) || null;
}
export function heckleFor(ordinal) {
  return GAUNTLETS.find((g) => g.heckleAt === ordinal) || null;
}
export function yieldFor(ordinal) {
  return GAUNTLETS.find((g) => g.yieldAt === ordinal) || null;
}

// lineFor({en,es,ca}, lang) -> the language's line, en fallback (i18n.js law:
// never throws, never blanks).
export function lineFor(line, lang) {
  return (line && (line[lang] || line.en)) || '';
}

// Journal-derived idempotence (no new save fields): has this trilingual line
// already been echoed into the journal in ANY language? Robust to the player
// switching languages between sessions.
export function journalHasLine(save, line) {
  if (!save || !Array.isArray(save.journal) || !line) return false;
  const variants = ['en', 'es', 'ca'].map((k) => line[k]).filter(Boolean);
  return save.journal.some((entry) => variants.some((v) => entry.includes(v)));
}

// Credits order (THE CHALLENGERS) — derived from the gauntlet table.
export const DUEL_CAST = GAUNTLETS.map((g) => ({ key: g.key, name: g.name }));
