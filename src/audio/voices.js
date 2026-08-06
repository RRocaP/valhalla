// Shared DSP building blocks for the OATHWOOD sound world. No dependencies,
// no Math.random anywhere (deterministic noise + fixed note tables).

// ---- A minor pentatonic, A2..A4 (index 0..10) ----
export const PENT = [
  110.0, // 0  A2
  130.81, // 1  C3
  146.83, // 2  D3
  164.81, // 3  E3
  196.0, // 4  G3
  220.0, // 5  A3
  261.63, // 6  C4
  293.66, // 7  D4
  329.63, // 8  E4
  392.0, // 9  G4
  440.0, // 10 A4
];

export function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Single source of truth for the drone's intensity->output-gain map. Measured
// (artifacts/wip-fable-b/metrics.json): keeps drone peaks under -12 dBFS while
// preserving >=1.5 dB steps between intensity 0.2 / 0.6 / 1.0.
export function droneGainFor(x) {
  return 0.12 + clamp01(x) * 0.16;
}

// ---- deterministic noise buffer, cached per AudioContext ----
const noiseCache = new WeakMap();
export function getNoiseBuffer(ctx, seconds = 2) {
  let buf = noiseCache.get(ctx);
  if (buf) return buf;
  const len = Math.max(1, Math.round(ctx.sampleRate * seconds));
  buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x2f6e2b1; // fixed seed -> deterministic LCG, no Math.random
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseCache.set(ctx, buf);
  return buf;
}

// ---- soft-clip curve for the lur (WaveShaper), computed once ----
function makeSoftClipCurve(amount = 6) {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}
export const SOFT_CLIP_CURVE = makeSoftClipCurve();

// ---- generic cleanup: disconnect every node in a voice once its source(s) end ----
export function scheduleCleanup(sources, allNodes) {
  const dispose = () => {
    for (const n of allNodes) {
      try { n.disconnect(); } catch {}
    }
  };
  for (const s of sources) s.onended = dispose;
}

// ---- shared small-hall air: synthesized impulse response, cached per ctx ----
// Exponentially decaying deterministic noise, ~0.9 s tail, darkened by a
// one-pole lowpass whose cutoff closes down the tail (air eats treble
// first). Two decorrelated channels for width; each normalized to unit
// energy so the wet level is set by the send/wet gains alone, not the IR.
// This room is what keeps the synthesis from reading as beeps: dry is only
// the knuckle, the hall answers.
const irCache = new WeakMap();
export function makeRoomIR(ctx, seconds = 0.9) {
  let ir = irCache.get(ctx);
  if (ir) return ir;
  const len = Math.max(1, Math.round(ctx.sampleRate * seconds));
  ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    let seed = c === 0 ? 0x51ab3e7 : 0x1c9d204f; // fixed seeds, deterministic
    let lp = 0;
    let energy = 0;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const white = (seed / 0x7fffffff) * 2 - 1;
      const p = i / len;
      lp += (0.28 - 0.2 * p) * (white - lp); // ~2.3 kHz closing to ~600 Hz
      data[i] = lp * Math.exp(-6.9 * p); // -60 dB by the tail end
      energy += data[i] * data[i];
    }
    const norm = 1 / Math.sqrt(Math.max(energy, 1e-12));
    for (let i = 0; i < len; i++) data[i] *= norm;
  }
  irCache.set(ctx, ir);
  return ir;
}

// ---- felted wood touch: shared generator for every wooden UI voice ----
// One noise burst through 2-3 resonant bandpasses at inharmonically spaced
// wood-mode frequencies (~180/700/1150 Hz family), felted attack (2-8 ms,
// no clicky transient), higher modes dying first, dark top. Replaces the
// old single-bandpass woodHit and the flip/deny oscillator voices.
export function woodTouch(ctx, bus, t, {
  modes = [180, 700, 1150], weights = [1, 0.5, 0.28],
  q = 14, decay = 0.14, gain = 1, lowpass = 1900, attack = 0.004,
} = {}) {
  const out = ctx.createGain();
  out.connect(bus);
  const top = ctx.createBiquadFilter(); // keep the top end dark
  top.type = 'lowpass';
  top.frequency.value = lowpass;
  top.connect(out);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const nodes = [out, top, src];
  modes.forEach((f, i) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = ctx.createGain();
    const w = weights[i] ?? 0.5 ** i;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * w, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, decay * (1 - 0.22 * i)));
    src.connect(bp);
    bp.connect(g);
    g.connect(top);
    nodes.push(bp, g);
  });
  const stopAt = t + decay + 0.06;
  src.start(t);
  src.stop(stopAt);
  scheduleCleanup([src], nodes);
}

// near-subliminal felt brush (drag): a whisper of motion, not an event
export function woodSlide(ctx, bus, t, { gain = 1.6 } = {}) {
  const out = ctx.createGain();
  out.connect(bus);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.Q.value = 3;
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 1200;
  src.connect(body);
  body.connect(top);
  top.connect(out);

  const dur = 0.12;
  body.frequency.setValueAtTime(240, t);
  body.frequency.linearRampToValueAtTime(520, t + dur * 0.6);
  body.frequency.linearRampToValueAtTime(360, t + dur);

  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(gain, t + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const stopAt = t + dur + 0.05;
  src.start(t);
  src.stop(stopAt);
  scheduleCleanup([src], [out, src, body, top]);
}

// ---- wrong: nothing buzzes, ever. The floor answers instead — a brief
// sub drop (sine, ~66 -> 44 Hz) under the felted thud, gone in ~160 ms.
export function subDrop(ctx, bus, t, { from = 66, to = 44, dur = 0.16, gain = 0.5 } = {}) {
  const out = ctx.createGain();
  out.connect(bus);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.85);
  const lp = ctx.createBiquadFilter(); // guarantee darkness even off-graph
  lp.type = 'lowpass';
  lp.frequency.value = 150;
  osc.connect(lp);
  lp.connect(out);

  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(gain, t + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const stopAt = t + dur + 0.05;
  osc.start(t);
  osc.stop(stopAt);
  scheduleCleanup([osc], [out, osc, lp]);
}

// ---- lyre pluck: Karplus-Strong via a feedback delay loop ----
export function pluck(ctx, bus, t, freq, { gain = 0.3, decay = 0.9, brightness = 1600 } = {}) {
  const period = 1 / freq;
  const out = ctx.createGain();
  out.connect(bus);

  // excitation: short filtered noise burst ~ one period long
  const exciter = ctx.createBufferSource();
  exciter.buffer = getNoiseBuffer(ctx);
  const exShape = ctx.createBiquadFilter();
  exShape.type = 'lowpass';
  exShape.frequency.value = brightness;
  const exGain = ctx.createGain();
  exGain.gain.setValueAtTime(1, t);
  exGain.gain.setValueAtTime(0, t + Math.max(period, 0.002));
  exciter.connect(exShape);
  exShape.connect(exGain);

  // resonant loop: delay -> damping lowpass -> feedback gain -> back to delay.
  // STABILITY (measured, artifacts/wip-fable-b): WebAudio lowpass biquads read
  // Q in dB, and the default Q=1 puts a +1 dB bump at the cutoff. With 0.98
  // feedback the loop gain exceeded 1 there, so plucks rang UP (measured
  // +15 dBFS) instead of decaying. Q=-6 keeps the response peak-free and
  // feedback 0.955 gives a lyre-like ~0.6-0.9 s ring-down.
  // TUNING (measured): WebAudio inserts one render quantum (128 samples) of
  // implicit delay in any feedback cycle, and the damping biquad adds its own
  // phase lag -- uncompensated, every pluck sounded a fourth-to-a-third flat
  // (e.g. A3 rang at ~139 Hz). Subtract both from the loop delay.
  const dampF = Math.min(brightness, freq * 10);
  const quantum = 128 / ctx.sampleRate;
  const filterLag = 1 / (Math.PI * dampF); // 2nd-order lowpass: two poles of lag
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = Math.min(0.05, Math.max(0, period - quantum - filterLag));
  const damping = ctx.createBiquadFilter();
  damping.type = 'lowpass';
  damping.frequency.value = dampF;
  damping.Q.value = -6;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.955;

  exGain.connect(delay);
  delay.connect(damping);
  damping.connect(feedback);
  feedback.connect(delay); // the loop
  damping.connect(out); // tap to output

  out.gain.setValueAtTime(0, t); // felted 3 ms onset: no click, still a pluck
  out.gain.linearRampToValueAtTime(gain, t + 0.003);
  out.gain.exponentialRampToValueAtTime(0.0001, t + decay);

  const endAt = t + decay + 0.1;
  exciter.start(t);
  exciter.stop(t + Math.max(period, 0.002) + 0.01);

  // watchdog: silent unconnected source, exists only to anchor true-end
  // cleanup — the excitation burst ends almost immediately but the
  // resonant tail rings on for `decay` seconds.
  const watchdog = ctx.createBufferSource();
  watchdog.buffer = getNoiseBuffer(ctx);
  watchdog.start(t);
  watchdog.stop(endAt);

  const allNodes = [out, exciter, exShape, exGain, delay, damping, feedback, watchdog];
  exciter.onended = () => {
    try { exciter.disconnect(); exShape.disconnect(); exGain.disconnect(); } catch {}
  };
  watchdog.onended = () => {
    for (const n of allNodes) { try { n.disconnect(); } catch {} }
  };
}

// ---- skin drum: pitch-dropped sine + noise thump ----
export function drumHit(ctx, bus, t, { gain = 0.3, dur = 0.32 } = {}) {
  const out = ctx.createGain();
  out.connect(bus);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + dur * 0.7);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, t); // felted skin, not a beater click
  oscGain.gain.linearRampToValueAtTime(gain, t + 0.006);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(oscGain);
  oscGain.connect(out);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 180; // darker thump, and off the A3 (220 Hz) bin so
  // the room's echo of the thump never masquerades as the yield third
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(gain * 0.5, t + 0.004);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.35);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(out);

  const stopAt = t + dur + 0.05;
  osc.start(t);
  osc.stop(stopAt);
  noise.start(t);
  noise.stop(stopAt);
  scheduleCleanup([osc, noise], [out, osc, oscGain, noise, nf, ng]);
}

// ---- lur swell: soft-clipped harmonic stack (unlocks/dare/finale) ----
// NOTE the tanh stage saturates near +-1, so `gain` IS the output ceiling.
export function lurSwell(ctx, bus, t, freqs, { dur = 2.5, gain = 0.2, brightness = 1200, attack = 0.8 } = {}) {
  const out = ctx.createGain();
  out.connect(bus);
  const shaper = ctx.createWaveShaper();
  shaper.curve = SOFT_CLIP_CURVE;
  shaper.oversample = '2x';
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = brightness;
  shaper.connect(tone);
  tone.connect(out);

  const mix = ctx.createGain();
  mix.gain.value = 1 / Math.max(1, freqs.length);
  mix.connect(shaper);
  const oscs = freqs.map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(mix);
    return o;
  });

  const a = Math.min(attack, dur * 0.45); // softer entry: the horn breathes in
  const release = 0.9;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(gain, t + a);
  out.gain.setValueAtTime(gain, t + Math.max(a, dur - release));
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const stopAt = t + dur + 0.1;
  for (const o of oscs) o.start(t);
  for (const o of oscs) o.stop(stopAt);
  scheduleCleanup(oscs, [out, shaper, tone, mix, ...oscs]);
}

// ---- drone (tagelharpa-like): build / intensity / bloom / release ----
export function buildDrone(ctx, bus, introGain = 0.5) {
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(bus);

  // Detuned saw pair with UNEQUAL weights: an equal pair at +9 cents beats at
  // ~0.57 Hz and periodically CANCELS (measured as a spurious 6-10 dB level
  // wobble far beyond the LFO design). With the second bow at 0.42 amplitude
  // the pair can never null -- the beat becomes a bounded 1.5-3 dB breath.
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 110;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 110;
  osc2.detune.value = 7;
  const osc2Gain = ctx.createGain();
  osc2Gain.gain.value = 0.3;
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0.5;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 260;
  bandpass.Q.value = 0.8; // broad: a narrow band sweeping the saw's harmonic comb wobbled +-6 dB
  osc1.connect(oscGain);
  osc2.connect(osc2Gain);
  osc2Gain.connect(oscGain);
  oscGain.connect(bandpass);
  bandpass.connect(out);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  noise.loop = true;
  // NOTE: 'lowpass', not 'bandpass' — deliberately, so tests can uniquely
  // find the modulated tone filter by type === 'bandpass'.
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 500;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.05;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(out);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.11;
  const lfoFilterDepth = ctx.createGain();
  lfoFilterDepth.gain.value = 25;
  const lfoAmpDepth = ctx.createGain();
  lfoAmpDepth.gain.value = 0.04; // measured: with the bounded beat, ~2-3 dB total breath
  lfo.connect(lfoFilterDepth);
  lfoFilterDepth.connect(bandpass.frequency);
  lfo.connect(lfoAmpDepth);
  lfoAmpDepth.connect(oscGain.gain);

  osc1.start(t);
  osc2.start(t);
  noise.start(t);
  lfo.start(t);
  out.gain.setTargetAtTime(introGain, t, 1.2); // slow fade in, the hall breathes

  return { out, osc1, osc2, osc2Gain, oscGain, bandpass, noise, noiseFilter, noiseGain, lfo, lfoFilterDepth, lfoAmpDepth };
}

export function applyDroneIntensity(ctx, nodes, x) {
  const t = ctx.currentTime;
  const v = clamp01(x);
  // center map 230-350: parking the passband right between saw harmonics
  // (330/440) at high intensity measurably ate the level step design.
  // Q stays fixed at 0.8 -- narrowing it with intensity also ate the steps.
  nodes.bandpass.frequency.setTargetAtTime(230 + v * 120, t, 0.4);
  nodes.out.gain.setTargetAtTime(droneGainFor(v), t, 0.4);
  return v;
}

export function bloomDrone(ctx, nodes, baseIntensity, t) {
  const peak = clamp01(baseIntensity + 0.4);
  nodes.bandpass.frequency.setTargetAtTime(230 + peak * 120, t, 0.3);
  nodes.out.gain.setTargetAtTime(droneGainFor(peak), t, 0.3);
  nodes.bandpass.frequency.setTargetAtTime(230 + baseIntensity * 120, t + 2.2, 1.2);
  nodes.out.gain.setTargetAtTime(droneGainFor(baseIntensity), t + 2.2, 1.2);
}

export function releaseDrone(ctx, nodes) {
  const t = ctx.currentTime;
  nodes.out.gain.cancelScheduledValues(t);
  nodes.out.gain.setTargetAtTime(0, t, 0.5);
  const stopAt = t + 1.5;
  const sources = [nodes.osc1, nodes.osc2, nodes.noise, nodes.lfo];
  const allNodes = [nodes.out, nodes.bandpass, nodes.oscGain, nodes.osc2Gain, nodes.noiseFilter,
    nodes.noiseGain, nodes.lfoFilterDepth, nodes.lfoAmpDepth, ...sources];
  const dispose = () => { for (const n of allNodes) { try { n.disconnect(); } catch {} } };
  for (const s of sources) {
    s.onended = dispose;
    try { s.stop(stopAt); } catch {}
  }
}
