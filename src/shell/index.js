// OATHWOOD shell — entry point (docs/SHELL.md, frozen signature).
import { rng } from '../kernel/rng.js';
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

    let save = loadSave(storage);
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
      save = freshSave();
      pushJournal(save, 'The chest is sealed anew.');
      writeSave(storage, save);
      if (audio.enabled) audio.drone.intensity(0);
    }

    function beginGesture(after) {
      if (!audio.enabled) {
        audio.enable();
        audio.drone.start();
        audio.music?.start?.();
        audio.drone.intensity(progressFraction(locks, save));
      }
      audio.ui('knock');
      if (save.journal.length === 0) pushJournal(save, 'The chest is laid before you.');
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
      overlayUnmount = mountJournalDrawer(overlaySlot, { save, onClose: closeOverlay });
    }

    function openSettings() {
      closeOverlay();
      overlay = 'settings';
      overlayUnmount = mountSettingsPanel(overlaySlot, {
        save,
        audio,
        onChanged: () => { persist(); applyMotionClass(); },
        onMotionOverrideChanged: () => { persist(); applyMotionClass(); rerenderForMotionChange(); },
        onReset: () => { closeOverlay(); resetChest(); goTo('threshold'); },
        onClose: closeOverlay,
      });
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
      const reducedMotion = effectiveReducedMotion();

      if (next === 'threshold') {
        screenUnmount = mountThreshold(screenSlot, {
          art,
          hasSave: hasSave(storage),
          onBegin: () => beginGesture(() => goTo(isComplete(locks, save) ? 'finale' : 'lid', { animate: false })),
          onBeginAnew: () => { resetChest(); beginGesture(() => goTo('lid')); },
        });
      } else if (next === 'lid') {
        screenUnmount = mountLid(screenSlot, {
          locks, save, art, audio, reducedMotion,
          justOpenedId: opts.justOpenedId || null,
          onOpenLock: (id) => { currentLockId = id; goTo('lockroom'); },
          onOpenJournal: openJournal,
          onOpenSettings: openSettings,
        });
      } else if (next === 'lockroom') {
        const lock = locks.find((l) => l.id === currentLockId);
        screenUnmount = mountLockRoom(screenSlot, {
          lock, locks, save, art, audio, reducedMotion, portraitsCache: imageCache,
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
          animate: !!opts.animate,
          onReset: () => { resetChest(); goTo('threshold'); },
          onReturnToLid: () => goTo('lid'),
          onCredits: () => goTo('credits'),
        });
      } else if (next === 'credits') {
        screenUnmount = mountCredits(screenSlot, {
          art, audio, reducedMotion, imageCache,
          onSkip: () => { audio.music?.start?.(); goTo('finale', { animate: false }); },
        });
      }
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (overlay) { closeOverlay(); return; }
      if (screen === 'lockroom') goTo('lid');
    });

    goTo('threshold');

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
