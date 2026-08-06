// Lock room. docs/SHELL.md #3, docs/CONTRACT.md §4.1, docs/JARLS.md (dare card
// + yield beat for duel locks 3/6/9/12/15).

import { el, clear, playBeat, carvedHeading } from '../dom.js';
import { rng } from '../../kernel/rng.js';
import { hintsArmed, isComplete } from '../progress.js';
import { pushJournal, hintTakenLine } from '../journal.js';
import { toRoman, ordinalWord } from '../numerals.js';
import { duelFor } from '../duels.js';
import { portraitImage, drawPortraitPlaceholder } from '../portraits.js';

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

  // Presentation-only styles for this screen (loop-2 escalation): the carved
  // primary's seated disabled state, the horn hint slots, the shard strike
  // reveal, and the yield banner. `#app` prefix outranks style.js at equal
  // source order without touching shell-owned files.
  const roomStyle = el('style');
  roomStyle.textContent = `
  #app .btn-carved[disabled]{opacity:.42;filter:saturate(.3) brightness(.85);transform:none;cursor:default;
    box-shadow:0 2px 0 rgba(12,9,6,.6),0 3px 6px rgba(12,9,6,.4),inset 0 0 0 1px rgba(42,29,5,.45)}
  #app .hint-slot{border:0;background:none;display:inline-flex;align-items:center;gap:7px;padding:4px 8px;min-height:44px;
    font-family:var(--font-display);font-variant-caps:all-small-caps;letter-spacing:.14em;font-size:.85rem}
  #app .hint-slot canvas{display:block}
  #app .hint-slot[data-state="locked"]{opacity:.8;color:rgba(183,169,140,.6)}
  #app .hint-slot[data-state="armed"]{color:var(--goldBright)}
  #app .hint-slot[data-state="taken"]{color:var(--bone);cursor:default}
  .ceremony-shard .carved-heading{opacity:0;transform:translateY(10px);transition:opacity .4s ease,transform .4s ease}
  .ceremony-shard.struck .carved-heading{opacity:1;transform:none}
  .yield-stage{position:relative;display:inline-block;margin:0 auto}
  .yield-stage canvas{position:relative;z-index:1}
  .yield-banner{position:absolute;left:50%;top:6px;z-index:0;transform:translate(-50%,-100%);
    color:var(--bone);font-family:var(--font-display);font-variant-caps:small-caps;font-weight:600;
    letter-spacing:.14em;font-size:.82rem;white-space:nowrap;padding:7px 22px 9px;background:var(--blood);
    background-image:linear-gradient(180deg,rgba(238,207,109,.3) 0,rgba(238,207,109,0) 3px),
      linear-gradient(180deg,rgba(255,241,199,.12),rgba(12,9,6,.08) 40%,rgba(12,9,6,.4));
    clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(50% + 8px) calc(100% - 8px),50% 100%,calc(50% - 8px) calc(100% - 8px),0 calc(100% - 8px));
    filter:drop-shadow(0 2px 1px rgba(12,9,6,.75)) drop-shadow(0 5px 8px rgba(12,9,6,.45));
    text-shadow:0 1px 0 rgba(12,9,6,.75);animation:yield-lower .95s cubic-bezier(.22,1,.36,1) both}
  @keyframes yield-lower{from{transform:translate(-50%,-320%);opacity:0}to{transform:translate(-50%,-100%);opacity:1}}
  @media (prefers-reduced-motion: reduce){
    .yield-banner{animation:none}
    .ceremony-shard .carved-heading{transition:none}
  }
  #app.reduced-motion .yield-banner{animation:none}
  #app.reduced-motion .ceremony-shard .carved-heading{transition:none}`;
  screen.append(roomStyle);

  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'lockroom-canvas';
  screen.prepend(bg.canvas);

  // 'board' draws the architrave tray around the mounted puzzle; 'dare' and
  // 'beat' leave the stage to the card/overlay. Furniture is repainted only
  // when the measured content box actually moves (state-keyed, no per-frame
  // work — docs/QUALITY.md latency law).
  let furnitureMode = 'board';
  let lastFurnitureKey = '';

  function contentBox() {
    if (furnitureMode !== 'board') return null;
    const inner = lockRootEl.firstElementChild;
    if (!inner) return null;
    const r = inner.getBoundingClientRect();
    const s = screen.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return null;
    const pad = 16;
    const band = Math.max(18, Math.min(30, r.width * 0.03));
    const headerBottom = header.getBoundingClientRect().bottom - s.top;
    const x = Math.max(band + 14, r.left - s.left - pad);
    const y = Math.max(headerBottom + band + 8, r.top - s.top - pad);
    const wdt = Math.min(screen.clientWidth - band - 14 - x, r.width + pad * 2);
    const hgt = Math.min(screen.clientHeight - band - 16 - y, r.height + pad * 2);
    if (wdt < 80 || hgt < 80) return null;
    return { x, y, w: wdt, h: hgt, band };
  }

  function paintBg() {
    const box = contentBox();
    const key = `${bg.w}x${bg.h}|${furnitureMode}|${box ? [box.x, box.y, box.w, box.h].map(Math.round).join(',') : '-'}`;
    if (key === lastFurnitureKey) return;
    lastFurnitureKey = key;
    art.paintWood(bg.ctx, bg.w, bg.h, 793, { shade: 0.2 });
    art.paintPanel(bg.ctx, 0, 0, bg.w, bg.h, { seed: `lock-${lock.id}` });
    // chip-carved run just inside the room's gold trim — the frame is an
    // architrave, not a picture border
    if (typeof art.chipBorder === 'function' && bg.w > 500) {
      art.chipBorder(bg.ctx, 30, 30, bg.w - 60, bg.h - 60, { size: 9, alpha: 0.55 });
    }
    // quiet tool history in the dead zones, never under the puzzle column
    if (typeof art.wear === 'function') {
      const avoid = box
        ? { x: box.x - box.band - 8, y: box.y - box.band - 8, w: box.w + box.band * 2 + 16, h: box.h + box.band * 2 + 16 }
        : { x: bg.w * 0.5 - 410, y: 0, w: 820, h: bg.h };
      art.wear(bg.ctx, bg.w, bg.h, `room-${lock.id}`, { avoid });
    }
    if (box && typeof art.tray === 'function') {
      art.tray(bg.ctx, box.x, box.y, box.w, box.h, {
        band: box.band, seed: lock.id, ribbon: box.w > 430, chipAlpha: 0.7,
      });
    }
  }

  function resizeBg() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'lockroom-canvas';
    screen.replaceChild(fresh.canvas, bg.canvas);
    bg = fresh;
    lastFurnitureKey = '';
    paintBg();
    if (headerTitle) {
      const freshTitle = carvedHeading('h2', {
        art, text: lock.title, size: headerTitleSize(), className: 'lock-title', depth: 0.95,
      });
      header.replaceChild(freshTitle, headerTitle);
      headerTitle = freshTitle;
    }
  }

  // Lock header: one of docs/ART.md's three full-depth carveText call-outs.
  // Declared BEFORE resizeBg is first called — resizeBg re-renders the carved
  // title on resize and reads all three of these bindings.
  const headerTitleSize = () => Math.round(Math.max(22, Math.min(40, screen.clientWidth * 0.028 + 12)));
  let headerTitle = carvedHeading('h2', {
    art, text: lock.title, size: headerTitleSize(), className: 'lock-title', depth: 0.95,
  });
  const header = el('div', { class: 'lockroom-header' }, [
    el('div', { class: 'ledger-numeral' }, toRoman(lock.ordinal)),
    headerTitle,
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

  // resizeBg reads header + lockRootEl (via contentBox), so it may only run
  // once both exist — the TDZ class of bug QUALITY_PLAY_01 §4 recorded.
  window.addEventListener('resize', resizeBg);
  resizeBg();

  // The tray hugs the mounted board: re-measure when the board's own size
  // changes (rows opening, tells appearing), rAF-debounced, repaint only on a
  // real move (paintBg is keyed on the measured box).
  let furnitureRaf = 0;
  const scheduleFurniture = () => {
    if (furnitureRaf) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 32);
    furnitureRaf = raf(() => { furnitureRaf = 0; paintBg(); });
  };
  let contentRO = null;
  if (typeof ResizeObserver === 'function') {
    contentRO = new ResizeObserver(scheduleFurniture);
    contentRO.observe(lockRootEl);
  }

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

  // A carved drinking horn per hint slot: tar-cold ghost carve when locked,
  // gilded and ember-lit when armed, seated gold when drunk. The canvas is
  // decoration; class, data-state, label and click stay exactly as the
  // contracts pin them (tests/e2e/journey.spec.mjs).
  function drawHornInto(c, w, h, state) {
    const p2 = art.palette;
    const body = (cc) => {
      cc.moveTo(w * 0.1, h * 0.22);
      cc.bezierCurveTo(w * 0.4, h * 0.02, w * 0.72, h * 0.1, w * 0.88, h * 0.5);
      cc.bezierCurveTo(w * 0.96, h * 0.72, w * 0.94, h * 0.9, w * 0.9, h * 0.94);
      cc.bezierCurveTo(w * 0.82, h * 0.86, w * 0.6, h * 0.72, w * 0.42, h * 0.66);
      cc.bezierCurveTo(w * 0.28, h * 0.62, w * 0.14, h * 0.5, w * 0.1, h * 0.22);
      cc.closePath();
    };
    c.save();
    if (state === 'locked') {
      c.fillStyle = `rgba(12,9,6,.55)`;
      c.beginPath(); body(c); c.fill();
      c.strokeStyle = `rgba(183,169,140,.4)`;
      c.lineWidth = 1.2;
      c.beginPath(); body(c); c.stroke();
    } else {
      if (state === 'armed') art.glow(c, w * 0.5, h * 0.55, w * 0.52, p2.ember, 0.5);
      const g = c.createLinearGradient(0, 0, w, h);
      if (state === 'armed') {
        g.addColorStop(0, p2.goldBright); g.addColorStop(0.5, p2.gold); g.addColorStop(1, '#6f5713');
      } else {
        g.addColorStop(0, p2.gold); g.addColorStop(0.55, '#8a6d18'); g.addColorStop(1, '#4c3a0e');
      }
      c.fillStyle = g;
      c.beginPath(); body(c); c.fill();
      c.strokeStyle = `rgba(12,9,6,.8)`;
      c.lineWidth = 1.3;
      c.beginPath(); body(c); c.stroke();
      // mouth rim + two strap bands
      c.strokeStyle = state === 'armed' ? p2.goldBright : `rgba(238,207,109,.55)`;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(w * 0.115, h * 0.24, w * 0.045, h * 0.17, -0.5, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(w * 0.34, h * 0.1); c.lineTo(w * 0.3, h * 0.6); c.stroke();
      c.beginPath(); c.moveTo(w * 0.62, h * 0.16); c.lineTo(w * 0.56, h * 0.68); c.stroke();
      // specular along the belly
      c.strokeStyle = `rgba(233,220,195,${state === 'armed' ? 0.6 : 0.3})`;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(w * 0.24, h * 0.26); c.quadraticCurveTo(w * 0.56, h * 0.24, w * 0.78, h * 0.52); c.stroke();
    }
    c.restore();
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
      const horn = art.makeCanvas(44, 32);
      horn.canvas.setAttribute('aria-hidden', 'true');
      drawHornInto(horn.ctx, horn.w, horn.h, state);
      const slot = el('button', {
        type: 'button', class: 'hint-slot', 'data-state': state,
        disabled: !isArmed && !isTaken,
        'aria-label': `Hint ${k + 1}${isTaken ? ' — taken' : isArmed ? ' — available' : ' — not yet armed'}`,
        onClick: () => takeHint(k),
      }, [horn.canvas, el('span', {}, `Hint ${k + 1}`)]);
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
    furnitureMode = 'board';
    scheduleFurniture();
    if (!showDare) lockRootEl.focus();
  }

  function beginSolveSequence() {
    if (lockHandle) { lockHandle.unmount(); lockHandle = null; }
    nearLine.textContent = '';
    furnitureMode = 'beat';
    paintBg();
    if (duel) runYieldBeat(runShardCeremony);
    else runShardCeremony();
  }

  function runYieldBeat(after) {
    const overlay = el('div', { class: 'ceremony-overlay', tabindex: '-1' });
    const port = art.makeCanvas(160, 190);
    // the challenger's war-banner lowers behind the portrait as the bow lands
    const stage = el('div', { class: 'yield-stage' }, [
      el('div', { class: 'yield-banner', 'aria-hidden': 'true' }, duel.name),
      port.canvas,
    ]);
    const line = el('p', { class: 'ceremony-line' }, duel.yield);
    overlay.append(stage, line);
    clear(lockRootEl);
    lockRootEl.append(overlay);
    overlay.focus();
    const img = portraitsCache ? portraitImage(portraitsCache, duel.key) : null;
    const canTween = typeof art.portrait === 'function' && !!img;
    if (!canTween) drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, duel.name);
    audio.motif('yield');
    cancelBeat = playBeat({
      el: overlay, duration: 1200, reducedMotion,
      render(t) { if (canTween) art.portrait(port.ctx, img, 0, 0, port.w, port.h, { bow: t, rim: 0.5 * (1 - t * 0.5) }); },
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
    // shard(instance) is part of the Lock interface (CONTRACT §4) and its
    // value is documented as instance-independent — calling it directly
    // works for every lock, real or fixture, unlike keying into the frozen
    // kernel SHARDS table (which only knows the real 01..14 ids).
    const shard = lock.shard(instance);
    audio.motif('shard');
    const overlay = el('div', { class: 'ceremony-overlay ceremony-shard', tabindex: '-1' });
    const RC = 132;
    const runeCanvas = art.makeCanvas(RC, RC);
    runeCanvas.canvas.className = 'shard-rune';
    // Shard numerals: the third full-depth carveText call-out (docs/ART.md).
    const line = carvedHeading('p', {
      art,
      text: shard ? `Shard sealed: ${shard.value}` : 'Shard sealed.',
      size: 34, className: 'ceremony-line', depth: 1, color: p.goldBright, letterSpacing: 2,
    });
    overlay.append(runeCanvas.canvas, line);
    clear(lockRootEl);
    lockRootEl.append(overlay);
    overlay.focus();

    // 1.5s of glory: the rune STRIKES into the hasp — under-shadow first,
    // face ribbon swelling to full chisel weight, ember spall flying off the
    // fresh cut — then the value inscribes with a chisel knock. Reduced
    // motion renders the finished strike once (playBeat renders t=1).
    let struckCue = false;
    const renderStrike = (t) => {
      const c = runeCanvas.ctx;
      c.clearRect(0, 0, RC, RC);
      if (shard) {
        const carveT = Math.min(1, t / 0.55);
        const ease = carveT * carveT * (3 - 2 * carveT);
        art.glow(c, RC * 0.5, RC * 0.52, RC * (0.34 + 0.24 * ease), p.ember, 0.25 + 0.4 * ease);
        c.save();
        c.globalAlpha = 0.3 + 0.7 * ease;
        art.drawRune(c, shard.rune, RC * 0.22, RC * 0.08, RC * 0.56, {
          color: p.goldBright,
          weight: (RC * 0.56 / 7.5) * (0.45 + 0.55 * ease),
          glow: 0.2 + 0.35 * ease,
        });
        c.restore();
        // ember spall: deterministic sparks while the chisel bites
        if (t > 0.04 && t < 0.85 && !reducedMotion) {
          for (let k = 0; k < 9; k++) {
            const a = k * 2.399 + 0.7;
            const throwT = Math.min(1, Math.max(0, (t - k * 0.05) / 0.5));
            if (throwT <= 0 || throwT >= 1) continue;
            const rr = RC * (0.12 + throwT * 0.42);
            const sx = RC * 0.5 + Math.cos(a) * rr;
            const sy = RC * 0.52 + Math.sin(a) * rr * 0.8 + throwT * throwT * RC * 0.1;
            c.save();
            c.globalAlpha = (1 - throwT) * 0.85;
            c.fillStyle = k % 3 ? p.goldBright : p.ember;
            c.beginPath();
            c.arc(sx, sy, Math.max(0.8, RC * 0.014 * (1 - throwT)), 0, Math.PI * 2);
            c.fill();
            c.restore();
          }
        }
      }
      if (t >= 0.58 && !struckCue) {
        struckCue = true;
        overlay.classList.add('struck');
        audio.ui('knock');
      }
    };
    cancelBeat = playBeat({
      el: overlay, duration: 1500, reducedMotion,
      render: renderStrike,
      onDone: () => {
        cancelBeat = null;
        audio.motif('unlock');
        note(`The ${ordinalWord(lock.ordinal)} lock is opened${shard ? `: ${shard.rune} sealed at ${shard.value}.` : '.'}`);
        onSolved(lock.id);
      },
    });
  }

  if (showDare) {
    // Dare theatre: the room darkens to a vignette, the portrait warms up
    // under a hearth rim-light, the name plate is carved, the taunt set like
    // an inscription. Entrance styles live in style.js; reduced motion drops
    // every animation and lands on the fully-lit final state.
    const vignette = el('div', { class: 'dare-vignette', 'aria-hidden': 'true' });
    const port = art.makeCanvas(220, 260);
    port.canvas.className = 'dare-portrait';
    const img = portraitsCache ? portraitImage(portraitsCache, duel.key) : null;
    if (typeof art.portrait === 'function' && img) art.portrait(port.ctx, img, 0, 0, port.w, port.h, { rim: 0.9 });
    else drawPortraitPlaceholder(port.ctx, p, 0, 0, port.w, port.h, duel.name);
    const answerBtn = el('button', { type: 'button', class: 'btn-carved' }, 'Answer the dare');
    const namePlate = carvedHeading('h3', {
      art, text: duel.name, size: 30, className: 'dare-name', depth: 0.9,
      color: p.goldBright, letterSpacing: 3,
    });
    const card = el('div', { class: 'dare-card' }, [
      port.canvas,
      namePlate,
      el('p', { class: 'dare-taunt' }, `"${duel.taunt}"`),
      answerBtn,
    ]);
    furnitureMode = 'dare';
    paintBg();
    lockRootEl.append(vignette, card);
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
    if (contentRO) contentRO.disconnect();
    if (furnitureRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(furnitureRaf);
    if (cancelBeat) cancelBeat();
    if (lockHandle) lockHandle.unmount();
    screen.remove();
  };
}
