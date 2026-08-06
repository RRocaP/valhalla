// Lock room. docs/SHELL.md #3, docs/CONTRACT.md §4.1, docs/JARLS.md (dare card
// + yield beat for duel locks 3/6/9/12/15).

import { el, clear, playBeat } from '../dom.js';
import { rng } from '../../kernel/rng.js';
import { hintsArmed, isComplete } from '../progress.js';
import { pushJournal, hintTakenLine } from '../journal.js';
import { toRoman, ordinalWord } from '../numerals.js';
import { duelFor } from '../duels.js';
import { portraitImage, drawPortraitPlaceholder } from '../portraits.js';
import { SHARDS } from '../../kernel/shards.js';

export function mountLockRoom(root, {
  lock, locks, save, art, audio, reducedMotion, portraitsCache,
  onPersist, onBack, onSolved,
}) {
  const p = art.palette;
  const solved = save.opened.includes(lock.id);
  const duel = duelFor(lock.ordinal);
  const showDare = !!duel && !solved;

  const screen = el('div', { class: 'screen screen-lockroom' });
  const frame = el('div', { class: 'lockroom-frame' });
  screen.append(frame);
  root.append(screen);

  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'lockroom-canvas';
  screen.prepend(bg.canvas);

  function resizeBg() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'lockroom-canvas';
    screen.replaceChild(fresh.canvas, bg.canvas);
    bg = fresh;
    art.paintPanel(bg.ctx, 0, 0, bg.w, bg.h);
  }
  window.addEventListener('resize', resizeBg);
  resizeBg();

  const header = el('div', { class: 'lockroom-header' }, [
    el('div', { class: 'ledger-numeral' }, toRoman(lock.ordinal)),
    el('h2', { class: 'lock-title' }, lock.title),
    el('p', { class: 'lock-epigraph' }, lock.epigraph),
  ]);

  const nearLine = el('p', { class: 'near-line', 'aria-live': 'polite' });
  const attemptsDots = el('div', { class: 'attempts-dots' });
  const attemptsLabel = el('span', { class: 'visually-hidden' });
  const hintHorn = el('div', { class: 'hint-horn' });
  const hintText = el('div', { class: 'hint-text' });
  const backBtn = el('button', {
    type: 'button', class: 'btn-quiet back-latch',
    onClick: () => { audio.ui('slide'); onBack(); },
  }, 'Close the lock');

  const footer = el('div', { class: 'lockroom-footer' }, [
    nearLine,
    el('div', { class: 'attempts-row' }, [attemptsDots, attemptsLabel]),
    hintHorn,
    hintText,
    backBtn,
  ]);

  const lockRootEl = el('div', { class: 'lock-root', tabindex: '-1' });
  frame.append(header, lockRootEl, footer);

  function currentAttempts() { return save.attempts[lock.id] || 0; }
  function currentHintsTaken() { return save.hints[lock.id] || []; }

  function renderAttempts() {
    const n = currentAttempts();
    attemptsLabel.textContent = `Attempts: ${n}`;
    clear(attemptsDots);
    const shown = Math.min(n, 12);
    for (let i = 0; i < shown; i++) attemptsDots.append(el('span', { class: 'dot' }));
    if (n > 12) attemptsDots.append(el('span', { class: 'dot-overflow' }, `+${n - 12}`));
  }

  function renderHints() {
    clear(hintHorn);
    clear(hintText);
    const armed = hintsArmed(currentAttempts());
    const taken = currentHintsTaken();
    for (let k = 0; k < 3; k++) {
      const isTaken = taken.includes(k);
      const isArmed = k < armed;
      const state = isTaken ? 'taken' : isArmed ? 'armed' : 'locked';
      const slot = el('button', {
        type: 'button', class: 'hint-slot', 'data-state': state,
        disabled: !isArmed && !isTaken,
        'aria-label': `Hint ${k + 1}${isTaken ? ' — taken' : isArmed ? ' — available' : ' — not yet armed'}`,
        onClick: () => takeHint(k),
      }, `Hint ${k + 1}`);
      hintHorn.append(slot);
      if (isTaken) hintText.append(el('p', {}, lock.hints[k]));
    }
  }

  function takeHint(k) {
    const taken = currentHintsTaken();
    if (taken.includes(k)) return;
    save.hints[lock.id] = [...taken, k];
    pushJournal(save, hintTakenLine(ordinalWord(lock.ordinal)));
    onPersist();
    audio.motif('hint');
    renderHints();
  }

  function shudder() {
    if (reducedMotion) return;
    frame.classList.remove('shudder');
    void frame.offsetWidth; // restart the CSS animation
    frame.classList.add('shudder');
  }

  function note(text) {
    pushJournal(save, text);
    onPersist();
  }

  const instance = lock.makePuzzle(rng('lindisfarne-793:' + lock.id));
  let lockHandle = null;
  let cancelBeat = null;

  function submit(answer) {
    const result = lock.verify(instance, answer);
    if (result.ok) {
      if (!save.opened.includes(lock.id)) {
        save.opened.push(lock.id);
        onPersist();
        beginSolveSequence();
      }
      return { ok: true };
    }
    save.attempts[lock.id] = currentAttempts() + 1;
    onPersist();
    audio.ui('deny');
    shudder();
    nearLine.textContent = result.near || '';
    renderAttempts();
    renderHints();
    return { ok: false, near: result.near };
  }

  function mountPuzzle() {
    const ctx = { root: lockRootEl, instance, art, audio, submit, note, solved };
    lockHandle = lock.mount(ctx);
    if (!showDare) lockRootEl.focus();
  }

  function beginSolveSequence() {
    if (lockHandle) { lockHandle.unmount(); lockHandle = null; }
    nearLine.textContent = '';
    if (duel) runYieldBeat(runShardCeremony);
    else runShardCeremony();
  }

  function runYieldBeat(after) {
    const overlay = el('div', { class: 'ceremony-overlay', tabindex: '-1' });
    const port = art.makeCanvas(160, 190);
    const line = el('p', { class: 'ceremony-line' }, duel.yield);
    overlay.append(port.canvas, line);
    clear(lockRootEl);
    lockRootEl.append(overlay);
    overlay.focus();
    const img = portraitsCache ? portraitImage(portraitsCache, duel.key) : null;
    const canTween = typeof art.portrait === 'function' && !!img;
    if (!canTween) drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, duel.name);
    audio.motif('yield');
    cancelBeat = playBeat({
      el: overlay, duration: 1200, reducedMotion,
      render(t) { if (canTween) art.portrait(port.ctx, img, 0, 0, port.w, port.h, { bow: t }); },
      onDone: () => {
        cancelBeat = null;
        if (!save.journal.some((l) => l.includes(duel.yield))) note(`${duel.name} yields: "${duel.yield}"`);
        after();
      },
    });
  }

  function runShardCeremony() {
    if (isComplete(locks, save)) {
      // Lock 15 has no shard of its own (LOCKS.md) — flows straight to the
      // finale rather than a hasp-inscribe ceremony (docs/JARLS.md "the last bow").
      cancelBeat = null;
      setTimeout(() => onSolved(lock.id), reducedMotion ? 0 : 400);
      return;
    }
    const shard = SHARDS[lock.id];
    audio.motif('shard');
    const overlay = el('div', { class: 'ceremony-overlay', tabindex: '-1' });
    const runeCanvas = art.makeCanvas(96, 96);
    runeCanvas.canvas.className = 'shard-rune';
    if (shard) art.drawRune(runeCanvas.ctx, shard.rune, runeCanvas.w * 0.22, runeCanvas.h * 0.08, runeCanvas.w * 0.56, { color: p.goldBright });
    const line = el('p', { class: 'ceremony-line' }, shard ? `Shard sealed: ${shard.value}` : 'Shard sealed.');
    overlay.append(runeCanvas.canvas, line);
    clear(lockRootEl);
    lockRootEl.append(overlay);
    overlay.focus();
    cancelBeat = playBeat({
      el: overlay, duration: 700, reducedMotion,
      render() {},
      onDone: () => {
        cancelBeat = null;
        audio.motif('unlock');
        note(`The ${ordinalWord(lock.ordinal)} lock is opened${shard ? `: ${shard.rune} sealed at ${shard.value}.` : '.'}`);
        onSolved(lock.id);
      },
    });
  }

  if (showDare) {
    const port = art.makeCanvas(220, 260);
    const img = portraitsCache ? portraitImage(portraitsCache, duel.key) : null;
    if (typeof art.portrait === 'function' && img) art.portrait(port.ctx, img, 0, 0, port.w, port.h, {});
    else drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, duel.name);
    const answerBtn = el('button', { type: 'button', class: 'btn-carved' }, 'Answer the dare');
    const card = el('div', { class: 'dare-card' }, [
      port.canvas,
      el('h3', { class: 'dare-name' }, duel.name),
      el('p', { class: 'dare-taunt' }, `"${duel.taunt}"`),
      answerBtn,
    ]);
    lockRootEl.append(card);
    if (!save.journal.some((l) => l.includes(duel.taunt))) {
      note(`${duel.name}: "${duel.taunt}"`);
    }
    audio.motif('dare');
    answerBtn.addEventListener('click', () => {
      audio.ui('confirm');
      clear(lockRootEl);
      mountPuzzle();
    });
    answerBtn.focus();
  } else {
    mountPuzzle();
  }

  renderAttempts();
  renderHints();

  return function unmount() {
    window.removeEventListener('resize', resizeBg);
    if (cancelBeat) cancelBeat();
    if (lockHandle) lockHandle.unmount();
    screen.remove();
  };
}
