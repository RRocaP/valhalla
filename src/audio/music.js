// Streamed score: gameplay music.mp3 + credits credits.mp3 (the "roca-airways"
// pattern, docs/AUDIO.md). Same-origin relative fetches only, lazy after
// enable()+start(), silent fallback to the synth drone on any failure.

import { droneGainFor } from './voices.js';

const AMP_THRESHOLD_DB = -60;
export const AMP_THRESHOLD = Math.pow(10, AMP_THRESHOLD_DB / 20);
const CROSSFADE_SECONDS = 0.5; // baked tail-into-head crossfade at the loop seam
const HANDOFF_SECONDS = 2.0; // drone -> gameplay music crossfade
const CREDITS_FADE_SECONDS = 1.5; // gameplay -> credits fade
const STOP_FADE_SECONDS = 1.2; // music -> silence, drone returns
const DUCK_DB = 3;
export const DUCK_GAIN_FACTOR = Math.pow(10, -DUCK_DB / 20);
// Music bus trim: the mp3s are mastered hot; this seats the loop's steady RMS
// beside the drone (measured in artifacts/wip-fable-b/metrics.json) so the
// handoff is a passing of the torch, not a wall.
const MUSIC_LEVEL = 0.24;
const REGION_WINDOW_SECONDS = 0.25; // RMS window for steady-level region scan
const REGION_FLOOR_DB = -6; // windows within 6 dB of the median count as steady

// ---- pure helpers (unit-testable without any audio graph) ----

// Scan every channel for the first/last sample at or above the amplitude
// threshold; returns sample indices (not seconds).
export function findLoopBounds(buffer, ampThreshold = AMP_THRESHOLD) {
  const chans = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  const len = buffer.length;

  let start = 0;
  let foundStart = false;
  for (let i = 0; i < len && !foundStart; i++) {
    for (const ch of chans) {
      if (Math.abs(ch[i]) >= ampThreshold) { start = i; foundStart = true; break; }
    }
  }
  let end = Math.max(0, len - 1);
  let foundEnd = false;
  for (let i = len - 1; i >= 0 && !foundEnd; i--) {
    for (const ch of chans) {
      if (Math.abs(ch[i]) >= ampThreshold) { end = i; foundEnd = true; break; }
    }
  }
  if (!foundStart || !foundEnd || end <= start) {
    start = 0;
    end = Math.max(0, len - 1);
  }
  return { startSample: start, endSample: end };
}

// Scan the trimmed span with RMS windows and return the steady-level body.
// Rationale (measured, artifacts/wip-fable-b/metrics-before.json): both mp3s
// open/close with long musical fades, so looping the silence-trimmed bounds
// lurched 14-25 dB at every wrap. The loop must live where the music lives.
export function findLoopRegion(buffer, startSample, endSample) {
  const sr = buffer.sampleRate;
  const win = Math.max(1, Math.round(REGION_WINDOW_SECONDS * sr));
  const chans = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  const rms = [];
  for (let p = startSample; p + win <= endSample; p += win) {
    let sum = 0;
    for (const ch of chans) {
      for (let i = p; i < p + win; i++) sum += ch[i] * ch[i];
    }
    rms.push(Math.sqrt(sum / (win * chans.length)));
  }
  if (rms.length < 8) return { regionStart: startSample, regionEnd: endSample };
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[sorted.length >> 1] * Math.pow(10, REGION_FLOOR_DB / 20);
  let i0 = 0;
  while (i0 < rms.length - 1 && !(rms[i0] >= floor && rms[i0 + 1] >= floor)) i0++;
  let i1 = rms.length - 1;
  while (i1 > 0 && !(rms[i1] >= floor && rms[i1 - 1] >= floor)) i1--;
  const regionStart = startSample + i0 * win;
  const regionEnd = Math.min(endSample, startSample + (i1 + 1) * win);
  if (regionEnd - regionStart < (endSample - startSample) / 2) {
    return { regionStart: startSample, regionEnd: endSample }; // degenerate scan: keep full span
  }
  return { regionStart, regionEnd };
}

// Bakes an equal-power crossfade of the region tail into the region head, in
// place. The returned loopStart sits AFTER the baked head segment: the tail
// has already morphed into [startSample, startSample+cf), so the wrap lands
// exactly where that segment ends -- sample-continuous, no gap, click, or
// double-played head. (The previous loopStart=startSample replayed the head
// crossfade segment every pass and cut mid-morph; measured as the 24.5 dB
// join lurch in metrics-before.json.)
export function bakeSeamlessLoop(buffer, startSample, endSample, crossfadeSeconds = CROSSFADE_SECONDS) {
  const sr = buffer.sampleRate;
  const span = endSample - startSample;
  let cfSamples = Math.max(0, Math.min(Math.floor(crossfadeSeconds * sr), Math.floor(span / 4)));
  if (cfSamples < 8) cfSamples = 0;
  for (let c = 0; c < buffer.numberOfChannels && cfSamples > 0; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < cfSamples; i++) {
      const p = i / cfSamples;
      const gOut = Math.cos(p * 0.5 * Math.PI); // equal-power fade-out of the tail
      const gIn = Math.sin(p * 0.5 * Math.PI); // equal-power fade-in of the head
      const tailIdx = endSample - cfSamples + i;
      const headIdx = startSample + i;
      data[tailIdx] = data[tailIdx] * gOut + data[headIdx] * gIn;
    }
  }
  return { loopStart: (startSample + cfSamples) / sr, loopEnd: endSample / sr };
}

export function prepareSeamlessLoop(buffer) {
  const { startSample, endSample } = findLoopBounds(buffer);
  const { regionStart, regionEnd } = findLoopRegion(buffer, startSample, endSample);
  const { loopStart, loopEnd } = bakeSeamlessLoop(buffer, regionStart, regionEnd);
  // Playback enters at the steady-level region start: starting inside the
  // fade-in intro hollowed the drone->music handoff out by 15.7 dB (measured).
  return { loopStart, loopEnd, playStart: regionStart / buffer.sampleRate };
}

// ---- controller: wires playback into a live (or mocked) AudioContext ----
// `drone` is the shared mutable state object from index.js:
//   { playing: boolean, nodes: { out: GainNode, ... } | null, intensity: number }
export function createMusic(ctx, bus, drone) {
  const state = {
    ready: false,
    fetching: false,
    buffer: null,
    loopStart: 0,
    loopEnd: 0,
    playStart: 0,
    playing: null, // { src, g }
    mode: 'stopped', // 'stopped' | 'gameplay' | 'credits'
  };
  const creditsState = {
    ready: false,
    fetching: false,
    buffer: null,
    loopStart: 0,
    loopEnd: 0,
    playStart: 0,
  };

  async function fetchDecode(url) {
    const res = await fetch(url);
    if (!res || !res.ok) throw new Error('music fetch failed: ' + url);
    const arr = await res.arrayBuffer();
    return ctx.decodeAudioData(arr);
  }

  function crossfadeDroneOut(t) {
    if (drone.playing && drone.nodes) {
      drone.nodes.out.gain.cancelScheduledValues(t);
      // Staggered handoff: hold the drone while the music establishes, then
      // ease it under -- measured to keep combined RMS within -3/+2 dB of the
      // pre-handoff level through the whole crossfade window.
      drone.nodes.out.gain.setTargetAtTime(0, t + 0.7, 0.8);
    }
  }
  function restoreDrone(t) {
    if (drone.playing && drone.nodes) {
      const target = droneGainFor(drone.intensity);
      drone.nodes.out.gain.cancelScheduledValues(t);
      drone.nodes.out.gain.setTargetAtTime(target, t, STOP_FADE_SECONDS / 2);
    }
  }

  function playBuffer(buffer, loopStart, loopEnd, playStart, fadeInSeconds) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = loopEnd;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    src.connect(g);
    g.connect(bus);
    src.start(t, playStart); // enter at full-level material, no lead-in gap
    g.gain.setTargetAtTime(MUSIC_LEVEL, t, Math.max(0.05, fadeInSeconds / 4));
    return { src, g };
  }

  function fadeOutAndStop(playing, seconds) {
    if (!playing) return;
    const t = ctx.currentTime;
    playing.g.gain.cancelScheduledValues(t);
    playing.g.gain.setTargetAtTime(0, t, seconds / 3);
    const stopAt = t + seconds + 0.2;
    const dispose = () => {
      try { playing.src.disconnect(); } catch {}
      try { playing.g.disconnect(); } catch {}
    };
    playing.src.onended = dispose;
    try { playing.src.stop(stopAt); } catch {}
  }

  function start() {
    if (!ctx) return;
    if (state.mode === 'gameplay' && state.playing) return; // idempotent
    if (state.ready && state.buffer) {
      // already decoded (e.g. resuming after stop()/credits()) -> play now
      const t = ctx.currentTime;
      state.mode = 'gameplay';
      state.playing = playBuffer(state.buffer, state.loopStart, state.loopEnd, state.playStart, HANDOFF_SECONDS);
      crossfadeDroneOut(t);
      return;
    }
    if (state.fetching) return; // fetch already in flight, don't duplicate
    state.mode = 'gameplay';
    state.fetching = true;
    fetchDecode('./music.mp3').then((buf) => {
      state.fetching = false;
      const { loopStart, loopEnd, playStart } = prepareSeamlessLoop(buf);
      state.buffer = buf;
      state.loopStart = loopStart;
      state.loopEnd = loopEnd;
      state.playStart = playStart;
      state.ready = true;
      if (state.mode !== 'credits') {
        const t = ctx.currentTime;
        state.mode = 'gameplay';
        state.playing = playBuffer(buf, loopStart, loopEnd, playStart, HANDOFF_SECONDS);
        crossfadeDroneOut(t);
      }
    }).catch(() => {
      state.fetching = false; // never throw, never retry-spam; next start() tries again
    });
  }

  function credits() {
    if (!ctx) return;
    if (state.mode === 'gameplay' && state.playing) fadeOutAndStop(state.playing, CREDITS_FADE_SECONDS);
    state.playing = null;
    state.mode = 'credits';

    if (creditsState.ready && creditsState.buffer) {
      state.playing = playBuffer(creditsState.buffer, creditsState.loopStart, creditsState.loopEnd, creditsState.playStart, CREDITS_FADE_SECONDS);
      return;
    }
    if (creditsState.fetching) return;
    creditsState.fetching = true;
    fetchDecode('./credits.mp3').then((buf) => {
      creditsState.fetching = false;
      const { loopStart, loopEnd, playStart } = prepareSeamlessLoop(buf);
      creditsState.buffer = buf;
      creditsState.loopStart = loopStart;
      creditsState.loopEnd = loopEnd;
      creditsState.playStart = playStart;
      creditsState.ready = true;
      if (state.mode === 'credits') {
        state.playing = playBuffer(buf, loopStart, loopEnd, playStart, CREDITS_FADE_SECONDS);
      }
    }).catch(() => {
      creditsState.fetching = false; // silent fallback; next credits() call retries
    });
  }

  function stop() {
    if (!ctx) return;
    fadeOutAndStop(state.playing, STOP_FADE_SECONDS);
    state.playing = null;
    state.mode = 'stopped';
    restoreDrone(ctx.currentTime);
  }

  // internal only (not part of the frozen public API) — ui()/motif() call
  // this to duck the music bus ~3 dB for the length of their own sound.
  function duck(holdSeconds = 0.3) {
    if (!ctx) return;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    // Measured: tc 0.015 reaches -3 dB (+-0.5) inside 50 ms of the motif
    // onset; release tc 0.28 lands back within 0.5 dB ~0.46 s after the hold.
    bus.gain.setTargetAtTime(DUCK_GAIN_FACTOR, t, 0.015);
    bus.gain.setTargetAtTime(1, t + holdSeconds, 0.28);
  }

  return {
    start,
    credits,
    stop,
    duck,
    get ready() { return state.ready; },
  };
}
