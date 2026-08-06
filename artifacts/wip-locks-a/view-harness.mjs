// OW-LOCKS-A view gate — a headless DOM/canvas stand-in, driven with real
// events. Mounts each lock, plays it to its solution through the keyboard and
// pointer paths only, submits, then unmounts and audits for leaks.
//
// Run: node artifacts/wip-locks-a/view-harness.mjs

import { rng } from '../../src/kernel/rng.js';
import { createArt } from '../../src/art/index.js';
import { ORDER } from '../../src/kernel/futhark.js';

import lock01 from '../../src/locks/01-runerow.js';
import lock02 from '../../src/locks/02-bismer.js';
import lock03 from '../../src/locks/03-beacons.js';
import lock04 from '../../src/locks/04-strakes.js';
import lock05 from '../../src/locks/05-knotwork.js';

// ------------------------------------------------------------------ the stub

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
  append(...kids) {
    for (const k of kids) {
      if (k.parentNode) k.parentNode.removeChild(k);
      k.parentNode = this;
      this.children.push(k);
    }
  }
  removeChild(k) {
    const i = this.children.indexOf(k);
    if (i >= 0) this.children.splice(i, 1);
    k.parentNode = null;
    return k;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
    listenerBalance++;
  }
  removeEventListener(type, fn) {
    const fns = this.listeners.get(type);
    if (!fns) return;
    const i = fns.indexOf(fn);
    if (i >= 0) { fns.splice(i, 1); listenerBalance--; }
  }
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
  setPointerCapture() {}
  releasePointerCapture() {}
  get firstChild() { return this.children[0] || null; }
}

const evt = (type, extra = {}) => Object.assign(
  { type, bubbles: true, preventDefault() {}, stopPropagation() {} }, extra,
);

const doc = {
  activeElement: null,
  createElement: (tag) => new El(tag),
};

globalThis.document = doc;
globalThis.window = globalThis;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

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

// ------------------------------------------------------------------ the rig

const art = createArt();
let failures = 0;
const check = (cond, what) => {
  if (!cond) { failures++; console.error('  FAIL ' + what); }
  return cond;
};

function makeCtx(lock, instance, opts = {}) {
  const notes = [];
  const submits = [];
  return {
    root: new El('div'),
    instance,
    art,
    audio: { ui() {}, motif() {}, drone: { start() {}, stop() {}, intensity() {} } },
    submit(answer) {
      submits.push(answer);
      const res = lock.verify(instance, answer);
      return res;
    },
    note(text) { notes.push(text); },
    solved: !!opts.solved,
    __notes: notes,
    __submits: submits,
  };
}

const key = (el, k) => el.dispatchEvent(evt('keydown', { key: k }));
const findAll = (el, pred, out = []) => {
  if (pred(el)) out.push(el);
  for (const k of el.children) findAll(k, pred, out);
  return out;
};
const byLabelStart = (root, s) => findAll(root, (e) => (e.getAttribute('aria-label') || '').startsWith(s));
const buttonsWith = (root, text) => findAll(root, (e) => e.tagName === 'BUTTON' && e.textContent === text);

function run(name, fn) {
  console.log(`\n— ${name}`);
  const before = listenerBalance;
  try {
    fn();
  } catch (e) {
    failures++;
    console.error('  THREW ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n         ') : e));
  }
  check(listenerBalance === before, `listeners balanced after unmount (leaked ${listenerBalance - before})`);
  check(timerLedger.size === 0, `timers cleared (${timerLedger.size} live)`);
}

// ---------------------------------------------------------------- lock 01

run('01-runerow — drag, flip, keyboard, submit', () => {
  const instance = lock01.makePuzzle(rng('view-01'));
  const c = makeCtx(lock01, instance);
  const handle = lock01.mount(c);
  check(c.root.children.length > 0, 'renders into root');
  check(c.__notes.length >= 2, 'writes the rail and the tiles to the journal');

  const tileBtns = findAll(c.root, (e) => e.className === 'ow1-tile');
  check(tileBtns.length === 16, `16 tiles rendered (got ${tileBtns.length})`);

  // lay the tiles out left to right so pointer hit-testing means something
  const place = () => {
    const row = findAll(c.root, (e) => e.getAttribute('role') === 'list')[0];
    row.children.forEach((b, i) => { b.__rect = { left: i * 50, top: 0, width: 46, height: 60 }; });
  };
  place();

  // a real drag: pick up the last tile and drop it at the head of the row
  const rowOf = () => findAll(c.root, (e) => e.getAttribute('role') === 'list')[0].children;
  const last = rowOf()[15];
  last.dispatchEvent(evt('pointerdown', { clientX: 15 * 50 + 20, clientY: 30, pointerId: 1 }));
  last.dispatchEvent(evt('pointermove', { clientX: 400, clientY: 30, pointerId: 1 }));
  last.dispatchEvent(evt('pointermove', { clientX: 10, clientY: 30, pointerId: 1 }));
  last.dispatchEvent(evt('pointerup', { clientX: 10, clientY: 30, pointerId: 1 }));
  check(rowOf()[0] === last, 'drag moved a tile to the head of the row');
  check(c.__notes.some((n) => n.includes('slides from')), 'the move is mirrored in the journal');

  // a tap turns a tile over
  const notesBefore = c.__notes.length;
  const t0 = rowOf()[0];
  t0.dispatchEvent(evt('pointerdown', { clientX: 20, clientY: 30, pointerId: 2 }));
  t0.dispatchEvent(evt('pointerup', { clientX: 21, clientY: 30, pointerId: 2 }));
  check(c.__notes.length > notesBefore && c.__notes[c.__notes.length - 1].includes('turns'),
    'a tap turns the tile and is mirrored');
  key(t0, 'f'); // turn it back

  // now play it out by keyboard alone
  const idOf = (btn) => tileBtns.indexOf(btn);
  for (let p = 0; p < 16; p++) {
    const wanted = instance.tiles.findIndex((t) => t.ch === ORDER[p]);
    const row = rowOf();
    const btn = tileBtns[wanted];
    let at = row.indexOf(btn);
    key(btn, ' '); // lift
    let guard = 0;
    while (at !== p && guard++ < 40) {
      key(btn, at > p ? 'ArrowLeft' : 'ArrowRight');
      at = rowOf().indexOf(btn);
    }
    key(btn, ' '); // set down
  }
  // turn over every tile that was cut backwards
  instance.tiles.forEach((t, id) => { if (t.wend) key(tileBtns[id], 'f'); });

  buttonsWith(c.root, 'Set the row')[0].click();
  check(c.__submits.length === 1, 'submitted once');
  check(lock01.verify(instance, c.__submits[0]).ok === true, 'the played answer opens the lock');
  check(idOf(tileBtns[0]) === 0, 'tile identity kept');

  handle.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// ---------------------------------------------------------------- lock 02

run('02-bismer — reckon, strike, accuse, submit', () => {
  const instance = lock02.makePuzzle(rng('view-02'));
  const c = makeCtx(lock02, instance);
  const handle = lock02.mount(c);
  const pouches = findAll(c.root, (e) => e.getAttribute('role') === 'radio');
  check(pouches.length === 9, `9 pouches (got ${pouches.length})`);
  check(c.__notes.length >= 3, 'the sworn weight and both weighings reach the journal');

  const reckonBtn = findAll(c.root, (e) => e.className === 'ow2-act' && e.textContent.startsWith('Reckon'))[0];
  reckonBtn.click();
  check(c.__notes.some((n) => n.includes('ertog, every pouch is sworn')), 'reckoning is mirrored');

  key(pouches[0], 'x');
  check(pouches[0].dataset.struck === '1', 'X strikes a pouch out');
  key(pouches[0], 'x');

  const want = lock02.solve(instance).pouch;
  pouches[want].click();
  check(pouches[want].getAttribute('aria-checked') === 'true', 'the named pouch is marked');

  const submit = buttonsWith(c.root, 'Name the pouch')[0];
  check(submit.disabled === false, 'submit opens once a pouch is named');
  submit.click();
  check(c.__submits.length === 1 && lock02.verify(instance, c.__submits[0]).ok === true, 'the named pouch opens the lock');

  // arrows walk and name
  key(pouches[want], 'ArrowRight');
  check(pouches[(want + 1) % 9].getAttribute('aria-checked') === 'true', 'arrows walk the pouches');

  handle.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// ---------------------------------------------------------------- lock 03

run('03-beacons — turn the dial by hand and by key, submit', () => {
  const instance = lock03.makePuzzle(rng('view-03'));
  const c = makeCtx(lock03, instance);
  const handle = lock03.mount(c);
  const dial = findAll(c.root, (e) => e.className === 'ow3-dial')[0];
  check(!!dial, 'the dial is rendered');
  check(dial.getAttribute('role') === 'slider', 'the dial is a slider for the screen reader');
  check(dial.getAttribute('aria-valuenow') === '1', 'the dial starts at night 1');

  // turn it by pointer
  dial.__rect = { left: 0, top: 0, width: 320, height: 320 };
  dial.dispatchEvent(evt('pointerdown', { clientX: 160, clientY: 10, pointerId: 1 }));
  dial.dispatchEvent(evt('pointermove', { clientX: 300, clientY: 160, pointerId: 1 }));
  dial.dispatchEvent(evt('pointerup', { clientX: 300, clientY: 160, pointerId: 1 }));
  check(Number(dial.getAttribute('aria-valuenow')) > 1, 'turning the dial moves the night');

  key(dial, 'Home');
  check(dial.getAttribute('aria-valuenow') === '1', 'Home returns to night 1');

  const want = lock03.solve(instance).night;
  const longest = Math.max(...instance.beacons.map((b) => b.cycle));
  let guard = 0;
  while (Number(dial.getAttribute('aria-valuenow')) + longest <= want && guard++ < 4000) key(dial, 'PageUp');
  while (Number(dial.getAttribute('aria-valuenow')) < want && guard++ < 4000) key(dial, 'ArrowRight');
  check(Number(dial.getAttribute('aria-valuenow')) === want, 'the keys reach the night');
  check((dial.getAttribute('aria-valuetext') || '').includes('burns'), 'the dial speaks its state');

  key(dial, 'Enter');
  check(c.__submits.length === 1 && lock03.verify(instance, c.__submits[0]).ok === true, 'the dial opens the lock');

  handle.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// ---------------------------------------------------------------- lock 04

run('04-strakes — accuse, raise the stack, submit', () => {
  const instance = lock04.makePuzzle(rng('view-04'));
  const c = makeCtx(lock04, instance);
  const handle = lock04.mount(c);
  const says = findAll(c.root, (e) => e.className === 'ow4-say');
  const planks = findAll(c.root, (e) => e.className === 'ow4-plank');
  check(says.length === 9, `9 testimonies (got ${says.length})`);
  check(planks.length === 9, `9 planks (got ${planks.length})`);
  check(c.__notes.some((n) => n.includes('Rivet law')), 'both laws reach the journal');
  check(c.__notes.filter((n) => n.includes('swears')).length === 9, 'every testimony reaches the journal');

  const truth = lock04.solve(instance);
  says[truth.liar].click();
  check(says[truth.liar].getAttribute('aria-checked') === 'true', 'the false oath is struck');

  // raise the stack by keyboard: visual list is sheer at top, keel at foot
  const listOf = () => findAll(c.root, (e) => e.getAttribute('role') === 'list')[0].children;
  const wantVisual = truth.order.slice().reverse();
  for (let p = 0; p < 9; p++) {
    const btn = planks[wantVisual[p]];
    let at = listOf().indexOf(btn);
    key(btn, ' ');
    let guard = 0;
    while (at !== p && guard++ < 40) {
      key(btn, at > p ? 'ArrowUp' : 'ArrowDown');
      at = listOf().indexOf(btn);
    }
    key(btn, ' ');
  }
  check(c.__notes.some((n) => n.includes('from the keel')), 'plank moves are mirrored');

  buttonsWith(c.root, 'Raise the stack')[0].click();
  check(c.__submits.length === 1 && lock04.verify(instance, c.__submits[0]).ok === true, 'the raised stack opens the lock');

  handle.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// ---------------------------------------------------------------- lock 05

run('05-knotwork — lay the crossings, follow the band, submit', () => {
  const instance = lock05.makePuzzle(rng('view-05'));
  const c = makeCtx(lock05, instance);
  const handle = lock05.mount(c);
  const cells = findAll(c.root, (e) => e.className === 'ow5-cell');
  check(cells.length === 16, `16 tiles (got ${cells.length})`);
  check(c.__notes.some((n) => n.includes('Carved:')), 'the carved crossings reach the journal');

  // a carved tile refuses to move
  const carved = instance.cells.findIndex((x) => x.carved);
  const before = JSON.stringify(instance);
  key(cells[carved], ' ');
  check(c.__notes[c.__notes.length - 1].includes('cannot be laid otherwise'), 'carved tiles deny and say so');
  check(JSON.stringify(instance) === before, 'the instance is never mutated by the view');

  // follow the band
  const freeCell = instance.free[0];
  key(cells[freeCell], 'T');
  check(c.__notes[c.__notes.length - 1].includes('the band runs on to'), 'following the band is mirrored');

  // arrows walk the panel
  key(cells[0], 'ArrowRight');
  check(doc.activeElement === cells[1], 'arrows walk the panel');

  const want = lock05.solve(instance).states;
  instance.free.forEach((cell, i) => {
    if (instance.initial[i] !== want[i]) key(cells[cell], ' ');
  });

  buttonsWith(c.root, 'Bind the knot')[0].click();
  check(c.__submits.length === 1 && lock05.verify(instance, c.__submits[0]).ok === true, 'the laid panel opens the lock');

  handle.unmount();
  check(c.root.children.length === 0, 'unmount clears the root');
});

// ---------------------------------------------------------- solved tableaux

run('all five — a solved lock re-opens without a submit path', () => {
  for (const lock of [lock01, lock02, lock03, lock04, lock05]) {
    const instance = lock.makePuzzle(rng(`view-solved-${lock.id}`));
    const c = makeCtx(lock, instance, { solved: true });
    const handle = lock.mount(c);
    check(c.root.children.length > 0, `${lock.id} renders its solved tableau`);
    const acts = findAll(c.root, (e) => e.tagName === 'BUTTON' && /act$/.test(e.className));
    const submits = acts.filter((b) => b.disabled);
    check(submits.length >= 1, `${lock.id} disables its submit`);
    for (const b of acts) b.click();
    check(c.__submits.length === 0, `${lock.id} cannot be re-submitted`);
    handle.unmount();
    check(c.root.children.length === 0, `${lock.id} unmounts clean`);
  }
});

realSetTimeout(() => {
  console.log('');
  if (failures) {
    console.error(`VIEW GATE FAILED — ${failures} problem(s)`);
    process.exit(1);
  }
  console.log('VIEW GATE GREEN — five locks mounted, played, submitted and unmounted');
}, 900);
