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

// ---- wood hit: shared generator for tick/knock/deny-thud/confirm/flip base ----
export function woodHit(ctx, bus, t, {
  resonance = 700, q = 8, decay = 0.08, gain = 0.5, lowpass = 3000,
} = {}) {
  const out = ctx.createGain();
  out.connect(bus);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.frequency.value = resonance;
  body.Q.value = q;
  const top = ctx.createBiquadFilter(); // keep the top end dark
  top.type = 'lowpass';
  top.frequency.value = lowpass;
  src.connect(body);
  body.connect(top);
  top.connect(out);

  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(gain, t + 0.004);
  out.gain.exponentialRampToValueAtTime(0.0001, t + decay);

  const stopAt = t + decay + 0.05;
  src.start(t);
  src.stop(stopAt);
  scheduleCleanup([src], [out, src, body, top]);
}

export function woodSlide(ctx, bus, t) {
  const out = ctx.createGain();
  out.connect(bus);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.Q.value = 4;
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 2600;
  src.connect(body);
  body.connect(top);
  top.connect(out);

  const dur = 0.15; // measured 60-120 ms envelope window (was 0.22 -> 150 ms)
  body.frequency.setValueAtTime(320, t);
  body.frequency.linearRampToValueAtTime(900, t + dur * 0.6);
  body.frequency.linearRampToValueAtTime(500, t + dur);

  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(2.9, t + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const stopAt = t + dur + 0.05;
  src.start(t);
  src.stop(stopAt);
  scheduleCleanup([src], [out, src, body, top]);
}

export function woodFlip(ctx, bus, t) {
  const out = ctx.createGain();
  out.connect(bus);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.Q.value = 5;
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 2600;
  src.connect(body);
  body.connect(top);
  top.connect(out);

  const dur = 0.16;
  body.frequency.setValueAtTime(750, t);
  body.frequency.exponentialRampToValueAtTime(320, t + dur);

  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(3.6, t + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const stopAt = t + dur + 0.05;
  src.start(t);
  src.stop(stopAt);
  scheduleCleanup([src], [out, src, body, top]);
}

export function denyBuzz(ctx, bus, t) {
  const out = ctx.createGain();
  out.connect(bus);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 68; // deliberately off-scale: non-musical per contract
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  osc.connect(lp);
  lp.connect(out);

  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.42, t + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

  const stopAt = t + 0.18;
  osc.start(t);
  osc.stop(stopAt);
  scheduleCleanup([osc], [out, osc, lp]);
}

// ---- lyre pluck: Karplus-Strong via a feedback delay loop ----
export function pluck(ctx, bus, t, freq, { gain = 0.3, decay = 0.9, brightness = 2200 } = {}) {
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

  out.gain.setValueAtTime(gain, t);
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
  oscGain.gain.setValueAtTime(gain, t);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(oscGain);
  oscGain.connect(out);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 220;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain * 0.5, t);
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
export function lurSwell(ctx, bus, t, freqs, { dur = 2.5, gain = 0.2, brightness = 1400 } = {}) {
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

  const attack = 0.5;
  const release = 0.9;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(gain, t + attack);
  out.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
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
