// OW-FABLE-A feel/fairness gate — deterministic checks for the polish raise on
// locks 01–05. Complements (never replaces) the lane's view-harness: this one
// asserts the NEW guarantees — premise/goal/keyboard journal notes, near-miss
// visual state, ember-flicker lifecycle under both motion settings, and clean
// unmounts with the new timers/rAF in play.
//
// Run: node artifacts/wip-fable-a/feel-gate.mjs

import { rng } from '../../src/kernel/rng.js';
import { createArt } from '../../src/art/index.js';

import lock01 from '../../src/locks/01-runerow.js';
import lock02 from '../../src/locks/02-bismer.js';
import lock03 from '../../src/locks/03-beacons.js';
import lock04 from '../../src/locks/04-strakes.js';
import lock05 from '../../src/locks/05-knotwork.js';

// ---------------------------------------------------------------- DOM stub
let listenerBalance = 0;
const timerLedger = new Map();

const gradient = () => ({ addColorStop() {} });
const FACTORIES = {
  createLinearGradient: gradient,
  createRadialGradient: gradient,
  createConicGradient: gradient,
  createPattern: () => ({ setTransform() {} }),
  measureText: () => ({ width: 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
};
const ctx2d = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k in FACTORIES) return FACTORIES[k];
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; },
});

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = { cssText: '' };
    this.dataset = {};
    this.attrs = {};
    this.listeners = new Map();
    this.textContent = '';
    this.className = '';
    this.disabled = false;
    this.type = '';
    this.__rect = { left: 0, top: 0, width: 44, height: 44 };
    if (this.tagName === 'CANVAS') {
      this.width = 0;
      this.height = 0;
      this.getContext = () => (this.__ctx || (this.__ctx = ctx2d()));
    }
  }
  // Browser-accurate on the two behaviours QA hit: re-appending a connected
  // node momentarily disconnects it, which BLURS it and DROPS pointer capture.
  append(...kids) {
    for (const k of kids) {
      if (k.parentNode) {
        if (doc.activeElement === k) doc.activeElement = null;
        k.__captured = null;
        k.parentNode.removeChild(k);
      }
      k.parentNode = this;
      this.children.push(k);
    }
  }
  removeChild(k) { const i = this.children.indexOf(k); if (i >= 0) this.children.splice(i, 1); k.parentNode = null; return k; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); listenerBalance++; }
  removeEventListener(type, fn) { const fns = this.listeners.get(type); if (!fns) return; const i = fns.indexOf(fn); if (i >= 0) { fns.splice(i, 1); listenerBalance--; } }
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    let node = this;
    while (node) {
      const fns = node.listeners.get(ev.type);
      if (fns) for (const fn of fns.slice()) fn.call(node, ev);
      node = ev.bubbles === false ? null : node.parentNode;
    }
    return true;
  }
  getBoundingClientRect() { return this.__rect; }
  focus() { doc.activeElement = this; this.dispatchEvent(evt('focus', { bubbles: false })); }
  click() { this.dispatchEvent(evt('click')); }
  setPointerCapture(id) { this.__captured = id; }
  releasePointerCapture(id) { if (this.__captured === id) this.__captured = null; }
}
const evt = (type, extra = {}) => Object.assign({ type, bubbles: true, preventDefault() {}, stopPropagation() {} }, extra);
const doc = { activeElement: null, createElement: (tag) => new El(tag) };

globalThis.document = doc;
globalThis.window = globalThis;
let REDUCED = false;
globalThis.matchMedia = () => ({ matches: REDUCED, addEventListener() {}, removeEventListener() {} });

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
let timerSeq = 0;
globalThis.setTimeout = (fn, ms) => {
  const id = ++timerSeq;
  const handle = realSetTimeout(() => { timerLedger.delete(handle); fn(); }, ms);
  timerLedger.set(handle, id);
  return handle;
};
globalThis.clearTimeout = (h) => { timerLedger.delete(h); return realClearTimeout(h); };

// rAF spy — Node has none, so the gate owns it entirely.
let rafCalls = 0;
let cancelCalls = 0;
let rafInstalled = false;
function installRaf() {
  rafInstalled = true;
  rafCalls = 0;
  cancelCalls = 0;
  globalThis.requestAnimationFrame = () => { rafCalls++; return rafCalls; };
  globalThis.cancelAnimationFrame = () => { cancelCalls++; };
}
function removeRaf() {
  rafInstalled = false;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
}

// ---------------------------------------------------------------- the rig
const art = createArt();
let failures = 0;
const check = (cond, what) => { if (!cond) { failures++; console.error('  FAIL ' + what); } return cond; };

function makeCtx(lock, instance) {
  const notes = [];
  return {
    root: new El('div'),
    instance,
    art,
    audio: { ui() {}, motif() {}, drone: { start() {}, stop() {}, intensity() {} } },
    submit(answer) { return lock.verify(instance, answer); },
    note(t) { notes.push(t); },
    solved: false,
    __notes: notes,
  };
}
const findAll = (el, pred, out = []) => { if (pred(el)) out.push(el); for (const k of el.children) findAll(k, pred, out); return out; };
const texts = (root) => findAll(root, (e) => e.tagName === 'P').map((e) => e.textContent).join(' | ');
const key = (el, k) => el.dispatchEvent(evt('keydown', { key: k }));
const noteHit = (c, s) => c.__notes.some((n) => n.includes(s));

function run(name, fn) {
  console.log(`\n— ${name}`);
  const before = listenerBalance;
  try { fn(); } catch (e) {
    failures++;
    console.error('  THREW ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n         ') : e));
  }
  check(listenerBalance === before, `listeners balanced (leaked ${listenerBalance - before})`);
  check(timerLedger.size === 0, `timers cleared (${timerLedger.size} live)`);
}

// ------------------------------------------------------- 01: ættir fairness
run('01 — ættir surfaced; near-miss marks the regions; no local shudder', () => {
  const instance = lock01.makePuzzle(rng('feel-01'));
  const c = makeCtx(lock01, instance);
  const h = lock01.mount(c);
  check(noteHit(c, 'Three ættir divide the rail'), 'journal names the ættir split');
  check((findAll(c.root, (e) => e.getAttribute && e.getAttribute('role') === 'img')[0]
    .getAttribute('aria-label') || '').includes('ættir'), 'rail aria carries the ættir bounds');

  // first focus documents the keys, exactly once
  const tiles = findAll(c.root, (e) => e.className === 'ow1-tile');
  tiles[0].focus();
  tiles[1].focus();
  check(c.__notes.filter((n) => n.startsWith('By key:')).length === 1, 'one first-focus key note');

  // wrong submit → near line reaches the board status (region marks painted)
  const submit = findAll(c.root, (e) => e.tagName === 'BUTTON' && e.textContent === 'Set the row')[0];
  submit.click();
  const status = findAll(c.root, (e) => (e.getAttribute && e.getAttribute('aria-live') === 'polite'))[0];
  check(status.textContent.length > 0, 'near-diagnostic shown on the board');
  h.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// -------------------------------------------------- 02: premise + weighing mark
run('02 — clipped premise on board and journal; near marks the clearing weighing', () => {
  const instance = lock02.makePuzzle(rng('feel-02'));
  const c = makeCtx(lock02, instance);
  const h = lock02.mount(c);
  check(texts(c.root).includes('One pouch was clipped'), 'the clipped premise is on the board');
  check(noteHit(c, 'One pouch was clipped and runs light'), 'the clipped premise reaches the journal');
  check(lock02.epigraph.includes('one runs light'), 'the epigraph carries the premise');

  const pouches = findAll(c.root, (e) => e.getAttribute && e.getAttribute('role') === 'radio');
  pouches[0].focus();
  pouches[1].focus();
  check(c.__notes.filter((n) => n.startsWith('By key:')).length === 1, 'one first-focus key note');

  // name a wrong pouch, submit, and expect the near path to run clean
  const right = lock02.solve(instance).pouch;
  const wrong = (right + 1) % 9;
  pouches[wrong].click();
  const submit = findAll(c.root, (e) => e.tagName === 'BUTTON' && e.textContent === 'Name the pouch')[0];
  submit.click();
  const status = findAll(c.root, (e) => (e.getAttribute && e.getAttribute('aria-live') === 'polite'))[0];
  check(status.textContent.includes('weighing'), 'near names the weighing on the board');
  h.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// ------------------------------------------- 03: goal, flicker lifecycle, near
run('03 — goal stated; flicker starts and is cancelled; near marks dark fires', () => {
  installRaf();
  const instance = lock03.makePuzzle(rng('feel-03'));
  const c = makeCtx(lock03, instance);
  const h = lock03.mount(c);
  check(texts(c.root).includes('all three burn as one'), 'the goal is on the board');
  check(noteHit(c, 'all three burn as one'), 'the goal reaches the journal');
  check(rafCalls === 1, `flicker armed once via rAF (got ${rafCalls})`);

  const dial = findAll(c.root, (e) => e.className === 'ow3-dial')[0];
  dial.focus();
  check(c.__notes.filter((n) => n.startsWith('By key:')).length === 1, 'one first-focus key note');

  // submit a night that cannot answer (night 1 answers only if all burned tonight)
  key(dial, 'Enter');
  const rows = findAll(c.root, (e) => e.tagName === 'SPAN' && e.style.color);
  const litNow = instance.beacons.filter((b) => (1 + b.lastBurned) % b.cycle === 0).length;
  if (litNow < 3) check(rows.length >= 1, 'dark beacons tinted ember in the ledger');

  h.unmount();
  check(cancelCalls === 1, `flicker cancelled on unmount (got ${cancelCalls})`);
  check(c.root.children.length === 0, 'unmount clears the root');

  // reduced motion: no flicker is ever armed
  REDUCED = true;
  installRaf();
  const c2 = makeCtx(lock03, instance);
  const h2 = lock03.mount(c2);
  check(rafCalls === 0, 'reduced motion arms no flicker');
  h2.unmount();
  check(cancelCalls === 0, 'nothing to cancel under reduced motion');
  REDUCED = false;
  removeRaf();
});

// ------------------------------------------------ 04: near marks where it fails
run('04 — near marks: cleared oath, forbidden pair, stand-true count', () => {
  const instance = lock04.makePuzzle(rng('feel-04'));
  const c = makeCtx(lock04, instance);
  const h = lock04.mount(c);
  const truth = lock04.solve(instance);
  const says = findAll(c.root, (e) => e.className === 'ow4-say');
  const status = () => findAll(c.root, (e) => (e.getAttribute && e.getAttribute('aria-live') === 'polite'))[0].textContent;

  says[0].focus();
  check(c.__notes.filter((n) => n.startsWith('By key:')).length === 1, 'one first-focus key note');

  // (a) accuse a lawful oath → that testimony is marked near
  const lawful = truth.liar === 0 ? 1 : 0;
  says[lawful].click();
  const submit = findAll(c.root, (e) => e.tagName === 'BUTTON' && e.textContent === 'Raise the stack')[0];
  submit.click();
  check(says[lawful].dataset.near === '1', 'the wrongly accused oath is marked');
  check(status().includes('no lie'), 'near says the oath keeps the law');

  // (b) accuse the liar with the raw stack → parity pairs marked (paint path runs)
  says[truth.liar].click();
  check(says[lawful].dataset.near !== '1', 'accusing anew clears the old mark');
  submit.click();
  check(status().length > 0, 'a near line stands for the parity fault');

  h.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// ------------------------------------------------ 05: bands named; first fault
run('05 — bands defined in journal; toggle pulse timer cleaned; near fault path', () => {
  const instance = lock05.makePuzzle(rng('feel-05'));
  const c = makeCtx(lock05, instance);
  const h = lock05.mount(c);
  check(noteHit(c, 'standing band runs north and south'), 'the journal defines the bands');

  const cells = findAll(c.root, (e) => e.className === 'ow5-cell');
  cells[0].focus();
  check(c.__notes.filter((n) => n.startsWith('By key:')).length === 1, 'one first-focus key note');

  // toggle a free crossing (spawns the pulse timer), then submit wrong
  key(cells[instance.free[0]], ' ');
  const submit = findAll(c.root, (e) => e.tagName === 'BUTTON' && e.textContent === 'Bind the knot')[0];
  submit.click();
  const status = findAll(c.root, (e) => (e.getAttribute && e.getAttribute('aria-live') === 'polite'))[0];
  check(status.textContent.includes('doubles over'), 'the near count stands on the board');

  h.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// --------------------------------------------- grip: focus + pointer capture
run('01 — grip survives re-render: focus restored, capture re-established', () => {
  const instance = lock01.makePuzzle(rng('grip-01'));
  const c = makeCtx(lock01, instance);
  const h = lock01.mount(c);
  const rowOf = () => findAll(c.root, (e) => e.getAttribute && e.getAttribute('role') === 'list')[0].children;

  // keyboard: lift a tile and walk it — the reorder must not shed focus
  const walker = rowOf()[0];
  walker.focus();
  key(walker, ' ');           // lift (no reorder)
  key(walker, 'ArrowRight');  // move (reorders the DOM)
  check(doc.activeElement === walker, 'keyboard mover keeps focus across the reorder');
  key(walker, ' ');           // set down
  check(doc.activeElement === walker, 'focus still held after set-down');

  // pointer: mid-drag re-renders must re-establish capture and keep focus
  rowOf().forEach((b, i) => { b.__rect = { left: i * 50, top: 0, width: 46, height: 60 }; });
  const dragged = rowOf()[15];
  dragged.focus();
  dragged.dispatchEvent(evt('pointerdown', { clientX: 15 * 50 + 20, clientY: 30, pointerId: 7 }));
  check(dragged.__captured === 7, 'capture taken on pointerdown');
  dragged.dispatchEvent(evt('pointermove', { clientX: 400, clientY: 30, pointerId: 7 }));
  dragged.dispatchEvent(evt('pointermove', { clientX: 10, clientY: 30, pointerId: 7 }));
  check(dragged.__captured === 7, 'capture re-established after the reorder re-append');
  check(doc.activeElement === dragged, 'focus survives the mid-drag reorder');
  dragged.dispatchEvent(evt('pointerup', { clientX: 10, clientY: 30, pointerId: 7 }));
  check(rowOf().indexOf(dragged) === 0, 'the drag landed at the head');
  h.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

run('04 — grip survives re-render: plank drag keeps capture and focus', () => {
  const instance = lock04.makePuzzle(rng('grip-04'));
  const c = makeCtx(lock04, instance);
  const h = lock04.mount(c);
  const listOf = () => findAll(c.root, (e) => e.getAttribute && e.getAttribute('role') === 'list')[0].children;
  listOf().forEach((b, i) => { b.__rect = { left: 0, top: i * 36, width: 200, height: 34 }; });

  const dragged = listOf()[8];
  dragged.focus();
  dragged.dispatchEvent(evt('pointerdown', { clientX: 20, clientY: 8 * 36 + 10, pointerId: 3 }));
  check(dragged.__captured === 3, 'capture taken on pointerdown');
  dragged.dispatchEvent(evt('pointermove', { clientX: 20, clientY: 5, pointerId: 3 }));
  check(dragged.__captured === 3, 'capture re-established after the stack reorder');
  check(doc.activeElement === dragged, 'focus survives the mid-drag reorder');
  dragged.dispatchEvent(evt('pointerup', { clientX: 20, clientY: 5, pointerId: 3 }));
  check(listOf().indexOf(dragged) < 8, 'the plank moved up the stack');

  // keyboard: lift + move, focus must stay on the moved plank
  const kb = listOf()[4];
  kb.focus();
  key(kb, ' ');
  key(kb, 'ArrowUp');
  check(doc.activeElement === kb, 'keyboard mover keeps focus across the reorder');
  key(kb, ' ');
  h.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

realSetTimeout(() => {
  console.log('');
  if (failures) {
    console.error(`FEEL GATE FAILED — ${failures} problem(s)`);
    process.exit(1);
  }
  console.log('FEEL GATE GREEN — fairness notes, near-marks, flicker lifecycle, grip, clean unmounts');
}, 700);
