// Drive each lock to its solution through the VIEW only: find buttons by their
// accessible labels, click them, and check what reaches ctx.submit.
import { installDom, buttons } from './domstub.mjs';
const { element } = installDom();
const { createArt } = await import('../../src/art/index.js');
const { createAudio } = await import('../../src/audio/index.js');
const { rng } = await import('../../src/kernel/rng.js');
const { BY_CH } = await import('../../src/kernel/futhark.js');

const art = createArt(), audio = createAudio();
const load = async (f) => (await import(`../../src/locks/${f}.js`)).default;
const seedFor = (lock) => rng('lindisfarne-793:' + lock.id);

function setup(lock, inst) {
  const root = element('div');
  const state = { submitted: null, result: null, notes: [] };
  const view = lock.mount({
    root, instance: inst, art, audio, solved: false,
    submit(ans) { state.submitted = ans; state.result = lock.verify(inst, ans); return state.result; },
    note(t) { state.notes.push(t); },
  });
  return { root, state, view };
}
const find = (root, pred) => buttons(root).find(pred);
const byLabel = (root, re) => find(root, (b) => re.test(b.getAttribute('aria-label') || ''));
const byText = (root, re) => find(root, (b) => re.test(b.textContent || ''));
const click = (b, what) => { if (!b) throw new Error(`no button for ${what}`); b.dispatch('click'); };

// ---- 11 -------------------------------------------------------------------
{
  const lock = await load('11-skerry');
  const inst = lock.makePuzzle(seedFor(lock));
  const { root, state, view } = setup(lock, inst);
  const route = lock.solve(inst).route;
  for (let i = 1; i < route.length; i++) {
    const name = inst.nodes[route[i]].name;
    click(byText(root, new RegExp(`(Row to|Haul over to) ${name} —`)), `leg to ${name}`);
  }
  click(byText(root, /^Seal the route$/), 'seal');
  console.log(`11-skerry: sailed ${route.length - 1} legs by click → submit ok=${state.result.ok}, notes ${state.notes.length}`);
  view.unmount();
}
// ---- 12 -------------------------------------------------------------------
{
  const lock = await load('12-veitsla');
  const inst = lock.makePuzzle(seedFor(lock));
  const { root, state, view } = setup(lock, inst);
  const ans = lock.solve(inst);
  const benchWord = ['the near bench', 'the far bench'];
  for (let b = 0; b < 2; b++) {
    for (let i = 0; i < 4; i++) {
      click(byText(root, new RegExp(`^${ans.benches[b][i]}$`)), `chip ${ans.benches[b][i]}`);
      click(byLabel(root, new RegExp(`${benchWord[b]}, seat ${i + 1}`)), `seat ${b}/${i}`);
    }
  }
  click(byLabel(root, new RegExp(`^Call this oath the boast: ${inst.oaths[ans.boast].text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)), 'boast');
  click(byText(root, /^Swear the seating$/), 'swear');
  console.log(`12-veitsla: seated 8 + named the boast by click → submit ok=${state.result.ok}, notes ${state.notes.length}`);
  view.unmount();
}
// ---- 13 -------------------------------------------------------------------
{
  const lock = await load('13-althing');
  const inst = lock.makePuzzle(seedFor(lock));
  const { root, state, view } = setup(lock, inst);
  const ans = lock.solve(inst);
  for (let i = 0; i < 9; i++) {
    const nm = inst.names[i];
    click(byLabel(root, new RegExp(`^${nm} is `)), `brand ${nm}`);              // unbranded -> true
    if (ans.liars[i]) click(byLabel(root, new RegExp(`^${nm} is `)), `brand ${nm} liar`);
  }
  click(byLabel(root, new RegExp(`^Name ${inst.names[ans.culprit]} the peace-breaker`)), 'accuse');
  click(byText(root, /^Give the verdict$/), 'verdict');
  console.log(`13-althing: branded 9 + accused by click → submit ok=${state.result.ok}, notes ${state.notes.length}`);
  view.unmount();
}
// ---- 14 -------------------------------------------------------------------
{
  const lock = await load('14-bindrune');
  const inst = lock.makePuzzle(seedFor(lock));
  const { root, state, view } = setup(lock, inst);
  const ans = lock.solve(inst);
  for (const ch of ans.runes) click(byLabel(root, new RegExp(`^${BY_CH[ch].name}`)), `rune ${ch}`);
  click(byText(root, /^Name the bound runes$/), 'seal');
  console.log(`14-bindrune: picked ${ans.runes.length} runes by click → submit ok=${state.result.ok}, notes ${state.notes.length}`);
  view.unmount();
}
// ---- 15 -------------------------------------------------------------------
{
  const lock = await load('15-oathring');
  const inst = lock.makePuzzle(seedFor(lock));
  const { root, state, view } = setup(lock, inst);
  const ring = lock.solve(inst).ring;
  for (let slot = 0; slot < ring.length; slot++) {
    click(byLabel(root, new RegExp(`^Shard ${BY_CH[ring[slot]].name}, number`)), `shard ${ring[slot]}`);
    click(byLabel(root, new RegExp(`^Slot ${slot}[,.]`)), `slot ${slot}`);
  }
  click(byText(root, /^Close the ring$/), 'close');
  console.log(`15-oathring: hung 14 shards by click → submit ok=${state.result.ok}, notes ${state.notes.length}`);
  console.log(`   submitted ring: ${state.submitted.ring.join(' ')}`);
  view.unmount();
}
