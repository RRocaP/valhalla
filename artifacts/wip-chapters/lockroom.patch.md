# lockroom.js re-key: per-ordinal duel map → gauntlet data (lead applies)

Target: `src/shell/screens/lockroom.js` at its current state (2026-08-06 22:24,
the version shipping `const duel = duelFor(lock.ordinal)`). Six exact edits.
After this lands, dare fires at 01/04/07/10/13 (v3 chapter-opening taunts),
the heckle line at 02/05/08/11/14, the yield beat stays at 03/06/09/12/15.
No save-schema change: idempotence stays journal-derived (`journalHasLine`
checks all three languages, so a mid-save language switch never re-notes).

## 1 — import

```js
// OLD
import { duelFor } from '../duels.js';
// NEW
import { dareFor, heckleFor, yieldFor, lineFor, journalHasLine } from '../duels.js';
import { resolveLang } from '../../kernel/i18n.js';
```

## 2 — bindings (top of mountLockRoom)

```js
// OLD
  const solved = save.opened.includes(lock.id);
  const duel = duelFor(lock.ordinal);
  const showDare = !!duel && !solved;
// NEW
  const solved = save.opened.includes(lock.id);
  const lang = resolveLang(save.settings && save.settings.lang,
    typeof navigator !== 'undefined' ? navigator.language : '');
  const dare = dareFor(lock.ordinal);       // gauntlet opens: 01/04/07/10/13
  const heckle = heckleFor(lock.ordinal);   // gauntlet middle: 02/05/08/11/14
  const yieldDuel = yieldFor(lock.ordinal); // gauntlet ends:  03/06/09/12/15
  const showDare = !!dare && !solved;
```

## 3 — heckle: small header line + one journal note (docs/JARLS.md §Heckles)

```js
// OLD
  const header = el('div', { class: 'lockroom-header' }, [
    el('div', { class: 'ledger-numeral' }, toRoman(lock.ordinal)),
    headerTitle,
    el('p', { class: 'lock-epigraph' }, lock.epigraph),
  ]);
// NEW
  const header = el('div', { class: 'lockroom-header' }, [
    el('div', { class: 'ledger-numeral' }, toRoman(lock.ordinal)),
    headerTitle,
    el('p', { class: 'lock-epigraph' }, lock.epigraph),
    heckle && !solved ? el('p', { class: 'heckle-line' }, lineFor(heckle.heckle, lang)) : null,
  ]);
  if (heckle && !solved && !journalHasLine(save, heckle.heckle)) {
    pushJournal(save, `${heckle.name}: "${lineFor(heckle.heckle, lang)}"`);
    onPersist();
  }
```

And append to the `roomStyle.textContent` template literal (before the closing backtick):

```css
  #app .heckle-line{margin:6px auto 0;max-width:52ch;font-style:italic;font-size:.86rem;
    letter-spacing:.02em;color:var(--bone);opacity:.85;text-shadow:0 1px 0 rgba(12,9,6,.85)}
```

## 4 — yield trigger

```js
// OLD
    if (duel) runYieldBeat(runShardCeremony);
// NEW
    if (yieldDuel) runYieldBeat(runShardCeremony);
```

## 5 — runYieldBeat body (four references)

```js
// OLD
      el('div', { class: 'yield-banner', 'aria-hidden': 'true' }, duel.name),
      port.canvas,
    ]);
    const line = el('p', { class: 'ceremony-line' }, duel.yield);
// NEW
      el('div', { class: 'yield-banner', 'aria-hidden': 'true' }, yieldDuel.name),
      port.canvas,
    ]);
    const line = el('p', { class: 'ceremony-line' }, lineFor(yieldDuel.yield, lang));
```

```js
// OLD (the runYieldBeat occurrence — three lines together disambiguate it)
    const img = portraitsCache ? portraitImage(portraitsCache, duel.key) : null;
    const canTween = typeof art.portrait === 'function' && !!img;
    if (!canTween) drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, duel.name);
// NEW
    const img = portraitsCache ? portraitImage(portraitsCache, yieldDuel.key) : null;
    const canTween = typeof art.portrait === 'function' && !!img;
    if (!canTween) drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, yieldDuel.name);
```

```js
// OLD
        if (!save.journal.some((l) => l.includes(duel.yield))) note(`${duel.name} yields: "${duel.yield}"`);
// NEW
        if (!journalHasLine(save, yieldDuel.yield)) note(`${yieldDuel.name} yields: "${lineFor(yieldDuel.yield, lang)}"`);
```

## 6 — dare block (five references)

```js
// OLD (the dare-block occurrence)
    const img = portraitsCache ? portraitImage(portraitsCache, duel.key) : null;
    if (typeof art.portrait === 'function' && img) art.portrait(port.ctx, img, 0, 0, port.w, port.h, { rim: 0.9 });
    else drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, duel.name);
// NEW
    const img = portraitsCache ? portraitImage(portraitsCache, dare.key) : null;
    if (typeof art.portrait === 'function' && img) art.portrait(port.ctx, img, 0, 0, port.w, port.h, { rim: 0.9 });
    else drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, dare.name);
```

```js
// OLD
      art, text: duel.name, size: 30, className: 'dare-name', depth: 0.9,
// NEW
      art, text: dare.name, size: 30, className: 'dare-name', depth: 0.9,
```

```js
// OLD
      el('p', { class: 'dare-taunt' }, `"${duel.taunt}"`),
// NEW
      el('p', { class: 'dare-taunt' }, `"${lineFor(dare.taunt, lang)}"`),
```

```js
// OLD
    if (!save.journal.some((l) => l.includes(duel.taunt))) {
      note(`${duel.name}: "${duel.taunt}"`);
    }
// NEW
    if (!journalHasLine(save, dare.taunt)) {
      note(`${dare.name}: "${lineFor(dare.taunt, lang)}"`);
    }
```

## After this patch

- `duels.js`'s legacy block (`DUELS`, `duelFor`, `isDuelOrdinal`, the v2 taunt
  strings) has no runtime consumer left; it still feeds `tests/e2e/helpers.mjs`
  and `tests/unit/shell.test.mjs` (both lead-owned) plus `DUEL_CAST`
  (credits order — already derived from GAUNTLETS, keep it). Delete the v2
  `LEGACY_TAUNTS` + `DUELS` + `duelFor` + `isDuelOrdinal` in the same
  integration that re-keys those tests.
- Spec/helper changes required (exact list in artifacts/handoffs/OW-CHAPTERS.md).
