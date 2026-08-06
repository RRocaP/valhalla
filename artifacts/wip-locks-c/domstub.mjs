// Minimal DOM good enough to mount a lock view in Node: elements, listeners,
// a no-op 2D canvas context, and a listener ledger so teardown can be audited.
export function installDom() {
  const ledger = { added: 0, removed: 0 };
  const CTX_NOOP = ['clearRect', 'fillRect', 'strokeRect', 'save', 'restore', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'arcTo', 'rect', 'roundRect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo',
    'stroke', 'fill', 'fillText', 'strokeText', 'setLineDash', 'translate', 'scale', 'rotate', 'clip',
    'drawImage', 'setTransform', 'resetTransform', 'createLinearGradient', 'createRadialGradient'];

  function make2d() {
    const c = {};
    for (const m of CTX_NOOP) {
      c[m] = () => (m.startsWith('create')
        ? { addColorStop() {} }
        : undefined);
    }
    c.measureText = () => ({ width: 10 });
    c.getImageData = () => ({ data: new Uint8ClampedArray(4) });
    c.canvas = null;
    return c;
  }

  function element(tag) {
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      parent: null,
      dataset: {},
      attrs: {},
      style: new Proxy({ cssText: '' }, { get: (t, k) => t[k] ?? '', set: (t, k, v) => { t[k] = v; return true; } }),
      textContent: '',
      className: '',
      listeners: new Map(),
      disabled: false,
      width: 0,
      height: 0,
      append(...kids) {
        for (const k of kids) { if (k && typeof k === 'object') { k.parent = el; el.children.push(k); } }
      },
      appendChild(k) { el.append(k); return k; },
      remove() {
        if (el.parent) el.parent.children = el.parent.children.filter((c) => c !== el);
        el.parent = null;
      },
      setAttribute(k, v) { el.attrs[k] = String(v); },
      getAttribute(k) { return el.attrs[k] ?? null; },
      removeAttribute(k) { delete el.attrs[k]; },
      addEventListener(ev, fn) {
        ledger.added++;
        if (!el.listeners.has(ev)) el.listeners.set(ev, []);
        el.listeners.get(ev).push(fn);
      },
      removeEventListener(ev, fn) {
        ledger.removed++;
        const list = el.listeners.get(ev) || [];
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      },
      dispatch(ev, payload = {}) {
        for (const fn of (el.listeners.get(ev) || []).slice()) fn({ target: el, preventDefault() {}, ...payload });
      },
      getContext() { const c = make2d(); c.canvas = el; return c; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 430, right: 720, bottom: 430 }; },
      focus() {},
      querySelectorAll() { return []; },
    };
    return el;
  }

  const doc = {
    createElement: element,
    elementFromPoint: () => null,
    listeners: new Map(),
    addEventListener(ev, fn) {
      ledger.added++;
      if (!doc.listeners.has(ev)) doc.listeners.set(ev, []);
      doc.listeners.get(ev).push(fn);
    },
    removeEventListener(ev, fn) {
      ledger.removed++;
      const list = doc.listeners.get(ev) || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    readyState: 'complete',
    body: element('body'),
  };

  globalThis.document = doc;
  globalThis.devicePixelRatio = 2;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.requestAnimationFrame = (fn) => { fn(0); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  return { ledger, element, doc };
}

// Walk a mounted tree and collect buttons (depth-first, render order).
export function buttons(root, pred = () => true) {
  const out = [];
  (function walk(el) {
    if (!el || !el.children) return;
    for (const c of el.children) {
      if (c.tagName === 'BUTTON' && pred(c)) out.push(c);
      walk(c);
    }
  })(root);
  return out;
}
