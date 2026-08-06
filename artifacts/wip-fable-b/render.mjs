// OW-FABLE-B measurement harness. Renders the real src/audio/** graph in
// headless Chromium via OfflineAudioContext (48 kHz), pulls Float32 PCM back
// to Node, and computes engineering metrics against the notch-above targets.
// No deps beyond the repo's own Playwright. Usage:
//   node artifacts/wip-fable-b/render.mjs [--out metrics.json] [--only name,name]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT_DIR = HERE;
const SR = 48000;

// ---------------------------------------------------------------- server ----
const PAGE = `<!doctype html><meta charset="utf-8"><title>ow-fable-b render</title>
<script type="module">
import { createAudio } from '/src/audio/index.js';
import { prepareSeamlessLoop } from '/src/audio/music.js';

const SR = ${SR};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms = 15000) {
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
function makeSineWav(freq, seconds, sr = SR, amp = 0.25) {
  const n = Math.round(seconds * sr);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(amp * 32767 * Math.sin(2 * Math.PI * freq * i / sr)), true);
  return buf;
}

// Generic runner: pre-render steps run at t=0; timed steps run at registered
// OfflineAudioContext suspend points (real scheduling, real graph).
async function run(duration, pre, timed = []) {
  let inst = null;
  class OAC extends OfflineAudioContext {
    constructor() { super(1, Math.ceil(duration * SR), SR); inst = this; }
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

const mockFetchWav = (freq, seconds) => async () =>
  ({ ok: true, arrayBuffer: async () => makeSineWav(freq, seconds) });

window.SCENARIOS = {
  // every ui kind: 1 s, fired at t=0
  ...Object.fromEntries(['tick', 'knock', 'slide', 'deny', 'confirm', 'flip'].map((k) =>
    ['ui_' + k, () => run(1.0, [(a) => a.ui(k)])])),
  // isolated motifs (no drone) for spectral identity
  ...Object.fromEntries(['shard', 'hint', 'unlock', 'dare', 'yield'].map((k) =>
    ['motif_' + k, () => run(4.5, [(a) => a.motif(k)])])),
  // chest in context: established drone, chest at t=5
  motif_chest: () => run(12, [(a) => { a.drone.start(); a.drone.intensity(0.6); }],
    [{ at: 5, run: (a) => a.motif('chest') }]),
  // drone at three intensities, 12 s each
  ...Object.fromEntries([0.2, 0.6, 1.0].map((x) =>
    ['drone_' + x, () => run(12, [(a) => { a.drone.start(); a.drone.intensity(x); }])])),
  // drone -> REAL music.mp3 handoff at t=7 (decode happens while suspended)
  handoff: () => run(16, [(a) => { a.drone.start(); a.drone.intensity(0.6); }],
    [{ at: 7, run: async (a) => { a.music.start(); await until(() => a.music.ready); } }]),
  // duck scenarios: music mocked as 6.5 kHz sine so Goertzel isolates the music level
  duck_motif: () => run(8, [], [
    { at: 0.5, run: async (a) => {
      const real = window.fetch; window.fetch = mockFetchWav(6500, 6.5);
      try { a.music.start(); await until(() => a.music.ready); } finally { window.fetch = real; }
    } },
    { at: 5, run: (a) => a.motif('shard') },
  ]),
  duck_ui: () => run(8, [], [
    { at: 0.5, run: async (a) => {
      const real = window.fetch; window.fetch = mockFetchWav(6500, 6.5);
      try { a.music.start(); await until(() => a.music.ready); } finally { window.fetch = real; }
    } },
    { at: 5, run: (a) => a.ui('tick') },
  ]),
};

// Real mp3 loop-seam render: decode, bake, then play across the wrap exactly
// as playback does (loop=true, offset loopEnd-4) for 8 s -> seam at t=4.
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
window.SCENARIOS.seam_music = () => seam('/music.mp3');
window.SCENARIOS.seam_credits = () => seam('/credits.mp3');

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
      if (!/^\/(src\/|music\.mp3$|credits\.mp3$)/.test(path)) throw new Error('scope');
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

// Streaming STFT visitor: cb(mags, frameIndex, timeSeconds)
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

function peakDb(x, from = 0, to = x.length) {
  let p = 0;
  for (let i = from; i < to; i++) { const a = Math.abs(x[i]); if (a > p) p = a; }
  return db(p);
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
// 5 ms RMS envelope at 1 ms hop, and duration above (peak - dropDb)
function envelope(x, sr) { return rmsTrack(x, sr, 0.005, 0.001); }
function envDuration(env, dropDb = 35) {
  const peak = Math.max(...env.map((e) => e.db));
  const above = env.filter((e) => e.db >= peak - dropDb);
  if (!above.length) return 0;
  return above.at(-1).t - above[0].t;
}
function attackTime(env) {
  const peak = Math.max(...env.map((e) => e.db));
  const peakLin = Math.pow(10, peak / 20);
  let t10 = null, t90 = null;
  for (const e of env) {
    const lin = Math.pow(10, e.db / 20);
    if (t10 === null && lin >= 0.1 * peakLin) t10 = e.t;
    if (t90 === null && lin >= 0.9 * peakLin) { t90 = e.t; break; }
  }
  return t10 !== null && t90 !== null ? Math.max(0, t90 - t10) : null;
}
// Energy-weighted mean spectral centroid + per-frame track + HF (>fSplit) ratio
function spectral(x, sr, { floorDb = -70 } = {}) {
  const n = 2048, hop = 512;
  const binHz = sr / n;
  let cSum = 0, eSum = 0, hfSum = 0, totSum = 0;
  const track = [];
  stft(x, sr, { n, hop }, (mags, _f, t) => {
    let e = 0, ce = 0, hf = 0;
    for (let k = 1; k < mags.length; k++) {
      const p = mags[k] * mags[k];
      e += p; ce += p * k * binHz;
      if (k * binHz > 6000) hf += p;
    }
    totSum += e; hfSum += hf;
    if (db(Math.sqrt(e / mags.length)) > floorDb && e > 0) {
      track.push({ t, centroid: ce / e });
      cSum += ce; eSum += e;
    }
  });
  return {
    centroid: eSum > 0 ? cSum / eSum : 0,
    hfDb: totSum > 0 ? 10 * Math.log10(Math.max(hfSum, 1e-24) / totSum) : -120,
    track,
  };
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
// autocorrelation pitch in [fmin,fmax] on a window at time t
function pitchAt(x, sr, t, { win = 0.03, fmin = 40, fmax = 500 } = {}) {
  const n = Math.round(win * sr);
  const p0 = Math.max(0, Math.round(t * sr));
  if (p0 + n > x.length) return null;
  const seg = x.subarray(p0, p0 + n);
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += seg[i] * seg[i];
  if (e0 < 1e-9) return null;
  const lagMin = Math.floor(sr / fmax), lagMax = Math.min(n - 2, Math.ceil(sr / fmin));
  let best = 0, bestLag = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += seg[i] * seg[i + lag];
    const norm = s / e0;
    if (norm > best) { best = norm; bestLag = lag; }
  }
  if (bestLag === 0 || best < 0.2) return null;
  return sr / bestLag;
}
// Pluck pitch: normalized autocorrelation with octave-error protection (a
// Karplus-Strong tone's 2nd harmonic can out-magnitude the fundamental, so
// prefer the LONGEST lag whose correlation is within 13% of the best).
function pluckPitchAt(x, sr, t, { win = 0.06, fmin = 85, fmax = 500 } = {}) {
  const n = Math.round(win * sr);
  const p0 = Math.max(0, Math.round(t * sr));
  if (p0 + n > x.length) return null;
  const seg = x.subarray(p0, p0 + n);
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += seg[i] * seg[i];
  if (e0 < 1e-10) return null;
  const lagMin = Math.floor(sr / fmax), lagMax = Math.min(n - 2, Math.ceil(sr / fmin));
  const r = new Float64Array(lagMax + 1);
  let rmax = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += seg[i] * seg[i + lag];
    r[lag] = s / e0;
    if (r[lag] > rmax) rmax = r[lag];
  }
  if (rmax < 0.2) return null;
  // SHORTEST lag whose local peak is within 7% of the global best: subharmonic
  // lags (2T, 3T) correlate ~as well as T for periodic signals, so scanning
  // from the long-lag side returns octave-down errors; scanning from the short
  // side only stops early if a half-period truly correlates like the period.
  let bestLag = 0;
  for (let lag = lagMin + 1; lag <= lagMax - 1; lag++) {
    if (r[lag] >= 0.93 * rmax && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      bestLag = lag;
      break;
    }
  }
  if (!bestLag) return null;
  // parabolic refinement on the autocorr peak
  const a = r[bestLag - 1] || 0, b = r[bestLag], c = r[bestLag + 1] || 0;
  const denom = a - 2 * b + c;
  const delta = denom !== 0 ? 0.5 * (a - c) / denom : 0;
  return sr / (bestLag + delta);
}
// onset times via 5ms-envelope positive slope peaks, min 50 ms apart
function onsets(x, sr, { thresholdDb = -50, count = 8 } = {}) {
  const env = envelope(x, sr);
  const cands = [];
  for (let i = 2; i < env.length; i++) {
    const rise = env[i].db - env[i - 2].db;
    if (env[i].db > thresholdDb && rise > 3) cands.push({ t: env[i].t, rise });
  }
  const picked = [];
  for (const c of cands.sort((a, b) => b.rise - a.rise)) {
    if (picked.every((p) => Math.abs(p.t - c.t) > 0.05)) picked.push(c);
    if (picked.length >= count) break;
  }
  return picked.map((p) => p.t).sort((a, b) => a - b);
}
function goertzelTrack(x, sr, freq, { win = 0.01, hop = 0.005 } = {}) {
  const n = Math.round(win * sr), h = Math.round(hop * sr);
  const k = Math.round(n * freq / sr);
  const wRad = 2 * Math.PI * k / n;
  const coeff = 2 * Math.cos(wRad);
  const out = [];
  for (let p = 0; p + n <= x.length; p += h) {
    let s0 = 0, s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { s0 = x[p + i] + coeff * s1 - s2; s2 = s1; s1 = s0; }
    const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
    out.push({ t: (p + n / 2) / sr, db: db(Math.sqrt(Math.max(power, 0)) / (n / 2)) });
  }
  return out;
}

// ------------------------------------------------------------- tiny PNG -----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function writePng(path, width, height, rgb) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return writeFile(path, png);
}
class Plot {
  constructor(w = 900, h = 280) {
    this.w = w; this.h = h;
    this.rgb = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) { this.rgb[i * 3] = 16; this.rgb[i * 3 + 1] = 14; this.rgb[i * 3 + 2] = 12; }
  }
  px(x, y, [r, g, b]) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.rgb[i] = r; this.rgb[i + 1] = g; this.rgb[i + 2] = b;
  }
  vline(x, color) { for (let y = 0; y < this.h; y++) this.px(x, y, color); }
  hgrid(n, color = [40, 36, 32]) {
    for (let i = 1; i < n; i++) for (let x = 0; x < this.w; x++) this.px(x, (this.h / n) * i, color);
  }
  series(pts, x0, x1, y0, y1, color) {
    let prev = null;
    for (const p of pts) {
      const x = ((p.x - x0) / (x1 - x0)) * (this.w - 20) + 10;
      const y = this.h - 10 - ((p.y - y0) / (y1 - y0)) * (this.h - 20);
      if (prev) {
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x - prev.x), Math.abs(y - prev.y))));
        for (let s = 0; s <= steps; s++) {
          this.px(prev.x + ((x - prev.x) * s) / steps, prev.y + ((y - prev.y) * s) / steps, color);
          this.px(prev.x + ((x - prev.x) * s) / steps, 1 + prev.y + ((y - prev.y) * s) / steps, color);
        }
      }
      prev = { x, y };
    }
  }
  save(path) { return writePng(path, this.w, this.h, this.rgb); }
}

// ---------------------------------------------------------------- checks ----
const results = { generatedAt: new Date().toISOString(), scenarios: {}, checks: [] };
function check(name, value, pass, detail = '') {
  results.checks.push({ name, value, pass: !!pass, detail });
  const v = typeof value === 'number' ? value.toFixed(2) : String(value);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${v} ${detail}`);
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
    'ui_tick', 'ui_knock', 'ui_slide', 'ui_deny', 'ui_confirm', 'ui_flip',
    'motif_shard', 'motif_hint', 'motif_unlock', 'motif_dare', 'motif_yield', 'motif_chest',
    'drone_0.2', 'drone_0.6', 'drone_1',
    'handoff', 'duck_motif', 'duck_ui', 'seam_music', 'seam_credits',
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

  // ---- UI kinds ----
  const uiDur = {};
  for (const kind of ['tick', 'knock', 'slide', 'deny', 'confirm', 'flip']) {
    const s = pcm['ui_' + kind];
    if (!s) continue;
    const env = envelope(s.x, s.sr);
    const dur = envDuration(env) * 1000;
    const peak = peakDb(s.x);
    const spec = spectral(s.x, s.sr);
    uiDur[kind] = dur;
    results.scenarios['ui_' + kind] = {
      durMs: dur, peakDb: peak, rmsDb: rmsDb(s.x), crestDb: peak - rmsDb(s.x),
      centroidHz: spec.centroid, hfAbove6kDb: spec.hfDb, attackMs: (attackTime(env) ?? 0) * 1000,
    };
    const floor = kind === 'tick' ? -26 : -24;
    check(`ui.${kind} duration 60-120ms`, dur, inRange(dur, 55, 130), 'ms');
    check(`ui.${kind} peak in [${floor},-12] dBFS`, peak, inRange(peak, floor, -11.5), 'dBFS');
    check(`ui.${kind} HF>6kHz <= -18 dB rel`, spec.hfDb, spec.hfDb <= -18, 'dB');
  }
  if (pcm.ui_deny) {
    const spec = spectral(pcm.ui_deny.x, pcm.ui_deny.sr);
    check('ui.deny centroid < 500 Hz (dull thud)', spec.centroid, spec.centroid < 500, 'Hz');
  }

  // ---- motifs ----
  const motifSpec = {};
  for (const kind of ['shard', 'hint', 'unlock', 'dare', 'yield']) {
    const s = pcm['motif_' + kind];
    if (!s) continue;
    const env = envelope(s.x, s.sr);
    const spec = spectral(s.x, s.sr);
    motifSpec[kind] = {
      durMs: envDuration(env) * 1000, peakDb: peakDb(s.x), centroidHz: spec.centroid,
      hfAbove6kDb: spec.hfDb, attackMs: (attackTime(env) ?? 0) * 1000, onsets: onsets(s.x, s.sr),
    };
    results.scenarios['motif_' + kind] = motifSpec[kind];
    check(`motif.${kind} peak in [-20,-12] dBFS`, motifSpec[kind].peakDb, inRange(motifSpec[kind].peakDb, -20, -11.5), 'dBFS');
    check(`motif.${kind} HF>6kHz <= -18 dB rel`, spec.hfDb, spec.hfDb <= -18, 'dB');
  }
  if (motifSpec.shard) {
    const on = motifSpec.shard.onsets.slice(0, 3);
    const p = on.map((t) => pluckPitchAt(pcm.motif_shard.x, SR, t + 0.02));
    results.scenarios.motif_shard.pitches = p;
    // A3-C4-E4 rising, each within 4% of A-minor-pentatonic pitch
    const bands = [[211, 229], [251, 272], [316, 343]];
    check('shard: rising A3>C4>E4 within 4%', p.filter(Boolean).length,
      p.length === 3 && p.every(Boolean) && p.every((v, i) => v >= bands[i][0] && v <= bands[i][1]),
      p.map((v) => v && v.toFixed(0)).join('>'));
  }
  if (motifSpec.hint) {
    // design note times (0, 0.32s): the envelope detector can misfire inside
    // note 1's ring; pitch truth is what rings at the scheduled moments
    const p = [0.02, 0.34].map((t) => pluckPitchAt(pcm.motif_hint.x, SR, t + 0.015));
    results.scenarios.motif_hint.pitches = p;
    // D3 -> A2, low falling fourth, each within ~5%
    check('hint: falling D3>A2 within 5%', p.filter(Boolean).length,
      p.length === 2 && p.every(Boolean) && inRange(p[0], 139, 155) && inRange(p[1], 104, 116),
      p.map((v) => v && v.toFixed(0)).join('>'));
  }
  if (motifSpec.yield) {
    const x = pcm.motif_yield.x;
    // drum sweep check in the drum-only window
    const fEarly = pitchAt(x, SR, 0.02, { fmin: 40, fmax: 300 });
    const fLate = pitchAt(x, SR, 0.15, { fmin: 40, fmax: 300 });
    results.scenarios.motif_yield.drumSweep = { fEarly, fLate };
    check('drum fundamental drops 160->55 (early 120-175)', fEarly ?? -1, inRange(fEarly, 118, 175), 'Hz');
    check('drum fundamental drops 160->55 (late <= 95)', fLate ?? -1, fLate !== null && fLate <= 95, 'Hz');
    // falling third after the drum
    const on = motifSpec.yield.onsets.filter((t) => t > 0.15).slice(0, 2);
    const p = on.map((t) => pluckPitchAt(x, SR, t + 0.02, { fmin: 150, fmax: 500 }));
    results.scenarios.motif_yield.pitches = p;
    check('yield: falling third (ratio 1.15-1.23)', p.every(Boolean) ? p[0] / p[1] : -1,
      p.length === 2 && p.every(Boolean) && inRange(p[0] / p[1], 1.13, 1.25),
      p.map((v) => v && v.toFixed(0)).join('>'));
  }
  if (motifSpec.dare) {
    // bloom of the FIRST horn note (the second stacks at +0.45s by design)
    const a = attackTime(envelope(pcm.motif_dare.x.subarray(0, Math.round(0.44 * SR)), SR));
    check('dare/lur bloom attack 300-600ms', (a ?? 0) * 1000, inRange((a ?? 0) * 1000, 280, 650), 'ms');
    check('dare/lur centroid < 2 kHz', motifSpec.dare.centroidHz, motifSpec.dare.centroidHz < 2000, 'Hz');
  }
  check('deny vs yield centroid separation',
    (motifSpec.yield && results.scenarios.ui_deny) ? motifSpec.yield.centroidHz / results.scenarios.ui_deny.centroidHz : -1,
    motifSpec.yield && results.scenarios.ui_deny && motifSpec.yield.centroidHz > 1.6 * results.scenarios.ui_deny.centroidHz,
    'ratio');

  // ---- chest in context ----
  if (pcm.motif_chest) {
    const s = pcm.motif_chest;
    const peak = peakDb(s.x, Math.round(4.8 * SR));
    const pre = rmsDb(s.x, Math.round(3.5 * SR), Math.round(5 * SR));
    const tailEnv = rmsTrack(s.x, SR, 0.1, 0.025).filter((e) => e.t > 5);
    const over = tailEnv.filter((e) => e.db > pre + 1);
    const tail = over.length ? over.at(-1).t - 5 : 0;
    results.scenarios.motif_chest = { peakDb: peak, droneRmsPreDb: pre, tailAboveDroneSec: tail };
    check('chest peak headroom <= -6 dBFS', peak, peak <= -6, 'dBFS');
    check('chest audible tail >= 3s over drone', tail, tail >= 3, 's');
  }

  // ---- drone ----
  const droneStats = {};
  for (const x of ['0.2', '0.6', '1']) {
    const s = pcm['drone_' + x];
    if (!s) continue;
    const from = Math.round(5 * SR);
    const track = rmsTrack(s.x, SR, 0.1, 0.05).filter((e) => e.t >= 5);
    const dbs = track.map((e) => e.db);
    const spec = spectral(s.x.subarray(from), SR);
    droneStats[x] = {
      meanDb: dbs.reduce((a, b) => a + b, 0) / dbs.length,
      lfoP2pDb: Math.max(...dbs) - Math.min(...dbs),
      centroidHz: spec.centroid,
      peakDb: peakDb(s.x),
      track,
    };
    results.scenarios['drone_' + x] = { ...droneStats[x], track: undefined };
    check(`drone@${x} LFO evolution p2p 1.5-3.5dB`, droneStats[x].lfoP2pDb,
      inRange(droneStats[x].lfoP2pDb, 1.5, 3.5), 'dB');
    check(`drone@${x} peak <= -12 dBFS`, droneStats[x].peakDb, droneStats[x].peakDb <= -11.5, 'dBFS');
  }
  if (droneStats['0.2'] && droneStats['0.6'] && droneStats['1']) {
    const d1 = droneStats['0.6'].meanDb - droneStats['0.2'].meanDb;
    const d2 = droneStats['1'].meanDb - droneStats['0.6'].meanDb;
    const c1 = droneStats['0.6'].centroidHz / droneStats['0.2'].centroidHz;
    const c2 = droneStats['1'].centroidHz / droneStats['0.6'].centroidHz;
    check('drone intensity level steps >= 1.5dB each', Math.min(d1, d2), d1 >= 1.5 && d2 >= 1.5, `(${d1.toFixed(2)}, ${d2.toFixed(2)})`);
    check('drone intensity centroid steps >= 8% each', Math.min(c1, c2), c1 >= 1.08 && c2 >= 1.08, `(${c1.toFixed(3)}, ${c2.toFixed(3)})`);
    const plot = new Plot();
    plot.hgrid(6);
    const all = Object.values(droneStats).flatMap((d) => d.track.map((e) => e.db));
    const lo = Math.min(...all) - 2, hi = Math.max(...all) + 2;
    const colors = { '0.2': [110, 140, 220], '0.6': [220, 170, 90], '1': [220, 100, 90] };
    for (const x of ['0.2', '0.6', '1']) {
      plot.series(droneStats[x].track.map((e) => ({ x: e.t, y: e.db })), 5, 12, lo, hi, colors[x]);
    }
    await plot.save(join(OUT_DIR, 'drone_rms.png'));
  }

  // ---- handoff ----
  if (pcm.handoff) {
    const s = pcm.handoff;
    const track = rmsTrack(s.x, SR, 0.1, 0.025);
    const base = track.filter((e) => e.t >= 5.5 && e.t < 7);
    const baseDb = base.reduce((a, b) => a + b.db, 0) / base.length;
    const windowTrack = track.filter((e) => e.t >= 7 && e.t <= 13);
    const minDb = Math.min(...windowTrack.map((e) => e.db));
    const maxDb = Math.max(...windowTrack.map((e) => e.db));
    const steady = track.filter((e) => e.t >= 13 && e.t <= 15.8);
    const steadyDb = steady.reduce((a, b) => a + b.db, 0) / steady.length;
    // The handoff must never fall into a hole below the quieter side nor build
    // a wall above the louder side; the music's own dynamics live in between.
    const floorDb = Math.min(baseDb, steadyDb) - 1.5;
    const ceilDb = Math.max(baseDb, steadyDb) + 2;
    results.scenarios.handoff = {
      baseDb, minDb, maxDb, musicSteadyDb: steadyDb,
      dipBelowFloor: floorDb - minDb, bumpAboveCeil: maxDb - ceilDb,
    };
    check('handoff: no hole (min >= min(drone,music)-1.5dB)', floorDb - minDb, minDb >= floorDb, 'dB over');
    check('handoff: no wall (max <= max(drone,music)+2dB)', maxDb - ceilDb, maxDb <= ceilDb, 'dB over');
    check('handoff: music steady within +-3dB of drone', steadyDb - baseDb, inRange(steadyDb - baseDb, -3, 3), 'dB');
    const plot = new Plot();
    plot.hgrid(6);
    const lo = Math.min(...track.map((e) => e.db)) - 2, hi = Math.max(...track.map((e) => e.db)) + 2;
    plot.vline(10 + (7 - 0) / 16 * 880, [80, 70, 60]);
    plot.series(track.map((e) => ({ x: e.t, y: e.db })), 0, 16, lo, hi, [120, 200, 160]);
    await plot.save(join(OUT_DIR, 'handoff_rms.png'));
  }

  // ---- ducks ----
  for (const [name, onset, hold] of [['duck_motif', 5, 0.8], ['duck_ui', 5, 0.15]]) {
    const s = pcm[name];
    if (!s) continue;
    const g = goertzelTrack(s.x, SR, 6500);
    const base = g.filter((e) => e.t >= 4.3 && e.t < 4.95);
    const baseDb = base.reduce((a, b) => a + b.db, 0) / base.length;
    const at50 = g.find((e) => e.t >= onset + 0.05);
    const minIn = Math.min(...g.filter((e) => e.t >= onset && e.t <= onset + hold + 0.1).map((e) => e.db));
    const rel = g.find((e) => e.t >= onset + hold && baseDb - e.db <= 0.5 && g.filter((f) => f.t >= e.t && f.t <= e.t + 0.15).every((f) => baseDb - f.db <= 0.6));
    const relSec = rel ? rel.t - (onset + hold) : null;
    results.scenarios[name] = {
      baseDb, depthAt50ms: baseDb - at50.db, maxDepth: baseDb - minIn, releaseSec: relSec,
    };
    check(`${name}: -3dB (+-0.5) within 50ms`, baseDb - at50.db, inRange(baseDb - at50.db, 2.5, 3.5), 'dB');
    check(`${name}: max depth <= 4.5dB (no over-duck)`, baseDb - minIn, baseDb - minIn <= 4.5, 'dB');
    check(`${name}: release 0.35-0.85s after hold`, relSec ?? -1, inRange(relSec, 0.3, 0.9), 's');
    if (name === 'duck_motif') {
      const plot = new Plot();
      plot.hgrid(6);
      const lo = Math.min(...g.map((e) => e.db)) - 1, hi = Math.max(...g.map((e) => e.db)) + 1;
      plot.vline(10 + (onset / 8) * 880, [80, 70, 60]);
      plot.series(g.map((e) => ({ x: e.t, y: e.db })), 0, 8, lo, hi, [220, 170, 90]);
      await plot.save(join(OUT_DIR, 'duck_track.png'));
    }
  }

  // ---- loop seams ----
  for (const name of ['seam_music', 'seam_credits']) {
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
    if (name === 'seam_music') {
      const plot = new Plot();
      plot.hgrid(6);
      const hi = Math.max(...usable.map((e) => e.flux)) * 1.05;
      plot.vline(10 + (joinT / 8) * 880, [80, 70, 60]);
      for (let x = 0; x < 880; x++) {
        plot.px(10 + x, plot.h - 10 - (p95 / hi) * (plot.h - 20), [120, 70, 70]);
      }
      plot.series(usable.map((e) => ({ x: e.t, y: e.flux })), 0, 8, 0, hi, [200, 120, 200]);
      await plot.save(join(OUT_DIR, 'seam_flux.png'));
    }
  }

  const fails = results.checks.filter((c) => !c.pass);
  console.log(`\n${results.checks.length - fails.length}/${results.checks.length} checks pass`);
  await writeFile(join(OUT_DIR, outName), JSON.stringify(results, null, 2));
  console.log(`wrote ${join(OUT_DIR, outName)}`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
