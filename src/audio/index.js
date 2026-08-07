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
  // `ducked` = music owns the floor (set/cleared by music.js at handoff/
  // stop). While true the drone must be FULLY silent: intensity() stores but
  // never re-raises, chest never blooms it, a rebuild comes up at gain 0.
  // (Shipped bug, Ramon live: the shell persists progress at yield beats,
  // and intensity() re-raised the crossfaded-out drone under the music — a
  // 110 Hz saw hum below the score. artifacts/wip-soundfeel/
  // metrics-yieldbug-before.json holds the offline repro: +6.7 dB sustained
  // 50-400 Hz over the music bed.)
  const drone = { playing: false, nodes: null, intensity: 0.4, ducked: false };

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
    voiceBus.gain.value = 0.7; // motifs seated a notch lower (OW-SOUNDFEEL)
    const uiBus = c.createGain();
    uiBus.gain.value = 0.19; // ~-10 dB from the old 0.6: the UI whispers
    const musicBus = c.createGain();
    musicBus.gain.value = 1;
    droneBus.connect(compressor);
    voiceBus.connect(compressor);
    uiBus.connect(compressor);
    musicBus.connect(compressor);

    // One shared small-hall air (OW-SOUNDFEEL): every synth voice leans on
    // the same room via bus sends into a ConvolverNode holding a synthesized
    // ~0.9 s dark IR. The wet return stays subtle (measured tail energy
    // <= 20% of a knock, artifacts/wip-soundfeel/metrics.json) — the room is
    // felt, not heard. Music and drone do not send (recordings and a
    // continuous bed gain nothing from it). Created after the six frozen
    // graph nodes so their creation order stays test-stable.
    const roomSend = c.createGain();
    roomSend.gain.value = 1;
    const room = c.createConvolver();
    room.buffer = V.makeRoomIR(c);
    const roomWet = c.createGain();
    roomWet.gain.value = 0.8; // measured: knock tail-energy fraction ~0.026

    uiBus.connect(roomSend);
    voiceBus.connect(roomSend);
    roomSend.connect(room);
    room.connect(roomWet);
    roomWet.connect(compressor);

    return { master, compressor, droneBus, voiceBus, uiBus, musicBus, roomSend, room, roomWet };
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
    // FEWER, SOFTER (OW-SOUNDFEEL): only meaningful touches speak — knock
    // (placement), confirm (submit), deny (wrong) — and only those duck the
    // score. tick/slide/flip are near-subliminal felt textures (~-40 dBFS):
    // present in a silent hall, invisible under music. Gains are measured,
    // not guessed: narrow bandpass modes eat 25-35 dB of the noise burst, so
    // per-voice gains sit above 1 (artifacts/wip-soundfeel/metrics.json).
    switch (kind) {
      case 'tick': // near-subliminal: felt, not heard
        V.woodTouch(ctx, bus, t, { modes: [310, 960], weights: [1, 0.4], q: 16, decay: 0.09, gain: 4.8, lowpass: 1500 });
        break;
      case 'knock': // meaningful placement: the soft felted knock
        musicImpl.duck(UI_DUCK_HOLD);
        V.woodTouch(ctx, bus, t, { modes: [180, 700, 1150], weights: [1, 0.5, 0.25], q: 13, decay: 0.15, gain: 17, lowpass: 1900 });
        break;
      case 'slide': // near-subliminal drag brush
        V.woodSlide(ctx, bus, t, { gain: 1.5 });
        break;
      case 'deny': // wrong: LOW felted thud + brief sub drop; nothing buzzes
        musicImpl.duck(UI_DUCK_HOLD);
        V.woodTouch(ctx, bus, t, { modes: [112, 330, 560], weights: [1, 0.45, 0.2], q: 9, decay: 0.15, gain: 7.5, lowpass: 640, attack: 0.006 });
        V.subDrop(ctx, bus, t, { gain: 0.8 });
        break;
      case 'confirm': // submit: two soft knocks, low then higher — settled
        musicImpl.duck(UI_DUCK_HOLD);
        V.woodTouch(ctx, bus, t, { modes: [200, 760, 1220], weights: [1, 0.5, 0.25], q: 13, decay: 0.11, gain: 7.5, lowpass: 1900 });
        V.woodTouch(ctx, bus, t + 0.08, { modes: [260, 900, 1400], weights: [1, 0.5, 0.22], q: 14, decay: 0.09, gain: 5.5, lowpass: 2100, attack: 0.003 });
        break;
      case 'flip': // near-subliminal turn
        V.woodTouch(ctx, bus, t, { modes: [240, 820], weights: [1, 0.45], q: 12, decay: 0.11, gain: 3.6, lowpass: 1500, attack: 0.005 });
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
    // Motifs stay — each marks a real event — but darker, quieter, and
    // leaning on the shared room (OW-SOUNDFEEL).
    switch (kind) {
      case 'shard':
        // rising A3-C4-E4 lyre arpeggio: small triumph, no sparkle glare
        [V.PENT[5], V.PENT[6], V.PENT[8]].forEach((f, i) =>
          V.pluck(ctx, bus, t + i * 0.11, f, { gain: 0.34, decay: 0.8, brightness: 1500 }));
        break;
      case 'hint':
        // two LOW lyre notes, falling fourth D3->A2: quiet, private counsel
        [V.PENT[2], V.PENT[0]].forEach((f, i) =>
          V.pluck(ctx, bus, t + i * 0.32, f, { gain: 0.3, decay: 1.0, brightness: 1000 }));
        break;
      case 'unlock':
        V.drumHit(ctx, bus, t, { gain: 0.22, dur: 0.3 });
        V.lurSwell(ctx, bus, t + 0.05, [V.PENT[0], V.PENT[3], V.PENT[5]], { dur: 2.5, gain: 0.1 });
        break;
      case 'chest':
        [0, 0.14, 0.28].forEach((dt) => V.drumHit(ctx, bus, t + dt, { gain: 0.2, dur: 0.34 }));
        V.lurSwell(ctx, bus, t + 0.1, [V.PENT[0], V.PENT[3], V.PENT[5], V.PENT[8]], { dur: 3.2, gain: 0.14, brightness: 1500, attack: 0.6 });
        // bloom only when the drone owns the floor — under music it must stay silent
        if (drone.playing && drone.nodes && !drone.ducked) V.bloomDrone(ctx, drone.nodes, drone.intensity, t);
        break;
      case 'dare':
        // low horn challenge: A2 sounds, then the fifth stacks on top and both
        // HOLD, unresolved (a challenger steps up) - a call, not a chord onset
        V.lurSwell(ctx, bus, t, [V.PENT[0]], { dur: 2.0, gain: 0.075, brightness: 1100, attack: 0.9 });
        V.lurSwell(ctx, bus, t + 0.45, [V.PENT[3]], { dur: 1.55, gain: 0.055, brightness: 1100, attack: 0.7 });
        break;
      case 'yield':
        // the challenger bows: one BIG felted drum, falling minor third
        // C4->A3 ringing out, and a low horn under the resolution answering
        // dare's held call — epic and clean, then the hall goes quiet
        V.drumHit(ctx, bus, t, { gain: 0.3, dur: 0.34 });
        V.pluck(ctx, bus, t + 0.22, V.PENT[6], { gain: 0.4, decay: 0.6, brightness: 1400 });
        V.pluck(ctx, bus, t + 0.46, V.PENT[5], { gain: 0.38, decay: 1.4, brightness: 1200 });
        V.lurSwell(ctx, bus, t + 0.46, [V.PENT[0]], { dur: 2.2, gain: 0.05, brightness: 1000, attack: 0.6 });
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
        // rebuilt while music owns the floor: come up silent; music.stop()'s
        // restore raises it at the stored intensity
        drone.nodes = V.buildDrone(ctx, buses.droneBus, drone.ducked ? 0 : V.droneGainFor(drone.intensity));
      },
      stop() {
        if (!ctx || !drone.playing) return;
        V.releaseDrone(ctx, drone.nodes);
        drone.playing = false;
        drone.nodes = null;
      },
      intensity(x) {
        if (!ctx) return;
        drone.intensity = V.clamp01(x); // always stored (restore uses it)...
        // ...but NEVER applied under music: the shell persists progress at
        // yield beats, and applying here was the live hum-under-music bug
        if (drone.nodes && !drone.ducked) V.applyDroneIntensity(ctx, drone.nodes, drone.intensity);
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
