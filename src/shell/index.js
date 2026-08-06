// STUB — replaced wholesale by the SHELL worker (docs/SHELL.md is the contract).
// Boots to a title card and lists locks; enough for pipeline smoke tests.
import { rng } from '../kernel/rng.js';

export function createShell({ locks, art, audio, treasureDataUri }) {
  return {
    start() {
      const app = document.getElementById('app');
      const p = art.palette;
      app.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = `min-height:100vh;display:grid;place-content:center;gap:12px;background:${p.oakDeep};color:${p.bone};font-family:Iowan Old Style,Palatino,Georgia,serif;text-align:center;padding:24px`;
      const h1 = document.createElement('h1');
      h1.textContent = 'OATHWOOD';
      h1.style.cssText = `letter-spacing:.35em;color:${p.gold};font-weight:600`;
      const sub = document.createElement('p');
      sub.textContent = `Fifteen Locks of the Northmen — scaffold build, ${locks.length} lock(s) present`;
      sub.style.color = p.boneDim;
      wrap.append(h1, sub);
      app.append(wrap);
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
          save: null,
          treasure: !!treasureDataUri,
          audio: !!audio,
        };
      }
    },
  };
}
