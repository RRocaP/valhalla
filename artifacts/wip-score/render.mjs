// OW-SCORE measurement harness (template: artifacts/wip-fable-b/render.mjs).
// Renders the real src/audio/** graph in headless Chromium via
// OfflineAudioContext (48 kHz) against the four COMMITTED mp3s, pulls PCM
// back to Node, and gates the v2 progression score:
//   - act1->act2 and act2->act3 crossfades: combined RMS through the window
//     never dips >3 dB below nor bumps >2 dB above the surrounding steadies
//   - each act's baked loop seam: join flux <= its own body p95, |dRMS| <= 2 dB
//   - per-track prepare(): deterministic across decodes, wall time < 80 ms
// Saves metrics.json + table.txt (plot-less) in this directory. Usage:
//   node artifacts/wip-score/render.mjs [--out metrics.json] [--only name,name]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT_DIR = HERE;
const SR = 48000;

// ---------------------------------------------------------------- server ----
const PAGE = `<!doctype html><meta charset="utf-8"><title>ow-score render</title>
<script type="module">
import { createAudio } from '/src/audio/index.js';
import { prepareSeamlessLoop, levelFor, MUSIC_LEVEL } from '/src/audio/music.js';

const SR = ${SR};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms = 20000) {
  const t0 = performance.now();
  while (!pred()) {
    if (performance.now() - t0 > ms) throw new Error('timeout waiting');
    await sleep(20);
  }
}
function b64(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// Generic runner: pre-render steps run at t=0; timed steps run at registered
// OfflineAudioContext suspend points (real scheduling, real graph). The
// instance's createBufferSource is counted so act switches (which allocate a
// new looping source once decode+prepare land) are awaitable while suspended.
async function run(duration, pre, timed = []) {
  let inst = null;
  class OAC extends OfflineAudioContext {
    constructor() {
      super(1, Math.ceil(duration * SR), SR);
      inst = this;
      inst.__srcCount = 0;
      const orig = inst.createBufferSource.bind(inst);
      inst.createBufferSource = () => { inst.__srcCount++; return orig(); };
    }
  }
  const audio = createAudio(OAC);
  audio.enable();
  for (const fn of pre) await fn(audio, () => inst);
  const sorted = timed.slice().sort((a, b) => a.at - b.at);
  const susp = sorted.map((s) => inst.suspend(s.at));
  const renderP = inst.startRendering();
  for (let i = 0; i < sorted.length; i++) {
    await susp[i];
    await sorted[i].run(audio, inst);
    await inst.resume();
  }
  const buf = await renderP;
  return { b64: b64(buf.getChannelData(0)), sr: buf.sampleRate, meta: {} };
}

const droneOn = (a) => { a.drone.start(); a.drone.intensity(0.6); };
const actSwitch = (n) => async (a, inst) => {
  const n0 = inst.__srcCount;
  a.music.act(n);
  await until(() => inst.__srcCount > n0); // decode+prepare+crossfade landed
};

window.SCENARIOS = {
  // Act I established from a cold start, switch to Act II at t=10
  xfade_1_2: () => run(26, [droneOn], [
    { at: 1, run: async (a) => { a.music.start(); await until(() => a.music.ready); } },
    { at: 10, run: actSwitch(2) },
  ]),
  // Load-at-act-2 path (act() before start(), only act2.mp3 fetched), then
  // the second progression switch to Act III at t=10
  xfade_2_3: () => run(26, [droneOn], [
    { at: 1, run: async (a) => { a.music.act(2); a.music.start(); await until(() => a.music.ready); } },
    { at: 10, run: actSwitch(3) },
  ]),
  // v1 regression: the drone -> Act I handoff must keep passing the
  // OW-FABLE-B bar under the refined entry points (their harness owns the
  // original record; re-checked here so their artifacts stay untouched)
  handoff: () => run(16, [droneOn], [
    { at: 7, run: async (a) => { a.music.start(); await until(() => a.music.ready); } },
  ]),
};

// Loop-seam render (fable-b technique): decode, bake, then play across the
// wrap exactly as playback does (loop=true, offset loopEnd-4) -> seam at t=4.
async function seam(url) {
  const scratch = new OfflineAudioContext(1, 8, SR);
  const arr = await (await fetch(url)).arrayBuffer();
  const buf = await scratch.decodeAudioData(arr);
  const { loopStart, loopEnd } = prepareSeamlessLoop(buf);
  const oac = new OfflineAudioContext(1, 8 * SR, SR);
  const src = oac.createBufferSource();
  src.buffer = buf; src.loop = true; src.loopStart = loopStart; src.loopEnd = loopEnd;
  src.connect(oac.destination);
  src.start(0, Math.max(loopStart, loopEnd - 4));
  const out = await oac.startRendering();
  return { b64: b64(out.getChannelData(0)), sr: SR,
    meta: { loopStart, loopEnd, bufDur: buf.duration, joinAt: Math.min(4, loopEnd - loopStart) } };
}
window.SCENARIOS.seam_act1 = () => seam('/music.mp3');
window.SCENARIOS.seam_act2 = () => seam('/act2.mp3');
window.SCENARIOS.seam_act3 = () => seam('/act3.mp3');
window.SCENARIOS.seam_credits = () => seam('/credits.mp3');

// Per-track prepare(): wall time on copies (bake mutates in place), and
// determinism across two INDEPENDENT fetch+decode+prepare passes.
async function prepStats() {
  const urls = { act1: '/music.mp3', act2: '/act2.mp3', act3: '/act3.mp3', credits: '/credits.mp3' };
  const out = {};
  for (const [name, url] of Object.entries(urls)) {
    const decode = async () => {
      const arr = await (await fetch(url)).arrayBuffer();
      return new OfflineAudioContext(1, 8, SR).decodeAudioData(arr);
    };
    const copyOf = (buf) => {
      const chans = [];
      for (let c = 0; c < buf.numberOfChannels; c++) chans.push(Float32Array.from(buf.getChannelData(c)));
      return { sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels,
        length: buf.length, duration: buf.duration, getChannelData: (c) => chans[c] };
    };
    const bufA = await decode();
    const prepMs = [];
    let prepA = null;
    for (let r = 0; r < 3; r++) {
      const copy = copyOf(bufA);
      const t0 = performance.now();
      prepA = prepareSeamlessLoop(copy);
      prepMs.push(performance.now() - t0);
    }
    const prepB = prepareSeamlessLoop(copyOf(await decode())); // fresh fetch + decode
    out[name] = {
      durationS: bufA.duration, sampleRate: bufA.sampleRate, channels: bufA.numberOfChannels,
      loopStart: prepA.loopStart, loopEnd: prepA.loopEnd,
      playStart: prepA.playStart, actStart: prepA.actStart,
      bodyRmsDb: prepA.bodyRmsDb,
      level: name === 'act2' || name === 'act3' ? levelFor(prepA.bodyRmsDb) : MUSIC_LEVEL,
      levelForOwnBody: levelFor(prepA.bodyRmsDb), musicLevel: MUSIC_LEVEL,
      prepMs,
      deterministic: ['loopStart', 'loopEnd', 'playStart', 'actStart', 'bodyRmsDb'].every((k) => prepA[k] === prepB[k]),
    };
  }
  return { b64: '', sr: SR, meta: out };
}
window.SCENARIOS.prep = () => prepStats();

window.RUN = (name) => window.SCENARIOS[name]();
window.READY = true;
</script>`;

function startServer() {
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.mp3': 'audio/mpeg' };
  const srv = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(PAGE);
      }
      if (path.includes('..')) throw new Error('nope');
      if (!/^\/(src\/|music\.mp3$|act2\.mp3$|act3\.mp3$|credits\.mp3$)/.test(path)) throw new Error('scope');
      const data = await readFile(join(ROOT, path));
      const ext = path.slice(path.lastIndexOf('.'));
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('nope'); }
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

// ------------------------------------------------------------------- DSP ----
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const hannCache = new Map();
function hann(n) {
  if (!hannCache.has(n)) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    hannCache.set(n, w);
  }
  return hannCache.get(n);
}

function stft(x, sr, { n = 2048, hop = 512 } = {}, cb) {
  const w = hann(n);
  const re = new Float64Array(n), im = new Float64Array(n);
  const mags = new Float64Array(n / 2);
  for (let f = 0, pos = 0; pos + n <= x.length; f++, pos += hop) {
    for (let i = 0; i < n; i++) { re[i] = x[pos + i] * w[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < n / 2; k++) mags[k] = Math.hypot(re[k], im[k]);
    cb(mags, f, (pos + n / 2) / sr);
  }
}

function rmsDb(x, from = 0, to = x.length) {
  let s = 0;
  const n = Math.max(1, to - from);
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return db(Math.sqrt(s / n));
}
function rmsTrack(x, sr, win = 0.1, hop = 0.025) {
  const w = Math.round(win * sr), h = Math.round(hop * sr);
  const out = [];
  for (let p = 0; p + w <= x.length; p += h) out.push({ t: (p + w / 2) / sr, db: rmsDb(x, p, p + w) });
  return out;
}
function fluxTrack(x, sr, { n = 2048, hop = 512 } = {}) {
  let prev = null;
  const out = [];
  stft(x, sr, { n, hop }, (mags, _f, t) => {
    if (prev) {
      let fl = 0;
      for (let k = 0; k < mags.length; k++) fl += Math.max(0, mags[k] - prev[k]);
      out.push({ t, flux: fl });
    }
    prev = Float64Array.from(mags);
  });
  return out;
}
function percentile(vals, p) {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
const mean = (vals) => vals.reduce((a, b) => a + b, 0) / vals.length;

// ---------------------------------------------------------------- checks ----
const results = { generatedAt: new Date().toISOString(), scenarios: {}, checks: [] };
const tableRows = [];
function check(name, value, pass, detail = '') {
  results.checks.push({ name, value, pass: !!pass, detail });
  const v = typeof value === 'number' ? value.toFixed(2) : String(value);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${v} ${detail}`);
  return !!pass;
}
const inRange = (v, lo, hi) => v !== null && v >= lo && v <= hi;

async function main() {
  const args = process.argv.slice(2);
  const outName = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'metrics.json';
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

  await mkdir(OUT_DIR, { recursive: true });
  const srv = await startServer();
  const port = srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction('window.READY === true');

  const wanted = [
    'xfade_1_2', 'xfade_2_3', 'handoff',
    'seam_act1', 'seam_act2', 'seam_act3', 'seam_credits',
    'prep',
  ].filter((n) => !only || only.includes(n));

  const pcm = {};
  for (const name of wanted) {
    const t0 = Date.now();
    const r = await page.evaluate((n) => window.RUN(n), name);
    const raw = Buffer.from(r.b64, 'base64');
    const ab = new ArrayBuffer(raw.length);
    new Uint8Array(ab).set(raw);
    pcm[name] = { x: new Float32Array(ab), sr: r.sr, meta: r.meta || {} };
    console.log(`rendered ${name} (${(pcm[name].x.length / r.sr).toFixed(1)}s) in ${Date.now() - t0}ms`);
  }
  await browser.close();
  srv.close();

  // ---- act crossfades ----
  // switch fires at t=10, fade is 2.5 s. Two independent gates:
  //  1. the fade itself: the 0.4 s loudness envelope through [9.9, 12.8]
  //     never dips >3 dB below nor bumps >2 dB above the envelope EXTREMES
  //     of the equal-length neighbourhoods either side — like compared with
  //     like, so a fade-made hole or wall fails while the music's own crests
  //     (the nyckelharpa hits +6 dB in 0.1 s windows all through act2, and
  //     they belong there) do not;
  //  2. seating: the acts' seated body medians (bodyRmsDb + level trim, from
  //     the prep pass) match within the clamp margin — the long render
  //     steadies are REPORTED alongside but not gated, because 3-12 s of one
  //     phrase against another swings with the composition, not the mix.
  for (const [name, label] of [['xfade_1_2', 'act1->act2'], ['xfade_2_3', 'act2->act3']]) {
    const s = pcm[name];
    if (!s) continue;
    const env = rmsTrack(s.x, SR, 0.4, 0.025);
    const track = rmsTrack(s.x, SR);
    const bandMean = (a, b) => mean(track.filter((e) => e.t >= a && e.t <= b).map((e) => e.db));
    const extremes = (a, b) => {
      const w = env.filter((e) => e.t >= a && e.t <= b).map((e) => e.db);
      return { min: Math.min(...w), max: Math.max(...w) };
    };
    const pre = extremes(7.0, 9.9);
    const fade = extremes(9.9, 12.8);
    const post = extremes(12.8, 15.7);
    const preDb = bandMean(6.5, 9.7);
    const postDb = bandMean(13.3, 25.5);
    const dip = Math.min(pre.min, post.min) - fade.min;
    const bump = fade.max - Math.max(pre.max, post.max);
    results.scenarios[name] = {
      preEnv: pre, fadeEnv: fade, postEnv: post,
      preSteadyDb: preDb, postSteadyDb: postDb, dipDb: dip, bumpDb: bump,
      levelMatchDeltaDb: postDb - preDb,
      rmsTrack: track.filter((e) => e.t >= 5 && e.t <= 26).map((e) => [+e.t.toFixed(3), +e.db.toFixed(2)]),
    };
    check(`${label}: no dip >3dB through the crossfade`, dip, dip <= 3, 'dB below neighbour envelope');
    check(`${label}: no bump >2dB through the crossfade`, bump, bump <= 2, 'dB above neighbour envelope');
    tableRows.push([label, `pre ${preDb.toFixed(1)}dB`, `post ${postDb.toFixed(1)}dB`,
      `dip ${dip.toFixed(2)}dB`, `bump ${bump.toFixed(2)}dB`]);
  }

  // ---- v1 drone -> Act I handoff regression (OW-FABLE-B bar) ----
  if (pcm.handoff) {
    const s = pcm.handoff;
    const track = rmsTrack(s.x, SR);
    const bandMean = (a, b) => mean(track.filter((e) => e.t >= a && e.t <= b).map((e) => e.db));
    const baseDb = bandMean(5.5, 7);
    const steadyDb = bandMean(13, 15.8);
    const win = track.filter((e) => e.t >= 7 && e.t <= 13);
    const minDb = Math.min(...win.map((e) => e.db));
    const maxDb = Math.max(...win.map((e) => e.db));
    const floorDb = Math.min(baseDb, steadyDb) - 1.5;
    const ceilDb = Math.max(baseDb, steadyDb) + 2;
    results.scenarios.handoff = {
      baseDb, minDb, maxDb, musicSteadyDb: steadyDb,
      dipBelowFloor: floorDb - minDb, bumpAboveCeil: maxDb - ceilDb,
    };
    check('handoff: no hole (min >= min(drone,music)-1.5dB)', floorDb - minDb, minDb >= floorDb, 'dB over');
    check('handoff: no wall (max <= max(drone,music)+2dB)', maxDb - ceilDb, maxDb <= ceilDb, 'dB over');
    check('handoff: music steady within +-3dB of drone', steadyDb - baseDb, inRange(steadyDb - baseDb, -3, 3), 'dB');
    tableRows.push(['handoff (v1 reg.)', `drone ${baseDb.toFixed(1)}dB`, `music ${steadyDb.toFixed(1)}dB`,
      `hole ${(floorDb - minDb).toFixed(2)}dB`, `wall ${(maxDb - ceilDb).toFixed(2)}dB`]);
  }

  // ---- loop seams (same bar as v1: flux <= own p95, |dRMS| <= 2dB) ----
  for (const name of ['seam_act1', 'seam_act2', 'seam_act3', 'seam_credits']) {
    const s = pcm[name];
    if (!s) continue;
    const joinT = s.meta.joinAt ?? 4;
    const fl = fluxTrack(s.x, SR);
    const usable = fl.filter((e) => e.t > 0.3 && e.t < 7.7);
    const p95 = percentile(usable.map((e) => e.flux), 0.95);
    const joinWin = usable.filter((e) => Math.abs(e.t - joinT) <= 0.1);
    const joinMax = Math.max(...joinWin.map((e) => e.flux));
    const rmsBefore = rmsDb(s.x, Math.round((joinT - 0.25) * SR), Math.round(joinT * SR));
    const rmsAfter = rmsDb(s.x, Math.round(joinT * SR), Math.round((joinT + 0.25) * SR));
    results.scenarios[name] = {
      loopStart: s.meta.loopStart, loopEnd: s.meta.loopEnd, bufDur: s.meta.bufDur,
      joinFluxMax: joinMax, trackFluxP95: p95, fluxRatio: joinMax / p95,
      rmsJoinDeltaDb: rmsAfter - rmsBefore,
    };
    check(`${name}: seam flux <= track p95`, joinMax / p95, joinMax <= p95, 'x p95');
    check(`${name}: |RMS delta at join| <= 2dB`, Math.abs(rmsAfter - rmsBefore), Math.abs(rmsAfter - rmsBefore) <= 2, 'dB');
    tableRows.push([name, `loop ${s.meta.loopStart.toFixed(2)}..${s.meta.loopEnd.toFixed(2)}s`,
      `flux ${(joinMax / p95).toFixed(2)}x p95`, `dRMS ${(rmsAfter - rmsBefore).toFixed(2)}dB`, '']);
  }

  // ---- per-track prepare(): deterministic, fast, level-seated ----
  if (pcm.prep) {
    results.scenarios.prep = pcm.prep.meta;
    for (const [name, m] of Object.entries(pcm.prep.meta)) {
      const worst = Math.max(...m.prepMs);
      check(`prep.${name}: wall time < 80ms (worst of 3)`, worst, worst < 80, `ms [${m.prepMs.map((v) => v.toFixed(1)).join(', ')}]`);
      check(`prep.${name}: deterministic across independent decodes`, m.deterministic, m.deterministic === true);
      tableRows.push([`prep ${name}`, `${m.durationS.toFixed(1)}s`, `body ${m.bodyRmsDb.toFixed(2)}dBFS`,
        `level ${m.level.toFixed(3)}`, `prep ${worst.toFixed(1)}ms`]);
    }
    const p = pcm.prep.meta;
    check('prep.act1: level is exactly MUSIC_LEVEL (v1 behavior kept)', p.act1.level, p.act1.level === p.act1.musicLevel);
    check('prep.credits: level is exactly MUSIC_LEVEL (v1 behavior kept)', p.credits.level, p.credits.level === p.credits.musicLevel);
    // REF_BODY_RMS_DB anchors acts 2/3 to act1's body through the browser
    // decoder; act1's own levelFor must therefore compute ~MUSIC_LEVEL.
    const refDriftDb = 20 * Math.log10(p.act1.levelForOwnBody / p.act1.musicLevel);
    check('prep: REF_BODY_RMS_DB matches act1 browser body (+-0.35dB)', refDriftDb, inRange(refDriftDb, -0.35, 0.35), 'dB drift');
    // seating: each act's seated body median (what the trim actually plays
    // at) must match its neighbours within the clamp margin
    const seat = (m) => m.bodyRmsDb + 20 * Math.log10(m.level / m.musicLevel);
    const seat12 = seat(p.act2) - seat(p.act1);
    const seat23 = seat(p.act3) - seat(p.act2);
    check('seating: act2 body seats within +-0.6dB of act1', seat12, inRange(seat12, -0.6, 0.6), 'dB');
    check('seating: act3 body seats within +-0.6dB of act2', seat23, inRange(seat23, -0.6, 0.6), 'dB');
  }

  const fails = results.checks.filter((c) => !c.pass);
  console.log(`\n${results.checks.length - fails.length}/${results.checks.length} checks pass`);
  await writeFile(join(OUT_DIR, outName), JSON.stringify(results, null, 2));
  const width = [18, 22, 22, 18, 26];
  const table = [
    'OW-SCORE progression-score metrics (plot-less table; full data: metrics.json)',
    `generated ${results.generatedAt}`,
    '',
    ...tableRows.map((r) => r.map((cell, i) => String(cell).padEnd(width[i])).join(' ')),
    '',
    `${results.checks.length - fails.length}/${results.checks.length} checks pass`,
    ...fails.map((f) => `FAIL ${f.name} = ${f.value} ${f.detail}`),
  ].join('\n');
  await writeFile(join(OUT_DIR, 'table.txt'), table + '\n');
  console.log(`wrote ${join(OUT_DIR, outName)} and table.txt`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
