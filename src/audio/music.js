// Streamed score (the "roca-airways" pattern, docs/AUDIO.md + CONTRACT §1 v2):
// a three-act progression plus ./credits.mp3. Act order (Ramon, 2026-08-07):
// the game must START chill and build — Act I ./act3.mp3 (Windswept Silence,
// the calm opener), Act II ./music.mp3 (Frostbound Lullaby), Act III
// ./act2.mp3 (Frost on the Nyckelharpa, the climax). Files stay as committed;
// only this mapping orders them. Same-origin relative fetches only, lazy
// after enable()+start()/act(), silent fallback to the synth drone on any
// failure. Acts crossfade equal-power (~2.5 s) at the shell's yield beats.

import { applyDroneIntensity, droneGainFor } from './voices.js';

const AMP_THRESHOLD_DB = -60;
export const AMP_THRESHOLD = Math.pow(10, AMP_THRESHOLD_DB / 20);
// Baked tail-into-head morph at the loop seam. v1 shipped 0.5 s; the act2/3
// bodies close up to ~2 dB off their opening level even after wrap-point
// matching, and a 2.5 s equal-power morph turns that step into a tide
// (measured: join flux and |dRMS| in artifacts/wip-score/metrics.json).
const CROSSFADE_SECONDS = 2.5;
const HANDOFF_SECONDS = 2.0; // drone -> gameplay music crossfade
// The very first time music enters (threshold begin, act 1): the hall
// exhales, ~4 s in, the drone held a little longer under it. Later act
// switches keep the 2.5 s crossfade; resumes keep the 2 s handoff.
const FIRST_HANDOFF_SECONDS = 4.0;
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
// The reference body loudness: ./music.mp3's loop-body median RMS through
// this file's own region scan (measured in artifacts/wip-score/metrics.json;
// that file is now Act II under the 2026-08-07 act order). Every act seats
// its own body RMS to this reference so an equal-power act crossfade holds
// combined loudness flat even if the files were mastered at different levels.
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

// Scan the trimmed span with RMS windows and return the steady-level body,
// its median RMS (linear), and a median-level entry point. Rationale
// (measured, artifacts/wip-fable-b/metrics-before.json + wip-score/
// metrics.json): the tracks open/close with long musical fades, so looping
// the silence-trimmed bounds lurched 14-25 dB at every wrap, and entering an
// act at the first "steady" window still landed on builds/swells up to
// ~2.5 dB off the body level — audible as a hole or a wall in the act
// crossfade. The loop must live where the music lives, and every entrance
// and wrap must land on body-level material.
const ENTRY_RUN_WINDOWS = 8; // 2 s at the 0.25 s scan window
const ENTRY_BAND_DB = 1.5; // entry run must average within this of the body
const ENTRY_HOLD_WINDOWS = 32; // ...preferring the run whose next 8 s hold closest
const HEAD_SLIDE_WINDOWS = 120; // search at most 30 s in for a cleaner morph exit
const END_MATCH_WINDOWS = 80; // search up to 20 s back for a level-matched wrap
const MATCH_PENALTY_DB = 0.05; // per window moved: keep the music whole
const MATCH_HYSTERESIS_DB = 0.75; // don't move loop points for marginal gains
const dbOf = (x) => 20 * Math.log10(Math.max(x, 1e-12));

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
    return { regionStart: startSample, regionEnd: endSample, bodyRms: medianOf(rms), handoffStart: startSample, entryStart: startSample };
  }
  const floor = medianOf(rms) * Math.pow(10, REGION_FLOOR_DB / 20);
  let i0 = 0;
  while (i0 < rms.length - 1 && !(rms[i0] >= floor && rms[i0 + 1] >= floor)) i0++;
  let i1 = rms.length - 1;
  while (i1 > 0 && !(rms[i1] >= floor && rms[i1 - 1] >= floor)) i1--;
  if ((i1 + 1 - i0) * win < (endSample - startSample) / 2) {
    // degenerate scan: keep full span
    return { regionStart: startSample, regionEnd: endSample, bodyRms: medianOf(rms), handoffStart: startSample, entryStart: startSample };
  }
  const cfWindows = Math.ceil((CROSSFADE_SECONDS * sr) / win);
  const meanDbAt = (a, b) => { // mean level of windows [a, b], inclusive
    let s = 0;
    for (let i = a; i <= b; i++) s += dbOf(rms[i]);
    return s / (b - a + 1);
  };
  // Morph-exit matching: the wrap exits the baked morph INTO the head at
  // offset +bake, so a level step across that boundary is heard as a lurch
  // at every pass (measured up to 2.4 dB). Score each candidate head by the
  // step across its own boundary (1 s either side), penalize sliding away
  // from the raw start, and only move on a real gain — tracks that already
  // wrap cleanly stay put and no music is skipped for marginal numbers.
  {
    const stepAt = (j) => Math.abs(
      meanDbAt(j + cfWindows, Math.min(j + cfWindows + 3, i1)) -
      meanDbAt(Math.max(j, j + cfWindows - 4), j + cfWindows - 1));
    const jMax = Math.min(i0 + HEAD_SLIDE_WINDOWS, i1 - cfWindows - 4);
    const rawStep = stepAt(i0);
    let best = i0;
    let bestCost = rawStep;
    for (let j = i0 + 1; j <= jMax; j++) {
      const cost = stepAt(j) + (j - i0) * MATCH_PENALTY_DB;
      if (cost < bestCost) { bestCost = cost; best = j; }
    }
    if (rawStep - bestCost >= MATCH_HYSTERESIS_DB) i0 = best; // real gain only
  }
  // Wrap-level matching: walk the loop end back (<= 20 s, same penalty and
  // hysteresis — the music should play as whole as possible) to a window run
  // whose closing second sits close to the opening second's level, so the
  // baked tail-into-head morph joins like with like (the raw i1 landed on
  // phrase boundaries and stepped up to 2.8 dB at the wrap, measured in
  // artifacts/wip-score/metrics.json).
  const headDb = meanDbAt(i0, Math.min(i0 + 3, i1));
  const rawCost = Math.abs(meanDbAt(Math.max(i0, i1 - 3), i1) - headDb);
  let end = i1;
  let bestCost = rawCost;
  for (let e = i1 - 1; e >= Math.max(i0 + ENTRY_RUN_WINDOWS, i1 - END_MATCH_WINDOWS); e--) {
    const cost = Math.abs(meanDbAt(Math.max(i0, e - 3), e) - headDb) + (i1 - e) * MATCH_PENALTY_DB;
    if (cost < bestCost) { bestCost = cost; end = e; }
  }
  if (rawCost - bestCost < MATCH_HYSTERESIS_DB) end = i1; // marginal gain: keep it whole
  const bodyRms = medianOf(rms.slice(i0, end + 1));
  // Two purpose-built entries (measured, artifacts/wip-score/metrics.json +
  // artifacts/wip-soundfeel/metrics.json):
  //
  // handoff entry — for the drone handoff and any cold start. The CALMEST
  // early run (Ramon, 2026-08-07: the opening seconds of gameplay must feel
  // like the hall exhaling, not a track starting): among 2 s runs in the
  // body's first minute averaging [-4.5, +0.5] dB of the body with no spike
  // past +1.5, take the quietest, earliness breaking near-ties (0.08 dB/s).
  // The drone was tuned (OW-FABLE-B) against Act I entering soft (~-2 dB)
  // and blooming from there; entering at full body level walls +3 dB over
  // the drone. May sit inside the baked head (v1 did the same with its
  // 0.5 s bake): the handoff fade-in masks the morph.
  //
  // act-crossfade entry — for act() switches over live music. The run whose
  // opening 2 s averages within ENTRY_BAND_DB of the body and stays inside
  // +-3 dB (no hidden lull, no opening transient), preferring the hold whose
  // following 8 s sits closest to the body level (hot holds cost extra) —
  // the incoming act must land AT the running loudness, not on a build or a
  // swell. Sits past the baked head so a switch never plays the wrap morph.
  // Both carry an earliness preference: first impressions play the piece's
  // opening material, not its middle.
  const bodyDb = dbOf(bodyRms);
  const HANDOFF_SCAN_WINDOWS = 240; // calm-entry search stays in the first ~60 s
  const HANDOFF_EARLINESS_DB = 0.02; // per window (~0.08 dB/s): early calm beats late calm
  let handoff = -1;
  let handoffScore = Infinity;
  for (let j = i0; j + ENTRY_RUN_WINDOWS - 1 <= end && j <= i0 + HANDOFF_SCAN_WINDOWS; j++) {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = j; i < j + ENTRY_RUN_WINDOWS; i++) {
      const d = dbOf(rms[i]);
      sum += d;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    const rel = sum / ENTRY_RUN_WINDOWS - bodyDb;
    if (rel < -4.5 || rel > 0.5 || min < bodyDb - 6 || max > bodyDb + 1.5) continue;
    const score = rel + (j - i0) * HANDOFF_EARLINESS_DB;
    if (score < handoffScore) { handoffScore = score; handoff = j; }
  }
  if (handoff < 0) {
    // fallback: the earliest run inside the old, tighter band
    for (let j = i0; j + ENTRY_RUN_WINDOWS - 1 <= end; j++) {
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let i = j; i < j + ENTRY_RUN_WINDOWS; i++) {
        const d = dbOf(rms[i]);
        sum += d;
        if (d < min) min = d;
        if (d > max) max = d;
      }
      const rel = sum / ENTRY_RUN_WINDOWS - bodyDb;
      if (rel >= -2.5 && rel <= 0.5 && min >= bodyDb - 4 && max <= bodyDb + 2) { handoff = j; break; }
    }
  }
  if (handoff < 0) handoff = i0;
  const bestEntryFrom = (from) => {
    let best = -1;
    let bestScore = Infinity;
    for (let j = from; j + ENTRY_RUN_WINDOWS - 1 <= end; j++) {
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let i = j; i < j + ENTRY_RUN_WINDOWS; i++) {
        const d = dbOf(rms[i]);
        sum += d;
        if (d < min) min = d;
        if (d > max) max = d;
      }
      if (Math.abs(sum / ENTRY_RUN_WINDOWS - bodyDb) > ENTRY_BAND_DB) continue;
      if (min < bodyDb - 3 || max > bodyDb + 3) continue;
      const holdEnd = Math.min(j + ENTRY_HOLD_WINDOWS - 1, end);
      const hold = meanDbAt(j, holdEnd) - bodyDb;
      const score = Math.abs(hold) + Math.max(0, hold) + (j - from) * (MATCH_PENALTY_DB / 2.5);
      if (score < bestScore - 1e-9) { bestScore = score; best = j; } // ties keep the earliest
    }
    return best;
  };
  let entry = bestEntryFrom(Math.min(i0 + cfWindows, end));
  if (entry < 0) entry = bestEntryFrom(i0);
  if (entry < 0) entry = i0;
  return {
    regionStart: startSample + i0 * win,
    regionEnd: Math.min(endSample, startSample + (end + 1) * win),
    bodyRms,
    handoffStart: startSample + handoff * win,
    entryStart: startSample + entry * win,
  };
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
// trim edges at -60 dBFS, find the steady body, bake the seam, and choose
// the two entrances (soft handoff entry past the fade-in intro — starting
// inside the intro hollowed the drone->music handoff out by 15.7 dB,
// measured — and a body-level act-crossfade entry). Also reports the body's
// median RMS so acts can be level-seated against REF_BODY_RMS_DB.
export function prepareSeamlessLoop(buffer) {
  const { startSample, endSample } = findLoopBounds(buffer);
  const { regionStart, regionEnd, bodyRms, handoffStart, entryStart } = findLoopRegion(buffer, startSample, endSample);
  const { loopStart, loopEnd } = bakeSeamlessLoop(buffer, regionStart, regionEnd);
  return {
    loopStart,
    loopEnd,
    playStart: handoffStart / buffer.sampleRate, // drone handoffs + cold starts
    actStart: entryStart / buffer.sampleRate, // act() crossfades over live music
    bodyRmsDb: dbOf(bodyRms),
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
    loopStart: 0, loopEnd: 0, playStart: 0, actStart: 0, level: MUSIC_LEVEL,
  });
  const tracks = {
    1: newTrack('./act3.mp3'), // Windswept Silence — the chill opener
    2: newTrack('./music.mp3'), // Frostbound Lullaby
    3: newTrack('./act2.mp3'), // Frost on the Nyckelharpa — the climax
    credits: newTrack('./credits.mp3'),
  };
  let mode = 'stopped'; // 'stopped' | 'gameplay' | 'credits'
  let currentAct = 1; // which act start() resumes and `ready` reflects
  let pendingAct = 0; // act awaiting fetch+prepare for a switch; 0 = none
  let playing = null; // { src, g, level }
  let firstEntry = true; // act 1's very first audible entry gets the 4 s exhale

  async function fetchDecode(url) {
    const res = await fetch(url);
    if (!res || !res.ok) throw new Error('music fetch failed: ' + url);
    const arr = await res.arrayBuffer();
    return ctx.decodeAudioData(arr);
  }

  function crossfadeDroneOut(t, gentle = false) {
    drone.ducked = true; // music owns the floor: the drone may not re-raise
    if (drone.playing && drone.nodes) {
      drone.nodes.out.gain.cancelScheduledValues(t);
      // Staggered handoff: hold the drone while the music establishes, then
      // ease it under -- measured to keep combined RMS within -3/+2 dB of the
      // pre-handoff level through the whole crossfade window. The gentle
      // (first-entry) variant holds 2 s and eases much slower under the 4 s
      // fade-in: the opener (Windswept Silence) is sparse, so the drone must
      // keep the floor warm through its first quiet phrases.
      if (gentle) drone.nodes.out.gain.setTargetAtTime(0, t + 1.6, 1.3);
      else drone.nodes.out.gain.setTargetAtTime(0, t + 0.7, 0.8);
    }
  }
  function restoreDrone(t) {
    drone.ducked = false; // the floor is the drone's again
    if (drone.playing && drone.nodes) {
      drone.nodes.out.gain.cancelScheduledValues(t);
      // full re-apply (gain AND filter center): intensity() calls made while
      // ducked were stored, not applied — the drone returns as the shell
      // last set it, not as it left
      applyDroneIntensity(ctx, drone.nodes, drone.intensity);
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

  // Every drone->music gameplay entry funnels through here so the one-time
  // first-entry gentleness (4 s fade, slower drone ease) can never replay.
  function enterGameplay(tr) {
    const gentle = firstEntry && tr === tracks[1];
    firstEntry = false;
    playing = playTrack(tr, gentle ? FIRST_HANDOFF_SECONDS : HANDOFF_SECONDS);
    crossfadeDroneOut(ctx.currentTime, gentle);
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
      enterGameplay(tr);
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
    src.start(t, tr.actStart); // land AT the running loudness, not on a build
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
      enterGameplay(tracks[key]);
    }
  }

  function fetchTrack(key) {
    const tr = tracks[key];
    if (tr.ready || tr.fetching) return;
    tr.fetching = true;
    fetchDecode(tr.url).then((buf) => {
      tr.fetching = false;
      const { loopStart, loopEnd, playStart, actStart, bodyRmsDb } = prepareSeamlessLoop(buf);
      tr.buffer = buf;
      tr.loopStart = loopStart;
      tr.loopEnd = loopEnd;
      // Handoffs/cold starts use the soft entry; act() crossfades use the
      // body-level one. Credits fades in from silence on a fresh screen, so
      // it keeps its own opening — just past the baked morph segment.
      tr.playStart = key === 'credits' ? loopStart : playStart;
      tr.actStart = actStart;
      // Credits keeps the v1 trim exactly; every act seats its body to the
      // fixed reference (Frostbound Lullaby's measured body) so act
      // crossfades hold loudness flat regardless of the act->file order.
      tr.level = key === 'credits' ? MUSIC_LEVEL : levelFor(bodyRmsDb);
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
      enterGameplay(tr);
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
