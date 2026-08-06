// Journal drawer + settings panel. Both reachable only from the Lid hub
// (docs/SHELL.md places both bullets under screen #2), layered above the
// currently-mounted screen rather than replacing it.

import { el, trapFocus, confirmButton } from './dom.js';

function overlayShell({ className, titleText, onClose }) {
  const scrim = el('div', { class: 'overlay-scrim', onClick: onClose });
  const closeBtn = el('button', { type: 'button', class: 'overlay-close', 'aria-label': 'Close' }, '✕');
  const header = el('div', { class: 'overlay-header' }, [el('h2', { class: 'overlay-title' }, titleText), closeBtn]);
  const panel = el('div', { class: className, role: 'dialog', 'aria-modal': 'true', 'aria-label': titleText }, [header]);
  closeBtn.addEventListener('click', onClose);
  return { scrim, panel, closeBtn };
}

export function mountJournalDrawer(root, { save, onClose }) {
  const { scrim, panel, closeBtn } = overlayShell({ className: 'drawer', titleText: 'Journal', onClose });

  const list = el('div', { class: 'journal-list' });
  if (!save.journal.length) {
    list.append(el('p', { class: 'journal-empty' }, 'Nothing carved yet.'));
  } else {
    save.journal.forEach((line) => list.append(el('p', { class: 'journal-line' }, line)));
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
  save, audio, onChanged, onMotionOverrideChanged, onReset, onClose,
}) {
  const { scrim, panel, closeBtn } = overlayShell({ className: 'panel-overlay', titleText: 'Settings', onClose });

  const muteToggle = el('button', {
    type: 'button', class: 'toggle', role: 'switch',
    'aria-pressed': String(!!save.settings.muted),
    'aria-label': 'Mute sound',
  });
  muteToggle.addEventListener('click', () => {
    save.settings.muted = !save.settings.muted;
    audio.setMuted(save.settings.muted);
    muteToggle.setAttribute('aria-pressed', String(save.settings.muted));
    if (!save.settings.muted) audio.ui('tick');
    onChanged();
  });
  const muteRow = el('div', { class: 'settings-row' }, [el('span', { class: 'settings-label' }, 'Mute sound'), muteToggle]);

  const options = [
    { value: null, label: 'Follow system' },
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ];
  const seg = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Reduced motion' });
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
  const motionRow = el('div', { class: 'settings-row' }, [el('span', { class: 'settings-label' }, 'Reduced motion'), seg]);

  const resetRow = el('div', { class: 'settings-row' }, [
    confirmButton({
      label: 'Reset chest', confirmLabel: 'Yes — reset everything', className: 'btn-quiet',
      onConfirm: onReset,
    }),
  ]);

  panel.append(muteRow, motionRow, resetRow);
  root.append(scrim, panel);
  requestAnimationFrame(() => panel.classList.add('open'));
  const untrap = trapFocus(panel);
  closeBtn.focus();

  return function unmount() {
    untrap();
    scrim.remove();
    panel.remove();
  };
}
