// The long listen. Read-only page instrumentation only.
//  - taps the finished mix (anything connected to ctx.destination) with an
//    AnalyserNode and logs RMS every 100 ms
//  - records the loop geometry the music module itself installs on its
//    AudioBufferSourceNode (loopStart / loopEnd / when it started)
//  - fires ui + motif events over the music and logs the duck depth/release
//  - runs long enough to cross >= 2 loop boundaries
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import * as H from './harness.mjs';

const INIT = `
(() => {
  const OrigAC = window.AudioContext || window.webkitAudioContext;
  if (!OrigAC) return;
  window.__owSources = [];
  function tap(c) {
    if (c.__owAn) return c.__owAn;
    const an = c.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0;
    c.__owAn = an; return an;
  }
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = origConnect.call(this, dest, ...rest);
    try { if (dest && this.context && dest === this.context.destination) origConnect.call(this, tap(this.context)); } catch (e) {}
    return r;
  };
  const origStart = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    try {
      if (this.loop && this.buffer && this.buffer.duration > 20) {
        window.__owSources.push({
          startedAtCtx: this.context.currentTime, when: a[0] ?? null, offset: a[1] ?? null,
          loopStart: this.loopStart, loopEnd: this.loopEnd,
          bufferDuration: this.buffer.duration, sampleRate: this.buffer.sampleRate,
        });
        // seam geometry, measured straight off the decoded buffer
        const b = this.buffer, sr = b.sampleRate;
        const win = Math.round(0.20 * sr);
        const rmsAt = (startSample) => {
          let s = 0, n = 0;
          for (let c = 0; c < b.numberOfChannels; c++) {
            const d = b.getChannelData(c);
            for (let i = startSample; i < startSample + win && i < d.length; i++) { s += d[i] * d[i]; n++; }
          }
          return Math.sqrt(s / Math.max(1, n));
        };
        const lsS = Math.round(this.loopStart * sr), leS = Math.round(this.loopEnd * sr);
        window.__owSources[window.__owSources.length - 1].seam = {
          preWrapRms: rmsAt(Math.max(0, leS - win)),
          postWrapRms: rmsAt(lsS),
          bodyRms: rmsAt(Math.round((lsS + leS) / 2)),
          firstSampleAfterWrap: b.getChannelData(0)[lsS],
          lastSampleBeforeWrap: b.getChannelData(0)[leS - 1],
        };
      }
    } catch (e) {}
    return origStart.apply(this, a);
  };
  class TappedAC extends OrigAC { constructor(...a) { super(...a); window.__AC = this; tap(this); } }
  window.AudioContext = TappedAC; window.webkitAudioContext = TappedAC;
  window.__owRms = () => {
    const c = window.__AC; if (!c || !c.__owAn) return null;
    const a = c.__owAn, buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let s = 0, peak = 0;
    for (let i = 0; i < buf.length; i++) { s += buf[i] * buf[i]; const v = Math.abs(buf[i]); if (v > peak) peak = v; }
    return { t: +c.currentTime.toFixed(3), rms: Math.sqrt(s / buf.length), peak };
  };
})();
`;

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: H.DESKTOP });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));

await page.goto(H.URL_BASE + '#autotest', { waitUntil: 'domcontentloaded' });
await page.evaluate(
  (s) => localStorage.setItem('oathwood.v1', s),
  H.saveWithOpenedUpTo(6, { muted: false, attempts: { '06-jotunvillur': 10 } })
);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.screen-threshold');

const samples = [];
const marks = [];
let sampling = true;
const t0 = Date.now();
const sampler = (async () => {
  while (sampling) {
    const s = await page.evaluate(() => window.__owRms()).catch(() => null);
    if (s) samples.push(s);
    await new Promise((r) => setTimeout(r, 100));
  }
})();

const mark = async (label) => {
  const t = await page.evaluate(() => (window.__AC ? window.__AC.currentTime : null)).catch(() => null);
  marks.push({ label, t, wall: (Date.now() - t0) / 1000 });
  console.log(`  mark ${label} @ctx ${t}`);
};

await mark('before-gesture');
await page.locator('.screen-threshold button').first().click();   // enable + drone.start + music.start
await mark('gesture');
await page.waitForSelector('.screen-lid');

// stay on the lid while the loop runs
const src = await page.waitForFunction(() => window.__owSources && window.__owSources.length ? window.__owSources[0] : false,
  null, { timeout: 30000, polling: 250 }).then((h) => h.jsonValue());
console.log('loop geometry:', JSON.stringify(src.seam), 'loopStart', src.loopStart, 'loopEnd', src.loopEnd, 'dur', src.bufferDuration);
const loopLen = src.loopEnd - src.loopStart;
const firstWrapAtCtx = src.startedAtCtx + (src.loopEnd - (src.offset ?? 0));
console.log(`loop length ${loopLen.toFixed(2)}s; first wrap ~ctx ${firstWrapAtCtx.toFixed(1)}s; plan: ride to 2 wraps`);

const rideTo = firstWrapAtCtx + 2 * loopLen + 12;
const waitUntilCtx = async (target) => {
  for (;;) {
    const t = await page.evaluate(() => window.__AC.currentTime);
    if (t >= target) return t;
    await new Promise((r) => setTimeout(r, 500));
  }
};

// duck probes over the music, in the clear between wraps. No navigation —
// the AudioContext must survive, so every move is in-page (Escape returns
// to the lid).
await waitUntilCtx(Math.min(firstWrapAtCtx - 40, src.startedAtCtx + 40));
await mark('probe:enter-duel-lock(motif dare)');
await page.locator('.medallion-hit[aria-label^="Lock 6:"]').click();
await page.waitForSelector('.screen-lockroom');
await new Promise((r) => setTimeout(r, 3000));
await mark('probe:answer-dare(ui confirm)');
await page.locator('.dare-card .btn-carved').click();
await new Promise((r) => setTimeout(r, 2000));
await mark('probe:take-hint(motif hint)');
await page.locator('.hint-slot').first().click();
await new Promise((r) => setTimeout(r, 3000));
await mark('probe:ui-tick');
await page.locator('.ow-jotun .slate button').first().click();
await new Promise((r) => setTimeout(r, 2000));
await mark('probe:end');
await page.keyboard.press('Escape');
await page.waitForSelector('.screen-lid');
await page.waitForTimeout(500);

await mark('ride-start');
await waitUntilCtx(rideTo);
await mark('ride-end');

sampling = false;
await sampler;
writeFileSync('artifacts/wip-qplay/music-long.json', JSON.stringify({ src, marks, samples, errs }, null, 0));
console.log('samples', samples.length, 'errors', errs.length);
await browser.close();
