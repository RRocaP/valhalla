// Journal drawer + settings panel. Both reachable only from the Lid hub
// (docs/SHELL.md places both bullets under screen #2), layered above the
// currently-mounted screen rather than replacing it. All player-facing text
// resolves through tr() (src/shell/strings.js via kernel i18n — CONTRACT §4.1
// localization amendment).

import { el, trapFocus, confirmButton } from './dom.js';
import { LANGS } from '../kernel/i18n.js';
import { LANG_NAMES } from './strings.js';

function overlayShell({ className, titleText, closeLabel, onClose }) {
  const scrim = el('div', { class: 'overlay-scrim', onClick: onClose });
  const closeBtn = el('button', { type: 'button', class: 'overlay-close', 'aria-label': closeLabel }, '✕');
  // Escape closes any overlay (LOOP 4: the drawer only answered the ✕ and a
  // scrim tap — desktop hands reach for Escape first). Listener detached by
  // the panel's own removal check so unmount paths need no extra wiring.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (!panel.isConnected) { document.removeEventListener('keydown', onKey); return; }
    e.preventDefault();
    onClose();
  };
  document.addEventListener('keydown', onKey);
  const header = el('div', { class: 'overlay-header' }, [el('h2', { class: 'overlay-title' }, titleText), closeBtn]);
  const panel = el('div', { class: className, role: 'dialog', 'aria-modal': 'true', 'aria-label': titleText }, [header]);
  closeBtn.addEventListener('click', onClose);
  return { scrim, panel, closeBtn };
}

export function mountJournalDrawer(root, { save, tr, onClose }) {
  const { scrim, panel, closeBtn } = overlayShell({
    className: 'drawer', titleText: tr('journal.title'), closeLabel: tr('common.close'), onClose,
  });

  const list = el('div', { class: 'journal-list' });
  if (!save.journal.length) {
    list.append(el('p', { class: 'journal-empty' }, tr('journal.empty')));
  } else {
    // Timestamps stay in the save (docs/SHELL.md contract) but the page reads
    // as carved entries, not a log — the clock is stripped at render.
    save.journal.forEach((line) => list.append(el('p', { class: 'journal-line' },
      String(line).replace(/^\d{2}:\d{2} — /, ''))));
  }
  panel.append(list);

  root.append(scrim, panel);
  requestAnimationFrame(() => panel.classList.add('open'));
  list.scrollTop = list.scrollHeight;
  const untrap = trapFocus(panel);
  closeBtn.focus();

  return function unmount() {
    untrap();
    scrim.remove();
    panel.remove();
  };
}

export function mountSettingsPanel(root, {
  save, audio, tr, lang, focusLang,
  onChanged, onMotionOverrideChanged, onLangChanged, onReset, onClose,
}) {
  const { scrim, panel, closeBtn } = overlayShell({
    className: 'panel-overlay', titleText: tr('settings.title'), closeLabel: tr('common.close'), onClose,
  });

  const muteToggle = el('button', {
    type: 'button', class: 'toggle', role: 'switch',
    'aria-pressed': String(!!save.settings.muted),
    'aria-label': tr('settings.mute'),
  });
  muteToggle.addEventListener('click', () => {
    save.settings.muted = !save.settings.muted;
    audio.setMuted(save.settings.muted);
    muteToggle.setAttribute('aria-pressed', String(save.settings.muted));
    if (!save.settings.muted) audio.ui('tick');
    onChanged();
  });
  const muteRow = el('div', { class: 'settings-row' }, [el('span', { class: 'settings-label' }, tr('settings.mute')), muteToggle]);

  const options = [
    { value: null, label: tr('settings.motionFollow') },
    { value: true, label: tr('settings.motionOn') },
    { value: false, label: tr('settings.motionOff') },
  ];
  const seg = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': tr('settings.motion') });
  const optButtons = options.map((o) => {
    const b = el('button', {
      type: 'button', class: 'segmented-option',
      'aria-pressed': String(save.settings.reducedMotion === o.value),
    }, o.label);
    b.addEventListener('click', () => {
      save.settings.reducedMotion = o.value;
      optButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(options[i].value === o.value)));
      audio.ui('tick');
      onMotionOverrideChanged();
    });
    return b;
  });
  optButtons.forEach((b) => seg.append(b));
  const motionRow = el('div', { class: 'settings-row' }, [el('span', { class: 'settings-label' }, tr('settings.motion')), seg]);

  // Language switcher (CONTRACT §4.1 amendment): three carved plates, the
  // current tongue gold-struck. Visible text is the code (EN/ES/CA — the same
  // in every language); the accessible name is the language's own name.
  const langSeg = el('div', { class: 'lang-row', role: 'radiogroup', 'aria-label': tr('settings.language') });
  const langButtons = LANGS.map((code) => {
    const b = el('button', {
      type: 'button', class: 'lang-btn', 'data-lang': code,
      'aria-pressed': String(lang === code),
      'aria-label': LANG_NAMES[code],
    }, code.toUpperCase());
    b.addEventListener('click', () => {
      if (code === lang) return;
      audio.ui('tick');
      onLangChanged(code); // index.js persists, echoes to the journal, re-renders
    });
    return b;
  });
  langButtons.forEach((b) => langSeg.append(b));
  const langRow = el('div', { class: 'settings-row' }, [el('span', { class: 'settings-label' }, tr('settings.language')), langSeg]);

  const resetRow = el('div', { class: 'settings-row' }, [
    confirmButton({
      label: tr('settings.reset'), confirmLabel: tr('settings.resetConfirm'),
      cancelLabel: tr('common.neverMind'), className: 'btn-quiet',
      onConfirm: onReset,
    }),
  ]);

  panel.append(muteRow, motionRow, langRow, resetRow);
  root.append(scrim, panel);
  requestAnimationFrame(() => panel.classList.add('open'));
  const untrap = trapFocus(panel);
  const struck = langButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
  if (focusLang && struck) struck.focus();
  else closeBtn.focus();

  return function unmount() {
    untrap();
    scrim.remove();
    panel.remove();
  };
}
