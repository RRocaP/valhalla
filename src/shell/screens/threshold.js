// Threshold screen. docs/SHELL.md #1. Audio is NOT touched here — the begin
// gesture (audio.enable() + drone.start()) is orchestrated by index.js so this
// screen stays decoupled from audio specifics.
//
// The poster shot (density rubric): the sea-chest waits as a silhouette in the
// lower field under a hearth-light pool, lid catching rim light, dust motes
// adrift (static under reduced motion); the carved wordmark and — after the
// begin gesture — the wager framing card (docs/JARLS.md "The wager") sit
// above it. Wager-seen derives from the stored journal (read-only peek, no
// new save fields); the lid records the journal echo, since it owns the live
// save object.

import { el, confirmButton, carvedHeading, trapFocus } from '../dom.js';
import { loadSave } from '../save.js';
import { WAGER, lineFor, journalHasLine } from '../duels.js';
import { t, resolveLang } from '../../kernel/i18n.js';
import { rng } from '../../kernel/rng.js';

// Shell chrome strings for this screen (kernel i18n dictionary shape). The
// WAGER body is frozen in duels.js; the kicker + continue labels are chrome
// (es/ca wording flagged for lead sign-off in the handoff).
const STR = {
  subtitle: {
    en: 'Fifteen Locks of the Northmen',
    es: 'Quince Cerraduras de los Hombres del Norte',
    ca: 'Quinze Panys dels Homes del Nord',
  },
  kicker: { en: 'THE WAGER', es: 'LA APUESTA', ca: "L'APOSTA" },
  takeWager: { en: 'Take the wager', es: 'Acepta la apuesta', ca: "Accepta l'aposta" },
};

const THRESHOLD_STYLE = `
#app .threshold-motes{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#app .wager-layer{position:absolute;inset:0;z-index:3;display:grid;place-items:center;
  padding:max(18px,var(--safe-t)) max(18px,var(--safe-r)) max(18px,var(--safe-b)) max(18px,var(--safe-l));
  background:radial-gradient(ellipse at 50% 44%,rgba(12,9,6,.38) 0%,rgba(12,9,6,.7) 100%)}
#app .wager-card{position:relative;isolation:isolate;width:min(92vw,600px);
  padding:clamp(24px,4.5vh,44px) clamp(20px,4.5vw,46px);text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:clamp(12px,2.2vh,20px);
  animation:wager-rise .5s cubic-bezier(.22,1,.36,1) both}
#app .wager-card > canvas.wager-panel{position:absolute;inset:0;width:100%;height:100%;z-index:-1;
  border-radius:6px;box-shadow:0 10px 30px rgba(12,9,6,.65),0 2px 6px rgba(12,9,6,.7)}
#app .wager-kicker{font-family:var(--font-display);font-variant-caps:small-caps;letter-spacing:.34em;
  color:var(--goldBright);font-size:clamp(.8rem,.5vw + .68rem,.95rem);text-shadow:0 1px 0 rgba(12,9,6,.9)}
#app .wager-text{font-family:var(--font-body);color:var(--bone);
  font-size:clamp(.98rem,.7vw + .82rem,1.16rem);line-height:1.62;max-width:46ch;
  text-shadow:0 1px 0 rgba(12,9,6,.85)}
@keyframes wager-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){#app .wager-card{animation:none}}
#app.reduced-motion .wager-card{animation:none}
#app .screen-threshold .threshold-content{padding-bottom:clamp(120px,24vh,280px)}`;

// Canvas relief, re-rendered on resize: the title card is one of the three
// call-outs docs/ART.md requires at full carveText depth rather than the CSS
// text-shadow approximation.
function titleSize(w) {
  return Math.round(Math.max(30, Math.min(62, w * 0.052 + 14)));
}

export function mountThreshold(root, { art, hasSave, onBegin, onBeginAnew }) {
  const p = art.palette;
  const screen = el('div', { class: 'screen screen-threshold' });
  const style = el('style');
  style.textContent = THRESHOLD_STYLE;
  screen.append(style);
  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'finale-canvas'; // full-bleed wood backdrop, shared styling
  screen.append(bg.canvas);
  let motes = art.makeCanvas(1, 1);
  motes.canvas.className = 'threshold-motes';
  motes.canvas.setAttribute('aria-hidden', 'true');
  screen.append(motes.canvas);

  // Reduced motion: index.js stamps #app.reduced-motion (user override OR
  // media query) before mounting any screen — read the stamp rather than
  // duplicating the resolution logic here.
  const appRoot = document.getElementById('app');
  const reducedMotion = !!(appRoot && appRoot.classList.contains('reduced-motion'));

  // Language: defensive read of the stored save's settings.lang (the locale
  // switcher is additive and may not have landed) — resolveLang falls back to
  // the navigator language, then en. Read-only peek; never written here.
  function storedSave() {
    try { return loadSave(window.localStorage); } catch { return null; }
  }
  const stored = storedSave();
  const lang = resolveLang(stored && stored.settings && stored.settings.lang,
    typeof navigator !== 'undefined' ? navigator.language : '');

  // The full carved wordmark (tracked VALHALLA over a rune-flanked rule) when
  // the art module provides it; the plain carved heading otherwise. Either
  // way the real text lives in the node for a11y and the e2e title check.
  const makeTitle = (w) => {
    if (typeof art.wordmark !== 'function') {
      return carvedHeading('h1', {
        art, text: 'VALHALLA', size: titleSize(w), className: 'title',
        depth: 1, color: art.palette.gold, letterSpacing: Math.round(titleSize(w) * 0.28),
      });
    }
    const size = titleSize(w);
    const node = el('h1', { class: 'carved-heading title' });
    node.append(el('span', { class: 'visually-hidden' }, 'VALHALLA'));
    const cw = Math.min(Math.max(320, w * 0.94), size * 11.4);
    const c = art.makeCanvas(cw, Math.ceil(size * 2.6));
    c.canvas.setAttribute('aria-hidden', 'true');
    art.wordmark(c.ctx, cw / 2, size * 1.14, size, { maxWidth: cw * 0.94 });
    node.append(c.canvas);
    return node;
  };
  let title = makeTitle(320);
  const subtitle = el('p', { class: 'subtitle' }, t(STR, lang, 'subtitle'));

  // ---- the wager framing card (shown once, after the begin gesture) -------

  const wagerBtn = el('button', { type: 'button', class: 'btn-carved wager-continue' }, t(STR, lang, 'takeWager'));
  let wagerPanel = art.makeCanvas(1, 1);
  wagerPanel.canvas.className = 'wager-panel';
  wagerPanel.canvas.setAttribute('aria-hidden', 'true');
  const wagerCard = el('div', { class: 'wager-card', role: 'dialog', 'aria-label': t(STR, lang, 'kicker') }, [
    wagerPanel.canvas,
    el('p', { class: 'wager-kicker' }, t(STR, lang, 'kicker')),
    el('p', { class: 'wager-text' }, lineFor(WAGER, lang)),
    wagerBtn,
  ]);
  const wagerLayer = el('div', { class: 'wager-layer', style: 'display:none' });
  wagerLayer.append(wagerCard);

  let pendingAction = null;
  let wagerSettled = false;
  let untrap = null;
  function paintWagerPanel() {
    const rect = wagerCard.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    const fresh = art.makeCanvas(rect.width, rect.height);
    fresh.canvas.className = 'wager-panel';
    fresh.canvas.setAttribute('aria-hidden', 'true');
    wagerCard.replaceChild(fresh.canvas, wagerPanel.canvas);
    wagerPanel = fresh;
    const { ctx, w, h } = wagerPanel;
    art.paintWood(ctx, w, h, 793, { shade: 0.34 });
    art.paintPanel(ctx, 0, 0, w, h, { seed: 'the-wager' });
    if (typeof art.chipBorder === 'function') art.chipBorder(ctx, 11, 11, w - 22, h - 22, { size: 7, alpha: 0.6 });
    if (typeof art.rosette === 'function') {
      for (const [rx, ry] of [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]]) {
        art.rosette(ctx, rx, ry, 9, { alpha: 0.6 });
      }
    }
  }
  function settleWager() {
    if (wagerSettled) return;
    wagerSettled = true;
    if (untrap) { untrap(); untrap = null; }
    wagerLayer.style.display = 'none';
    content.style.visibility = '';
    const act = pendingAction;
    pendingAction = null;
    if (act) act();
  }
  function showWager(action) {
    pendingAction = action;
    wagerSettled = false;
    content.style.visibility = 'hidden'; // the card takes the stage alone
    wagerLayer.style.display = '';
    paintWagerPanel();
    untrap = trapFocus(wagerLayer);
    wagerBtn.focus();
  }
  wagerBtn.addEventListener('click', (e) => { e.stopPropagation(); settleWager(); });
  wagerLayer.addEventListener('click', settleWager); // tap anywhere continues
  wagerLayer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); settleWager(); }
  });

  // Wager-seen heuristic (docs/JARLS.md: shown once): the journal already
  // carries the wager line in some language. Begin-anew re-seals the chest,
  // so the wager is always re-framed on that path.
  function beginThrough(action, { always = false } = {}) {
    const seen = !always && journalHasLine(storedSave(), WAGER);
    if (seen) action();
    else showWager(action);
  }

  const actions = el('div', { class: 'threshold-actions' });
  if (hasSave) {
    const cont = el('button', { type: 'button', class: 'btn-carved', onClick: () => beginThrough(onBegin) }, 'Continue');
    const anew = confirmButton({
      label: 'Begin anew',
      confirmLabel: 'Yes — begin anew',
      className: 'btn-quiet',
      onConfirm: () => beginThrough(onBeginAnew, { always: true }),
    });
    actions.append(cont, anew);
  } else {
    const begin = el('button', {
      type: 'button', class: 'btn-carved',
      onClick: () => beginThrough(onBegin),
    }, 'Lay hands on the chest');
    actions.append(begin);
  }

  const content = el('div', { class: 'threshold-content' }, [title, subtitle, actions]);
  screen.append(content, wagerLayer);
  root.append(screen);

  // ---- the chest presence (lower field) -----------------------------------

  function chestBox(w, h) {
    const portraitish = h > w * 1.15;
    const cw = portraitish ? w * 0.76 : Math.min(w * 0.46, 520);
    const ch = cw * (portraitish ? 0.68 : 0.56);
    const bottom = h * (portraitish ? 0.955 : 0.94);
    return { x: w / 2 - cw / 2, y: bottom - ch, w: cw, h: ch };
  }

  function paintChestPresence(ctx, w, h) {
    const b = chestBox(w, h);
    const cx = b.x + b.w / 2;
    const lidH = b.h * 0.3;
    const bodyY = b.y + lidH;
    ctx.save();
    // grounding shadow
    const sh = ctx.createRadialGradient(cx, b.y + b.h, b.w * 0.06, cx, b.y + b.h, b.w * 0.6);
    sh.addColorStop(0, 'rgba(12,9,6,.62)');
    sh.addColorStop(1, 'rgba(12,9,6,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(cx, b.y + b.h, b.w * 0.6, b.h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // body silhouette — layered darks, never a flat fill
    const bodyG = ctx.createLinearGradient(0, bodyY, 0, b.y + b.h);
    bodyG.addColorStop(0, 'rgba(20,13,7,.96)');
    bodyG.addColorStop(0.5, 'rgba(14,10,6,.97)');
    bodyG.addColorStop(1, 'rgba(9,7,4,.98)');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x, bodyY, b.w, b.h - lidH, [3, 3, 7, 7]);
    else ctx.rect(b.x, bodyY, b.w, b.h - lidH);
    ctx.fill();
    // domed lid
    ctx.beginPath();
    ctx.moveTo(b.x, bodyY + 1);
    ctx.quadraticCurveTo(cx, b.y - lidH * 0.55, b.x + b.w, bodyY + 1);
    ctx.closePath();
    const lidG = ctx.createLinearGradient(0, b.y - lidH * 0.4, 0, bodyY);
    lidG.addColorStop(0, 'rgba(26,17,9,.96)');
    lidG.addColorStop(1, 'rgba(13,9,5,.97)');
    ctx.fillStyle = lidG;
    ctx.fill();
    // plank seams + strap silhouettes (subordinate detail, density law)
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      const yy = bodyY + ((b.h - lidH) * k) / 4;
      ctx.beginPath(); ctx.moveTo(b.x + 3, yy); ctx.lineTo(b.x + b.w - 3, yy); ctx.stroke();
      ctx.strokeStyle = 'rgba(233,220,195,.045)';
      ctx.beginPath(); ctx.moveTo(b.x + 3, yy + 1); ctx.lineTo(b.x + b.w - 3, yy + 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
    }
    for (const fx of [0.16, 0.5, 0.84]) {
      const sx = b.x + b.w * fx;
      // the strap follows the dome: start on the lid surface, not above it
      const t = fx;
      const domeY = bodyY - (1 - (2 * t - 1) * (2 * t - 1)) * lidH * 0.52;
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(sx - b.w * 0.022, domeY + 2, b.w * 0.044, b.y + b.h - domeY - 4);
      ctx.fillStyle = 'rgba(238,207,109,.08)';
      for (let rv = 0; rv < 3; rv++) {
        ctx.beginPath();
        ctx.arc(sx, bodyY + ((b.h - lidH) * (rv + 0.7)) / 3.4, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // hearth pool over the chest — the light it waits under
    art.glow(ctx, cx, b.y - lidH * 0.3, b.w * 0.9, p.ember, 0.52);
    art.glow(ctx, cx, b.y - lidH * 0.1, b.w * 0.42, p.goldBright, 0.2);
    art.glow(ctx, cx, b.y + b.h * 0.3, b.w * 0.55, p.gold, 0.14);
    // the pool catches the lid dome and the strap crowns
    const domeLight = ctx.createLinearGradient(0, b.y - lidH * 0.5, 0, bodyY + (b.h - lidH) * 0.4);
    domeLight.addColorStop(0, 'rgba(194,92,51,.2)');
    domeLight.addColorStop(0.5, 'rgba(194,92,51,.07)');
    domeLight.addColorStop(1, 'rgba(194,92,51,0)');
    ctx.fillStyle = domeLight;
    ctx.beginPath();
    ctx.moveTo(b.x, bodyY + (b.h - lidH) * 0.4);
    ctx.lineTo(b.x, bodyY);
    ctx.quadraticCurveTo(cx, b.y - lidH * 0.55, b.x + b.w, bodyY);
    ctx.lineTo(b.x + b.w, bodyY + (b.h - lidH) * 0.4);
    ctx.closePath();
    ctx.fill();
    for (const fx of [0.16, 0.5, 0.84]) { // ember kiss on each strap's crown
      const sx = b.x + b.w * fx;
      ctx.strokeStyle = 'rgba(238,207,109,.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const t = (sx - b.x) / b.w;
      const yOnDome = bodyY - (1 - (2 * t - 1) * (2 * t - 1)) * lidH * 0.52;
      ctx.moveTo(sx - b.w * 0.022, yOnDome + 3);
      ctx.lineTo(sx - b.w * 0.022, yOnDome + 12);
      ctx.stroke();
    }
    // rim light: the lid edge catches the hearth
    const rim = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
    rim.addColorStop(0, 'rgba(238,207,109,0)');
    rim.addColorStop(0.28, 'rgba(238,207,109,.4)');
    rim.addColorStop(0.5, 'rgba(255,241,199,.62)');
    rim.addColorStop(0.72, 'rgba(238,207,109,.4)');
    rim.addColorStop(1, 'rgba(238,207,109,0)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(b.x + 2, bodyY - 1);
    ctx.quadraticCurveTo(cx, b.y - lidH * 0.55, b.x + b.w - 2, bodyY - 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(194,92,51,.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + 4, bodyY + 2.5);
    ctx.quadraticCurveTo(cx, b.y - lidH * 0.42, b.x + b.w - 4, bodyY + 2.5);
    ctx.stroke();
    // hasp glint, dead centre — the first thing a thief checks
    ctx.fillStyle = 'rgba(238,207,109,.5)';
    ctx.fillRect(cx - 2.5, bodyY + 3, 5, Math.min(14, (b.h - lidH) * 0.16));
    ctx.fillStyle = 'rgba(255,241,199,.75)';
    ctx.fillRect(cx - 1, bodyY + 4, 2, 4);
    ctx.restore();
  }

  // ---- dust motes ----------------------------------------------------------

  let moteList = [];
  let motesRaf = null;
  function seedMotes(w, h) {
    const r4 = rng(`threshold-motes:${w}x${h}`); // deterministic, like every screen
    const n = Math.round(Math.max(14, Math.min(30, w / 46)));
    moteList = [];
    for (let i = 0; i < n; i++) {
      moteList.push({
        x: r4() * w,
        y: r4() * h * 0.86,
        r: 0.7 + r4() * 1.3,
        a: 0.08 + r4() * 0.2,
        vy: 4 + r4() * 9,          // px/s, drifting down
        sway: 6 + r4() * 14,
        ph: r4() * Math.PI * 2,
      });
    }
  }
  function paintMotes(tSec) {
    const { ctx, w, h } = motes;
    ctx.clearRect(0, 0, w, h);
    for (const m of moteList) {
      const y = (m.y + m.vy * tSec) % (h * 0.9);
      const x = m.x + Math.sin(tSec * 0.35 + m.ph) * m.sway;
      const warm = y > h * 0.55; // motes near the hearth pool glow warmer
      ctx.fillStyle = warm ? `rgba(238,207,109,${m.a})` : `rgba(233,220,195,${m.a * 0.8})`;
      ctx.beginPath();
      ctx.arc(((x % w) + w) % w, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function startMotes() {
    if (reducedMotion) { paintMotes(0); return; } // static scatter
    const t0 = performance.now();
    const step = (now) => {
      paintMotes((now - t0) / 1000);
      motesRaf = requestAnimationFrame(step);
    };
    motesRaf = requestAnimationFrame(step);
  }

  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'finale-canvas';
    screen.replaceChild(fresh.canvas, bg.canvas);
    bg = fresh;
    art.paintWood(bg.ctx, bg.w, bg.h, 793, { shade: 0.2 });
    // dead-zone law: the hall's empty boards carry quiet tool history — never
    // competing with the chest or the title column
    const cb = chestBox(w, h);
    if (typeof art.wear === 'function') {
      art.wear(bg.ctx, w, h, 'threshold-hall', {
        avoid: { x: cb.x - 14, y: cb.y - 26, w: cb.w + 28, h: cb.h + 30 },
      });
      art.wear(bg.ctx, w, h, 'threshold-hall-2', {
        avoid: { x: w * 0.5 - 340, y: 0, w: 680, h: h * 0.62 },
      });
      if (w > 900) { // the wide hall carries more tool history in its side fields
        art.wear(bg.ctx, w, h, 'threshold-hall-3', {
          avoid: { x: w * 0.5 - 340, y: 0, w: 680, h: h },
        });
      }
    }
    if (typeof art.chipBorder === 'function' && w > 360) {
      art.chipBorder(bg.ctx, 10, 10, w - 20, h - 20, { size: 8, alpha: 0.55 });
    }
    // a quiet carved wainscot rail in the side fields, flanking the chest
    // (echoes the lid's gold rail; breaks the wide bare band the density
    // rubric flags — kept clear of the title column and the chest itself)
    if (typeof art.ribbonRail === 'function' && w > 900) {
      const railY = Math.round(cb.y + cb.h * 0.16);
      bg.ctx.save();
      bg.ctx.globalAlpha = 0.4;
      art.ribbonRail(bg.ctx, 26, railY, cb.x - 20 - 26, { amp: 4, step: 26, color: art.palette.gold });
      art.ribbonRail(bg.ctx, Math.round(cb.x + cb.w + 20), railY, w - 26 - (cb.x + cb.w + 20), { amp: 4, step: 26, color: art.palette.gold });
      bg.ctx.restore();
    }
    if (typeof art.rosette === 'function') {
      for (const [rx, ry] of [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]]) {
        art.rosette(bg.ctx, rx, ry, 11, { alpha: 0.5 });
      }
    }
    // one hearth, high in front of the boards, pooling behind the wordmark
    if (typeof art.hearth === 'function') art.hearth(bg.ctx, w, h, { y: 0.3, strength: 1.1 });
    else art.glow(bg.ctx, w / 2, h * 0.34, Math.max(w, h) * 0.45, art.palette.ember, 0.16);
    // deeper vignette first — the hall recedes...
    const vg = bg.ctx.createRadialGradient(w / 2, h * 0.44, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(12,9,6,0)');
    vg.addColorStop(1, 'rgba(12,9,6,.52)');
    bg.ctx.fillStyle = vg;
    bg.ctx.fillRect(0, 0, w, h);
    // ...then the chest and its hearth pool hold their light against it
    paintChestPresence(bg.ctx, w, h);
    const freshMotes = art.makeCanvas(w, h);
    freshMotes.canvas.className = 'threshold-motes';
    freshMotes.canvas.setAttribute('aria-hidden', 'true');
    screen.replaceChild(freshMotes.canvas, motes.canvas);
    motes = freshMotes;
    seedMotes(w, h);
    if (reducedMotion) paintMotes(0);
    const freshTitle = makeTitle(w);
    content.replaceChild(freshTitle, title);
    title = freshTitle;
    if (wagerLayer.style.display !== 'none') paintWagerPanel();
  }
  window.addEventListener('resize', resize);
  resize();
  startMotes();

  return function unmount() {
    window.removeEventListener('resize', resize);
    if (motesRaf) cancelAnimationFrame(motesRaf);
    if (untrap) untrap();
    screen.remove();
  };
}
