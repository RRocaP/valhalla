// OATHWOOD synthesized sound world (docs/AUDIO.md — frozen API). WebAudio
// synthesis only, plus the four committed mp3 streams — the three-act
// progression score and credits (the "roca-airways" exception, docs/
// CONTRACT.md v2). No AudioContext exists until enable() runs from a user
// gesture; nothing plays before that.
import * as V from './voices.js';
import { createMusic } from './music.js';

const UI_DUCK_HOLD = 0.15;
const MOTIF_DUCK_HOLD = 0.8;

// `ACImpl` is an additive, optional override of the AudioContext
// constructor — omitted, it's the real global, so `createAudio()` called
// with zero arguments (as src/main.js does) is unaffected. Tests pass a
// mock class, per AUDIO.md's own note to "construct with a mocked
// AudioContext" in unit tests.
export function createAudio(ACImpl = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let ctx = null;
  let buses = null;
  let musicImpl = null;
  let enabledFlag = false;
  let mutedFlag = false;
  const drone = { playing: false, nodes: null, intensity: 0.4 };

  // Node creation order below is fixed and relied upon by
  // tests/unit/audio.test.mjs: master, compressor, droneBus, voiceBus,
  // uiBus, musicBus (after the context's own `destination`).
  function buildGraph(c) {
    const master = c.createGain();
    master.gain.value = mutedFlag ? 0 : 1;
    const compressor = c.createDynamicsCompressor();
    // Safety-net only. Chrome's DEFAULTS (threshold -24, knee 30, ratio 12)
    // measurably crushed the mix design: drone intensity steps collapsed from
    // ~2.5 dB to ~0.15 dB and every loud voice pumped everything else
    // (artifacts/wip-fable-b/metrics-before.json). These settings leave the
    // tuned levels untouched below -11 dBFS and only catch stack-ups.
    compressor.threshold.value = -6;
    compressor.knee.value = 5;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressor.connect(master);
    master.connect(c.destination);

    const droneBus = c.createGain();
    droneBus.gain.value = 1;
    const voiceBus = c.createGain();
    voiceBus.gain.value = 0.9;
    const uiBus = c.createGain();
    uiBus.gain.value = 0.6;
    const musicBus = c.createGain();
    musicBus.gain.value = 1;
    droneBus.connect(compressor);
    voiceBus.connect(compressor);
    uiBus.connect(compressor);
    musicBus.connect(compressor);

    return { master, compressor, droneBus, voiceBus, uiBus, musicBus };
  }

  function enable() {
    if (!ctx) {
      if (!ACImpl) return; // WebAudio unsupported: safe no-op forever, never throws
      ctx = new ACImpl();
      buses = buildGraph(ctx);
      musicImpl = createMusic(ctx, buses.musicBus, drone);
    }
    enabledFlag = true;
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        const p = ctx.resume();
        if (p && typeof p.then === 'function') p.catch(() => {});
      } catch {}
    }
  }

  function setMuted(b) {
    mutedFlag = !!b;
    if (ctx && buses) {
      const t = ctx.currentTime;
      buses.master.gain.cancelScheduledValues(t);
      buses.master.gain.setTargetAtTime(mutedFlag ? 0 : 1, t, 0.02);
    }
  }

  function ui(kind) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const bus = buses.uiBus;
    musicImpl.duck(UI_DUCK_HOLD);
    // Gains here are measured, not guessed: narrow bandpass filtering eats
    // 25-35 dB of the noise burst, so per-voice gains sit well above 1 to land
    // audible wood at -21..-24 dBFS peaks (artifacts/wip-fable-b/metrics.json).
    switch (kind) {
      case 'tick':
        V.woodHit(ctx, bus, t, { resonance: 950, q: 8, decay: 0.15, gain: 6.0, lowpass: 2800 });
        break;
      case 'knock':
        V.woodHit(ctx, bus, t, { resonance: 480, q: 6, decay: 0.16, gain: 5.4, lowpass: 2200 });
        break;
      case 'slide':
        V.woodSlide(ctx, bus, t);
        break;
      case 'deny':
        V.woodHit(ctx, bus, t, { resonance: 220, q: 3, decay: 0.15, gain: 4.2, lowpass: 900 });
        V.denyBuzz(ctx, bus, t);
        break;
      case 'confirm':
        V.woodHit(ctx, bus, t, { resonance: 620, q: 7, decay: 0.09, gain: 2.8, lowpass: 2400 });
        V.woodHit(ctx, bus, t + 0.07, { resonance: 900, q: 9, decay: 0.06, gain: 2.0, lowpass: 2800 });
        break;
      case 'flip':
        V.woodFlip(ctx, bus, t);
        break;
      default:
        break; // unknown kind: no-op, never throws
    }
  }

  function motif(kind) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const bus = buses.voiceBus;
    musicImpl.duck(MOTIF_DUCK_HOLD);
    switch (kind) {
      case 'shard':
        // rising A3-C4-E4 lyre arpeggio: small triumph, quick sparkle
        [V.PENT[5], V.PENT[6], V.PENT[8]].forEach((f, i) =>
          V.pluck(ctx, bus, t + i * 0.11, f, { gain: 0.5, decay: 0.8 }));
        break;
      case 'hint':
        // two LOW lyre notes, falling fourth D3->A2: quiet, private counsel
        [V.PENT[2], V.PENT[0]].forEach((f, i) =>
          V.pluck(ctx, bus, t + i * 0.32, f, { gain: 0.42, decay: 1.0, brightness: 1200 }));
        break;
      case 'unlock':
        V.drumHit(ctx, bus, t, { gain: 0.3, dur: 0.3 });
        V.lurSwell(ctx, bus, t + 0.05, [V.PENT[0], V.PENT[3], V.PENT[5]], { dur: 2.5, gain: 0.14 });
        break;
      case 'chest':
        [0, 0.14, 0.28].forEach((dt) => V.drumHit(ctx, bus, t + dt, { gain: 0.28, dur: 0.34 }));
        V.lurSwell(ctx, bus, t + 0.1, [V.PENT[0], V.PENT[3], V.PENT[5], V.PENT[8]], { dur: 3.2, gain: 0.19, brightness: 1700 });
        if (drone.playing && drone.nodes) V.bloomDrone(ctx, drone.nodes, drone.intensity, t);
        break;
      case 'dare':
        // low horn challenge: A2 sounds, then the fifth stacks on top and both
        // HOLD, unresolved (a challenger steps up) - a call, not a chord onset
        V.lurSwell(ctx, bus, t, [V.PENT[0]], { dur: 2.0, gain: 0.1, brightness: 1300 });
        V.lurSwell(ctx, bus, t + 0.45, [V.PENT[3]], { dur: 1.55, gain: 0.075, brightness: 1300 });
        break;
      case 'yield':
        // drum hit + falling minor third C4->A3, resolving (the challenger bows)
        V.drumHit(ctx, bus, t, { gain: 0.27, dur: 0.28 });
        V.pluck(ctx, bus, t + 0.22, V.PENT[6], { gain: 0.46, decay: 0.5, brightness: 1600 });
        V.pluck(ctx, bus, t + 0.46, V.PENT[5], { gain: 0.44, decay: 1.0, brightness: 1400 });
        break;
      default:
        break; // unknown kind: no-op, never throws
    }
  }

  return {
    enable,
    get enabled() { return enabledFlag; },
    setMuted,
    get muted() { return mutedFlag; },
    ui,
    motif,
    drone: {
      start() {
        if (!ctx || drone.playing) return; // idempotent, no double-allocate
        drone.playing = true;
        drone.nodes = V.buildDrone(ctx, buses.droneBus, V.droneGainFor(drone.intensity));
      },
      stop() {
        if (!ctx || !drone.playing) return;
        V.releaseDrone(ctx, drone.nodes);
        drone.playing = false;
        drone.nodes = null;
      },
      intensity(x) {
        if (!ctx) return;
        drone.intensity = V.clamp01(x);
        if (drone.nodes) V.applyDroneIntensity(ctx, drone.nodes, drone.intensity);
      },
    },
    music: {
      start() { if (musicImpl) musicImpl.start(); },
      credits() { if (musicImpl) musicImpl.credits(); },
      stop() { if (musicImpl) musicImpl.stop(); },
      act(n) { if (musicImpl) musicImpl.act(n); }, // v2: progression track select
      get ready() { return musicImpl ? musicImpl.ready : false; },
    },
  };
}
