// Smoke-drive every view: mount, real clicks, submit, clean unmount.
import { installDom, buttons } from './domstub.mjs';
const { ledger, element } = installDom();
const { createArt } = await import('../../src/art/index.js');
const { createAudio } = await import('../../src/audio/index.js');
const { rng } = await import('../../src/kernel/rng.js');

const locks = [];
for (const f of ['11-skerry', '12-veitsla', '13-althing', '14-bindrune', '15-oathring']) {
  locks.push((await import(`../../src/locks/${f}.js`)).default);
}
const art = createArt();
const audio = createAudio();

for (const lock of locks) {
  const before = { a: ledger.added, r: ledger.removed };
  const root = element('div');
  const inst = lock.makePuzzle(rng('lindisfarne-793:' + lock.id));
  const notes = [];
  let submitted = null;
  const ctx = {
    root, instance: inst, art, audio, solved: false,
    submit(ans) { submitted = ans; const v = lock.verify(inst, ans); return v; },
    note(t) { notes.push(t); },
  };
  const view = lock.mount(ctx);
  const btns = buttons(root);
  // click every button once (twice for toggles), in order — real input, no internals
  for (const b of btns) { if (!b.disabled) b.dispatch('click'); }
  for (const b of btns.slice(0, 12)) { if (!b.disabled) b.dispatch('click'); }
  const added = ledger.added - before.a;
  view.unmount();
  const removed = ledger.removed - before.r;
  console.log(`${lock.id}: buttons ${btns.length} | notes ${notes.length} | listeners +${added}/-${removed} ` +
    `${added === removed ? 'CLEAN' : 'LEAK'} | submitted ${submitted ? 'yes' : 'no'} | root children after unmount ${root.children.length}`);
  if (added !== removed) process.exitCode = 1;
  if (root.children.length !== 0) { console.log('  !! view left DOM behind'); process.exitCode = 1; }
  if (!notes.length) { console.log('  !! no ctx.note() text mirror'); process.exitCode = 1; }
}

// Solved-state remount must not throw and must disable submit.
for (const lock of locks) {
  const root = element('div');
  const inst = lock.makePuzzle(rng('lindisfarne-793:' + lock.id));
  let submits = 0;
  const view = lock.mount({ root, instance: inst, art, audio, solved: true,
    submit() { submits++; return { ok: true }; }, note() {} });
  for (const b of buttons(root)) if (!b.disabled) b.dispatch('click');
  view.unmount();
  console.log(`${lock.id}: solved tableau ok, submits while solved = ${submits}${submits ? ' !! should be 0' : ''}`);
  if (submits) process.exitCode = 1;
}
