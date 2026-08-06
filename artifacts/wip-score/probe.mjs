// OW-SCORE probe: offline (afconvert) look at the four committed tracks —
// durations, loop prep output, body RMS, and prep wall time in Node.
// Ground truth for runtime numbers is render.mjs (real browser decode).
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const music = await import(join(ROOT, 'src/audio/music.js'));

function decode(mp3) {
  const wav = join(tmpdir(), `ow-score-probe-${process.pid}-${Math.random().toString(36).slice(2)}.wav`);
  try {
    execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16', mp3, wav]);
    const raw = readFileSync(wav);
    const ab = new ArrayBuffer(raw.length);
    new Uint8Array(ab).set(raw);
    const view = new DataView(ab);
    let off = 12, fmt = null, dataOff = 0, dataLen = 0;
    while (off + 8 <= raw.length) {
      const id = String.fromCharCode(raw[off], raw[off + 1], raw[off + 2], raw[off + 3]);
      const size = view.getUint32(off + 4, true);
      if (id === 'fmt ') fmt = { channels: view.getUint16(off + 10, true), sampleRate: view.getUint32(off + 12, true) };
      if (id === 'data') { dataOff = off + 8; dataLen = size; }
      off += 8 + size + (size % 2);
    }
    const int16 = new Int16Array(ab, dataOff, Math.floor(dataLen / 2));
    const frames = Math.floor(int16.length / fmt.channels);
    const chans = [];
    for (let c = 0; c < fmt.channels; c++) {
      const f = new Float32Array(frames);
      for (let i = 0; i < frames; i++) f[i] = int16[i * fmt.channels + c] / 32768;
      chans.push(f);
    }
    return {
      sampleRate: fmt.sampleRate, numberOfChannels: fmt.channels, length: frames,
      duration: frames / fmt.sampleRate, getChannelData: (c) => chans[c],
    };
  } finally { rmSync(wav, { force: true }); }
}

const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
for (const name of ['music.mp3', 'act2.mp3', 'act3.mp3', 'credits.mp3']) {
  const buf = decode(join(ROOT, name));
  // copy so repeated prepare timings aren't polluted by the previous bake
  const copy = () => {
    const chans = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(Float32Array.from(buf.getChannelData(c)));
    return { ...buf, getChannelData: (i) => chans[i] };
  };
  const times = [];
  let prep = null;
  for (let r = 0; r < 3; r++) {
    const b = copy();
    const t0 = performance.now();
    prep = music.prepareSeamlessLoop(b);
    times.push(performance.now() - t0);
  }
  const { startSample, endSample } = music.findLoopBounds(copy());
  const region = music.findLoopRegion(buf, startSample, endSample);
  console.log(JSON.stringify({
    name,
    duration: +buf.duration.toFixed(2),
    sr: buf.sampleRate, ch: buf.numberOfChannels,
    trim: { startS: +(startSample / buf.sampleRate).toFixed(2), endS: +(endSample / buf.sampleRate).toFixed(2) },
    region: { startS: +(region.regionStart / buf.sampleRate).toFixed(2), endS: +(region.regionEnd / buf.sampleRate).toFixed(2) },
    bodyRmsDb: region.bodyRms !== undefined ? +db(region.bodyRms).toFixed(2) : '(not yet exported)',
    prep: { loopStart: +prep.loopStart.toFixed(2), loopEnd: +prep.loopEnd.toFixed(2), playStart: +prep.playStart.toFixed(2) },
    prepMsRuns: times.map((t) => +t.toFixed(1)),
  }));
}
