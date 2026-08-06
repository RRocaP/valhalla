// VALHALLA shell strings — every player-facing shell string, en/es/ca.
// Resolved through src/kernel/i18n.js `t(SHELL_STRINGS, lang, key, params)`.
// FROZEN lines (docs/JARLS.md "Frozen localized lines", 2026-08-06) are
// verbatim and must not be reworded. Names (VALHALLA, BOURJ, RØIS, ÅNDREAS,
// FOLKLORE, ÄRYÄ STÖRK, RAMON, JARL ÅLANØ) and track titles never translate.
//
// Keys under lid.* / lockroom.* / threshold.* are rendered by screens owned
// by other workers (screens/lid.js, screens/lockroom.js, screens/threshold.js,
// duels.js) — the translations live HERE so the lead can wire them at
// integration (see artifacts/handoffs/OW-LOCALE-SHELL.md). Duel taunt/yield
// lines are duels.js data (frozen in docs/JARLS.md), not shell strings.

import { ordinalWord } from './numerals.js';

export const LANG_NAMES = { en: 'English', es: 'Español', ca: 'Català' };

export const SHELL_STRINGS = {
  // ---- threshold (rendered by screens/threshold.js) ----
  'threshold.subtitle': {
    en: 'Fifteen Locks of the Northmen',
    es: 'Quince Cerraduras de los Hombres del Norte', // FROZEN
    ca: 'Quinze Panys dels Homes del Nord', // FROZEN
  },
  'threshold.begin': {
    en: 'Lay hands on the chest',
    es: 'Pon las manos sobre el cofre',
    ca: 'Posa les mans sobre el cofre',
  },
  'threshold.continue': { en: 'Continue', es: 'Continuar', ca: 'Continua' },
  'threshold.beginAnew': { en: 'Begin anew', es: 'Empezar de nuevo', ca: 'Comença de nou' },
  'threshold.beginAnewConfirm': { en: 'Yes — begin anew', es: 'Sí — empezar de nuevo', ca: 'Sí — comença de nou' },

  // ---- shared chrome ----
  'common.neverMind': { en: 'Never mind', es: 'Déjalo estar', ca: 'Deixa-ho estar' },
  'common.close': { en: 'Close', es: 'Cerrar', ca: 'Tanca' },
  'common.continueHint': {
    en: 'tap or press Enter to continue',
    es: 'toca o pulsa Intro para continuar',
    ca: 'toca o prem Retorn per continuar',
  },
  'common.skipHint': { en: 'tap to skip', es: 'toca para saltar', ca: 'toca per ometre' },

  // ---- lid (rendered by screens/lid.js) ----
  'lid.openJournal': { en: 'Open the journal', es: 'Abrir el diario', ca: 'Obre el diari' },
  'lid.openSettings': { en: 'Open settings', es: 'Abrir ajustes', ca: 'Obre la configuració' },
  // e2e contract: under #autotest lang is forced en, so the "Lock {n}:" prefix
  // the drivers key on (tests/e2e/helpers.mjs) always holds there.
  'lid.lockLabel': {
    en: 'Lock {n}: {title} — {state}',
    es: 'Cerradura {n}: {title} — {state}',
    ca: 'Pany {n}: {title} — {state}',
  },
  'lid.state.open': { en: 'open', es: 'abierta', ca: 'obert' },
  'lid.state.next': { en: 'next', es: 'siguiente', ca: 'següent' },
  'lid.state.sealed': { en: 'sealed', es: 'sellada', ca: 'segellat' },
  'lid.barsJournal': {
    en: '{name} bars the {ord} lock.',
    es: '{name} cierra el paso a la {ord} cerradura.',
    ca: '{name} barra el pas al {ord} pany.',
  },

  // ---- settings (overlays.js) ----
  'settings.title': { en: 'Settings', es: 'Ajustes', ca: 'Configuració' },
  'settings.mute': { en: 'Mute sound', es: 'Silenciar el sonido', ca: 'Silencia el so' },
  'settings.motion': { en: 'Reduced motion', es: 'Movimiento reducido', ca: 'Moviment reduït' },
  'settings.motionFollow': { en: 'Follow system', es: 'Según el sistema', ca: 'Segons el sistema' },
  'settings.motionOn': { en: 'On', es: 'Sí', ca: 'Sí' },
  'settings.motionOff': { en: 'Off', es: 'No', ca: 'No' },
  'settings.language': { en: 'Language', es: 'Idioma', ca: 'Llengua' },
  'settings.reset': { en: 'Reset chest', es: 'Reiniciar el cofre', ca: 'Reinicia el cofre' },
  'settings.resetConfirm': { en: 'Yes — reset everything', es: 'Sí — reiniciarlo todo', ca: 'Sí — reinicia-ho tot' },

  // ---- journal (overlays.js + system lines from index.js/lockroom.js) ----
  'journal.title': { en: 'Journal', es: 'Diario', ca: 'Diari' },
  'journal.empty': { en: 'Nothing carved yet.', es: 'Aún no hay nada tallado.', ca: 'Encara no hi ha res tallat.' },
  'journal.laid': { en: 'The chest is laid before you.', es: 'El cofre está ante ti.', ca: 'El cofre és davant teu.' },
  'journal.sealedAnew': {
    en: 'The chest is sealed anew.',
    es: 'El cofre queda sellado de nuevo.',
    ca: 'El cofre torna a quedar segellat.',
  },
  // The language echo is written in the NEW language (each names its own).
  'journal.hallSpeaks': {
    en: 'The hall now speaks English.',
    es: 'El salón ahora habla español.',
    ca: 'La sala ara parla català.',
  },
  'journal.hornSounded': {
    en: 'The horn was sounded on the {ord} lock.',
    es: 'El cuerno sonó en la {ord} cerradura.',
    ca: 'El corn va sonar al {ord} pany.',
  },
  'journal.lockOpened': {
    en: 'The {ord} lock is opened: {rune} sealed at {value}.',
    es: 'La {ord} cerradura se ha abierto: {rune} sellada en {value}.',
    ca: "El {ord} pany s'ha obert: {rune} segellada a {value}.",
  },
  'journal.lockOpenedPlain': {
    en: 'The {ord} lock is opened.',
    es: 'La {ord} cerradura se ha abierto.',
    ca: "El {ord} pany s'ha obert.",
  },
  'journal.dared': { en: '{name}: "{line}"', es: '{name}: "{line}"', ca: '{name}: "{line}"' },
  'journal.yields': { en: '{name} yields: "{line}"', es: '{name} cede: "{line}"', ca: '{name} cedeix: "{line}"' },

  // ---- lock room (rendered by screens/lockroom.js) ----
  'lockroom.back': { en: 'Close the lock', es: 'Cerrar la cerradura', ca: 'Tanca el pany' },
  'lockroom.attempts': { en: 'Attempts: {n}', es: 'Intentos: {n}', ca: 'Intents: {n}' },
  'lockroom.hint': { en: 'Hint {n}', es: 'Pista {n}', ca: 'Pista {n}' },
  'lockroom.hintTaken': { en: 'Hint {n} — taken', es: 'Pista {n} — tomada', ca: 'Pista {n} — presa' },
  'lockroom.hintAvailable': { en: 'Hint {n} — available', es: 'Pista {n} — disponible', ca: 'Pista {n} — disponible' },
  'lockroom.hintLocked': { en: 'Hint {n} — not yet armed', es: 'Pista {n} — aún no armada', ca: 'Pista {n} — encara no armada' },
  'lockroom.answerDare': { en: 'Answer the dare', es: 'Responde al desafío', ca: 'Respon al desafiament' },
  // shard nouns match docs/JARLS.md frozen usage (es «esquirlas», ca «estelles»)
  'lockroom.shardSealed': { en: 'Shard sealed: {value}', es: 'Esquirla sellada: {value}', ca: 'Estella segellada: {value}' },
  'lockroom.shardSealedPlain': { en: 'Shard sealed.', es: 'Esquirla sellada.', ca: 'Estella segellada.' },

  // ---- finale (screens/finale.js) — treasure lines FROZEN per JARLS.md ----
  'finale.tebiTitle': {
    en: 'TEBI THE OSTEOPATH · Snake-in-the-Eye',
    es: 'TEBI EL OSTEÓPATA · Serpiente-en-el-Ojo', // FROZEN
    ca: "TEBI L'OSTEÒPATA · Serp-a-l'Ull", // FROZEN
  },
  'finale.tebiSub': {
    en: 'The hoard of the fifteen locks.',
    es: 'El tesoro de las quince cerraduras.', // FROZEN
    ca: 'El tresor dels quinze panys.', // FROZEN
  },
  'finale.alanoTitle': { en: 'JARL ÅLANØ', es: 'JARL ÅLANØ', ca: 'JARL ÅLANØ' },
  'finale.alanoEpithet': {
    en: 'the Troll-Burster · Friend of the Children',
    es: 'el Revientatrols · Amigo de los Niños', // FROZEN
    ca: 'el Rebentatrols · Amic dels Infants', // FROZEN
  },
  'finale.falseBottom': {
    en: 'from under the false bottom — {epithet}',
    es: 'bajo el doble fondo — {epithet}',
    ca: 'sota el doble fons — {epithet}',
  },
  'finale.alanoLine': {
    en: 'Praised in every fjord for refusing the trendy Viking sport of impaling toddlers on spears.',
    es: 'Alabado en todos los fiordos por negarse al deporte vikingo de moda: ensartar niños pequeños en lanzas.', // FROZEN
    ca: "Lloat a tots els fiords per negar-se a l'esport viking de moda: empalar criatures en llances.", // FROZEN
  },
  'finale.raiseHorns': { en: 'Raise the horns', es: 'Alzad los cuernos', ca: 'Alceu els corns' },
  'finale.sealAgain': { en: 'Seal the chest again', es: 'Sellar el cofre de nuevo', ca: 'Segella el cofre de nou' },
  'finale.sealAgainConfirm': { en: 'Yes — seal it', es: 'Sí — sellarlo', ca: "Sí — segella'l" },
  'finale.return': { en: 'Return to the chest', es: 'Volver al cofre', ca: 'Torna al cofre' },
  'finale.colophon': {
    en: 'carved by machine hands · MMXXVI',
    es: 'tallado por manos de máquina · MMXXVI', // FROZEN
    ca: 'tallat per mans de màquina · MMXXVI', // FROZEN
  },

  // ---- credits (screens/credits.js) ----
  'credits.challengers': { en: 'THE CHALLENGERS', es: 'LOS DESAFIANTES', ca: 'ELS DESAFIADORS' },
  'credits.hoard': { en: 'THE HOARD', es: 'EL TESORO', ca: 'EL TRESOR' },
  'credits.score': { en: 'THE SCORE', es: 'LA MÚSICA', ca: 'LA MÚSICA' },
  'credits.track1': { en: '"Frostbound Lullaby"', es: '"Frostbound Lullaby"', ca: '"Frostbound Lullaby"' },
  'credits.track2': { en: '"Hjá Vindi"', es: '"Hjá Vindi"', ca: '"Hjá Vindi"' },
  'credits.skip': { en: 'Skip', es: 'Saltar', ca: 'Omet' },
};

// Ordinal words for journal templates ({ord}). es agrees with «cerradura»
// (feminine), ca with «pany» (masculine). en reuses numerals.ordinalWord.
const ORDINALS = {
  es: ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava',
    'novena', 'décima', 'undécima', 'duodécima', 'decimotercera', 'decimocuarta', 'decimoquinta'],
  ca: ['primer', 'segon', 'tercer', 'quart', 'cinquè', 'sisè', 'setè', 'vuitè',
    'novè', 'desè', 'onzè', 'dotzè', 'tretzè', 'catorzè', 'quinzè'],
};

export function ordinalWordLang(n, lang) {
  if (lang === 'es' || lang === 'ca') return ORDINALS[lang][n - 1] || String(n);
  return ordinalWord(n);
}
