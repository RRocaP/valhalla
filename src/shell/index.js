// OATHWOOD shell — entry point (docs/SHELL.md, frozen signature).
import { rng } from '../kernel/rng.js';
import { resolveLang, t } from '../kernel/i18n.js';
import { FONTS } from '../kernel/fonts.gen.js';
import { SHELL_STRINGS } from './strings.js';
import { freshSave, loadSave, writeSave, hasSave } from './save.js';
import { nextLockId, progressFraction, isComplete } from './progress.js';
import { pushJournal } from './journal.js';
import { buildShellStyle } from './style.js';
import { loadImageCache } from './portraits.js';
import { clear } from './dom.js';
import { mountThreshold } from './screens/threshold.js';
import { mountLid } from './screens/lid.js';
import { mountLockRoom } from './screens/lockroom.js';
import { mountFinale } from './screens/finale.js';
import { mountCredits } from './screens/credits.js';
import { mountJournalDrawer, mountSettingsPanel } from './overlays.js';

export function createShell({ locks, art, audio, treasureDataUri, portraits }) {
  function getStorage() {
    try { return window.localStorage; } catch { return null; }
  }
  const storage = getStorage();
  // One unified cache serves portraits, the treasure image, and the credits
  // sticker pool — loadImageCache is generic over any {key: dataUri} map.
  const imageCache = loadImageCache({ ...(portraits || {}), tebi: treasureDataUri });

  function start() {
    const appRoot = document.getElementById('app');

    // Embedded display face (docs/QUALITY.md Magic Law §2): Cormorant Garamond
    // latin subset as data URIs, injected ahead of the shell style so both DOM
    // text and the canvas carve engine resolve the same voice. Weight range
    // 500-700 maps every display weight onto the one real cut (no faux bold).
    if (!document.getElementById('ow-fonts') && FONTS.regular) {
      const fontEl = document.createElement('style');
      fontEl.id = 'ow-fonts';
      fontEl.textContent =
        `@font-face{font-family:'Cormorant Garamond';font-style:normal;font-weight:500 700;` +
        `src:url(${FONTS.regular}) format('woff2');font-display:swap}` +
        (FONTS.italic
          ? `@font-face{font-family:'Cormorant Garamond';font-style:italic;font-weight:500 700;` +
            `src:url(${FONTS.italic}) format('woff2');font-display:swap}`
          : '');
      document.head.appendChild(fontEl);
    }

    if (!document.getElementById('ow-shell-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'ow-shell-style';
      styleEl.textContent = buildShellStyle(art.palette);
      document.head.appendChild(styleEl);
    }

    appRoot.innerHTML = '';
    const screenSlot = document.createElement('div');
    screenSlot.id = 'screen-slot';
    const overlaySlot = document.createElement('div');
    overlaySlot.id = 'overlay-slot';
    appRoot.append(screenSlot, overlaySlot);

    // Localization (CONTRACT §4.1 amendment 2026-08-06): the additive
    // save.settings.lang is defaulted from navigator.language inside loadSave;
    // #autotest forces effective 'en' so the e2e drivers' label contracts hold
    // (the stored preference is preserved, only the effective language pins).
    const navLang = (typeof navigator !== 'undefined' && navigator.language) || '';
    const autotest = location.hash === '#autotest';
    let save = loadSave(storage, new Date(), navLang);
    function lang() {
      return autotest ? 'en' : resolveLang(save.settings.lang, navLang);
    }
    function tr(key, params) {
      return t(SHELL_STRINGS, lang(), key, params);
    }
    audio.setMuted(save.settings.muted);

    let systemReducedMotion = false;
    let mql = null;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      systemReducedMotion = mql.matches;
      const onMqlChange = (e) => {
        systemReducedMotion = e.matches;
        if (save.settings.reducedMotion === null) rerenderForMotionChange();
      };
      if (mql.addEventListener) mql.addEventListener('change', onMqlChange);
      else if (mql.addListener) mql.addListener(onMqlChange);
    } catch {
      /* matchMedia unavailable — follow-system just behaves as "off" */
    }

    function effectiveReducedMotion() {
      return save.settings.reducedMotion === null ? systemReducedMotion : save.settings.reducedMotion;
    }
    function applyMotionClass() {
      appRoot.classList.toggle('reduced-motion', effectiveReducedMotion());
    }

    function persist() {
      writeSave(storage, save);
      if (audio.enabled) audio.drone.intensity(progressFraction(locks, save));
    }

    function resetChest() {
      const keptLang = save.settings.lang;
      save = freshSave();
      // language is a device preference, not chest progress — survives a reset
      save.settings.lang = resolveLang(keptLang, navLang);
      pushJournal(save, tr('journal.sealedAnew'));
      writeSave(storage, save);
      if (audio.enabled) audio.drone.intensity(0);
    }

    function beginGesture(after) {
      if (!audio.enabled) {
        audio.enable();
        audio.drone.start();
        // act BEFORE start: the lazy loader then fetches only the saved act
        audio.music?.act?.(save.opened.includes('12-veitsla') ? 3
          : save.opened.includes('06-jotunvillur') ? 2 : 1);
        audio.music?.start?.();
        audio.drone.intensity(progressFraction(locks, save));
      }
      audio.ui('knock');
      if (save.journal.length === 0) pushJournal(save, tr('journal.laid'));
      persist();
      after();
    }

    let screen = null;
    let screenUnmount = null;
    let overlay = null;
    let overlayUnmount = null;
    let currentLockId = null;

    function closeOverlay() {
      if (overlayUnmount) { overlayUnmount(); overlayUnmount = null; }
      overlay = null;
    }

    function openJournal() {
      closeOverlay();
      overlay = 'journal';
      overlayUnmount = mountJournalDrawer(overlaySlot, { save, tr, onClose: closeOverlay });
    }

    function openSettings(opts = {}) {
      closeOverlay();
      overlay = 'settings';
      overlayUnmount = mountSettingsPanel(overlaySlot, {
        save,
        audio,
        tr,
        lang: lang(),
        focusLang: !!opts.focusLang,
        onChanged: () => { persist(); applyMotionClass(); },
        onMotionOverrideChanged: () => { persist(); applyMotionClass(); rerenderForMotionChange(); },
        onLangChanged: setLang,
        onReset: () => { closeOverlay(); resetChest(); goTo('threshold'); },
        onClose: closeOverlay,
      });
    }

    // Language switch applies LIVE: persist, journal echo in the NEW language,
    // re-render the current screen, and re-open settings on the fresh render.
    // (Settings is only reachable from the lid, so no puzzle state can be lost.)
    function setLang(next) {
      if (save.settings.lang === next) return;
      save.settings.lang = next;
      pushJournal(save, tr('journal.hallSpeaks'));
      persist();
      goTo(screen);
      openSettings({ focusLang: true });
    }

    function rerenderForMotionChange() {
      applyMotionClass();
      if (screen === 'lid') goTo('lid');
      else if (screen === 'lockroom') goTo('lockroom');
    }

    function goTo(next, opts = {}) {
      if (screenUnmount) { screenUnmount(); screenUnmount = null; }
      closeOverlay();
      screen = next;
      clear(screenSlot);
      applyMotionClass();
      appRoot.dataset.lang = lang(); // stable driver hook (tests/e2e/locale.spec.mjs)
      const reducedMotion = effectiveReducedMotion();

      if (next === 'threshold') {
        screenUnmount = mountThreshold(screenSlot, {
          art, lang: lang(), tr,
          hasSave: hasSave(storage),
          onBegin: () => beginGesture(() => goTo(isComplete(locks, save) ? 'finale' : 'lid', { animate: false })),
          onBeginAnew: () => { resetChest(); beginGesture(() => goTo('lid')); },
        });
        // Interim wiring (lead removes at integration once screens/threshold.js
        // consumes strings.js itself): the subtitle is the one localized line
        // the locale gate pins on the threshold. Same-text no-op in en.
        const sub = screenSlot.querySelector('.subtitle');
        if (sub) sub.textContent = tr('threshold.subtitle');
      } else if (next === 'lid') {
        screenUnmount = mountLid(screenSlot, {
          locks, save, art, audio, reducedMotion, lang: lang(), tr,
          justOpenedId: opts.justOpenedId || null,
          onOpenLock: (id) => { currentLockId = id; goTo('lockroom'); },
          onOpenJournal: openJournal,
          onOpenSettings: openSettings,
        });
      } else if (next === 'lockroom') {
        const lock = locks.find((l) => l.id === currentLockId);
        screenUnmount = mountLockRoom(screenSlot, {
          lock, locks, save, art, audio, reducedMotion, portraitsCache: imageCache,
          lang: lang(), tr,
          onPersist: persist,
          onBack: () => goTo('lid'),
          onSolved: (id) => {
            if (isComplete(locks, save)) goTo('finale', { animate: true });
            else goTo('lid', { justOpenedId: id });
          },
        });
      } else if (next === 'finale') {
        screenUnmount = mountFinale(screenSlot, {
          locks, save, art, audio, treasureDataUri, imageCache, reducedMotion,
          lang: lang(), tr,
          animate: !!opts.animate,
          onReset: () => { resetChest(); goTo('threshold'); },
          onReturnToLid: () => goTo('lid'),
          onCredits: () => goTo('credits'),
        });
      } else if (next === 'credits') {
        screenUnmount = mountCredits(screenSlot, {
          art, audio, reducedMotion, imageCache, lang: lang(), tr,
          onSkip: () => { audio.music?.start?.(); goTo('finale', { animate: false }); },
        });
      }
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (overlay) { closeOverlay(); return; }
      if (screen === 'lockroom') goTo('lid');
    });

    // First paint waits for the embedded face (canvas carve text has no
    // reflow-on-font-load) — data-URI decode is near-instant, and a 400ms
    // race keeps a broken FontFace API from ever blocking the game.
    const fontsSettled = (FONTS.regular && typeof document !== 'undefined'
      && document.fonts && typeof document.fonts.load === 'function')
      ? Promise.race([
        Promise.all([
          document.fonts.load('600 40px "Cormorant Garamond"'),
          document.fonts.load('italic 500 24px "Cormorant Garamond"'),
        ]).catch(() => {}),
        new Promise((r) => setTimeout(r, 400)),
      ])
      : Promise.resolve();
    fontsSettled.then(() => goTo('threshold'));

    if (location.hash === '#autotest') {
      window.__OW = {
        locks,
        instanceOf: (id) => {
          const l = locks.find((x) => x.id === id);
          return l && l.makePuzzle(rng('lindisfarne-793:' + id));
        },
        answerOf: (id) => {
          const l = locks.find((x) => x.id === id);
          return l && l.solve(l.makePuzzle(rng('lindisfarne-793:' + id)));
        },
        get save() { return save; },
      };
    }
  }

  return { start };
}
