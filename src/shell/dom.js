// Tiny DOM helpers shared by every screen. No framework.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v === false || v == null) { /* omit */ }
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// A button that requires one confirming click before it fires. Used by
// "Begin anew", "Reset chest", "Seal the chest again" — all one-confirm resets.
export function confirmButton({ label, confirmLabel, cancelLabel = 'Never mind', onConfirm, className = '' }) {
  const wrap = el('span', { class: 'confirm-wrap' });
  const ask = el('button', { type: 'button', class: className }, label);
  const yes = el('button', { type: 'button', class: 'confirm-yes' }, confirmLabel);
  const no = el('button', { type: 'button', class: 'confirm-no' }, cancelLabel);
  const confirmRow = el('span', { class: 'confirm-row', style: 'display:none' }, [yes, no]);

  function reset() {
    ask.style.display = '';
    confirmRow.style.display = 'none';
  }
  ask.addEventListener('click', () => {
    ask.style.display = 'none';
    confirmRow.style.display = '';
    yes.focus();
  });
  no.addEventListener('click', reset);
  yes.addEventListener('click', () => { reset(); onConfirm(); });

  wrap.append(ask, confirmRow);
  return wrap;
}

// Focus trap for overlays (journal drawer, settings panel). Returns a
// teardown function. Esc handling is centralized in index.js, not here.
export function trapFocus(container) {
  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
