// The Lid (hub). docs/SHELL.md #2, docs/JARLS.md "Banner".

import { el } from '../dom.js';
import { lockState, isAccessible, nextLockId, progressFraction } from '../progress.js';
import { pushJournal } from '../journal.js';
import { ordinalWord } from '../numerals.js';
import { duelFor, isDuelOrdinal } from '../duels.js';
import { SHARDS } from '../../kernel/shards.js';

// Generic N-lock layout (not hardcoded to 15) so the same code serves the
// small dev fixtures and the real 15-lock chest identically. 5 columns max,
// wrapping into rows, with a slight per-row arc.
function medallionLayout(n, w, h) {
  const cols = Math.min(5, n) || 1;
  const rows = Math.ceil(n / cols);
  const marginX = w * 0.12;
  const top = h * 0.28;
  const gridW = w - marginX * 2;
  const gridH = h * 0.46;
  const stepY = gridH / (rows + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const countInRow = Math.min(cols, n - row * cols);
    const idxInRow = i - row * cols;
    const rowStepX = gridW / (countInRow + 1);
    const arc = countInRow > 1 ? Math.sin((idxInRow / (countInRow - 1)) * Math.PI) * (h * 0.03) : 0;
    out.push({
      x: marginX + rowStepX * (idxInRow + 1),
      y: top + stepY * (row + 1) - arc,
      r: Math.max(22, Math.min(rowStepX, stepY) * 0.42),
    });
  }
  return out;
}

export function mountLid(root, { locks, save, art, audio, reducedMotion, justOpenedId, onOpenLock, onOpenJournal, onOpenSettings }) {
  const p = art.palette;
  const screen = el('div', { class: 'screen screen-lid' });
  const medallionsLayer = el('div', { class: 'lid-medallions' });
  const haspWrap = el('div', { class: 'hasp-wrap' });
  const duelBanner = el('div', { class: 'duel-banner', style: 'display:none' });

  const journalBtn = el('button', {
    type: 'button', class: 'btn-icon journal-handle', 'aria-label': 'Open the journal',
    onClick: () => { audio.ui('slide'); onOpenJournal(); },
  }, '☰');
  const settingsBtn = el('button', {
    type: 'button', class: 'btn-icon settings-nail', 'aria-label': 'Open settings',
    onClick: () => { audio.ui('slide'); onOpenSettings(); },
  }, '⚙');
  const chrome = el('div', { class: 'lid-chrome' }, [journalBtn, settingsBtn]);

  medallionsLayer.append(duelBanner);
  screen.append(medallionsLayer, haspWrap, chrome);
  root.append(screen);

  const nextId = nextLockId(locks, save);
  const nextLock = locks.find((l) => l.id === nextId) || null;

  // Announce a duel lock the first time it's seen as armed. Idempotent via a
  // content check against the journal (no new save fields, per docs/JARLS.md).
  if (nextLock && isDuelOrdinal(nextLock.ordinal)) {
    const duel = duelFor(nextLock.ordinal);
    const marker = `${duel.name} bars the`;
    if (!save.journal.some((line) => line.includes(marker))) {
      pushJournal(save, `${duel.name} bars the ${ordinalWord(nextLock.ordinal)} lock.`);
    }
    duelBanner.textContent = duel.name;
    duelBanner.style.display = '';
  }

  const buttons = locks.map((lock) => {
    const state = lockState(locks, save, lock.id);
    const accessible = isAccessible(locks, save, lock.id);
    const btn = el('button', {
      type: 'button',
      class: 'medallion-hit',
      disabled: !accessible,
      'aria-label': `Lock ${lock.ordinal}: ${lock.title} — ${state}`,
      onClick: () => { if (!accessible) return; audio.ui('knock'); onOpenLock(lock.id); },
    });
    medallionsLayer.append(btn);
    return btn;
  });

  let cur = art.makeCanvas(1, 1);
  cur.canvas.className = 'lid-canvas';
  screen.prepend(cur.canvas);
  let hasp = art.makeCanvas(1, 1);
  hasp.canvas.className = 'hasp-canvas';
  haspWrap.append(hasp.canvas);

  let layout = [];
  const progress = progressFraction(locks, save);
  const mountedAt = performance.now();
  let raf = null;

  function paint(t) {
    art.chestScene(cur.ctx, cur.w, cur.h, t, progress);
    locks.forEach((lock, i) => {
      const pos = layout[i];
      if (!pos) return;
      art.medallion(cur.ctx, pos.x, pos.y, pos.r, lockState(locks, save, lock.id), lock.ordinal);
    });
    if (justOpenedId && !reducedMotion) {
      const idx = locks.findIndex((l) => l.id === justOpenedId);
      const pos = layout[idx];
      if (pos) {
        const strength = Math.max(0, 1 - t / 1100);
        if (strength > 0) art.glow(cur.ctx, pos.x, pos.y, pos.r * 1.8, p.goldBright, strength);
      }
    }
  }

  function paintHasp() {
    const opened = locks.filter((l) => save.opened.includes(l.id));
    const n = opened.length;
    const cell = n ? Math.min(40, hasp.w / n) : 0;
    opened.forEach((lock, i) => {
      const shard = SHARDS[lock.id];
      if (!shard) return;
      const cx = hasp.w / 2 - (n * cell) / 2 + cell * i + cell / 2;
      const cy = hasp.h / 2;
      art.drawRune(hasp.ctx, shard.rune, cx - cell * 0.28, cy - cell * 0.32, cell * 0.56, { color: p.goldBright });
      hasp.ctx.fillStyle = p.boneDim;
      hasp.ctx.font = '12px ui-monospace, monospace';
      hasp.ctx.textAlign = 'center';
      hasp.ctx.fillText(String(shard.value), cx, cy + cell * 0.42);
    });
  }

  function layoutMedallions() {
    layout = medallionLayout(locks.length, screen.clientWidth, screen.clientHeight);
    locks.forEach((lock, i) => {
      const pos = layout[i];
      const btn = buttons[i];
      btn.style.left = `${pos.x}px`;
      btn.style.top = `${pos.y}px`;
      btn.style.setProperty('--mr', `${Math.max(44, pos.r * 2)}px`);
    });
    if (nextLock) {
      const idx = locks.indexOf(nextLock);
      const pos = layout[idx];
      if (pos) {
        duelBanner.style.left = `${pos.x}px`;
        duelBanner.style.top = `${pos.y - pos.r - 14}px`;
      }
    }
  }

  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'lid-canvas';
    screen.replaceChild(fresh.canvas, cur.canvas);
    cur = fresh;
    const haspW = Math.min(w * 0.86, 640);
    const freshHasp = art.makeCanvas(haspW, 56);
    freshHasp.canvas.className = 'hasp-canvas';
    haspWrap.replaceChild(freshHasp.canvas, hasp.canvas);
    hasp = freshHasp;
    layoutMedallions();
    paint(reducedMotion ? 0 : performance.now() - mountedAt);
    paintHasp();
  }

  function loop(now) {
    paint(now - mountedAt);
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  if (!reducedMotion) raf = requestAnimationFrame(loop);

  return function unmount() {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    screen.remove();
  };
}
