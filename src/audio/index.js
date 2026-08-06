// OATHWOOD synthesized sound world (docs/AUDIO.md — frozen API). WebAudio
// synthesis only, plus the two committed music/credits mp3 streams (the
// "roca-airways" exception, docs/CONTRACT.md). No AudioContext exists until
// enable() runs from a user gesture; nothing plays before that.
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
    switch (kind) {
      case 'tick':
        V.woodHit(ctx, bus, t, { resonance: 950, q: 8, decay: 0.05, gain: 0.32, lowpass: 3000 });
        break;
      case 'knock':
        V.woodHit(ctx, bus, t, { resonance: 480, q: 6, decay: 0.11, gain: 0.5, lowpass: 2200 });
        break;
      case 'slide':
        V.woodSlide(ctx, bus, t);
        break;
      case 'deny':
        V.woodHit(ctx, bus, t, { resonance: 220, q: 3, decay: 0.16, gain: 0.45, lowpass: 900 });
        V.denyBuzz(ctx, bus, t);
        break;
      case 'confirm':
        V.woodHit(ctx, bus, t, { resonance: 620, q: 7, decay: 0.09, gain: 0.4, lowpass: 2400 });
        V.woodHit(ctx, bus, t + 0.07, { resonance: 900, q: 9, decay: 0.06, gain: 0.28, lowpass: 3000 });
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
        [V.PENT[5], V.PENT[6], V.PENT[8]].forEach((f, i) =>
          V.pluck(ctx, bus, t + i * 0.11, f, { gain: 0.32, decay: 0.8 }));
        break;
      case 'hint':
        [V.PENT[4], V.PENT[2]].forEach((f, i) =>
          V.pluck(ctx, bus, t + i * 0.28, f, { gain: 0.28, decay: 1.0, brightness: 1500 }));
        break;
      case 'unlock':
        V.drumHit(ctx, bus, t, { gain: 0.55, dur: 0.3 });
        V.lurSwell(ctx, bus, t + 0.05, [V.PENT[0], V.PENT[3], V.PENT[5]], { dur: 2.5, gain: 0.3 });
        break;
      case 'chest':
        [0, 0.14, 0.28].forEach((dt) => V.drumHit(ctx, bus, t + dt, { gain: 0.6, dur: 0.34 }));
        V.lurSwell(ctx, bus, t + 0.1, [V.PENT[0], V.PENT[3], V.PENT[5], V.PENT[8]], { dur: 3.2, gain: 0.38, brightness: 1700 });
        if (drone.playing && drone.nodes) V.bloomDrone(ctx, drone.nodes, drone.intensity, t);
        break;
      case 'dare':
        // low horn challenge, two notes, held (a challenger steps up)
        V.lurSwell(ctx, bus, t, [V.PENT[0], V.PENT[3]], { dur: 1.8, gain: 0.34, brightness: 1300 });
        break;
      case 'yield':
        // drum hit + falling third, resolving (the challenger bows)
        V.drumHit(ctx, bus, t, { gain: 0.5, dur: 0.28 });
        V.pluck(ctx, bus, t + 0.22, V.PENT[6], { gain: 0.3, decay: 0.5, brightness: 1600 });
        V.pluck(ctx, bus, t + 0.46, V.PENT[5], { gain: 0.28, decay: 1.0, brightness: 1400 });
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
        drone.nodes = V.buildDrone(ctx, buses.droneBus, 0.35 + drone.intensity * 0.4);
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
      get ready() { return musicImpl ? musicImpl.ready : false; },
    },
  };
}
