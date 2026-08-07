// Lock room. docs/SHELL.md #3, docs/CONTRACT.md §4.1, docs/JARLS.md (dare card
// + yield beat for duel locks 3/6/9/12/15).

import { el, clear, playBeat, carvedHeading } from '../dom.js';
import { rng } from '../../kernel/rng.js';
import { hintsArmed, isComplete } from '../progress.js';
import { pushJournal, hintTakenLine } from '../journal.js';
import { toRoman, ordinalWord } from '../numerals.js';
import { dareFor, heckleFor, yieldFor, lineFor, journalHasLine } from '../duels.js';
import { portraitImage, drawPortraitPlaceholder } from '../portraits.js';
import { applyMood, moodTint } from '../../art/moods.js';
import { resolveLang, lockText, localizeNear } from '../../kernel/i18n.js';

export function mountLockRoom(root, {
  lock, locks, save, art, audio, reducedMotion, portraitsCache,
  onPersist, onBack, onSolved,
}) {
  const p = art.palette;
  const solved = save.opened.includes(lock.id);
  const lang = resolveLang(save.settings && save.settings.lang,
    typeof navigator !== 'undefined' ? navigator.language : '');
  const locText = lockText(lock, lang);
  const dare = dareFor(lock.ordinal);       // gauntlet opens: 01/04/07/10/13
  const heckle = heckleFor(lock.ordinal);   // gauntlet middle: 02/05/08/11/14
  const yieldDuel = yieldFor(lock.ordinal); // gauntlet ends:  03/06/09/12/15
  const showDare = !!dare && !solved;

  const screen = el('div', { class: 'screen screen-lockroom' });
  const frame = el('div', { class: 'lockroom-frame' });
  screen.append(frame);
  root.append(screen);

  // Which gauntlet's hall this room stands in (docs/JARLS.md: five gauntlets
  // of three). The mood is environment only — light, air and colour over the
  // painted room; it never touches puzzle furniture or text colour.
  const gauntlet = Math.ceil(lock.ordinal / 3);
  const mood = moodTint(gauntlet);
  screen.dataset.mood = mood.key;
  screen.style.setProperty('--mood-tint', mood.tint);
  screen.style.setProperty('--mood-glow', mood.glow);
  screen.style.setProperty('--mood-edge', mood.edge);

  // OW-RUNEFIRE's `opts.magic` groove-fire, adopted the moment it exists and
  // silently skipped when it doesn't (older drawRune builds ignore the opt, so
  // the sniff only decides whether the shard strike ramps it at all).
  const RUNE_MAGIC = (() => {
    try { return /magic/.test(Function.prototype.toString.call(art.drawRune)); } catch { return false; }
  })();

  // Presentation-only styles for this screen (loop-2 escalation): the carved
  // primary's seated disabled state, the horn hint slots, the shard strike
  // reveal, and the yield banner. `#app` prefix outranks style.js at equal
  // source order without touching shell-owned files.
  const roomStyle = el('style');
  roomStyle.textContent = `
  #app .lockroom-mood{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
  #app .screen-lockroom .ledger-numeral{text-shadow:-1px -1px 0 var(--tar),1px 1px 0 rgba(238,207,109,.24),0 0 20px var(--mood-glow)}
  #app .screen-lockroom .attempts-dots .dot{background:var(--mood-tint);box-shadow:0 0 6px var(--mood-glow)}
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
  #app.reduced-motion .ceremony-shard .carved-heading{transition:none}
  #app .heckle-line{margin:6px auto 0;max-width:52ch;font-style:italic;font-size:.86rem;
    letter-spacing:.02em;color:var(--bone);opacity:.85;text-shadow:0 1px 0 rgba(12,9,6,.85)}
  /* Dare card, tightened around a bigger arch (Ramon, live on iPhone: the
     portrait was small and the plate/taunt drifted away from it). The card's
     own rhythm is now portrait -> name -> taunt -> button with the gaps
     shrinking toward the face, so the jarl reads as the subject. */
  #app .dare-card{gap:0;padding:12px 16px 16px}
  #app .dare-card .dare-portrait{margin:0 auto 10px}
  #app .dare-name{margin:0;line-height:1.05}
  #app .dare-taunt{margin:9px 0 0;padding:9px 6px}
  #app .dare-card .btn-carved{margin-top:14px}
  #app .yield-stage canvas{margin:0 auto}`;
  screen.append(roomStyle);

  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'lockroom-canvas';
  screen.prepend(bg.canvas);

  // The mood rides on its own surface, directly over the room paint and under
  // every DOM layer, so the hall's light can breathe without a single wood
  // repaint. It stays AFTER bg.canvas in the DOM on purpose: the wood must
  // remain the first canvas in the screen.
  const mountedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let moodLayer = art.makeCanvas(1, 1);
  moodLayer.canvas.className = 'lockroom-mood';
  moodLayer.canvas.setAttribute('aria-hidden', 'true');
  bg.canvas.after(moodLayer.canvas);

  function paintMood(ms) {
    moodLayer.ctx.clearRect(0, 0, moodLayer.w, moodLayer.h);
    applyMood(moodLayer.ctx, moodLayer.w, moodLayer.h, gauntlet, ms, reducedMotion);
  }

  // A tall board (lock 14's stave, lock 12's benches) grows the room past the
  // viewport it was measured in. The backdrop canvases then stretch to fit,
  // which is harmless for a wood texture but not for light: a stretched mood
  // puts its quiet text bands in the wrong place. Re-cut the mood surface to
  // the live screen box whenever it actually moves.
  function syncMoodSize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    if (!(w > 0 && h > 0)) return false;
    if (Math.abs(w - moodLayer.w) < 2 && Math.abs(h - moodLayer.h) < 2) return false;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'lockroom-mood';
    fresh.canvas.setAttribute('aria-hidden', 'true');
    screen.replaceChild(fresh.canvas, moodLayer.canvas);
    moodLayer = fresh;
    return true;
  }

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
    const freshMood = art.makeCanvas(w, h);
    freshMood.canvas.className = 'lockroom-mood';
    freshMood.canvas.setAttribute('aria-hidden', 'true');
    screen.replaceChild(freshMood.canvas, moodLayer.canvas);
    moodLayer = freshMood;
    lastFurnitureKey = '';
    paintBg();
    paintMood(reducedMotion ? 0 : (typeof performance !== 'undefined' ? performance.now() : Date.now()) - mountedAt);
    if (headerTitle) {
      const freshTitle = carvedHeading('h2', {
        art, text: locText.title, size: headerTitleSize(), className: 'lock-title', depth: 0.95,
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
    art, text: locText.title, size: headerTitleSize(), className: 'lock-title', depth: 0.95,
  });
  const header = el('div', { class: 'lockroom-header' }, [
    el('div', { class: 'ledger-numeral' }, toRoman(lock.ordinal)),
    headerTitle,
    el('p', { class: 'lock-epigraph' }, locText.epigraph),
    heckle && !solved ? el('p', { class: 'heckle-line' }, lineFor(heckle.heckle, lang)) : null,
  ]);
  if (heckle && !solved && !journalHasLine(save, heckle.heckle)) {
    pushJournal(save, `${heckle.name}: "${lineFor(heckle.heckle, lang)}"`);
    onPersist();
  }

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

  // Quiet scroll cue: a small gold chevron over a soft fade, shown only while
  // the board still continues below the fold (and never during dare/beat
  // theatre). One DOM node, CSS-driven, no per-frame work.
  const scrollCue = el('div', { class: 'scroll-cue', 'aria-hidden': 'true' });
  screen.append(scrollCue);
  function updateScrollCue() {
    const se = scrollBox();
    const more = se ? se.scrollHeight - se.clientHeight - se.scrollTop : 0;
    scrollCue.classList.toggle('show', furnitureMode === 'board' && more > 90);
  }
  // capture: scroll events do not bubble, and the scroller here is <body>
  document.addEventListener('scroll', updateScrollCue, { passive: true, capture: true });

  // resizeBg reads header + lockRootEl (via contentBox), so it may only run
  // once both exist — the TDZ class of bug QUALITY_PLAY_01 §4 recorded.
  window.addEventListener('resize', resizeBg);
  resizeBg();

  // Mood air (smoke, wisps, motes, glints) on a time-gated rAF: ~30fps is
  // ample for drift this slow and halves the per-second cost. Reduced motion
  // never starts the loop — resizeBg's paintMood already laid the still frame.
  let moodRaf = 0;
  let lastMoodPaint = -1e9;
  function moodLoop(now) {
    moodRaf = requestAnimationFrame(moodLoop);
    if (now - lastMoodPaint < 33) return;
    lastMoodPaint = now;
    syncMoodSize();
    paintMood(now - mountedAt);
  }
  if (!reducedMotion && typeof requestAnimationFrame === 'function') {
    moodRaf = requestAnimationFrame(moodLoop);
  }

  // The tray hugs the mounted board: re-measure when the board's own size
  // changes (rows opening, tells appearing), rAF-debounced, repaint only on a
  // real move (paintBg is keyed on the measured box).
  let furnitureRaf = 0;
  const scheduleFurniture = () => {
    if (furnitureRaf) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 32);
    furnitureRaf = raf(() => {
      furnitureRaf = 0;
      paintBg();
      updateScrollCue();
      if (syncMoodSize()) paintMood(reducedMotion ? 0 : (typeof performance !== 'undefined' ? performance.now() : Date.now()) - mountedAt);
    });
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
      if (isTaken) hintText.append(el('p', {}, locText.hints[k]));
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
    nearLine.textContent = localizeNear(result.near, locText.nearMap) || '';
    renderAttempts();
    renderHints();
    return { ok: false, near: result.near };
  }

  // Entry framing: a room opens at its top — numeral, title, epigraph, then
  // the board (QUALITY_LOOP4: every board taller than the window landed
  // mid-scroll with the chapter head cropped above the fold). Focus still
  // lands for the keyboard path, but without dragging the scroll with it.
  // NOTE the shell's actual scroller is <body> (html and body both carry
  // `overflow:hidden auto`; document.scrollingElement reports <html>, whose
  // scrollHeight never grows) — measure/reset the box that really scrolls.
  const scrollBox = () => {
    const b = document.body;
    if (b && b.scrollHeight > b.clientHeight + 1) return b;
    return document.scrollingElement || document.documentElement;
  };
  const resetScroll = () => {
    const se = scrollBox();
    if (se) se.scrollTop = 0;
  };

  function mountPuzzle() {
    const ctx = { root: lockRootEl, instance, art, audio, submit, note, solved, lang };
    lockHandle = lock.mount(ctx);
    furnitureMode = 'board';
    scheduleFurniture();
    if (!showDare) {
      try { lockRootEl.focus({ preventScroll: true }); } catch { lockRootEl.focus(); }
    }
    resetScroll();
    updateScrollCue();
  }

  function beginSolveSequence() {
    if (lockHandle) { lockHandle.unmount(); lockHandle = null; }
    nearLine.textContent = '';
    furnitureMode = 'beat';
    updateScrollCue();
    paintBg();
    if (yieldDuel) runYieldBeat(runShardCeremony);
    else runShardCeremony();
  }

  // ---- the duel portrait stage (dare card + yield beat share it) ----------
  // The arch is measured from the card instead of pinned at 220px: at 390x844
  // that lands it at ~78% of the card with 44px+ of air at each screen edge,
  // which is what makes a face read at arm's length. The canvas is padded out
  // past the arch so the surround can carry its chip band.
  function archStage(frac, maxArch) {
    const cardW = Math.min(420, Math.max(220, lockRootEl.clientWidth || 342));
    // Room limits apply to the CANVAS (arch + both pads, ~1.11x the arch), not
    // the arch: 46px of air at each screen edge clears the 44px floor, and the
    // card's own 16px padding keeps the canvas from widening the card itself.
    const room = Math.min(
      Math.max(180, (screen.clientWidth || cardW) - 92),
      cardW - 32,
    );
    // Vertical budget: a 1280x800 desktop room is SHORT, and the card has to
    // land whole there too (reduced motion skips the rise transform, so it
    // sits ~12px lower than the animated one). The reserve is the measured
    // chrome under the arch — name, taunt, button, gaps, card padding.
    const sBox = screen.getBoundingClientRect();
    const headerBottom = Math.max(0, header.getBoundingClientRect().bottom - sBox.top);
    const vRoom = Math.max(200, (screen.clientHeight || 800) - headerBottom - 268);
    const archW = Math.max(150, Math.min(
      Math.round(cardW * frac), maxArch,
      Math.floor(room / 1.11),   // canvas = arch + 2 pads ~= arch * 1.11
      Math.floor(vRoom / 1.29),  // canvas height ~= arch * 1.29
    ));
    const archH = Math.round(archW * 1.18);
    const pad = Math.max(9, Math.round(archW * 0.055));
    const made = art.makeCanvas(archW + pad * 2, archH + pad * 2);
    made.canvas.dataset.arch = `${pad},${pad},${archW},${archH}`;
    return { ...made, pad, archW, archH };
  }

  // A wolf-tooth run cut into the surround, following the arch just outside
  // the gold groove (docs/QUALITY.md carve standard). Three cuts per chip —
  // socket, shade wall, lit wall — with the wall shading resolved per chip
  // against the one hearth key (upper-left), so the band reads as CARVED at
  // 200% and stays subordinate to the face at thumbnail size.
  function archChipBand(c, ax, ay, aw, ah, pad) {
    const R = aw / 2 + pad * 0.5;
    const cx = ax + aw / 2;
    const springY = ay + aw / 2;
    const jamb = Math.max(0, ay + ah - springY);
    const s = Math.max(5, pad * 0.85);
    const pts = [];
    const nJ = Math.max(2, Math.round(jamb / s));
    for (let i = nJ; i >= 1; i--) pts.push([cx - R, springY + (jamb * i) / nJ, 1, 0]);
    const nC = Math.max(8, Math.round((Math.PI * R) / s));
    for (let i = 0; i <= nC; i++) {
      const a = Math.PI + (Math.PI * i) / nC;
      pts.push([cx + Math.cos(a) * R, springY + Math.sin(a) * R, -Math.cos(a), -Math.sin(a)]);
    }
    for (let i = 1; i <= nJ; i++) pts.push([cx + R, springY + (jamb * i) / nJ, -1, 0]);

    c.save();
    c.lineCap = 'butt';
    pts.forEach(([px, py, nx, ny], i) => {
      const tx = -ny;
      const ty = nx;
      const depth = s * (i % 2 ? 0.74 : 0.34);
      const b0 = [px - tx * s * 0.5, py - ty * s * 0.5];
      const b1 = [px + tx * s * 0.5, py + ty * s * 0.5];
      const apex = [px + nx * depth, py + ny * depth];
      c.fillStyle = `rgba(12,9,6,.34)`;
      c.beginPath();
      c.moveTo(b0[0], b0[1]);
      c.lineTo(b1[0], b1[1]);
      c.lineTo(apex[0], apex[1]);
      c.closePath();
      c.fill();
      // each wall takes the key or turns away from it: outward face normal
      // vs the hearth direction (light travelling down-right)
      for (const [B, other] of [[b0, b1], [b1, b0]]) {
        let ex = apex[0] - B[0];
        let ey = apex[1] - B[1];
        let wx = -ey;
        let wy = ex;
        if (wx * (other[0] - B[0]) + wy * (other[1] - B[1]) > 0) { wx = -wx; wy = -wy; }
        const catches = wx + wy < 0; // normal faces up-left, toward the hearth
        c.strokeStyle = catches ? `rgba(132,95,50,.62)` : `rgba(12,9,6,.55)`;
        c.lineWidth = Math.max(0.8, s * 0.14);
        c.beginPath();
        c.moveTo(B[0], B[1]);
        c.lineTo(apex[0], apex[1]);
        c.stroke();
      }
    });
    // stepped architrave: one scribe line outside the run, with its lit twin
    for (const [off, style, wdt] of [[pad * 0.95, 'rgba(12,9,6,.42)', 1], [pad * 0.95 + 1.1, 'rgba(233,220,195,.10)', 1]]) {
      const RR = aw / 2 + off;
      c.strokeStyle = style;
      c.lineWidth = wdt;
      c.beginPath();
      c.moveTo(cx - RR, ay + ah);
      c.lineTo(cx - RR, springY);
      c.arc(cx, springY, RR, Math.PI, 0, false);
      c.lineTo(cx + RR, ay + ah);
      c.stroke();
    }
    c.restore();
  }

  function runYieldBeat(after) {
    const overlay = el('div', { class: 'ceremony-overlay', tabindex: '-1' });
    const port = archStage(0.58, 230);
    // the challenger's war-banner lowers behind the portrait as the bow lands
    const banner = el('div', { class: 'yield-banner', 'aria-hidden': 'true' }, yieldDuel.name);
    banner.style.top = `${port.pad + 5}px`;
    const stage = el('div', { class: 'yield-stage' }, [banner, port.canvas]);
    const line = el('p', { class: 'ceremony-line' }, lineFor(yieldDuel.yield, lang));
overlay.append(stage, line);
    clear(lockRootEl);
    lockRootEl.append(overlay);
    overlay.focus();
    const img = portraitsCache ? portraitImage(portraitsCache, yieldDuel.key) : null;
    const canTween = typeof art.portrait === 'function' && !!img;
    // The bow dips and shears the arch's contents, so each frame starts from a
    // clean surface (the old code painted over the last one and smeared the
    // crown) and re-cuts the surround around it.
    const paintYield = (t) => {
      port.ctx.clearRect(0, 0, port.w, port.h);
      archChipBand(port.ctx, port.pad, port.pad, port.archW, port.archH, port.pad);
      if (canTween) {
        // honor light: the yielding jarl is LIT like the dare that opened the
        // gauntlet — the beat is earned, not an afterthought (QUALITY_LOOP4)
        art.portrait(port.ctx, img, port.pad, port.pad, port.archW, port.archH,
          { bow: t, rim: 0.85 * (1 - t * 0.22) });
      } else {
        drawPortraitPlaceholder(port.ctx, p, port.pad, port.pad, port.archW, port.archH, yieldDuel.name);
      }
    };
    paintYield(0);
    audio.motif('yield');
    // act switches ride the chapter turns (docs/CONTRACT.md §1 v2)
    if (lock.id === '06-jotunvillur') audio.music?.act?.(2);
    else if (lock.id === '12-veitsla') audio.music?.act?.(3);
    cancelBeat = playBeat({
      el: overlay, duration: 1200, reducedMotion,
      render(t) { paintYield(t); },
      onDone: () => {
        cancelBeat = null;
        if (!journalHasLine(save, yieldDuel.yield)) note(`${yieldDuel.name} yields: "${lineFor(yieldDuel.yield, lang)}"`);
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
    // The strike must carry the emptied stage (QUALITY_LOOP4: at 132px the
    // rune floated small in a bare room) — scale with the room, clamped.
    const RC = Math.round(Math.max(148, Math.min(216, (screen.clientWidth || 800) * 0.17)));
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
          // the groove takes fire as the chisel finishes its bite
          ...(RUNE_MAGIC ? { magic: ease * 0.85, t: t * 1500, reduced: reducedMotion } : {}),
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
    const port = archStage(0.78, 300);
    port.canvas.className = 'dare-portrait';
    archChipBand(port.ctx, port.pad, port.pad, port.archW, port.archH, port.pad);
    const img = portraitsCache ? portraitImage(portraitsCache, dare.key) : null;
    if (typeof art.portrait === 'function' && img) {
      art.portrait(port.ctx, img, port.pad, port.pad, port.archW, port.archH, { rim: 0.9 });
    } else {
      drawPortraitPlaceholder(port.ctx, p, port.pad, port.pad, port.archW, port.archH, dare.name);
    }
    const answerBtn = el('button', { type: 'button', class: 'btn-carved' }, 'Answer the dare');
    const namePlate = carvedHeading('h3', {
      art, text: dare.name, size: 30, className: 'dare-name', depth: 0.9,
      color: p.goldBright, letterSpacing: 3,
    });
    const card = el('div', { class: 'dare-card' }, [
      port.canvas,
      namePlate,
      el('p', { class: 'dare-taunt' }, `"${lineFor(dare.taunt, lang)}"`),
      answerBtn,
    ]);
    furnitureMode = 'dare';
    paintBg();
    lockRootEl.append(vignette, card);
    if (!journalHasLine(save, dare.taunt)) {
      note(`${dare.name}: "${lineFor(dare.taunt, lang)}"`);
    }
    audio.motif('dare');
    answerBtn.addEventListener('click', () => {
      audio.ui('confirm');
      clear(lockRootEl);
      mountPuzzle();
    });
    try { answerBtn.focus({ preventScroll: true }); } catch { answerBtn.focus(); }
    resetScroll();
    updateScrollCue();
  } else {
    mountPuzzle();
  }

  renderAttempts();
  renderHints();

  return function unmount() {
    window.removeEventListener('resize', resizeBg);
    document.removeEventListener('scroll', updateScrollCue, { capture: true });
    if (moodRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(moodRaf);
    if (contentRO) contentRO.disconnect();
    if (furnitureRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(furnitureRaf);
    if (cancelBeat) cancelBeat();
    if (lockHandle) lockHandle.unmount();
    screen.remove();
  };
}
