// Unit tests for src/audio/** against docs/AUDIO.md (frozen API + music
// addendum). Uses a hand-written mock AudioContext (records node creation,
// connect/disconnect, start/stop, and AudioParam automation) so the whole
// suite runs without a real browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../../src/audio/index.js';
import { clamp01 } from '../../src/audio/voices.js';
import { findLoopBounds, bakeSeamlessLoop, prepareSeamlessLoop, DUCK_GAIN_FACTOR } from '../../src/audio/music.js';

// ---------------------------------------------------------------------
// minimal mock AudioContext
// ---------------------------------------------------------------------

class MockAudioParam {
  constructor(value = 1) { this.value = value; this.calls = []; }
  setValueAtTime(v, t) { this.value = v; this.calls.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v, t) { this.value = v; this.calls.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { this.value = v; this.calls.push(['exp', v, t]); return this; }
  setTargetAtTime(v, t, tc) { this.value = v; this.calls.push(['target', v, t, tc]); return this; }
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

// The 6 permanent graph nodes are created once, in this fixed order, inside
// enable() (see src/audio/index.js buildGraph). Safe to call any time after
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
  assert.strictEqual(loopStart, startSample / buffer.sampleRate);
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

test('ui() ducks the music bus ~3dB and releases shortly after', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const { musicBus } = graphNodes(ctx());
  audio.ui('tick');
  const calls = musicBus.gain.calls.filter((call) => call[0] === 'target').slice(-2);
  const [duckCall, releaseCall] = calls;
  assert.ok(Math.abs(duckCall[1] - DUCK_GAIN_FACTOR) < 1e-6, `expected duck target ~${DUCK_GAIN_FACTOR}, got ${duckCall[1]}`);
  assert.strictEqual(releaseCall[1], 1, 'expected release back to unity gain');
  assert.ok(releaseCall[2] > duckCall[2], 'release must be scheduled after the duck');
});

test('motif() ducks the music bus ~3dB and holds longer than a ui() duck', () => {
  const { audio, ctx } = fresh();
  audio.enable();
  const { musicBus } = graphNodes(ctx());

  audio.ui('tick');
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
