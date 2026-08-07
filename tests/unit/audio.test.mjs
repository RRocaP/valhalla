// Unit tests for src/audio/** against docs/AUDIO.md (frozen API + music
// addendum). Uses a hand-written mock AudioContext (records node creation,
// connect/disconnect, start/stop, and AudioParam automation) so the whole
// suite runs without a real browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAudio } from '../../src/audio/index.js';
import { clamp01, PENT } from '../../src/audio/voices.js';
import { findLoopBounds, bakeSeamlessLoop, prepareSeamlessLoop, DUCK_GAIN_FACTOR, ACT_CROSSFADE_SECONDS } from '../../src/audio/music.js';

// ---------------------------------------------------------------------
// minimal mock AudioContext
// ---------------------------------------------------------------------

class MockAudioParam {
  constructor(value = 1) { this.value = value; this.calls = []; }
  setValueAtTime(v, t) { this.value = v; this.calls.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v, t) { this.value = v; this.calls.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { this.value = v; this.calls.push(['exp', v, t]); return this; }
  setTargetAtTime(v, t, tc) { this.value = v; this.calls.push(['target', v, t, tc]); return this; }
  setValueCurveAtTime(curve, t, dur) { this.value = curve[curve.length - 1]; this.calls.push(['curve', Float32Array.from(curve), t, dur]); return this; }
  cancelScheduledValues(t) { this.calls.push(['cancel', t]); return this; }
}

let uid = 0;
class MockNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this._kind = kind;
    this._id = ++uid;
    this.connections = [];
    this.disconnected = false;
    this.onended = null;
    ctx._registry.push(this);
  }
  connect(dest) { this.connections.push(dest); return dest; }
  disconnect() { this.disconnected = true; this.connections = []; }
}
class MockSource extends MockNode {
  constructor(ctx, kind) {
    super(ctx, kind);
    this.startedAt = null;
    this.stoppedAt = null;
  }
  start(t = 0) { this.startedAt = t; }
  stop(t = 0) { this.stoppedAt = t; }
  // test-only helper: simulate the native 'ended' event firing
  _end() { if (typeof this.onended === 'function') this.onended(); }
}
class MockOscillator extends MockSource {
  constructor(ctx) {
    super(ctx, 'oscillator');
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
  }
}
class MockBufferSource extends MockSource {
  constructor(ctx) {
    super(ctx, 'bufferSource');
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
  }
}
class MockGain extends MockNode {
  constructor(ctx) { super(ctx, 'gain'); this.gain = new MockAudioParam(1); }
}
class MockBiquad extends MockNode {
  constructor(ctx) {
    super(ctx, 'biquad');
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.detune = new MockAudioParam(0);
    this.gain = new MockAudioParam(0);
  }
}
class MockDelay extends MockNode {
  constructor(ctx) { super(ctx, 'delay'); this.delayTime = new MockAudioParam(0); }
}
class MockWaveShaper extends MockNode {
  constructor(ctx) { super(ctx, 'waveshaper'); this.curve = null; this.oversample = 'none'; }
}
class MockCompressor extends MockNode {
  constructor(ctx) {
    super(ctx, 'compressor');
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) this[k] = new MockAudioParam(0);
  }
}
class MockConvolver extends MockNode {
  constructor(ctx) { super(ctx, 'convolver'); this.buffer = null; this.normalize = true; }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this._registry = [];
    this.destination = new MockNode(this, 'destination');
    MockAudioContext.instances.push(this);
  }
  createGain() { return new MockGain(this); }
  createOscillator() { return new MockOscillator(this); }
  createBufferSource() { return new MockBufferSource(this); }
  createBiquadFilter() { return new MockBiquad(this); }
  createDelay() { return new MockDelay(this); }
  createWaveShaper() { return new MockWaveShaper(this); }
  createDynamicsCompressor() { return new MockCompressor(this); }
  createConvolver() { return new MockConvolver(this); }
  createBuffer(channels, length, sampleRate) {
    const chans = [];
    for (let i = 0; i < channels; i++) chans.push(new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (c) => chans[c] };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  // real AudioContext#decodeAudioData(arrayBuffer) -> Promise<AudioBuffer>;
  // tests override `_decodeImpl` per-instance to simulate failure.
  decodeAudioData(arrayBuffer) {
    if (this._decodeImpl) return this._decodeImpl(arrayBuffer);
    return Promise.resolve(defaultMusicBuffer(this));
  }
}
MockAudioContext.instances = [];

// Synthetic decoded buffer: sr=100, len=100, silence padding [0,10) and
// [90,100), tone [10,90) -- gives exact, easy-to-check loop bounds.
function defaultMusicBuffer(ctx) {
  const buf = ctx.createBuffer(1, 100, 100);
  const data = buf.getChannelData(0);
  for (let i = 10; i < 90; i++) data[i] = 0.5;
  return buf;
}

function fresh() {
  MockAudioContext.instances.length = 0;
  const audio = createAudio(MockAudioContext);
  return { audio, ctx: () => MockAudioContext.instances.at(-1) };
}
function mark(ctxInstance) { return ctxInstance._registry.length; }
function since(ctxInstance, markIndex) { return ctxInstance._registry.slice(markIndex); }

// The 6 permanent bus nodes are created once, in this fixed order, inside
// enable() (see src/audio/index.js buildGraph); the shared-room nodes
// (send gain, convolver, wet gain) follow them. Safe to call any time after
// enable() even if more nodes were allocated since.
function graphNodes(c) {
  const [destination, master, compressor, droneBus, voiceBus, uiBus, musicBus] = c._registry;
  return { destination, master, compressor, droneBus, voiceBus, uiBus, musicBus };
}

async function waitFor(predicate, maxTicks = 50) {
  for (let i = 0; i < maxTicks; i++) {
    if (predicate()) return true;
    await Promise.resolve();
  }
  return predicate();
}

// Every started source in `slice` must have a scheduled stop or an onended
// handler; simulating end-of-life must leave every node in `slice`
// disconnected (no leaks).
function assertVoiceDisposes(c, baseline) {
  const slice = since(c, baseline);
  assert.ok(slice.length > 0, 'expected at least one node to be created');
  // only MockSource instances (oscillator/bufferSource) have startedAt at
  // all; plain nodes leave it undefined, so use a loose null check.
  for (const n of slice) {
    if (n.startedAt != null) {
      assert.ok(n.stoppedAt !== null || typeof n.onended === 'function',
        `started ${n._kind} must have a scheduled stop or onended cleanup`);
    }
  }
  for (const n of slice) if (n.startedAt != null) n._end();
  for (const n of slice) {
    assert.strictEqual(n.disconnected, true, `${n._kind} #${n._id} leaked (never disconnected)`);
  }
}

function withMockFetch(impl) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  return () => { globalThis.fetch = real; };
}
const okFetchImpl = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

// ---------------------------------------------------------------------
// autoplay-safety
// ---------------------------------------------------------------------

test('no AudioContext is constructed before enable()', () => {
  let constructed = 0;
  class CountingAC extends MockAudioContext {
    constructor() { super(); constructed++; }
  }
  const audio = createAudio(CountingAC);
  audio.ui('tick');
  audio.motif('shard');
  audio.drone.start();
  audio.drone.stop();
  audio.drone.intensity(0.5);
  audio.music.start();
  audio.music.credits();
  audio.music.stop();
  audio.music.act(2);
  assert.strictEqual(constructed, 0, 'no call before enable() should construct a context');
  audio.enable();
  assert.strictEqual(constructed, 1);
});

test('ui/motif/drone/music calls before enable() never throw and stay inert', () => {
  const { audio } = fresh();
  assert.doesNotThrow(() => {
    for (const k of ['tick', 'knock', 'slide', 'deny', 'confirm', 'flip', 'nonsense']) audio.ui(k);
    for (const k of ['shard', 'unlock', 'hint', 'chest', 'dare', 'yield', 'nonsense']) audio.motif(k);
    audio.drone.start();
    audio.drone.stop();
    audio.drone.intensity(0.7);
    audio.music.start();
    audio.music.credits();
    audio.music.stop();
    audio.music.act(2);
    audio.music.act(3);
  });
  assert.strictEqual(audio.music.ready, false);
});

// ---------------------------------------------------------------------
// node lifecycle: fresh allocation, scheduled cleanup, no leaks
// ---------------------------------------------------------------------

test('ui() allocates fresh nodes per call and fully disposes them across 50 calls', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  const baseline = mark(c);
  for (let i = 0; i < 50; i++) {
    const before = c._registry.length;
    audio.ui('tick');
    assert.ok(c._registry.length > before, `call ${i} should allocate fresh nodes`);
  }
  assertVoiceDisposes(c, baseline);
});

test('every ui kind allocates, schedules cleanup, and fully disposes', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  for (const kind of ['tick', 'knock', 'slide', 'deny', 'confirm', 'flip']) {
    const baseline = mark(c);
    audio.ui(kind);
    assertVoiceDisposes(c, baseline);
  }
});

test('every motif kind (incl. dare/yield) allocates, schedules cleanup, and fully disposes', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  audio.drone.start(); // exercise chest's drone-bloom path too
  const c = ctx();
  for (const kind of ['shard', 'hint', 'unlock', 'chest', 'dare', 'yield']) {
    const baseline = mark(c);
    audio.motif(kind);
    assertVoiceDisposes(c, baseline);
  }
});

// ---------------------------------------------------------------------
// mute
// ---------------------------------------------------------------------

test('setMuted(true) ramps master gain to 0, false restores to 1', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const { master } = graphNodes(ctx());
  audio.setMuted(true);
  assert.strictEqual(audio.muted, true);
  assert.strictEqual(master.gain.value, 0);
  audio.setMuted(false);
  assert.strictEqual(audio.muted, false);
  assert.strictEqual(master.gain.value, 1);
});

test('setMuted(true) before enable() applies once the graph is built', () => {
  const { audio, ctx } = fresh();
  audio.setMuted(true);
  assert.strictEqual(audio.muted, true); // state setters work pre-enable
  audio.enable();
  const { master } = graphNodes(ctx());
  assert.strictEqual(master.gain.value, 0);
});

// ---------------------------------------------------------------------
// drone
// ---------------------------------------------------------------------

test('drone.start()/stop() are idempotent (no double-allocate, no throw)', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  audio.drone.start();
  const after1 = c._registry.length;
  audio.drone.start();
  assert.strictEqual(c._registry.length, after1, 'double start must not double-allocate');
  assert.doesNotThrow(() => audio.drone.stop());
  assert.doesNotThrow(() => audio.drone.stop());
});

test('clamp01 clamps to [0,1] for a range of inputs', () => {
  const cases = [
    [-5, 0], [-0.001, 0], [0, 0], [0.5, 0.5], [1, 1],
    [1.2, 1], [5, 1], [NaN, 0], [undefined, 0], ['x', 0],
  ];
  for (const [input, expected] of cases) {
    assert.strictEqual(clamp01(input), expected, `clamp01(${input}) should be ${expected}`);
  }
});

test('drone.intensity() clamps at the graph level and never throws on bad input', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  const before = mark(c);
  audio.drone.start();
  const droneNodes = since(c, before);
  const bandpass = droneNodes.find((n) => n._kind === 'biquad' && n.type === 'bandpass');
  assert.ok(bandpass, 'expected to find the drone tone bandpass filter');

  assert.doesNotThrow(() => audio.drone.intensity(5));
  assert.ok(bandpass.frequency.value <= 400 + 1e-6, `expected clamped freq <=400, got ${bandpass.frequency.value}`);

  assert.doesNotThrow(() => audio.drone.intensity(-5));
  assert.ok(bandpass.frequency.value >= 220 - 1e-6, `expected clamped freq >=220, got ${bandpass.frequency.value}`);

  assert.doesNotThrow(() => audio.drone.intensity(NaN));
  assert.ok(bandpass.frequency.value >= 220 - 1e-6);
});

// ---------------------------------------------------------------------
// master chain topology
// ---------------------------------------------------------------------

test('master chain: voices -> per-bus gains -> compressor -> master -> destination', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  const { destination, master, compressor, droneBus, voiceBus, uiBus, musicBus } = graphNodes(c);
  assert.strictEqual(master._kind, 'gain');
  assert.strictEqual(compressor._kind, 'compressor');
  assert.ok(master.connections.includes(destination));
  assert.ok(compressor.connections.includes(master));
  for (const bus of [droneBus, voiceBus, uiBus, musicBus]) {
    assert.strictEqual(bus._kind, 'gain');
    assert.ok(bus.connections.includes(compressor), 'each per-bus gain should feed the compressor');
  }
});

test('shared room: one convolver, dark decaying ~0.9s IR, ui+voice sends, subtle wet return', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  const { compressor, droneBus, voiceBus, uiBus, musicBus } = graphNodes(c);
  const convolvers = c._registry.filter((n) => n._kind === 'convolver');
  assert.strictEqual(convolvers.length, 1, 'exactly one shared room');
  const room = convolvers[0];
  assert.ok(room.buffer, 'room must hold a synthesized IR');
  const irSec = room.buffer.length / room.buffer.sampleRate;
  assert.ok(irSec >= 0.7 && irSec <= 1.2, `IR ${irSec}s outside the small-hall range`);
  const d = room.buffer.getChannelData(0);
  const tenth = Math.floor(d.length / 10);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < tenth; i++) {
    head += d[i] * d[i];
    tail += d[d.length - tenth + i] * d[d.length - tenth + i];
  }
  assert.ok(tail < head / 100, 'IR must decay by >= 20 dB across its length');
  const send = c._registry.find((n) => n._kind === 'gain' && n.connections.includes(room));
  assert.ok(send, 'a send gain feeds the convolver');
  assert.ok(uiBus.connections.includes(send), 'uiBus sends to the room');
  assert.ok(voiceBus.connections.includes(send), 'voiceBus sends to the room');
  assert.ok(!musicBus.connections.includes(send), 'music (recordings) must not send');
  assert.ok(!droneBus.connections.includes(send), 'the drone bed must not send');
  const wet = room.connections.find((n) => n._kind === 'gain');
  assert.ok(wet && wet.connections.includes(compressor), 'wet return joins the mix at the compressor');
  assert.ok(wet.gain.value <= 0.85, `wet return ${wet.gain.value} too hot: the room is felt, not heard`);
});

test("motif('chest') schedules a finale tail of at least 3 seconds", () => {
  const { audio, ctx } = fresh();
  audio.enable();
  audio.drone.start();
  const c = ctx();
  const t0 = c.currentTime;
  const before = mark(c);
  audio.motif('chest');
  const stops = since(c, before).map((n) => n.stoppedAt).filter((v) => v !== null && v !== undefined);
  assert.ok(stops.length > 0);
  const longest = Math.max(...stops);
  assert.ok(longest - t0 >= 3, `expected finale tail >= 3s, got ${longest - t0}`);
});

// ---------------------------------------------------------------------
// music module (addendum): lazy streamed score
// ---------------------------------------------------------------------

test('music: no fetch before enable(), and none until start() is called', () => {
  let calls = 0;
  const restore = withMockFetch(async () => { calls++; return okFetchImpl(); });
  try {
    const { audio } = fresh();
    audio.music.start(); // before enable(): hard no-op
    assert.strictEqual(calls, 0);
    audio.enable();
    assert.strictEqual(calls, 0, 'enable() alone must not fetch');
    audio.music.start();
    assert.strictEqual(calls, 1, 'start() after enable() should fetch exactly once');
  } finally {
    restore();
  }
});

test('findLoopBounds/bakeSeamlessLoop trim silence and produce valid loop points', () => {
  const c = new MockAudioContext();
  const buffer = defaultMusicBuffer(c); // sr=100, len=100, tone in [10,90)
  const { startSample, endSample } = findLoopBounds(buffer);
  assert.strictEqual(startSample, 10);
  assert.strictEqual(endSample, 89);

  const { loopStart, loopEnd } = bakeSeamlessLoop(buffer, startSample, endSample, 0.1);
  assert.ok(loopEnd > loopStart, 'loopEnd must be after loopStart');
  assert.ok(loopStart >= 0 && loopEnd <= buffer.length / buffer.sampleRate);
  // loopStart sits AFTER the baked head segment (start + crossfade), so the
  // wrap is sample-continuous instead of double-playing the head material
  const cfSamples = Math.floor(0.1 * buffer.sampleRate);
  assert.strictEqual(loopStart, (startSample + cfSamples) / buffer.sampleRate);
  assert.strictEqual(loopEnd, endSample / buffer.sampleRate);
});

test('bakeSeamlessLoop actually blends tail samples toward the head (equal-power, not a no-op)', () => {
  const c = new MockAudioContext();
  const buffer = defaultMusicBuffer(c);
  const data = buffer.getChannelData(0);
  const before = data[84]; // midpoint of a 10-sample crossfade ending at sample 89
  bakeSeamlessLoop(buffer, 10, 89, 0.1);
  const after = data[84];
  assert.notStrictEqual(after, before, 'crossfade window should modify the tail samples');
  assert.ok(Math.abs(after - 0.5 * Math.SQRT2) < 1e-6, `expected equal-power midpoint blend, got ${after}`);
});

test('prepareSeamlessLoop runs end-to-end without throwing', () => {
  const c = new MockAudioContext();
  assert.doesNotThrow(() => prepareSeamlessLoop(defaultMusicBuffer(c)));
});

test('music.start(): drone crossfades out once the stream is ready', async () => {
  const restore = withMockFetch(okFetchImpl);
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    const before = mark(c);
    audio.drone.start();
    const droneNodes = since(c, before);
    const droneBus = graphNodes(c).droneBus;
    const droneOut = droneNodes.find((n) => n._kind === 'gain' && n.connections.includes(droneBus));
    assert.ok(droneOut, 'expected to find the drone output gain');

    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true), 'music should become ready');

    const last = droneOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(last, 'expected a setTargetAtTime automation on the drone output once music took over');
    assert.ok(Math.abs(last[1] - 0) < 1e-6, `expected drone to crossfade toward 0, got target ${last[1]}`);
  } finally {
    restore();
  }
});

test('music.start(): the playing source has native loop points set (loopEnd > loopStart)', async () => {
  const restore = withMockFetch(okFetchImpl);
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    const before = mark(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    const src = since(c, before).find((n) => n._kind === 'bufferSource' && n.loop === true);
    assert.ok(src, 'expected a looping bufferSource for the gameplay music');
    assert.ok(src.loopEnd > src.loopStart, 'loopEnd must be greater than loopStart');
    assert.ok(src.loopStart >= 0);
  } finally {
    restore();
  }
});

test('music.stop(): fades music out and restores the drone gain', async () => {
  const restore = withMockFetch(okFetchImpl);
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    const beforeDrone = mark(c);
    audio.drone.start();
    const droneBus = graphNodes(c).droneBus;
    const droneOut = since(c, beforeDrone).find((n) => n._kind === 'gain' && n.connections.includes(droneBus));

    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    let last = droneOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(Math.abs(last[1] - 0) < 1e-6, 'drone should be crossfaded down while music plays');

    audio.music.stop();
    last = droneOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(last[1] > 0, `expected drone gain restored above 0, got ${last[1]}`);
  } finally {
    restore();
  }
});

test('meaningful ui (knock) ducks the music bus ~3dB and releases shortly after', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const { musicBus } = graphNodes(ctx());
  audio.ui('knock');
  const calls = musicBus.gain.calls.filter((call) => call[0] === 'target').slice(-2);
  const [duckCall, releaseCall] = calls;
  assert.ok(Math.abs(duckCall[1] - DUCK_GAIN_FACTOR) < 1e-6, `expected duck target ~${DUCK_GAIN_FACTOR}, got ${duckCall[1]}`);
  assert.strictEqual(releaseCall[1], 1, 'expected release back to unity gain');
  assert.ok(releaseCall[2] > duckCall[2], 'release must be scheduled after the duck');
});

test('near-subliminal ui (tick/slide/flip) never ducks the score', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const { musicBus } = graphNodes(ctx());
  for (const kind of ['tick', 'slide', 'flip']) {
    const before = musicBus.gain.calls.length;
    audio.ui(kind);
    assert.strictEqual(musicBus.gain.calls.length, before,
      `${kind} is a felt texture; it must not pump the music bus`);
  }
});

test('motif() ducks the music bus ~3dB and holds longer than a ui() duck', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const { musicBus } = graphNodes(ctx());

  audio.ui('knock');
  const uiCalls = musicBus.gain.calls.filter((call) => call[0] === 'target').slice(-2);
  const uiHold = uiCalls[1][2] - uiCalls[0][2];

  audio.motif('shard');
  const motifCalls = musicBus.gain.calls.filter((call) => call[0] === 'target').slice(-2);
  assert.ok(Math.abs(motifCalls[0][1] - DUCK_GAIN_FACTOR) < 1e-6);
  assert.strictEqual(motifCalls[1][1], 1);
  const motifHold = motifCalls[1][2] - motifCalls[0][2];
  assert.ok(motifHold > uiHold, 'a motif should hold the duck longer than a ui tick');
});

test('music.credits(): fades gameplay out immediately and switches to the credits loop', async () => {
  const restore = withMockFetch(okFetchImpl);
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();

    const beforeGameplay = mark(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    const gameplaySrc = since(c, beforeGameplay).find((n) => n._kind === 'bufferSource' && n.loop === true);
    assert.ok(gameplaySrc);
    assert.strictEqual(gameplaySrc.stoppedAt, null, 'gameplay loop should still be running');

    const beforeCredits = mark(c);
    audio.music.credits();
    assert.ok(gameplaySrc.stoppedAt !== null, 'credits() should schedule the gameplay loop to stop right away');

    const gotCredits = await waitFor(() =>
      since(c, beforeCredits).some((n) => n._kind === 'bufferSource' && n.loop === true));
    assert.ok(gotCredits, 'expected a new looping source for the credits track');
    const creditsSrc = since(c, beforeCredits).find((n) => n._kind === 'bufferSource' && n.loop === true);
    assert.notStrictEqual(creditsSrc, gameplaySrc);
    assert.ok(creditsSrc.loopEnd > creditsSrc.loopStart);
  } finally {
    restore();
  }
});

test('music: fetch/decode failure falls back silently and retries on the next start()', async () => {
  let calls = 0;
  let shouldFail = true;
  const restore = withMockFetch(async () => {
    calls++;
    if (shouldFail) throw new Error('network down');
    return okFetchImpl();
  });
  try {
    const { audio } = fresh();
    audio.enable();
    assert.doesNotThrow(() => audio.music.start());
    await waitFor(() => calls >= 1);
    for (let i = 0; i < 10; i++) await Promise.resolve(); // let the rejection settle
    assert.strictEqual(audio.music.ready, false, 'a failed decode must not report ready');

    shouldFail = false;
    assert.doesNotThrow(() => audio.music.start()); // documented retry-on-next-call
    assert.ok(await waitFor(() => audio.music.ready === true));
    assert.strictEqual(calls, 2, 'the retry should re-fetch rather than reuse a permanently-failed state');
  } finally {
    restore();
  }
});

test('music: an HTTP-level failure (res.ok === false) is also swallowed', async () => {
  const restore = withMockFetch(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(8) }));
  try {
    const { audio } = fresh();
    audio.enable();
    assert.doesNotThrow(() => audio.music.start());
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.strictEqual(audio.music.ready, false);
  } finally {
    restore();
  }
});

test('music: a decodeAudioData rejection is also swallowed', async () => {
  const restore = withMockFetch(okFetchImpl);
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    c._decodeImpl = async () => { throw new Error('corrupt mp3'); };
    assert.doesNotThrow(() => audio.music.start());
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.strictEqual(audio.music.ready, false);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------
// music acts (v2 progression score): music.act(n), docs/AUDIO.md addendum
// ---------------------------------------------------------------------

// URL-aware fetch mock: byteLength encodes the track so a per-instance
// decode impl can tag the produced buffer with its source. Tags follow ACT
// NUMBERS under the 2026-08-07 chill-opener order: act 1 plays ./act3.mp3,
// act 2 ./music.mp3, act 3 ./act2.mp3.
const FILE_FOR_ACT = { 1: './act3.mp3', 2: './music.mp3', 3: './act2.mp3', credits: './credits.mp3' };
const ACT_LEN = { [FILE_FOR_ACT[1]]: 8, [FILE_FOR_ACT[2]]: 12, [FILE_FOR_ACT[3]]: 16, [FILE_FOR_ACT.credits]: 20 };
const ACT_TAG = { 8: 'act1', 12: 'act2', 16: 'act3', 20: 'credits' };
function actFetchImpl(urls, failFor = () => false) {
  return async (url) => {
    urls.push(url);
    if (failFor(url)) throw new Error('network down: ' + url);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(ACT_LEN[url] ?? 4) };
  };
}
function tagDecode(c) {
  c._decodeImpl = async (ab) => {
    const buf = defaultMusicBuffer(c);
    buf._tag = ACT_TAG[ab.byteLength] || 'unknown';
    return buf;
  };
}
const loopSources = (c, from = 0) => since(c, from).filter((n) => n._kind === 'bufferSource' && n.loop === true);

test('music.act(): invalid n is a no-op after enable (no fetch, no nodes, no throw)', () => {
  const urls = [];
  const restore = withMockFetch(actFetchImpl(urls));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    const baseline = mark(c);
    assert.doesNotThrow(() => {
      for (const n of [0, 4, -1, 1.5, '2', null, undefined, NaN]) audio.music.act(n);
    });
    assert.strictEqual(urls.length, 0, 'invalid act values must not fetch');
    assert.strictEqual(since(c, baseline).length, 0, 'invalid act values must not allocate');
  } finally {
    restore();
  }
});

test('music.act(): lazy — act2.mp3 unfetched until requested; current act plays until the new buffer is ready', async () => {
  const urls = [];
  const restore = withMockFetch(actFetchImpl(urls));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    assert.deepStrictEqual(urls, [FILE_FOR_ACT[1]], 'start() must fetch only the current act');
    const act1Src = loopSources(c).find((s) => s.buffer && s.buffer._tag === 'act1');
    assert.ok(act1Src, 'act 1 should be looping');
    assert.strictEqual(act1Src.stoppedAt, null);

    const beforeSwitch = mark(c);
    audio.music.act(2);
    assert.deepStrictEqual(urls, [FILE_FOR_ACT[1], FILE_FOR_ACT[2]], 'act(2) lazily fetches its own file');
    assert.strictEqual(loopSources(c, beforeSwitch).length, 0, 'no new source before the decode lands');
    assert.strictEqual(act1Src.stoppedAt, null, 'act 1 must keep playing while act 2 decodes');

    assert.ok(await waitFor(() => loopSources(c, beforeSwitch).length === 1), 'act 2 source should appear');
    const act2Src = loopSources(c, beforeSwitch)[0];
    assert.strictEqual(act2Src.buffer._tag, 'act2');
    assert.ok(act2Src.loopEnd > act2Src.loopStart, 'act 2 must body-loop with baked seam points');
    assert.ok(act2Src.startedAt !== null);
    assert.ok(act1Src.stoppedAt !== null, 'the old act is scheduled to stop after the crossfade');
    assert.ok(act1Src.stoppedAt >= ACT_CROSSFADE_SECONDS, `old act stops at ${act1Src.stoppedAt}, before the fade ends`);
    assert.strictEqual(audio.music.ready, true, 'ready now reflects act 2');
  } finally {
    restore();
  }
});

test('music.act(): equal-power ~2.5s crossfade scheduling shape on both gains', async () => {
  const restore = withMockFetch(actFetchImpl([]));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    const act1Src = loopSources(c).find((s) => s.buffer._tag === 'act1');
    const act1Gain = act1Src.connections[0];
    assert.strictEqual(act1Gain._kind, 'gain');

    const beforeSwitch = mark(c);
    audio.music.act(2);
    assert.ok(await waitFor(() => loopSources(c, beforeSwitch).length === 1));
    const act2Src = loopSources(c, beforeSwitch)[0];
    const act2Gain = act2Src.connections[0];

    const inCall = act2Gain.gain.calls.find((call) => call[0] === 'curve');
    const outCall = act1Gain.gain.calls.filter((call) => call[0] === 'curve').at(-1);
    assert.ok(inCall, 'incoming act gain must use a curve automation');
    assert.ok(outCall, 'outgoing act gain must use a curve automation');
    assert.strictEqual(inCall[3], ACT_CROSSFADE_SECONDS);
    assert.strictEqual(outCall[3], ACT_CROSSFADE_SECONDS);
    assert.strictEqual(inCall[2], outCall[2], 'both curves start at the same time');
    const [rise, fall] = [inCall[1], outCall[1]];
    assert.strictEqual(rise.length, fall.length);
    assert.strictEqual(rise[0], 0, 'incoming starts silent');
    const inLevel = rise[rise.length - 1];
    const outLevel = fall[0];
    assert.ok(inLevel > 0 && outLevel > 0);
    assert.ok(Math.abs(fall[fall.length - 1]) < 1e-6, 'outgoing ends silent');
    for (let i = 0; i < rise.length; i++) {
      const power = (rise[i] / inLevel) ** 2 + (fall[i] / outLevel) ** 2;
      assert.ok(Math.abs(power - 1) < 1e-6, `curves not equal-power at point ${i}: ${power}`);
    }
    // the outgoing gain's curve must come after a cancel of its fade-in automation
    const outCalls = act1Gain.gain.calls;
    const cancelIdx = outCalls.findIndex((call) => call[0] === 'cancel');
    assert.ok(cancelIdx !== -1 && cancelIdx < outCalls.indexOf(outCall), 'cancel precedes the fade-out curve');
  } finally {
    restore();
  }
});

test('music.act(): idempotent — same act and duplicate switches never double-fetch or double-allocate', async () => {
  const urls = [];
  const restore = withMockFetch(actFetchImpl(urls));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));

    const baseline = mark(c);
    audio.music.act(1); // already the current act
    assert.strictEqual(since(c, baseline).length, 0);
    assert.deepStrictEqual(urls, [FILE_FOR_ACT[1]]);

    audio.music.act(2);
    audio.music.act(2); // duplicate while the fetch is in flight
    assert.strictEqual(urls.filter((u) => u === FILE_FOR_ACT[2]).length, 1, 'one fetch per act');
    assert.ok(await waitFor(() => loopSources(c, baseline).length === 1));

    const afterSwitch = mark(c);
    audio.music.act(2); // now the current act: full no-op
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.strictEqual(loopSources(c, afterSwitch).length, 0, 'repeat act(2) must not re-crossfade');
    assert.strictEqual(urls.filter((u) => u === FILE_FOR_ACT[2]).length, 1);
  } finally {
    restore();
  }
});

test('music.act(): fetch failure stays on the current act silently and retries on the next act() call', async () => {
  const urls = [];
  let act2Down = true;
  const restore = withMockFetch(actFetchImpl(urls, (url) => act2Down && url === FILE_FOR_ACT[2]));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    const act1Src = loopSources(c).find((s) => s.buffer._tag === 'act1');

    assert.doesNotThrow(() => audio.music.act(2));
    for (let i = 0; i < 10; i++) await Promise.resolve(); // let the rejection settle
    assert.strictEqual(act1Src.stoppedAt, null, 'act 1 must keep playing through the failure');
    assert.strictEqual(audio.music.ready, true, 'ready still reflects the (unchanged) current act');

    act2Down = false;
    const beforeRetry = mark(c);
    assert.doesNotThrow(() => audio.music.act(2)); // documented retry-on-next-call
    assert.strictEqual(urls.filter((u) => u === FILE_FOR_ACT[2]).length, 2, 'the retry re-fetches');
    assert.ok(await waitFor(() => loopSources(c, beforeRetry).length === 1), 'retry completes the switch');
    assert.strictEqual(loopSources(c, beforeRetry)[0].buffer._tag, 'act2');
  } finally {
    restore();
  }
});

test('music.credits() fades whatever act is live; start() resumes the CURRENT act, not act 1', async () => {
  const urls = [];
  const restore = withMockFetch(actFetchImpl(urls));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    const m0 = mark(c);
    audio.music.act(2);
    assert.ok(await waitFor(() => loopSources(c, m0).length === 1));
    const act2Src = loopSources(c, m0)[0];

    const m1 = mark(c);
    audio.music.credits();
    assert.ok(act2Src.stoppedAt !== null, 'credits() must fade the live act 2 out');
    assert.ok(await waitFor(() => loopSources(c, m1).some((s) => s.buffer._tag === 'credits')));
    const creditsSrc = loopSources(c, m1).find((s) => s.buffer._tag === 'credits');

    const m2 = mark(c);
    audio.music.start(); // e.g. credits screen skipped back into the game
    assert.ok(creditsSrc.stoppedAt !== null, 'start() must fade the credits loop out');
    assert.ok(await waitFor(() => loopSources(c, m2).length === 1));
    assert.strictEqual(loopSources(c, m2)[0].buffer._tag, 'act2', 'start() resumes act 2, the current act');
    assert.strictEqual(urls.filter((u) => u === FILE_FOR_ACT[2]).length, 1, 'the cached act 2 buffer is reused');
  } finally {
    restore();
  }
});

test('music.act() while stopped or mid-stop keeps the selection; start() resumes it (save-progress path)', async () => {
  const urls = [];
  const restore = withMockFetch(actFetchImpl(urls));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    audio.music.act(3); // fetch in flight...
    audio.music.stop(); // ...and the player backs out mid-switch
    const m0 = mark(c);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.strictEqual(loopSources(c, m0).length, 0, 'stopped mode: the landed act must not start playing');
    audio.music.start();
    assert.ok(await waitFor(() => loopSources(c, m0).length === 1));
    assert.strictEqual(loopSources(c, m0)[0].buffer._tag, 'act3', 'start() resumes the selected act');
  } finally {
    restore();
  }
});

test('music.act() before start() (load from save): only the saved act is fetched, drone hands off to it', async () => {
  const urls = [];
  const restore = withMockFetch(actFetchImpl(urls));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    const beforeDrone = mark(c);
    audio.drone.start();
    const droneBus = graphNodes(c).droneBus;
    const droneOut = since(c, beforeDrone).find((n) => n._kind === 'gain' && n.connections.includes(droneBus));

    const m0 = mark(c); // the drone's own noise loop is a looping source too
    audio.music.act(3);
    assert.strictEqual(audio.music.ready, false, 'ready is false until the selected act has a buffer');
    audio.music.start();
    assert.ok(await waitFor(() => loopSources(c, m0).length === 1), 'the saved act starts once decoded');
    assert.deepStrictEqual(urls, [FILE_FOR_ACT[3]], "act 1's file must NOT be fetched when resuming at act 3");
    assert.strictEqual(loopSources(c, m0)[0].buffer._tag, 'act3');
    assert.strictEqual(audio.music.ready, true);
    const last = droneOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(last && Math.abs(last[1] - 0) < 1e-6, 'the drone crossfades under act 3 exactly as it does under act 1');
  } finally {
    restore();
  }
});

test('music.act(): a switch issued while the context is suspended (iOS) still schedules and survives resume', async () => {
  const restore = withMockFetch(actFetchImpl([]));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    c.state = 'suspended'; // backgrounded tab: currentTime freezes, calls must not be lost
    const m0 = mark(c);
    audio.music.act(2);
    assert.ok(await waitFor(() => loopSources(c, m0).length === 1), 'the switch lands while suspended');
    const act2Src = loopSources(c, m0)[0];
    assert.strictEqual(act2Src.buffer._tag, 'act2');
    assert.ok(act2Src.startedAt !== null, 'source scheduled against the frozen clock');
    await c.resume();
    assert.strictEqual(c.state, 'running');
    assert.strictEqual(audio.music.ready, true);
  } finally {
    restore();
  }
});

// The live first-yield-beat bug (Ramon): the shell persists progress at
// yield beats -> drone.intensity() fired while music owned the floor and
// re-raised the crossfaded-out drone — a saw hum under the score. Music
// ownership now gates every drone raise path.
test('drone stays FULLY silent under music: no re-raise via intensity(), chest bloom, or rebuild', async () => {
  const restore = withMockFetch(okFetchImpl);
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    const beforeDrone = mark(c);
    audio.drone.start();
    const droneBus = graphNodes(c).droneBus;
    const droneOut = since(c, beforeDrone).find((n) => n._kind === 'gain' && n.connections.includes(droneBus));
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    const marker = droneOut.gain.calls.length; // crossfade-out already scheduled

    audio.drone.intensity(0.9); // the shell persisting progress mid-music
    audio.motif('chest'); // the finale bloom path
    const raised = droneOut.gain.calls.slice(marker)
      .filter((call) => call[0] !== 'cancel' && call[1] > 0);
    assert.strictEqual(raised.length, 0,
      `drone gain re-raised under music: ${JSON.stringify(raised)}`);

    // a drone rebuilt mid-music must come up silent
    audio.drone.stop();
    const beforeRestart = mark(c);
    audio.drone.start();
    const newOut = since(c, beforeRestart).find((n) => n._kind === 'gain' && n.connections.includes(droneBus));
    const intro = newOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(intro && Math.abs(intro[1]) < 1e-9, `mid-music drone rebuild must target 0, got ${intro && intro[1]}`);

    // when music stops, the floor returns at the intensity persisted mid-music
    audio.music.stop();
    const restored = newOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(restored[1] > 0.25, `restore must use the stored intensity 0.9, got gain ${restored[1]}`);
  } finally {
    restore();
  }
});

test('first music entry is the 4s exhale (drone eased gently); resumes use the 2s handoff', async () => {
  const restore = withMockFetch(actFetchImpl([]));
  try {
    const { audio, ctx } = fresh();
    audio.enable();
    const c = ctx();
    tagDecode(c);
    const beforeDrone = mark(c);
    audio.drone.start();
    const droneBus = graphNodes(c).droneBus;
    const droneOut = since(c, beforeDrone).find((n) => n._kind === 'gain' && n.connections.includes(droneBus));

    const m0 = mark(c);
    audio.music.start();
    assert.ok(await waitFor(() => audio.music.ready === true));
    const firstGain = loopSources(c, m0)[0].connections[0];
    let fade = firstGain.gain.calls.find((call) => call[0] === 'target');
    assert.ok(fade[3] >= 0.9, `first-entry fade tc ${fade[3]} — expected ~1.0 (4 s exhale)`);
    const ease = droneOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(Math.abs(ease[1]) < 1e-6, 'drone eases to 0 under the first entry');
    assert.ok(ease[2] >= 1.2, `gentle entry holds the drone until t=${ease[2]} — expected >= 1.2`);
    assert.ok(ease[3] >= 1.0, `gentle drone ease tc ${ease[3]} — expected >= 1.0`);

    audio.music.stop();
    const m1 = mark(c);
    audio.music.start(); // resume from cache: the one-time exhale is spent
    assert.ok(await waitFor(() => loopSources(c, m1).length === 1));
    fade = loopSources(c, m1)[0].connections[0].gain.calls.find((call) => call[0] === 'target');
    assert.ok(Math.abs(fade[3] - 0.5) < 0.01, `resume fade tc ${fade[3]} — expected 0.5 (2 s handoff)`);
    const ease2 = droneOut.gain.calls.filter((call) => call[0] === 'target').at(-1);
    assert.ok(ease2[2] <= 0.8 && ease2[3] <= 0.9, 'resume uses the standard drone ease, not the gentle one');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------
// measured invariants (tuned via artifacts/wip-soundfeel/render.mjs; the
// ground-truth numbers live in artifacts/wip-soundfeel/metrics.json)
// ---------------------------------------------------------------------

// Every ui kind's scheduled envelope must stay in the fast-answer family:
// the longest gain ramp ends 60-180 ms after onset (measured -35 dB duration
// 74-97 ms) and every source stops within 300 ms.
test('ui kinds schedule 60-180ms envelopes and stop within 300ms', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  for (const kind of ['tick', 'knock', 'slide', 'deny', 'confirm', 'flip']) {
    const baseline = mark(c);
    audio.ui(kind);
    const slice = since(c, baseline);
    const rampEnds = slice
      .filter((n) => n._kind === 'gain')
      .flatMap((n) => n.gain.calls.filter((call) => call[0] === 'exp').map((call) => call[2]));
    assert.ok(rampEnds.length > 0, `${kind}: expected decay ramps`);
    const last = Math.max(...rampEnds);
    assert.ok(last >= 0.06 && last <= 0.18, `${kind}: ramp end ${last} outside [0.06,0.18]`);
    for (const n of slice) {
      if (n.startedAt != null && n.stoppedAt != null) {
        assert.ok(n.stoppedAt <= 0.3, `${kind}: source stops at ${n.stoppedAt} > 0.3`);
      }
    }
    for (const n of slice) if (n.startedAt != null) n._end();
  }
});

// Nothing buzzes, ever (OW-SOUNDFEEL): no ui voice may use a square or
// sawtooth oscillator. deny is a LOW felted thud + brief sub drop — one sine
// falling below 60 Hz, all filtering dark (<= 900 Hz), never on a pentatonic
// degree; yield's two plucks must ring a falling minor third C4 -> A3 after
// loop-delay compensation (quantum + biquad lag).
test('nothing buzzes; deny is a felted thud + sub drop; yield plucks are tuned C4 -> A3', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();

  for (const kind of ['tick', 'knock', 'slide', 'deny', 'confirm', 'flip']) {
    const b = mark(c);
    audio.ui(kind);
    const slice = since(c, b);
    for (const o of slice.filter((n) => n._kind === 'oscillator')) {
      assert.strictEqual(o.type, 'sine', `${kind}: oscillator type ${o.type} — nothing buzzes, ever`);
    }
    for (const n of slice) if (n.startedAt != null) n._end();
  }

  let baseline = mark(c);
  audio.ui('deny');
  const denySlice = since(c, baseline);
  const denyOscs = denySlice.filter((n) => n._kind === 'oscillator');
  assert.strictEqual(denyOscs.length, 1, 'deny carries exactly one sub-drop oscillator');
  const sub = denyOscs[0];
  assert.strictEqual(sub.type, 'sine');
  assert.ok(sub.frequency.value < 60, `sub drop must end below 60 Hz, got ${sub.frequency.value}`);
  for (const p of PENT) {
    assert.ok(Math.abs(sub.frequency.value - p) / p > 0.03,
      `deny sub at ${sub.frequency.value} Hz sits on a musical degree (${p})`);
  }
  for (const f of denySlice.filter((n) => n._kind === 'biquad')) {
    assert.ok(f.frequency.value <= 900, `deny filter at ${f.frequency.value} Hz is not dark`);
  }
  for (const n of denySlice) if (n.startedAt != null) n._end();

  baseline = mark(c);
  audio.motif('yield');
  const yieldSlice = since(c, baseline);
  const delays = yieldSlice.filter((n) => n._kind === 'delay');
  assert.strictEqual(delays.length, 2, 'yield should allocate two Karplus-Strong loops');
  const quantum = 128 / c.sampleRate;
  const rung = delays.map((d) => {
    const damping = d.connections[0];
    assert.strictEqual(damping._kind, 'biquad', 'delay must feed its damping lowpass');
    return 1 / (d.delayTime.value + quantum + 1 / (Math.PI * damping.frequency.value));
  });
  const expected = [PENT[6], PENT[5]]; // C4 261.63, A3 220
  for (let i = 0; i < 2; i++) {
    const cents = Math.abs(rung[i] - expected[i]) / expected[i];
    assert.ok(cents < 0.015,
      `yield pluck ${i} rings at ${rung[i].toFixed(1)} Hz, expected ${expected[i]} (off ${(cents * 100).toFixed(1)}%)`);
  }
  assert.ok(rung[0] > rung[1], 'yield must FALL (C4 down to A3)');
  for (const n of yieldSlice) if (n.startedAt != null) n._end();
});

// The skin drum's weight is its 160->55 Hz fall; in the rendered world the
// tail sits under the room's echo, so the sweep is asserted here, on the
// scheduled automation, deterministically.
test('drum voices sweep 160->55 Hz (yield carries real skin weight)', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const c = ctx();
  const baseline = mark(c);
  audio.motif('yield');
  const oscs = since(c, baseline).filter((n) => n._kind === 'oscillator' && n.type === 'sine');
  const drum = oscs.find((o) => o.frequency.calls.some((call) => call[0] === 'set' && call[1] === 160));
  assert.ok(drum, 'yield drum oscillator starts at 160 Hz');
  assert.ok(drum.frequency.calls.some((call) => call[0] === 'exp' && call[1] === 55),
    'drum frequency must fall exponentially to 55 Hz');
  for (const n of since(c, baseline)) if (n.startedAt != null) n._end();
});

// Duck timing law (measured: -3 dB within 50 ms, release lands back within
// 0.5 dB 0.35-0.85 s after the hold ends; holds 0.15 s ui / 0.8 s motif).
test('duck reaches fast, holds by caller kind, releases in 0.35-0.85s', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const { musicBus } = graphNodes(ctx());

  audio.ui('knock');
  let [down, up] = musicBus.gain.calls.filter((call) => call[0] === 'target').slice(-2);
  assert.ok(down[3] <= 0.02, `duck attack tc ${down[3]} too slow for -3dB@50ms`);
  assert.ok(Math.abs((up[2] - down[2]) - 0.15) < 0.03, `ui hold ${up[2] - down[2]} != ~0.15s`);
  let release = 1.65 * up[3]; // setTargetAtTime: within 0.5 dB of unity at ~1.65*tc
  assert.ok(release >= 0.35 && release <= 0.85, `ui duck release ${release}s outside 0.35-0.85`);

  audio.motif('shard');
  [down, up] = musicBus.gain.calls.filter((call) => call[0] === 'target').slice(-2);
  assert.ok(Math.abs((up[2] - down[2]) - 0.8) < 0.05, `motif hold ${up[2] - down[2]} != ~0.8s`);
  release = 1.65 * up[3];
  assert.ok(release >= 0.35 && release <= 0.85, `motif duck release ${release}s outside 0.35-0.85`);
});

// Build-time seam check against the COMMITTED tracks the player meets first:
// act 1 (./act3.mp3, the chill opener) and act 2 (./music.mp3). Decode via
// afconvert (macOS CoreAudio), run the real loop preparation, and verify the
// wrap the player will hear -- spectral flux at the join must not exceed the
// loop body's 95th percentile, and the join must not step more than 2 dB.
// (act2.mp3 and the act-pair crossfades are covered by the wip-soundfeel
// render harness.)
for (const file of ['act3.mp3', 'music.mp3']) test(`committed ${file} loop seam is inaudible (flux <= p95, |dRMS| <= 2dB)`, (t) => {
  const mp3 = fileURLToPath(new URL('../../' + file, import.meta.url));
  if (!existsSync('/usr/bin/afconvert') || !existsSync(mp3)) {
    return t.skip(`afconvert or ${file} unavailable`);
  }
  const wav = join(tmpdir(), `ow-seam-${process.pid}-${file}.wav`);
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
    assert.ok(fmt && dataOff, 'wav parse failed');
    const int16 = new Int16Array(ab, dataOff, Math.floor(dataLen / 2));
    const frames = Math.floor(int16.length / fmt.channels);
    const mono = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let s = 0;
      for (let ch = 0; ch < fmt.channels; ch++) s += int16[i * fmt.channels + ch];
      mono[i] = s / (fmt.channels * 32768);
    }
    const sr = fmt.sampleRate;
    const buffer = { sampleRate: sr, numberOfChannels: 1, length: frames, duration: frames / sr, getChannelData: () => mono };
    const { loopStart, loopEnd } = prepareSeamlessLoop(buffer);
    assert.ok(loopEnd - loopStart > 60, 'loop region implausibly short');

    // the wrap as heard: 4 s of tail (baked) then 4 s from loopStart
    const eS = Math.round(loopEnd * sr), s0 = Math.round(loopStart * sr);
    const span = Math.round(4 * sr);
    const seamSeq = new Float32Array(2 * span);
    seamSeq.set(mono.subarray(eS - span, eS), 0);
    seamSeq.set(mono.subarray(s0, s0 + span), span);

    const N = 2048, HOP = 512;
    const hann = new Float64Array(N);
    for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    const fft = (re, im) => {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const wr = Math.cos(-2 * Math.PI / len), wi = Math.sin(-2 * Math.PI / len);
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
    };
    const fluxTrack = (x) => {
      const re = new Float64Array(N), im = new Float64Array(N);
      let prev = null;
      const out = [];
      for (let p = 0; p + N <= x.length; p += HOP) {
        for (let i = 0; i < N; i++) { re[i] = x[p + i] * hann[i]; im[i] = 0; }
        fft(re, im);
        const mags = new Float64Array(N / 2);
        for (let k = 0; k < N / 2; k++) mags[k] = Math.hypot(re[k], im[k]);
        if (prev) {
          let fl = 0;
          for (let k = 0; k < N / 2; k++) fl += Math.max(0, mags[k] - prev[k]);
          out.push({ t: (p + N / 2) / sr, flux: fl });
        }
        prev = mags;
      }
      return out;
    };

    const refFlux = fluxTrack(mono.subarray(s0, s0 + Math.min(Math.round(60 * sr), eS - s0)))
      .map((e) => e.flux).sort((a, b) => a - b);
    const p95 = refFlux[Math.floor(refFlux.length * 0.95)];
    const seamFlux = fluxTrack(seamSeq);
    const joinMax = Math.max(...seamFlux.filter((e) => Math.abs(e.t - 4) <= 0.1).map((e) => e.flux));
    assert.ok(joinMax <= p95, `seam flux ${joinMax.toFixed(1)} exceeds loop-body p95 ${p95.toFixed(1)}`);

    const rms = (x, a, b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += x[i] * x[i];
      return 10 * Math.log10(Math.max(s / (b - a), 1e-24));
    };
    const q = Math.round(0.25 * sr);
    const delta = rms(seamSeq, span, span + q) - rms(seamSeq, span - q, span);
    assert.ok(Math.abs(delta) <= 2, `RMS steps ${delta.toFixed(2)} dB at the loop join`);
  } finally {
    rmSync(wav, { force: true });
  }
});
