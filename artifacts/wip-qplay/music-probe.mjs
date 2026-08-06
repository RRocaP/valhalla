// Music over time. Read-only instrumentation injected before page scripts:
// every node that connects to ctx.destination is ALSO connected to an
// AnalyserNode, so the tap hears the finished mix (post-compressor, post-master)
// without touching a line of src/audio.
//
//   node music-probe.mjs [seconds]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import * as H from './harness.mjs';

const SECONDS = Number(process.argv[2] || 200);

const INIT = `
(() => {
  const OrigAC = window.AudioContext || window.webkitAudioContext;
  if (!OrigAC) return;
  function tap(ctxObj) {
    if (ctxObj.__owAn) return ctxObj.__owAn;
    const an = ctxObj.createAnalyser();
    an.fftSize = 2048;
    an.smoothingTimeConstant = 0;
    ctxObj.__owAn = an;
    return an;
  }
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = origConnect.call(this, dest, ...rest);
    try {
      if (dest && this.context && dest === this.context.destination) {
        origConnect.call(this, tap(this.context));
      }
    } catch (e) {}
    return r;
  };
  class TappedAC extends OrigAC {
    constructor(...a) { super(...a); window.__AC = this; tap(this); }
  }
  window.AudioContext = TappedAC;
  window.webkitAudioContext = TappedAC;
  window.__owRms = () => {
    const c = window.__AC;
    if (!c || !c.__owAn) return null;
    const a = c.__owAn;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let s = 0, peak = 0;
    for (let i = 0; i < buf.length; i++) { s += buf[i] * buf[i]; const v = Math.abs(buf[i]); if (v > peak) peak = v; }
    return { t: c.currentTime, state: c.state, rms: Math.sqrt(s / buf.length), peak };
  };
})();
`;

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio=false'],
});
const ctx = await browser.newContext({ viewport: H.DESKTOP });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto(H.URL_BASE + '#autotest', { waitUntil: 'domcontentloaded' });
await page.evaluate((s) => localStorage.setItem('oathwood.v1', s), H.saveWithOpenedUpTo(6, { muted: false }));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.screen-threshold');

// the gesture that enables audio + drone + music
await page.locator('.screen-threshold button').first().click();
await page.waitForSelector('.screen-lid');

// loop geometry, straight out of the music module's own decode
const geom = await page.waitForFunction(() => {
  const c = window.__AC;
  if (!c) return false;
  const srcs = c.__owSrc;
  return true;
}, null, { timeout: 8000 }).then(() => page.evaluate(() => ({ state: window.__AC && window.__AC.state })));

const samples = [];
const t0 = Date.now();
let lastLog = 0;
while ((Date.now() - t0) / 1000 < SECONDS) {
  const s = await page.evaluate(() => window.__owRms());
  if (s) samples.push({ wall: (Date.now ? 0 : 0), ...s });
  await new Promise((r) => setTimeout(r, 50));
  const el = Math.floor((Date.now() - t0) / 1000);
  if (el >= lastLog + 20) { lastLog = el; console.log(`  t=${el}s  n=${samples.length}  last rms=${s && s.rms.toFixed(5)} state=${s && s.state}`); }
}

// events over music: fire motifs and log the duck
const events = [];
async function fire(kind, how) {
  const mark = await page.evaluate(() => window.__AC.currentTime);
  const before = [];
  for (let i = 0; i < 8; i++) { before.push(await page.evaluate(() => window.__owRms())); await new Promise((r) => setTimeout(r, 25)); }
  await how();
  const after = [];
  for (let i = 0; i < 60; i++) { after.push(await page.evaluate(() => window.__owRms())); await new Promise((r) => setTimeout(r, 25)); }
  events.push({ kind, mark, before, after });
}
// hint motif (long duck) via the lock room; and a ui deny (short duck)
await H.enterLock(page, 6);
await H.answerDare(page);
await page.waitForTimeout(600);
await fire('motif:hint-armed?', async () => { /* baseline only */ });

writeFileSync('artifacts/wip-qplay/music-samples.json', JSON.stringify({ geom, seconds: SECONDS, samples, events, logs }, null, 0));
console.log('samples:', samples.length, 'state:', geom, 'errors:', logs.length);
await browser.close();
