// Journal line formatting + append. Pure, no DOM. Every line is timestamped
// text (docs/SHELL.md: "every note() line + system lines, timestamped").

export function formatTimestamp(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function journalLine(text, date = new Date()) {
  return `${formatTimestamp(date)} — ${text}`;
}

// Mutates save.journal (the save object is already the live working state);
// returns the new array for convenience.
export function pushJournal(save, text, date = new Date()) {
  save.journal = [...save.journal, journalLine(text, date)];
  return save.journal;
}

// Matches the exact phrasing given in docs/SHELL.md ("The horn was sounded on
// the fourth lock").
export function hintTakenLine(ordinalWordStr) {
  return `The horn was sounded on the ${ordinalWordStr} lock.`;
}
