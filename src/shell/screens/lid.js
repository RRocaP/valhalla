// The Lid (hub). docs/SHELL.md #2, docs/JARLS.md v3 "Chapters": five jarls own
// five 3-lock gauntlets — each jarl's blood-red banner spans THEIR three
// medallions (ownership at a glance), with a small-caps chapter label. The
// armed gauntlet's label carries the .duel-banner class (e2e contract).

import { el } from '../dom.js';
import { lockState, isAccessible, nextLockId, progressFraction } from '../progress.js';
import { pushJournal } from '../journal.js';
import { ordinalWord } from '../numerals.js';
import { SHELL_STRINGS, ordinalWordLang } from '../strings.js';
import { t } from '../../kernel/i18n.js';
import { gauntletFor, lineFor, journalHasLine, WAGER } from '../duels.js';
import { rng } from '../../kernel/rng.js';
import { resolveLang } from '../../kernel/i18n.js';
import { loadHero, drawHero, coverRect } from '../heroes.js';

// The chest hero plate (heroes/chest.jpg) photographs the real object: a
// sea-chest with FIFTEEN bronze medallions in three arcs. In photo mode the
// hit targets anchor onto the photographed bronze and all lock state renders
// as light ON the metal. Procedural chestScene remains the full fallback when
// the plate is absent (offline law).
// Calibration (LOOP 1, hand-measured on 0.005-fraction grid crops —
// artifacts/wip-verifier/loop1/grid-row*.png, verified calib-verify.png):
// per-socket center AND radius as fractions of the image (fr is of width;
// the photographed discs are 0.034-0.036 W, not one shared radius — the old
// single 0.0442 constant is why every state ring spilled off its bronze).
const CHEST_SOCKETS = [
  { fx: 0.3309, fy: 0.4497, fr: 0.0349 },
  { fx: 0.4152, fy: 0.4554, fr: 0.0349 },
  { fx: 0.5019, fy: 0.4598, fr: 0.0349 },
  { fx: 0.5858, fy: 0.4564, fr: 0.0341 },
  { fx: 0.6688, fy: 0.4504, fr: 0.0343 },
  { fx: 0.3185, fy: 0.5296, fr: 0.0360 },
  { fx: 0.4017, fy: 0.5363, fr: 0.0357 },
  { fx: 0.4973, fy: 0.5386, fr: 0.0353 },
  { fx: 0.5901, fy: 0.5344, fr: 0.0353 },
  { fx: 0.6774, fy: 0.5296, fr: 0.0351 },
  { fx: 0.3129, fy: 0.6133, fr: 0.0360 },
  { fx: 0.4004, fy: 0.6243, fr: 0.0358 },
  { fx: 0.4972, fy: 0.6267, fr: 0.0358 },
  { fx: 0.5856, fy: 0.6249, fr: 0.0354 },
  { fx: 0.6724, fy: 0.6197, fr: 0.0354 },
];
// Clear zones of the photograph for chapter labels (fractions of the image):
// the iron/dark band between the carved frieze and the first medallion arc.
const CHEST_LABEL_BAND_TOP = 0.414;

// Fallback layout, used only when the art module predates art.chestLayout.
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

// Presentation-only styles for this screen (same pattern as lockroom.js's
// roomStyle): #app prefix outranks style.js at equal source order without
// touching the shell-owned stylesheet. The armed gauntlet's label reuses the
// .duel-banner CLASS (e2e visibility contract) but not its CSS recipe — the
// blood field is painted on the ribbon canvas underneath, so every visual
// property the old rule set is overridden here.
const LID_STYLE = `
#app .lid-deco{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#app .chapter-label{position:absolute;transform:translate(-50%,-50%);pointer-events:none;
  background:none;background-image:none;clip-path:none;filter:none;padding:0 6px;max-width:none;
  white-space:nowrap;overflow:visible;text-overflow:clip;
  font-family:var(--font-display);font-variant-caps:small-caps;font-weight:600;
  letter-spacing:.13em;font-size:clamp(.6rem,.35vw + .52rem,.72rem);line-height:1;
  color:var(--bone);text-shadow:0 1px 0 rgba(12,9,6,.9),0 0 8px rgba(12,9,6,.55)}
#app .chapter-label.chapter-done{color:var(--boneDim)}
#app .chapter-label.chapter-sealed{color:var(--boneDim);opacity:.7;
  font-size:clamp(.55rem,.3vw + .48rem,.66rem);letter-spacing:.11em}
#app .chapter-label.duel-banner{color:var(--bone);
  text-shadow:0 1px 0 rgba(12,9,6,.9),0 0 10px rgba(238,207,109,.28);
  animation:chapter-breathe 3.4s ease-in-out infinite}
@keyframes chapter-breathe{0%,100%{opacity:1}50%{opacity:.84}}
@media (prefers-reduced-motion: reduce){#app .chapter-label.duel-banner{animation:none}}
#app.reduced-motion .chapter-label.duel-banner{animation:none}
#app .medallion-hit{transition:transform .16s cubic-bezier(.34,1.56,.64,1)}
#app .medallion-hit:not(:disabled):active{transform:translate(-50%,-50%) scale(.955)}
@media (prefers-reduced-motion: reduce){#app .medallion-hit{transition:none}
  #app .medallion-hit:not(:disabled):active{transform:translate(-50%,-50%)}}
#app.reduced-motion .medallion-hit{transition:none}
#app.reduced-motion .medallion-hit:not(:disabled):active{transform:translate(-50%,-50%)}`;

export function mountLid(root, { locks, save, art, audio, reducedMotion, justOpenedId, onOpenLock, onOpenJournal, onOpenSettings }) {
  const p = art.palette;
  const lang = resolveLang(save && save.settings && save.settings.lang,
    typeof navigator !== 'undefined' ? navigator.language : '');
  const screen = el('div', { class: 'screen screen-lid' });
  const medallionsLayer = el('div', { class: 'lid-medallions' });
  const haspWrap = el('div', { class: 'hasp-wrap' });

  const lidStyle = el('style');
  lidStyle.textContent = LID_STYLE;

  const journalBtn = el('button', {
    type: 'button', class: 'btn-icon journal-handle', 'aria-label': 'Open the journal',
    onClick: () => { audio.ui('slide'); onOpenJournal(); },
  }, '☰');
  const settingsBtn = el('button', {
    type: 'button', class: 'btn-icon settings-nail', 'aria-label': 'Open settings',
    onClick: () => { audio.ui('slide'); onOpenSettings(); },
  }, '⚙');
  const chrome = el('div', { class: 'lid-chrome' }, [journalBtn, settingsBtn]);

  screen.append(lidStyle, medallionsLayer, haspWrap, chrome);
  root.append(screen);

  const nextId = nextLockId(locks, save);
  const nextLock = locks.find((l) => l.id === nextId) || null;

  // Journal echo of the wager framing card (docs/JARLS.md "The wager"): the
  // card itself is shown by the threshold after the begin gesture; the lid —
  // which owns the live save — records the text mirror. Idempotent across
  // languages via journalHasLine (no new save fields).
  if (!journalHasLine(save, WAGER)) {
    pushJournal(save, lineFor(WAGER, lang));
  }

  // Gauntlet bookkeeping: group this chest's locks by owning jarl (guarded so
  // dev fixtures with n≠15 locks still mount — partial gauntlets just render
  // whatever medallions exist).
  const gauntletGroups = [];
  locks.forEach((lock, i) => {
    const g = gauntletFor(lock.ordinal);
    if (!g) return;
    let group = gauntletGroups.find((entry) => entry.g === g);
    if (!group) { group = { g, items: [] }; gauntletGroups.push(group); }
    group.items.push({ index: i, ordinal: lock.ordinal, id: lock.id });
  });
  gauntletGroups.forEach((group) => {
    group.items.sort((a, b) => a.ordinal - b.ordinal);
    group.done = group.items.every((it) => save.opened.includes(it.id));
    group.active = !!nextLock && group.g === gauntletFor(nextLock.ordinal);
  });

  // Progressive reveal (Ramon 2026-08-07): a jarl's name appears only once
  // you have faced their dare (journal holds the taunt), any of their locks
  // stands open, or the wager itself named them (gauntlet I). Until then the
  // banner hangs sealed.
  const SEALED = { en: 'A SEALED BANNER', es: 'ESTANDARTE SELLADO', ca: 'ESTENDARD SEGELLAT' };
  const GWORD = { en: 'GAUNTLET', es: 'DESAFÍO', ca: 'REPTE' };
  const ROMANG = ['I', 'II', 'III', 'IV', 'V'];
  const isRevealed = (g) =>
    g.dareAt === 1 ||
    journalHasLine(save, g.taunt) ||
    save.opened.some((id) => {
      const n = Number(id.slice(0, 2));
      return n >= g.dareAt && n <= g.yieldAt;
    });

  // Announce the armed gauntlet the first time it is seen — by name only if
  // revealed; otherwise a veiled line. Idempotent via journal content checks.
  const activeGroup = gauntletGroups.find((group) => group.active) || null;
  if (activeGroup) {
    const g = activeGroup.g;
    if (isRevealed(g)) {
      // localized announcement (LOOP 4: the es/ca journal carried an English
      // line — strings.js has held lid.barsJournal all along). journalHasLine
      // dedupes across languages, so old saves keep their English entry.
      const line = {};
      for (const L of ['en', 'es', 'ca']) {
        line[L] = t(SHELL_STRINGS, L, 'lid.barsJournal',
          { name: g.name, ord: L === 'en' ? ordinalWord(g.dareAt) : ordinalWordLang(g.dareAt, L) });
      }
      if (!journalHasLine(save, line)) pushJournal(save, lineFor(line, lang));
    } else {
      const veiled = {
        en: `A new banner is raised over the ${ordinalWord(g.dareAt)} lock. No one will say whose.`,
        es: `Un nuevo estandarte se alza sobre la siguiente cerradura. Nadie dice de quién es.`,
        ca: `Un nou estendard s'alça sobre el pany següent. Ningú no diu de qui és.`,
      };
      if (!journalHasLine(save, veiled)) pushJournal(save, lineFor(veiled, lang));
    }
  }

  // ONE chapter label on the whole hub: the armed gauntlet's (Magic Law text
  // budget — five all-caps ribbons read as noise and collided with the
  // medallion field). Finished and sealed gauntlets speak through their cloth
  // alone. The armed label keeps the .duel-banner class — journey/floors
  // assert its visibility before entering a duel lock.
  gauntletGroups.forEach((group) => {
    if (!group.active) { group.label = null; return; }
    const cls = ['chapter-label', 'duel-banner'];
    const gi = ROMANG[Math.max(0, Math.ceil(group.g.dareAt / 3) - 1)];
    const text = isRevealed(group.g)
      ? lineFor(group.g.title, lang)
      : `${GWORD[lang] || GWORD.en} ${gi} — ${SEALED[lang] || SEALED.en}`;
    if (!isRevealed(group.g)) cls.push('chapter-sealed');
    group.label = el('div', { class: cls.join(' ') }, text);
    medallionsLayer.append(group.label);
  });

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
  // Static decoration overlay above the animated chest canvas and below the
  // hit targets: gauntlet ribbons, the wordmark echo, and the dead-zone tool
  // history. Painted on resize only — zero per-frame cost (QUALITY.md
  // latency law).
  let deco = art.makeCanvas(1, 1);
  deco.canvas.className = 'lid-deco';
  deco.canvas.setAttribute('aria-hidden', 'true');
  cur.canvas.after(deco.canvas);
  let hasp = art.makeCanvas(1, 1);
  hasp.canvas.className = 'hasp-canvas';
  haspWrap.append(hasp.canvas);

  let layout = [];
  const progress = progressFraction(locks, save);
  const mountedAt = performance.now();
  let raf = null;

  // chestScene carves the sockets AND seats the medallions in them. When the
  // art module exposes chestLayout we take those exact positions for the hit
  // targets and paint nothing more; the old code ran an independent layout and
  // painted a second medallion set on top, which is what made the lid read as
  // a scatter of overlapping circles.
  const useChestLayout = typeof art.chestLayout === 'function';

  // ---- photo mode: the hub is the real chest -------------------------------
  let hero = null;        // decoded chest plate, or null (procedural fallback)
  let heroBake = null;    // offscreen: graded plate + static state light
  const photoMode = () => !!hero;

  function photoRect(w, h) {
    return coverRect(hero, w, h, 0.5, 0.53);
  }

  function photoLayout(w, h) {
    const r = photoRect(w, h);
    const sockets = CHEST_SOCKETS.map((f) => ({
      x: r.dx + f.fx * r.dw,
      y: r.dy + f.fy * r.dh,
      r: Math.max(20, f.fr * r.dw),
    }));
    return {
      sockets,
      left: r.dx + 0.04 * r.dw,
      top: r.dy + 0.26 * r.dh,
      chestW: 0.92 * r.dw,
      chestH: 0.55 * r.dh,
      railH: 0.07 * r.dh,
      rect: r,
    };
  }

  function bakePhoto(w, h) {
    heroBake = art.makeCanvas(w, h);
    const c = heroBake.ctx;
    drawHero(c, hero, w, h, { fy: 0.53, edge: 0.72 });
    // static state light, ON the bronze
    const L = photoLayout(w, h);
    locks.forEach((lock, i) => {
      const pos = L.sockets[i];
      if (!pos) return;
      const state = lockState(locks, save, lock.id);
      if (state === 'sealed') {
        const g = c.createRadialGradient(pos.x, pos.y, pos.r * 0.2, pos.x, pos.y, pos.r * 1.05);
        g.addColorStop(0, 'rgba(12,9,6,.48)');
        g.addColorStop(1, 'rgba(12,9,6,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(pos.x, pos.y, pos.r * 1.05, 0, Math.PI * 2);
        c.fill();
      } else if (state === 'open') {
        // the seal stands broken: a quiet gold ring ON the rim and the lock's
        // rune etched dead-center. All light is clipped to the disc so it
        // reads as light on the bronze, never a halo hovering over the wood.
        c.save();
        c.beginPath();
        c.arc(pos.x, pos.y, pos.r * 1.04, 0, Math.PI * 2);
        c.clip();
        art.glow(c, pos.x, pos.y, pos.r * 1.02, p.gold, 0.2);
        c.strokeStyle = 'rgba(238,207,109,.55)';
        c.lineWidth = Math.max(1.4, pos.r * 0.055);
        c.beginPath();
        c.arc(pos.x, pos.y, pos.r * 0.9, 0, Math.PI * 2);
        c.stroke();
        if (typeof art.drawRune === 'function') {
          const shard = lock.shard && lock.shard(lock.makePuzzle(rng('lindisfarne-793:' + lock.id)));
          if (shard && shard.rune) {
            const rs = pos.r * 0.84;
            c.globalAlpha = 0.85;
            art.drawRune(c, shard.rune, pos.x - rs / 2, pos.y - rs / 2, rs, {
              color: p.goldBright, weight: Math.max(2, rs * 0.13), glow: 0.25,
            });
          }
        }
        c.restore();
      }
    });
    return heroBake;
  }

  function paint(t) {
    if (photoMode()) {
      if (!heroBake || heroBake.w !== cur.w || heroBake.h !== cur.h) bakePhoto(cur.w, cur.h);
      cur.ctx.clearRect(0, 0, cur.w, cur.h);
      cur.ctx.drawImage(heroBake.canvas, 0, 0, cur.w, cur.h);
      // the armed lock breathes: gold halo + the one cold accent (arcane blue)
      const nextIdx = nextLock ? locks.indexOf(nextLock) : -1;
      const pos = nextIdx >= 0 ? layout[nextIdx] : null;
      if (pos) {
        const pulse = reducedMotion ? 0.75 : 0.62 + 0.38 * Math.sin(t / 640);
        // gold state light stays ON the bronze: clipped wash + a ring that
        // hugs the photographed rim (the 2.1r halo spilled onto the wood and
        // collided with its neighbours — LOOP 1)
        cur.ctx.save();
        cur.ctx.beginPath();
        cur.ctx.arc(pos.x, pos.y, pos.r * 1.08, 0, Math.PI * 2);
        cur.ctx.clip();
        art.glow(cur.ctx, pos.x, pos.y, pos.r * 1.05, p.goldBright, 0.26 * pulse + 0.14);
        art.glow(cur.ctx, pos.x, pos.y, pos.r * 0.7, p.ember, 0.18 * pulse);
        cur.ctx.strokeStyle = `rgba(238,207,109,${0.45 + 0.3 * pulse})`;
        cur.ctx.lineWidth = Math.max(1.6, pos.r * 0.07);
        cur.ctx.beginPath();
        cur.ctx.arc(pos.x, pos.y, pos.r * 0.94, 0, Math.PI * 2);
        cur.ctx.stroke();
        cur.ctx.restore();
        // the armed rune BURNS — overflowing arcane fire, dead-center on the
        // disc; the flame alone may rise past the rim (Ramon, LOOP 1)
        if (typeof art.drawRune === 'function') {
          const shard = nextLock.shard && nextLock.shard(nextLock.makePuzzle(rng('lindisfarne-793:' + nextLock.id)));
          const accent = (p.fjordLight || '#3f6d9e');
          if (shard && shard.rune) {
            const rs = pos.r * 1.12;
            cur.ctx.save();
            cur.ctx.globalAlpha = 0.82 + 0.18 * pulse;
            art.drawRune(cur.ctx, shard.rune, pos.x - rs / 2, pos.y - rs / 2, rs, {
              color: accent, weight: Math.max(2.2, rs * 0.13),
              magic: 0.88 + 0.12 * pulse, t, reduced: reducedMotion,
              flameScale: 3, // couch test: the fire must outgrow the disc
            });
            cur.ctx.restore();
          }
        }
      }
    } else {
      art.chestScene(cur.ctx, cur.w, cur.h, t, progress);
      if (!useChestLayout) {
        locks.forEach((lock, i) => {
          const pos = layout[i];
          if (!pos) return;
          art.medallion(cur.ctx, pos.x, pos.y, pos.r, lockState(locks, save, lock.id), lock.ordinal);
        });
      }
    }
    if (justOpenedId && !reducedMotion) {
      const idx = locks.findIndex((l) => l.id === justOpenedId);
      const pos = layout[idx];
      if (pos) {
        const strength = Math.max(0, 1 - t / 1100);
        if (strength > 0) art.glow(cur.ctx, pos.x, pos.y, pos.r * 1.8, p.goldBright, strength);
      }
    }
    renderFx(cur.ctx);
  }

  // ---- touch delight (LOOP 1, Ramon: "like when you press them they give
  // some magic feedback like a card in HS would") -----------------------------
  // Transient, time-gated FX on the existing animated canvas: an accessible
  // medallion answers a press with a quick bloom + 4-6 arcane sparks that die
  // <500ms; a locked one answers with a dull ember pulse + the soft deny thud;
  // bare chest wood answers idle taps with dust motes. Reduced motion: bloom
  // or gleam only, no particles, no press scale.
  const fxList = [];
  let fxTimer = null;
  function scheduleFxRepaint() {
    if (fxTimer || !reducedMotion) return;
    fxTimer = setTimeout(() => {
      fxTimer = null;
      paint(0);
      if (fxList.length) scheduleFxRepaint();
    }, 90);
  }
  function addFx(f) {
    f.t0 = performance.now();
    fxList.push(f);
    scheduleFxRepaint();
  }
  function renderFx(ctx) {
    if (!fxList.length) return;
    const now = performance.now();
    for (let i = fxList.length - 1; i >= 0; i--) {
      const f = fxList[i];
      const k = (now - f.t0) / f.life;
      if (k >= 1) { fxList.splice(i, 1); continue; }
      const fade = 1 - k;
      if (f.kind === 'bloom') {
        art.glow(ctx, f.x, f.y, f.r * (1.1 + 0.3 * k), p.goldBright, 0.95 * fade);
        art.glow(ctx, f.x, f.y, f.r * 0.6, (p.fjordLight || '#3f6d9e'), 0.55 * fade);
      } else if (f.kind === 'spark') {
        const e = 1 - (1 - k) * (1 - k); // ease-out travel
        const px = f.x + Math.cos(f.ang) * f.sp * e;
        const py = f.y + Math.sin(f.ang) * f.sp * e - f.rise * e;
        ctx.save();
        ctx.globalAlpha = Math.min(1, 1.2 * fade);
        ctx.fillStyle = f.cold ? (p.fjordLight || '#3f6d9e') : p.goldBright;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px, py, f.size * (0.6 + 0.4 * fade), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,241,199,.9)';
        ctx.beginPath();
        ctx.arc(px, py, f.size * 0.4 * fade, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (f.kind === 'deny') {
        ctx.save();
        ctx.globalAlpha = 0.7 * fade;
        ctx.strokeStyle = p.ember;
        ctx.lineWidth = Math.max(2.5, f.r * 0.12);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.86 + 0.1 * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        art.glow(ctx, f.x, f.y, f.r * 0.8, p.ember, 0.45 * fade);
      } else if (f.kind === 'mote') {
        ctx.save();
        ctx.globalAlpha = 0.36 * fade;
        ctx.fillStyle = p.bone;
        ctx.shadowColor = p.bone;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(f.x + f.dx * k, f.y + f.dy * k, f.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (k < 0.4) art.glow(ctx, f.x, f.y, 20, p.gold, 0.12 * (1 - k / 0.4));
      } else if (f.kind === 'gleam') {
        art.glow(ctx, f.x, f.y, f.r, p.gold, 0.3 * fade);
      }
    }
  }
  function pressFx(pos) {
    addFx({ kind: 'bloom', x: pos.x, y: pos.y, r: pos.r, life: 280 });
    if (reducedMotion) return;
    const n = 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
      addFx({
        kind: 'spark', x: pos.x, y: pos.y - pos.r * 0.3, ang,
        sp: pos.r * (0.7 + Math.random() * 1.0), rise: pos.r * (0.6 + Math.random() * 0.8),
        size: 2.4 + Math.random() * 2, cold: i % 2 === 0, life: 380 + Math.random() * 110,
      });
    }
  }
  function denyFx(pos) {
    addFx({ kind: 'deny', x: pos.x, y: pos.y, r: pos.r, life: 380 });
  }
  function motesFx(x, y) {
    if (reducedMotion) { addFx({ kind: 'gleam', x, y, r: 26, life: 320 }); return; }
    for (let i = 0; i < 8; i++) {
      addFx({
        kind: 'mote', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 10,
        dx: (Math.random() - 0.5) * 32, dy: -12 - Math.random() * 26,
        size: 1.4 + Math.random() * 1.6, life: 380 + Math.random() * 80,
      });
    }
  }
  medallionsLayer.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const rect = screen.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let hit = -1;
    layout.forEach((pos, i) => {
      if (pos && Math.hypot(px - pos.x, py - pos.y) <= Math.max(24, pos.r * 1.12)) hit = i;
    });
    if (hit >= 0) {
      if (buttons[hit].disabled) { denyFx(layout[hit]); audio.ui('deny'); }
      else pressFx(layout[hit]);
    } else {
      motesFx(px, py);
      audio.ui('tick');
    }
  });

  // The shard ledger: ONE carved rail object seated on the chest's carved
  // band — tar-washed plate, swallow-tail ends, gold hairlines, each shard a
  // rune over its Cormorant numeral. Loose runes + mono chips floated under
  // the chest like debris (Ramon's iPhone review, LOOP 1).
  function paintHasp() {
    const opened = locks.filter((l) => save.opened.includes(l.id));
    if (!opened.length) return;
    // shard(instance) is part of the Lock interface (CONTRACT §4) and is
    // documented instance-independent — calling it directly (rather than
    // keying into the frozen kernel SHARDS table, which only knows the
    // real 01..14 ids) works for every lock, real or fixture.
    const shards = opened
      .map((lock) => lock.shard(lock.makePuzzle(rng('lindisfarne-793:' + lock.id))))
      .filter(Boolean);
    if (!shards.length) return;
    const c = hasp.ctx;
    const cellW = shards.map((s) => Math.max(27, String(s.value).length * 8 + 14));
    const innerW = cellW.reduce((a, b) => a + b, 0);
    const pad = 16;
    const railW = Math.min(hasp.w - 4, innerW + pad * 2);
    const scale = innerW + pad * 2 > railW ? (railW - pad * 2) / innerW : 1;
    const x0 = hasp.w / 2 - railW / 2;
    const y0 = 9;
    const railH = 40;
    const notch = 8;
    c.save();
    // plate
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x0 + railW, y0);
    c.lineTo(x0 + railW - notch, y0 + railH / 2);
    c.lineTo(x0 + railW, y0 + railH);
    c.lineTo(x0, y0 + railH);
    c.lineTo(x0 + notch, y0 + railH / 2);
    c.closePath();
    const gPlate = c.createLinearGradient(0, y0, 0, y0 + railH);
    gPlate.addColorStop(0, 'rgba(24,16,10,.92)');
    gPlate.addColorStop(0.5, 'rgba(14,10,7,.9)');
    gPlate.addColorStop(1, 'rgba(8,6,4,.94)');
    c.fillStyle = gPlate;
    c.shadowColor = 'rgba(12,9,6,.7)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(12,9,6,.85)';
    c.lineWidth = 1.2;
    c.stroke();
    c.strokeStyle = 'rgba(201,162,39,.42)';
    c.lineWidth = 0.9;
    c.stroke();
    // shards
    let x = x0 + pad;
    shards.forEach((shard, i) => {
      const wCell = cellW[i] * scale;
      const cx = x + wCell / 2;
      const runeS = 15;
      art.drawRune(c, shard.rune, cx - runeS / 2, y0 + 4, runeS, {
        color: p.goldBright, weight: 2.2,
      });
      c.font = '600 13px "Cormorant Garamond", "Iowan Old Style", Georgia, serif';
      c.textAlign = 'center';
      c.fillStyle = rgbaOf(p.goldBright, 0.92);
      c.fillText(String(shard.value), cx, y0 + railH - 7);
      if (i < shards.length - 1) {
        const nx = x + wCell;
        c.save();
        c.translate(nx, y0 + railH / 2);
        c.rotate(Math.PI / 4);
        c.fillStyle = 'rgba(201,162,39,.45)';
        c.fillRect(-1.8, -1.8, 3.6, 3.6);
        c.restore();
      }
      x += wCell;
    });
    c.restore();
  }

  // ---- gauntlet ribbons -----------------------------------------------------

  const rgbaOf = (hex, a) => {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  };

  // Split a gauntlet's medallions into contiguous row runs (the 5-wide desktop
  // grid wraps gauntlets II and IV across rows; the 3-wide portrait grid keeps
  // each gauntlet to exactly one row).
  function segmentsOf(group) {
    const segs = [];
    let segItems = [];
    for (const item of group.items) {
      const pos = layout[item.index];
      if (!pos) continue;
      const prev = segItems[segItems.length - 1];
      if (prev && (Math.abs(pos.y - prev.pos.y) > pos.r * 0.9 || pos.x < prev.pos.x)) {
        segs.push(segItems);
        segItems = [];
      }
      segItems.push({ ...item, pos });
    }
    if (segItems.length) segs.push(segItems);
    const first = group.g.locks[0];
    const last = group.g.locks[group.g.locks.length - 1];
    return segs.map((items) => ({
      items,
      // gonfalon ends: a swallow-tail V where the banner truly ends, a plain
      // fold-under cut where it wraps to the next row of the grid
      outerLeft: items[0].ordinal === first,
      outerRight: items[items.length - 1].ordinal === last,
    }));
  }

  function bannerGeometry(seg, w) {
    const sockets = seg.items.map((it) => it.pos);
    const r = sockets[0].r;
    const bandH = Math.max(11, Math.min(19, r * 0.52));
    const gapBelow = Math.max(4, r * 0.16);
    // extend past the end sockets into the column gap / chest margin, clamped
    // against the viewport and the neighbouring gauntlet's reach
    let colGap = r * 4;
    for (let i = 1; i < sockets.length; i++) colGap = Math.min(colGap, sockets[i].x - sockets[i - 1].x);
    const ext = Math.max(r * 0.55, Math.min(r + 24, colGap / 2 - r - 5));
    const x0 = Math.max(8, sockets[0].x - r - (seg.outerLeft ? ext : Math.max(2, ext * 0.4)));
    const x1 = Math.min(w - 8, sockets[sockets.length - 1].x + r + (seg.outerRight ? ext : Math.max(2, ext * 0.4)));
    const topAt = (x) => {
      // follow the row's dome bow: piecewise-linear through the socket tops
      if (x <= sockets[0].x) return sockets[0].y - r - gapBelow - bandH;
      const lastS = sockets[sockets.length - 1];
      if (x >= lastS.x) return lastS.y - r - gapBelow - bandH;
      for (let i = 1; i < sockets.length; i++) {
        const a = sockets[i - 1]; const b = sockets[i];
        if (x <= b.x) {
          const t = (x - a.x) / Math.max(1, b.x - a.x);
          return (a.y + (b.y - a.y) * t) - r - gapBelow - bandH;
        }
      }
      return lastS.y - r - gapBelow - bandH;
    };
    return { x0, x1, bandH, topAt, r };
  }

  function traceBanner(ctx, geo, seg) {
    const { x0, x1, bandH, topAt } = geo;
    const notch = bandH * 0.62;
    const steps = 14;
    ctx.beginPath();
    ctx.moveTo(x0 + (seg.outerLeft ? 0 : 0), topAt(x0));
    for (let i = 1; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      ctx.lineTo(x, topAt(x));
    }
    if (seg.outerRight) {
      ctx.lineTo(x1 - notch, topAt(x1) + bandH / 2); // swallow-tail V into the end
      ctx.lineTo(x1, topAt(x1) + bandH);
    } else {
      ctx.lineTo(x1, topAt(x1) + bandH); // fold-under cut (continues next row)
    }
    for (let i = steps; i >= 0; i--) {
      const x = x0 + ((x1 - x0) * i) / steps;
      ctx.lineTo(x, topAt(x) + bandH);
    }
    if (seg.outerLeft) {
      ctx.lineTo(x0 + notch, topAt(x0) + bandH / 2);
    }
    ctx.closePath();
  }

  // A short pennant flap hanging from a true banner end — only drawn where it
  // clears the neighbouring medallion and the screen edge.
  function drawFlap(ctx, xEdge, yBot, bandH, dir, nearestSocket, w, shade) {
    const fw = bandH * 0.95;
    const fl = bandH * 1.55;
    const xIn = xEdge + dir * 2;
    const xOut = xEdge + dir * (2 + fw);
    if (xOut < 6 || xOut > w - 6) return;
    if (nearestSocket) {
      const clear = Math.min(Math.abs(xIn - nearestSocket.x), Math.abs(xOut - nearestSocket.x));
      if (clear < nearestSocket.r + 4) return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xIn, yBot - bandH * 0.55);
    ctx.lineTo(xOut, yBot - bandH * 0.35);
    ctx.lineTo(xOut - dir * fw * 0.08, yBot + fl * 0.62);
    ctx.lineTo((xIn + xOut) / 2, yBot + fl * 0.3); // swallow notch
    ctx.lineTo(xIn + dir * fw * 0.06, yBot + fl);
    ctx.closePath();
    ctx.fillStyle = p.blood;
    ctx.fill();
    ctx.fillStyle = `rgba(12,9,6,${0.3 + shade * 0.2})`; // turned-away fold, darker
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,9,6,.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,241,199,.14)';
    ctx.beginPath();
    ctx.moveTo(xIn, yBot - bandH * 0.5);
    ctx.lineTo(xIn, yBot + fl * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  // Abstract interlace device (docs/JARLS.md: knot devices, no new
  // iconography) — a small seeded closed cross-loop, distinct per jarl.
  function drawDevice(ctx, key, cx, cy, dia) {
    if (typeof art.drawKnot !== 'function') return;
    const r2 = rng(`banner-device:${key}`);
    const n = 4 + r2.int(2);
    const pts = [];
    const rot = r2() * Math.PI;
    for (let i = 0; i < n * 2; i++) {
      const k = (i * (n - 1)) % (n * 2); // star-order visit forces crossings
      const a = rot + (k / (n * 2)) * Math.PI * 2;
      const rad = (dia / 2) * (i % 2 ? 0.55 : 1);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    pts.push(pts[0].slice(), pts[1].slice());
    ctx.save();
    ctx.globalAlpha = 0.9;
    art.drawKnot(ctx, pts, { width: Math.max(1.6, dia * 0.14), color: p.gold, gapAtCrossings: dia * 0.2 });
    ctx.restore();
  }

  // Photo mode: the photograph is the spectacle — NO cloth crosses the
  // medallion field (the full-width ribbons read as red smears cutting the
  // bronze mid-face, Ramon's iPhone review LOOP 1). The one armed chapter
  // label is seated in a CLEAR ZONE of the photograph — the iron band above
  // the first arc, or the wooden rail between arcs — on a whisper-weight
  // blood end-tab sized to the text.
  function paintPhotoLabel(ctx, group, w, h) {
    if (!group.active || !group.label) return;
    const segs = segmentsOf(group);
    if (!segs.length) return;
    // seat the label on the segment that holds the ARMED lock — the words
    // belong beside the burning medallion (fallback: the longest run)
    let labelSeg = null;
    if (nextLock) {
      labelSeg = segs.find((s) => s.items.some((it) => it.ordinal === nextLock.ordinal)) || null;
    }
    if (!labelSeg) {
      labelSeg = segs[0];
      for (const s of segs) {
        if (s.items.length > labelSeg.items.length) labelSeg = s;
        else if (s.items.length === labelSeg.items.length
          && s.items.some((it) => it.ordinal === group.g.dareAt)) labelSeg = s;
      }
    }
    const items = labelSeg.items;
    const row = Math.floor(items[0].index / 5);
    const rect = photoRect(w, h);
    const labelW = group.label.offsetWidth || 150;
    const tabW = Math.min(labelW + 34, w - 16);
    // horizontal seat first: over the segment, clamped so the whole TAB stays
    // on-screen (at 390px the gauntlet-IV tab bled off the left edge — LOOP 2)
    const cxRaw = items.reduce((a, it) => a + it.pos.x, 0) / items.length;
    const cx = Math.max(tabW / 2 + 8, Math.min(w - tabW / 2 - 8, cxRaw));
    let cy;
    if (row === 0) {
      cy = rect.dy + CHEST_LABEL_BAND_TOP * rect.dh;
    } else {
      // midpoint of the clear rail between this arc and the arc above it,
      // measured over the TAB'S OWN CLAMPED SPAN (the arcs smile, so the rail
      // height depends on which columns the cloth actually crosses)
      const x0 = cx - tabW / 2;
      const x1 = cx + tabW / 2;
      let prevBottom = -Infinity;
      let segTop = Infinity;
      for (let i = (row - 1) * 5; i < row * 5; i++) {
        const s2 = layout[i];
        if (!s2 || s2.x + s2.r < x0 || s2.x - s2.r > x1) continue;
        prevBottom = Math.max(prevBottom, s2.y + s2.r);
      }
      for (let i = row * 5; i < Math.min(layout.length, row * 5 + 5); i++) {
        const s2 = layout[i];
        if (!s2 || s2.x + s2.r < x0 || s2.x - s2.r > x1) continue;
        segTop = Math.min(segTop, s2.y - s2.r);
      }
      if (segTop === Infinity) segTop = Math.min(...items.map((it) => it.pos.y - it.pos.r));
      cy = prevBottom > -Infinity ? (prevBottom + segTop) / 2 : segTop - 16;
    }
    group.label.style.left = `${cx}px`;
    group.label.style.top = `${cy}px`;
    // the end-tab: a short strip of cloth pinned behind the words only
    const revealed = isRevealed(group.g);
    const tabH = 20;
    const notch = 7;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - tabW / 2, cy - tabH / 2);
    ctx.lineTo(cx + tabW / 2, cy - tabH / 2);
    ctx.lineTo(cx + tabW / 2 - notch, cy);
    ctx.lineTo(cx + tabW / 2, cy + tabH / 2);
    ctx.lineTo(cx - tabW / 2, cy + tabH / 2);
    ctx.lineTo(cx - tabW / 2 + notch, cy);
    ctx.closePath();
    ctx.fillStyle = revealed ? p.blood : 'rgba(30,20,14,.9)';
    ctx.fill();
    const g1 = ctx.createLinearGradient(0, cy - tabH / 2, 0, cy + tabH / 2);
    g1.addColorStop(0, 'rgba(255,241,199,.10)');
    g1.addColorStop(0.5, 'rgba(12,9,6,.05)');
    g1.addColorStop(1, 'rgba(12,9,6,.42)');
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,9,6,.8)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    if (revealed) {
      ctx.strokeStyle = rgbaOf(p.goldBright, 0.32);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintBanner(ctx, group, w) {
    const segs = segmentsOf(group);
    if (!segs.length) return;
    // One banner leads (QUALITY_LOOP4): the armed gauntlet at full blood, the
    // finished ones resting, the sealed ones receded to tar-washed cloth —
    // five equal-loudness ribbons read as a red lattice, not chapters.
    const revealed = isRevealed(group.g);
    const alpha = group.active ? 1 : group.done ? 0.5 : revealed ? 0.62 : 0.4;
    const r3 = rng(`banner-folds:${group.g.key}`);
    // the label sits on the longest run (ties -> the run holding the dare lock)
    let labelSeg = segs[0];
    for (const s of segs) {
      if (s.items.length > labelSeg.items.length) labelSeg = s;
      else if (s.items.length === labelSeg.items.length
        && s.items.some((it) => it.ordinal === group.g.dareAt)) labelSeg = s;
    }
    for (const seg of segs) {
      const geo = bannerGeometry(seg, w);
      ctx.save();
      ctx.globalAlpha = alpha;
      // seating shadow first, then the cloth
      ctx.save();
      ctx.shadowColor = 'rgba(12,9,6,.65)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 3;
      traceBanner(ctx, geo, seg);
      ctx.fillStyle = p.blood;
      ctx.fill();
      ctx.restore();
      // layered field: gilded lip, daylight fade, tar-weighted hem
      traceBanner(ctx, geo, seg);
      ctx.save();
      ctx.clip();
      const yRef = geo.topAt((geo.x0 + geo.x1) / 2);
      const g1 = ctx.createLinearGradient(0, yRef, 0, yRef + geo.bandH);
      g1.addColorStop(0, 'rgba(238,207,109,.30)');
      g1.addColorStop(0.14, 'rgba(255,241,199,.10)');
      g1.addColorStop(0.45, 'rgba(12,9,6,.06)');
      g1.addColorStop(1, 'rgba(12,9,6,.42)');
      ctx.fillStyle = g1;
      ctx.fillRect(geo.x0 - 2, yRef - geo.bandH, geo.x1 - geo.x0 + 4, geo.bandH * 3);
      if (!group.active && !group.done && !revealed) {
        // sealed cloth: tar-washed, its red held back until the jarl is faced
        ctx.fillStyle = 'rgba(12,9,6,.32)';
        ctx.fillRect(geo.x0 - 2, yRef - geo.bandH, geo.x1 - geo.x0 + 4, geo.bandH * 3);
      }
      // cloth undulation: seeded vertical fold shadows + counter-lights
      const folds = 2 + Math.round((geo.x1 - geo.x0) / 90);
      for (let k = 0; k < folds; k++) {
        const fx = geo.x0 + (geo.x1 - geo.x0) * ((k + 0.35 + r3() * 0.4) / folds);
        const fwd = geo.bandH * (0.5 + r3() * 0.5);
        const gf = ctx.createLinearGradient(fx - fwd, 0, fx + fwd, 0);
        gf.addColorStop(0, 'rgba(12,9,6,0)');
        gf.addColorStop(0.45, 'rgba(12,9,6,.16)');
        gf.addColorStop(0.62, 'rgba(255,241,199,.05)');
        gf.addColorStop(1, 'rgba(12,9,6,0)');
        ctx.fillStyle = gf;
        ctx.fillRect(fx - fwd, yRef - geo.bandH, fwd * 2, geo.bandH * 3);
      }
      if (!seg.outerRight) { // fold-under mark at a wrap cut
        ctx.fillStyle = 'rgba(12,9,6,.3)';
        ctx.fillRect(geo.x1 - 3, yRef - geo.bandH, 3, geo.bandH * 3);
      }
      if (!seg.outerLeft) {
        ctx.fillStyle = 'rgba(12,9,6,.3)';
        ctx.fillRect(geo.x0, yRef - geo.bandH, 3, geo.bandH * 3);
      }
      ctx.restore();
      // edge: tar outline + a thin inner gold thread on the armed gauntlet
      traceBanner(ctx, geo, seg);
      ctx.strokeStyle = 'rgba(12,9,6,.8)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      if (group.active || group.done) {
        traceBanner(ctx, geo, seg);
        ctx.strokeStyle = rgbaOf(p.goldBright, group.active ? 0.35 : 0.22);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      // hanging pennant flaps ONLY at the row's true outer margins — a flap at
      // an interior junction (where the next gauntlet's cloth begins) piled
      // into the shared gap and read as loose red debris over the medallions
      // (QUALITY_LOOP4). Sealed banners hang flapless until their jarl shows.
      const rowOuter = (xEdge, dir, sock) => !layout.some((s2) => s2 && s2 !== sock
        && Math.abs(s2.y - sock.y) < sock.r
        && (dir < 0 ? s2.x < xEdge - 2 : s2.x > xEdge + 2));
      const yB0 = geo.topAt(geo.x0) + geo.bandH;
      const yB1 = geo.topAt(geo.x1) + geo.bandH;
      const firstPos = seg.items[0].pos;
      const lastPos = seg.items[seg.items.length - 1].pos;
      if (revealed || group.active || group.done) {
        if (seg.outerLeft && rowOuter(geo.x0, -1, firstPos)) drawFlap(ctx, geo.x0, yB0, geo.bandH, -1, firstPos, w, r3());
        if (seg.outerRight && rowOuter(geo.x1, 1, lastPos)) drawFlap(ctx, geo.x1, yB1, geo.bandH, 1, lastPos, w, r3());
      }
      ctx.restore();
      if (seg === labelSeg) {
        const cx = (geo.x0 + geo.x1) / 2;
        const cy = geo.topAt(cx) + geo.bandH / 2;
        // the jarl's embroidered knot-device belongs only to a banner whose
        // owner is known — on sealed cloth the gold glints read as stray
        // sparkle debris between the medallions (QUALITY_LOOP4)
        if (group.active || group.done || revealed) {
          drawDevice(ctx, group.g.key, geo.x0 + geo.bandH * 1.5, cy, geo.bandH * 0.82);
        }
        if (group.label) {
          const halfW = group.label.offsetWidth / 2 || 60;
          const clampedX = Math.max(halfW + 6, Math.min(w - halfW - 6, cx));
          group.label.style.left = `${clampedX}px`;
          group.label.style.top = `${cy}px`;
        }
      }
    }
  }

  function paintDeco() {
    const w = deco.w;
    const h = deco.h;
    deco.ctx.clearRect(0, 0, w, h);
    if (photoMode()) {
      // the photograph carries its own history — only the wordmark echo joins
      // it, in the dark hall above the chest
      const L = photoLayout(w, h);
      if (typeof art.wordmark === 'function' && L.top > 56) {
        const size = Math.max(15, Math.min(24, L.top * 0.2));
        art.wordmark(deco.ctx, w / 2, Math.max(34, L.top * 0.44), size, { maxWidth: w * 0.7, depth: 0.75 });
      }
    } else if (useChestLayout) {
      const L = art.chestLayout(w, h, locks.length);
      // quiet tool history in the dead zones around the chest — never on it
      // (two seeded passes: the surround is the largest empty field on the
      // screen and carries the density rubric's dead-zone law)
      if (typeof art.wear === 'function') {
        const avoid = { x: L.left - 12, y: L.top - 12, w: L.chestW + 24, h: L.chestH + 24 };
        art.wear(deco.ctx, w, h, 'lid-hall', { avoid });
        art.wear(deco.ctx, w, h, 'lid-hall-2', { avoid });
      }
      // chip-carved run just inside the screen edge (density law: the empty
      // border carries carving, subordinate to the chest)
      if (typeof art.chipBorder === 'function' && w > 360) {
        art.chipBorder(deco.ctx, 10, 10, w - 20, h - 20, { size: 8, alpha: 0.7 });
      }
      if (typeof art.rosette === 'function') {
        for (const [rx, ry] of [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]]) {
          art.rosette(deco.ctx, rx, ry, 11, { alpha: 0.55 });
        }
      }
      // the wordmark echo in the top strip, small — the hall remembers whose
      // roof this is without competing with the chest
      if (typeof art.wordmark === 'function' && L.top > 56) {
        const size = Math.max(15, Math.min(24, L.top * 0.2));
        art.wordmark(deco.ctx, w / 2, Math.max(34, L.top * 0.44), size, { maxWidth: w * 0.7, depth: 0.75 });
      }
    }
    if (photoMode()) {
      for (const group of gauntletGroups) paintPhotoLabel(deco.ctx, group, w, h);
    } else {
      for (const group of gauntletGroups) paintBanner(deco.ctx, group, w);
    }
  }

  function layoutMedallions() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    layout = photoMode()
      ? photoLayout(w, h).sockets
      : useChestLayout
        ? art.chestLayout(w, h, locks.length).sockets
        : medallionLayout(locks.length, w, h);
    locks.forEach((lock, i) => {
      const pos = layout[i];
      const btn = buttons[i];
      btn.style.left = `${pos.x}px`;
      btn.style.top = `${pos.y}px`;
      btn.style.setProperty('--mr', `${Math.max(44, pos.r * 2)}px`);
    });
  }

  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'lid-canvas';
    screen.replaceChild(fresh.canvas, cur.canvas);
    cur = fresh;
    const freshDeco = art.makeCanvas(w, h);
    freshDeco.canvas.className = 'lid-deco';
    freshDeco.canvas.setAttribute('aria-hidden', 'true');
    screen.replaceChild(freshDeco.canvas, deco.canvas);
    deco = freshDeco;
    cur.canvas.after(deco.canvas);
    // Sit the shard tally on the carved hasp rail of the painted chest rather
    // than at a fixed offset from the bottom of the viewport, where it floated
    // on bare board below the chest.
    let haspW = Math.min(w * 0.86, 640);
    if (photoMode()) {
      // the ledger rail sits ON the photographed carved band under the third
      // arc (fy 0.667 of the plate), centered on the rail plate's own height
      const r = photoRect(w, h);
      haspW = Math.min(r.dw * 0.82, 640);
      haspWrap.style.bottom = 'auto';
      haspWrap.style.top = `${Math.round(r.dy + 0.667 * r.dh - 28)}px`;
    } else if (useChestLayout) {
      const L = art.chestLayout(w, h, locks.length);
      haspW = Math.min(L.chestW * 0.76, 640);
      const railTop = L.top + L.chestH - L.railH + L.railH * 0.1;
      haspWrap.style.bottom = 'auto';
      haspWrap.style.top = `${Math.round(railTop + L.railH * 0.34 - 28)}px`;
    }
    const freshHasp = art.makeCanvas(haspW, 56);
    freshHasp.canvas.className = 'hasp-canvas';
    haspWrap.replaceChild(freshHasp.canvas, hasp.canvas);
    hasp = freshHasp;
    layoutMedallions();
    paintDeco();
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

  // The chest plate arrives whenever it arrives (lazy, same-origin, cached):
  // procedural paints first, the real object settles in on the same frame
  // clock — no jank, and no dependency if the file is absent.
  let alive = true;
  loadHero('chest').then((img) => {
    if (!alive || !img) return;
    hero = img;
    heroBake = null;
    resize();
    if (reducedMotion) paint(0);
  });

  return function unmount() {
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    if (fxTimer) clearTimeout(fxTimer);
    window.removeEventListener('resize', resize);
    screen.remove();
  };
}
