// Streamed score (the "roca-airways" pattern, docs/AUDIO.md + CONTRACT §1 v2):
// a three-act progression — Act I ./music.mp3, Act II ./act2.mp3, Act III
// ./act3.mp3 — plus ./credits.mp3. Same-origin relative fetches only, lazy
// after enable()+start()/act(), silent fallback to the synth drone on any
// failure. Acts crossfade equal-power (~2.5 s) at the shell's yield beats.

import { droneGainFor } from './voices.js';

const AMP_THRESHOLD_DB = -60;
export const AMP_THRESHOLD = Math.pow(10, AMP_THRESHOLD_DB / 20);
const CROSSFADE_SECONDS = 0.5; // baked tail-into-head crossfade at the loop seam
const HANDOFF_SECONDS = 2.0; // drone -> gameplay music crossfade
const CREDITS_FADE_SECONDS = 1.5; // gameplay -> credits fade
const STOP_FADE_SECONDS = 1.2; // music -> silence, drone returns
export const ACT_CROSSFADE_SECONDS = 2.5; // act -> act equal-power crossfade
const ACT_CURVE_POINTS = 65; // ~39 ms/segment: linear error vs sine < 1e-4
const DUCK_DB = 3;
export const DUCK_GAIN_FACTOR = Math.pow(10, -DUCK_DB / 20);
// Music bus trim: the mp3s are mastered hot; this seats Act I's steady RMS
// beside the drone (measured in artifacts/wip-fable-b/metrics.json) so the
// handoff is a passing of the torch, not a wall.
export const MUSIC_LEVEL = 0.24;
// Act I's loop-body median RMS through this file's own region scan (measured
// in artifacts/wip-score/metrics.json). Acts II/III seat their own body RMS
// to this reference so an equal-power act crossfade holds combined loudness
// flat even if the files were mastered at different levels.
const REF_BODY_RMS_DB = -13.62;
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

// Scan the trimmed span with RMS windows and return the steady-level body
// plus its median RMS (linear). Rationale (measured, artifacts/wip-fable-b/
// metrics-before.json): the tracks open/close with long musical fades, so
// looping the silence-trimmed bounds lurched 14-25 dB at every wrap. The loop
// must live where the music lives.
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
  const medianOf = (vals) => {
    if (!vals.length) return 0;
    const s = [...vals].sort((a, b) => a - b);
    return s[s.length >> 1];
  };
  if (rms.length < 8) {
    return { regionStart: startSample, regionEnd: endSample, bodyRms: medianOf(rms) };
  }
  const floor = medianOf(rms) * Math.pow(10, REGION_FLOOR_DB / 20);
  let i0 = 0;
  while (i0 < rms.length - 1 && !(rms[i0] >= floor && rms[i0 + 1] >= floor)) i0++;
  let i1 = rms.length - 1;
  while (i1 > 0 && !(rms[i1] >= floor && rms[i1 - 1] >= floor)) i1--;
  const regionStart = startSample + i0 * win;
  const regionEnd = Math.min(endSample, startSample + (i1 + 1) * win);
  if (regionEnd - regionStart < (endSample - startSample) / 2) {
    // degenerate scan: keep full span
    return { regionStart: startSample, regionEnd: endSample, bodyRms: medianOf(rms) };
  }
  return { regionStart, regionEnd, bodyRms: medianOf(rms.slice(i0, i1 + 1)) };
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

// Per-track prepare(): the whole v1 discipline in one deterministic pass —
// trim edges at -60 dBFS, find the steady body, bake the seam, enter at the
// body start (starting inside the fade-in intro hollowed the drone->music
// handoff out by 15.7 dB, measured). Also reports the body's median RMS so
// acts can be level-seated against REF_BODY_RMS_DB.
export function prepareSeamlessLoop(buffer) {
  const { startSample, endSample } = findLoopBounds(buffer);
  const { regionStart, regionEnd, bodyRms } = findLoopRegion(buffer, startSample, endSample);
  const { loopStart, loopEnd } = bakeSeamlessLoop(buffer, regionStart, regionEnd);
  return {
    loopStart,
    loopEnd,
    playStart: regionStart / buffer.sampleRate,
    bodyRmsDb: 20 * Math.log10(Math.max(bodyRms, 1e-12)),
  };
}

// Gain that seats a track's loop body at the same output loudness as Act I.
// Clamped to +-6 dB so a degenerate scan can never blast or bury an act;
// a body below the -60 dBFS trim threshold is silence — stay neutral.
export function levelFor(bodyRmsDb) {
  if (!Number.isFinite(bodyRmsDb) || bodyRmsDb <= AMP_THRESHOLD_DB) return MUSIC_LEVEL;
  const trim = Math.pow(10, (REF_BODY_RMS_DB - bodyRmsDb) / 20);
  return MUSIC_LEVEL * Math.min(2, Math.max(0.5, trim));
}

// ---- controller: wires playback into a live (or mocked) AudioContext ----
// `drone` is the shared mutable state object from index.js:
//   { playing: boolean, nodes: { out: GainNode, ... } | null, intensity: number }
export function createMusic(ctx, bus, drone) {
  const newTrack = (url) => ({
    url, ready: false, fetching: false, buffer: null,
    loopStart: 0, loopEnd: 0, playStart: 0, level: MUSIC_LEVEL,
  });
  const tracks = {
    1: newTrack('./music.mp3'),
    2: newTrack('./act2.mp3'),
    3: newTrack('./act3.mp3'),
    credits: newTrack('./credits.mp3'),
  };
  let mode = 'stopped'; // 'stopped' | 'gameplay' | 'credits'
  let currentAct = 1; // which act start() resumes and `ready` reflects
  let pendingAct = 0; // act awaiting fetch+prepare for a switch; 0 = none
  let playing = null; // { src, g, level }

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

  function playTrack(tr, fadeInSeconds) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = tr.buffer;
    src.loop = true;
    src.loopStart = tr.loopStart;
    src.loopEnd = tr.loopEnd;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    src.connect(g);
    g.connect(bus);
    src.start(t, tr.playStart); // enter at full-level material, no lead-in gap
    g.gain.setTargetAtTime(tr.level, t, Math.max(0.05, fadeInSeconds / 4));
    return { src, g, level: tr.level };
  }

  function fadeOutAndStop(p, seconds) {
    if (!p) return;
    const t = ctx.currentTime;
    p.g.gain.cancelScheduledValues(t);
    p.g.gain.setTargetAtTime(0, t, seconds / 3);
    const stopAt = t + seconds + 0.2;
    const dispose = () => {
      try { p.src.disconnect(); } catch {}
      try { p.g.disconnect(); } catch {}
    };
    p.src.onended = dispose;
    try { p.src.stop(stopAt); } catch {}
  }

  // Equal-power act curve: sin rise (or cos fall) sampled for
  // setValueCurveAtTime, scaled to the track's seated level.
  function actCurve(level, rising) {
    const c = new Float32Array(ACT_CURVE_POINTS);
    for (let i = 0; i < ACT_CURVE_POINTS; i++) {
      const p = (i / (ACT_CURVE_POINTS - 1)) * 0.5 * Math.PI;
      c[i] = level * (rising ? Math.sin(p) : Math.cos(p));
    }
    return c;
  }

  // The act switch itself. Runs only once the target buffer is decoded and
  // seam-baked; until then the current act keeps playing untouched. All
  // scheduling is against ctx.currentTime, which a suspended (iOS) context
  // freezes — the curves simply run from the resume, nothing is lost.
  function beginAct(n) {
    currentAct = n;
    if (mode !== 'gameplay') return; // stopped/credits: selection sticks for the next start()
    const tr = tracks[n];
    const t = ctx.currentTime;
    if (!playing) {
      // gameplay mode but nothing sounding yet (start()'s own fetch still in
      // flight, or previously failed): enter exactly like a fresh start()
      playing = playTrack(tr, HANDOFF_SECONDS);
      crossfadeDroneOut(t);
      return;
    }
    const old = playing;
    // incoming act: body-looping source rising on the equal-power sine
    const src = ctx.createBufferSource();
    src.buffer = tr.buffer;
    src.loop = true;
    src.loopStart = tr.loopStart;
    src.loopEnd = tr.loopEnd;
    const g = ctx.createGain();
    g.gain.value = 0; // direct assignment: setValueCurveAtTime owns the event timeline
    g.gain.setValueCurveAtTime(actCurve(tr.level, true), t, ACT_CROSSFADE_SECONDS);
    src.connect(g);
    g.connect(bus);
    src.start(t, tr.playStart);
    playing = { src, g, level: tr.level };
    // outgoing act: equal-power cosine to zero from its seated level, then
    // release the nodes. (Anchoring at old.level assumes the fade-in long
    // converged — acts switch minutes apart at the yield beats.)
    old.g.gain.cancelScheduledValues(t);
    old.g.gain.setValueCurveAtTime(actCurve(old.level, false), t, ACT_CROSSFADE_SECONDS);
    const dispose = () => {
      try { old.src.disconnect(); } catch {}
      try { old.g.disconnect(); } catch {}
    };
    old.src.onended = dispose;
    try { old.src.stop(t + ACT_CROSSFADE_SECONDS + 0.1); } catch {}
  }

  // A landed decode consults the CURRENT state — never a captured one — so
  // stop()/credits()/act() issued mid-flight all resolve correctly.
  function onTrackReady(key) {
    if (key === 'credits') {
      if (mode === 'credits' && !playing) playing = playTrack(tracks.credits, CREDITS_FADE_SECONDS);
      return;
    }
    if (key === pendingAct) {
      pendingAct = 0;
      beginAct(key);
      return;
    }
    if (key === currentAct && mode === 'gameplay' && !playing) {
      // start()'s lazy fetch landing (plays only if still wanted — a stop()
      // issued mid-fetch stays stopped)
      playing = playTrack(tracks[key], HANDOFF_SECONDS);
      crossfadeDroneOut(ctx.currentTime);
    }
  }

  function fetchTrack(key) {
    const tr = tracks[key];
    if (tr.ready || tr.fetching) return;
    tr.fetching = true;
    fetchDecode(tr.url).then((buf) => {
      tr.fetching = false;
      const { loopStart, loopEnd, playStart, bodyRmsDb } = prepareSeamlessLoop(buf);
      tr.buffer = buf;
      tr.loopStart = loopStart;
      tr.loopEnd = loopEnd;
      tr.playStart = playStart;
      // Act I and credits keep the v1 trim exactly; acts II/III seat their
      // body to Act I's reference so crossfades hold loudness flat.
      tr.level = (key === 2 || key === 3) ? levelFor(bodyRmsDb) : MUSIC_LEVEL;
      tr.ready = true;
      onTrackReady(key);
    }).catch(() => {
      // never throw, never retry-spam; stay on the current act silently and
      // let the next start()/credits()/act() call retry
      tr.fetching = false;
      if (key === pendingAct) pendingAct = 0;
    });
  }

  function start() {
    if (!ctx) return;
    if (mode === 'gameplay' && (playing || tracks[currentAct].fetching || pendingAct)) return; // idempotent
    if (playing) { fadeOutAndStop(playing, CREDITS_FADE_SECONDS); playing = null; } // leaving credits
    mode = 'gameplay';
    const tr = tracks[currentAct];
    if (tr.ready) {
      // already decoded (e.g. resuming after stop()/credits()) -> play now
      playing = playTrack(tr, HANDOFF_SECONDS);
      crossfadeDroneOut(ctx.currentTime);
      return;
    }
    if (!pendingAct) fetchTrack(currentAct); // a pending act() will land as gameplay by itself
  }

  // v2 (additive, docs/AUDIO.md): select the progression track. Idempotent;
  // lazy-fetches the target; the current act keeps playing until the new
  // buffer is decoded and seam-baked, then a ~2.5 s equal-power crossfade.
  function act(n) {
    if (!ctx) return;
    if (n !== 1 && n !== 2 && n !== 3) return; // outside the progression: no-op, never throw
    if (n === currentAct) { pendingAct = 0; return; } // also cancels a stale pending switch
    if (n === pendingAct) return; // this switch is already in flight
    const tr = tracks[n];
    if (tr.ready) {
      pendingAct = 0;
      beginAct(n);
      return;
    }
    pendingAct = n;
    fetchTrack(n);
  }

  function credits() {
    if (!ctx) return;
    if (mode === 'credits' && (playing || tracks.credits.fetching)) return; // idempotent
    if (playing) fadeOutAndStop(playing, CREDITS_FADE_SECONDS); // fades whatever act is live
    playing = null;
    mode = 'credits';
    const tr = tracks.credits;
    if (tr.ready) {
      playing = playTrack(tr, CREDITS_FADE_SECONDS);
      return;
    }
    fetchTrack('credits');
  }

  function stop() {
    if (!ctx) return;
    fadeOutAndStop(playing, STOP_FADE_SECONDS);
    playing = null;
    mode = 'stopped';
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
    act,
    duck,
    get ready() { return tracks[currentAct].ready; },
  };
}
