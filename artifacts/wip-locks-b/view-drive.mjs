// Drives locks 06-10 views with real input events through a DOM stub.
// Asserts: mount renders, the documented interaction path reaches a correct
// ctx.submit, note() mirrors state, and unmount leaves no node or listener.
import { rng } from '/Users/ramon/oathwood/src/kernel/rng.js';
import { createArt } from '/Users/ramon/oathwood/src/art/index.js';
import { createAudio } from '/Users/ramon/oathwood/src/audio/index.js';

let liveListeners = 0;
const noop = () => {};
const gradient = { addColorStop: noop };
const ctx2d = new Proxy({}, {
  get: (t, k) => {
    if (k === 'canvas') return { width: 400, height: 400 };
    if (k === 'measureText') return () => ({ width: 10 });
    if (typeof k === 'string' && k.startsWith('create')) return () => gradient;
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    return noop;
  },
  set: () => true,
});

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.listeners = [];
    this.attrs = {};
    this.style = { cssText: '' };
    this.dataset = {};
    this._text = '';
    this.width = 0; this.height = 0; this.tabIndex = -1;
    this.disabled = false; this.draggable = false; this.title = ''; this.type = '';
    this._classes = new Set();
    const self = this;
    this.classList = {
      add: (c) => self._classes.add(c),
      remove: (c) => self._classes.delete(c),
      contains: (c) => self._classes.has(c),
      toggle: (c, f) => (f === undefined ? (self._classes.has(c) ? self._classes.delete(c) : self._classes.add(c)) : (f ? self._classes.add(c) : self._classes.delete(c))),
    };
  }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._classes].join(' '); }
  appendChild(c) {
    if (c.parentElement) c.parentElement.removeChild(c);
    c.parentElement = this; this.children.push(c); return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentElement = null; return c;
  }
  remove() { if (this.parentElement) this.parentElement.removeChild(this); }
  addEventListener(t, f) { this.listeners.push([t, f]); liveListeners++; }
  removeEventListener(t, f) {
    const i = this.listeners.findIndex(([tt, ff]) => tt === t && ff === f);
    if (i >= 0) { this.listeners.splice(i, 1); liveListeners--; }
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  getContext() { return ctx2d; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
  focus() {}
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() {
    if (this._text) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }
  fire(type, ev = {}) {
    const e = { type, preventDefault: noop, stopPropagation: noop, target: this, ...ev };
    for (const [t, f] of this.listeners.slice()) if (t === type) f(e);
  }
}

globalThis.document = { createElement: (t) => new El(t) };
globalThis.matchMedia = () => ({ matches: true });   // exercise the reduced-motion path

const walk = (el, out = []) => { out.push(el); el.children.forEach((c) => walk(c, out)); return out; };
const all = (root) => walk(root);
const byRole = (root, role) => all(root).filter((e) => e.attrs.role === role);
const buttons = (root) => all(root).filter((e) => e.tagName === 'BUTTON');
const byText = (root, text) => buttons(root).find((b) => b.textContent === text);

const art = createArt();
const audio = createAudio();
const results = [];

function harness(lock, seed, drive) {
  const instance = lock.makePuzzle(rng(seed));
  const root = new El('div');
  const notes = [];
  let submitted = null;
  const ctx = {
    root, instance, art, audio, solved: false,
    note: (t) => notes.push(t),
    submit: (a) => { submitted = a; return lock.verify(instance, a); },
  };
  const before = liveListeners;
  const handle = lock.mount(ctx);
  if (!root.children.length) throw new Error(`${lock.id}: mount rendered nothing`);
  if (!notes.length) throw new Error(`${lock.id}: mount wrote no journal mirror`);
  const mounted = all(root).length;

  drive({ root, instance, ctx, notes });

  if (!submitted) throw new Error(`${lock.id}: driving the view never reached submit`);
  const v = lock.verify(instance, submitted);
  if (!v.ok) throw new Error(`${lock.id}: view submitted a wrong answer ${JSON.stringify(submitted)}`);

  handle.unmount();
  if (root.children.length) throw new Error(`${lock.id}: unmount left ${root.children.length} node(s)`);
  if (liveListeners !== before) throw new Error(`${lock.id}: unmount leaked ${liveListeners - before} listener(s)`);
  results.push(`${lock.id}: ${mounted} nodes, ${notes.length} journal lines, submit verified, unmount clean`);
}

// ---- 06 ------------------------------------------------------------------
const jotun = (await import('/Users/ramon/oathwood/src/locks/06-jotunvillur.js')).default;
harness(jotun, 'view-06', ({ root, instance }) => {
  const words = jotun.solve(instance).words;
  const rows = byRole(root, 'option');
  const lex = new Set(instance.lexicon.map(([w]) => w));
  words.forEach((w, i) => {
    rows[i].fire('click');
    const b = buttons(root).find((x) => lex.has(x.textContent) && x.textContent === w);
    if (!b) throw new Error(`06: no slate button for ${w}`);
    b.fire('click');
  });
  byText(root, 'Read the manifest').fire('click');
});

// ---- 07 (keyboard path only) ---------------------------------------------
const tafl = (await import('/Users/ramon/oathwood/src/locks/07-tafl.js')).default;
harness(tafl, 'view-07', ({ root, instance }) => {
  const board = byRole(root, 'application')[0];
  let cur = instance.king;
  const step = (to) => {
    let guard = 0;
    while (cur !== to && guard++ < 40) {
      const [cr, cc] = [Math.floor(cur / 7), cur % 7];
      const [tr, tc] = [Math.floor(to / 7), to % 7];
      const key = cr < tr ? 'ArrowDown' : cr > tr ? 'ArrowUp' : cc < tc ? 'ArrowRight' : 'ArrowLeft';
      board.fire('keydown', { key });
      cur = cr < tr ? cur + 7 : cr > tr ? cur - 7 : cc < tc ? cur + 1 : cur - 1;
    }
    board.fire('keydown', { key: 'Enter' });
  };
  for (const [from, to] of tafl.solve(instance).line) {
    step(from[0] * 7 + from[1]);
    step(to[0] * 7 + to[1]);
  }
  byText(root, 'Swear the road').fire('click');
});

// ---- 08 ------------------------------------------------------------------
const hacksilver = (await import('/Users/ramon/oathwood/src/locks/08-hacksilver.js')).default;
harness(hacksilver, 'view-08', ({ root, instance }) => {
  const { piece, heavier } = hacksilver.solve(instance);
  byRole(root, 'radio')[piece].fire('click');
  buttons(root).find((b) => b.textContent.startsWith(heavier ? 'heavy' : 'light')).fire('click');
  byText(root, 'Swear the accusation').fire('click');
});

// ---- 09 ------------------------------------------------------------------
const sunstone = (await import('/Users/ramon/oathwood/src/locks/09-sunstone.js')).default;
harness(sunstone, 'view-09', ({ root, instance }) => {
  const { azimuth, wet } = sunstone.solve(instance);
  buttons(root).find((b) => b.textContent === String(azimuth)).fire('click');
  buttons(root).filter((b) => b.textContent === 'wet')[wet].fire('click');
  byText(root, 'Swear the bearing').fire('click');
});

// ---- 10 ------------------------------------------------------------------
const drott = (await import('/Users/ramon/oathwood/src/locks/10-drottkvaett.js')).default;
harness(drott, 'view-10', ({ root, instance }) => {
  const { lines } = drott.solve(instance);
  const frags = buttons(root).filter((b) => b._classes.has('frag'));
  const slots = all(root).filter((e) => e._classes.has('slot'));
  lines.forEach(([odd, even], k) => {
    frags[odd].fire('click'); slots[k * 2].fire('click');
    frags[even].fire('click'); slots[k * 2 + 1].fire('click');
  });
  byText(root, 'Speak the verse').fire('click');
});

console.log(results.join('\n'));
console.log(`\nlisteners still live after all unmounts: ${liveListeners}`);
