// OW-CARDLIGHT deterministic gate: does the jarl's FACE read?
//
// Measures mean sRGB luminance over a fixed face box of the graded portrait
// and compares it to the SAME box of the raw source drawn cover-fit at the
// same size. Ratio >= FLOOR is the pass condition (the dare's warm-up must
// END at full exposure, so the final frame is what gets sampled).
//
//   node artifacts/wip-cardlight/measure.mjs [tag]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'x';
mkdirSync('artifacts/wip-cardlight/shots', { recursive: true });

const FLOOR = 0.8;                 // final-frame gate from the brief
const REST_FLOOR = 0.9;            // rest-state exposure floor
// Face box in ARCH-normalised coords (bourj.jpg cover-fit into the arch:
// brow -> chin, temple -> temple). Same box on graded + raw, so the ratio is
// a pure grading measurement independent of arch size.
const FACE = { x0: 0.30, y0: 0.10, x1: 0.70, y1: 0.46 };

const SRC = {
  bourj: 'assets/jarls/bourj.jpg',
  rois: 'assets/jarls/rois.jpg',
};
const dataUri = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;

// Runs inside the page: sample `sel`'s canvas over the face box, then build a
// raw cover-fit reference of the same source at the same size and sample the
// same box.
async function measureCanvas(page, sel, srcUri, FACEBOX) {
  return page.evaluate(async ([selector, uri, F]) => {
    const cv = document.querySelector(selector);
    if (!cv) return { error: 'no canvas ' + selector };
    // dataset.arch is the arch rect inside the canvas in CSS px (the dare
    // card pads the canvas out for its chip band); default = whole canvas.
    const cssW = parseFloat(getComputedStyle(cv).width);
    const cssH = parseFloat(getComputedStyle(cv).height);
    const arch = (cv.dataset.arch || `0,0,${cssW},${cssH}`).split(',').map(Number);
    const [ax, ay, aw, ah] = arch;
    const sx = cv.width / cssW;
    const sy = cv.height / cssH;

    const box = (bx, by, bw, bh) => ({
      x: Math.round(bx + bw * F.x0), y: Math.round(by + bh * F.y0),
      w: Math.round(bw * (F.x1 - F.x0)), h: Math.round(bh * (F.y1 - F.y0)),
    });

    const meanOf = (ctx, b) => {
      const d = ctx.getImageData(b.x, b.y, b.w, b.h).data;
      let lum = 0, r = 0, g = 0, bl = 0, n = 0;
      let min = 255, max = 0;
      for (let i = 0; i < d.length; i += 4) {
        const L = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        lum += L; r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++;
        if (L < min) min = L;
        if (L > max) max = L;
      }
      // saturation proxy: mean (max-min)/max per pixel channel spread
      return { lum: lum / n, r: r / n, g: g / n, b: bl / n, min, max, n };
    };

    const gctx = cv.getContext('2d');
    const graded = meanOf(gctx, box(ax * sx, ay * sy, aw * sx, ah * sy));

    // raw reference: identical cover-fit into an arch-sized offscreen canvas
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = uri; });
    const off = document.createElement('canvas');
    off.width = Math.round(aw * sx);
    off.height = Math.round(ah * sy);
    const octx = off.getContext('2d');
    const scale = Math.max(off.width / img.naturalWidth, off.height / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    octx.drawImage(img, (off.width - dw) / 2, (off.height - dh) / 2, dw, dh);
    const raw = meanOf(octx, box(0, 0, off.width, off.height));

    const sat = (c) => {
      const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
      return mx > 0 ? (mx - mn) / mx : 0;
    };
    return {
      arch: [ax, ay, aw, ah].map((v) => +v.toFixed(1)),
      graded: { lum: +graded.lum.toFixed(1), rgb: [graded.r, graded.g, graded.b].map((v) => +v.toFixed(1)), sat: +sat(graded).toFixed(3), max: graded.max },
      raw: { lum: +raw.lum.toFixed(1), rgb: [raw.r, raw.g, raw.b].map((v) => +v.toFixed(1)), sat: +sat(raw).toFixed(3), max: raw.max },
      ratio: +(graded.lum / raw.lum).toFixed(3),
      satDrop: +(1 - sat(graded) / sat(raw)).toFixed(3),
    };
  }, [sel, srcUri, FACEBOX]);
}

const browser = await H.launch();
const rows = [];
const errs = [];

// Test-environment isolation only, no product change: while OW-RUNEFIRE's
// sibling audio wave is mid-flight, src/audio/index.js still calls voices that
// voices.js no longer exports (V.woodHit / V.denyBuzz / V.woodFlip), so
// audio.ui() throws on the very first gesture and nothing past the threshold
// mounts. createAudio() is documented to be a permanent safe no-op when
// WebAudio is absent (`if (!ACImpl) return`), so the rig removes AudioContext
// and measures the pixels it is actually here to measure. Reported upstream.
async function page390(vp) {
  const page = await H.newPage(browser, vp);
  await page.addInitScript(() => {
    /* audio left intact: the sibling wave that broke it has landed */
  });
  return page;
}

const shoot = (page, name) => page.screenshot({ path: `artifacts/wip-cardlight/shots/${tag}-${name}.png` });

for (const vp of [H.PHONE, H.DESKTOP]) {
  const vpName = vp.width < 500 ? 'phone' : 'desktop';

  // ---- Bourj DARE (lock 1) ------------------------------------------------
  {
    const page = await page390(vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(1) });
    await H.crossThreshold(page);
    await H.enterLock(page, 1);
    await page.waitForSelector('.dare-card canvas.dare-portrait', { timeout: 8000 });
    await page.waitForTimeout(2400);           // dare-warm is 1.6s + rise .9s
    const m = await measureCanvas(page, '.dare-portrait', dataUri(SRC.bourj), FACE);
    rows.push({ vp: vpName, beat: 'dare-bourj', ...m });
    await shoot(page, `dare-bourj-${vpName}`);
    // portrait-only crop, Ramon's angle
    const bb = await page.locator('.dare-portrait').boundingBox();
    if (bb) await page.screenshot({ path: `artifacts/wip-cardlight/shots/${tag}-dare-bourj-crop-${vpName}.png`, clip: bb });
    const geo = await page.evaluate(() => {
      const card = document.querySelector('.dare-card');
      const cv = document.querySelector('.dare-portrait');
      const cr = card.getBoundingClientRect(), pr = cv.getBoundingClientRect();
      const name = document.querySelector('.dare-name').getBoundingClientRect();
      const taunt = document.querySelector('.dare-taunt').getBoundingClientRect();
      return {
        cardW: +cr.width.toFixed(1), portW: +pr.width.toFixed(1), portH: +pr.height.toFixed(1),
        pctOfCard: +(pr.width / cr.width).toFixed(3),
        marginL: +(pr.left).toFixed(1), marginR: +(innerWidth - pr.right).toFixed(1),
        gapPortToName: +(name.top - pr.bottom).toFixed(1),
        gapNameToTaunt: +(taunt.top - name.bottom).toFixed(1),
        docScrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      };
    });
    rows[rows.length - 1].geo = geo;
    if (page.__errors.length) errs.push({ vp: vpName, beat: 'dare', e: page.__errors });
    await page.context().close();
  }

  // ---- Bourj YIELD beat (lock 3) -----------------------------------------
  {
    const page = await page390(vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(3) });
    await H.crossThreshold(page);
    await H.enterLock(page, 3);
    await H.answerDare(page);
    const { answer, instance } = await page.evaluate(() => ({
      answer: window.__OW.answerOf('03-beacons'), instance: window.__OW.instanceOf('03-beacons'),
    }));
    const dial = page.locator('canvas[role="slider"]');
    await dial.focus();
    await page.keyboard.press('Home');
    const longest = Math.max(...instance.beacons.map((b) => b.cycle));
    let rem = answer.night - 1;
    while (rem >= longest) { await page.keyboard.press('PageUp'); rem -= longest; }
    while (rem >= 10) { await page.keyboard.press('ArrowUp'); rem -= 10; }
    while (rem >= 1) { await page.keyboard.press('ArrowRight'); rem -= 1; }
    await page.getByRole('button', { name: 'Set the dial', exact: true }).click();
    await page.waitForSelector('.yield-stage canvas', { timeout: 8000 });
    await page.waitForTimeout(180);            // early in the bow: face still up
    const m = await measureCanvas(page, '.yield-stage canvas', dataUri(SRC.bourj), FACE);
    rows.push({ vp: vpName, beat: 'yield-bourj', ...m });
    await shoot(page, `yield-bourj-${vpName}`);
    const yb = await page.locator('.yield-stage canvas').boundingBox();
    if (yb) await page.screenshot({ path: `artifacts/wip-cardlight/shots/${tag}-yield-bourj-crop-${vpName}.png`, clip: yb });
    // the DEEP bow: the beat's own last frame, which is also what reduced
    // motion renders as a still. The bow must still be SEEN there.
    await page.waitForTimeout(760);
    if (await page.locator('.yield-stage canvas').count()) {
      const mb = await measureCanvas(page, '.yield-stage canvas', dataUri(SRC.bourj), FACE);
      rows.push({ vp: vpName, beat: 'yield-bowed', ...mb });
      const yb2 = await page.locator('.yield-stage canvas').boundingBox();
      if (yb2) await page.screenshot({ path: `artifacts/wip-cardlight/shots/${tag}-yield-bowed-crop-${vpName}.png`, clip: yb2 });
    }
    if (page.__errors.length) errs.push({ vp: vpName, beat: 'yield', e: page.__errors });
    await page.context().close();
  }
}

await browser.close();
writeFileSync(`artifacts/wip-cardlight/measure-${tag}.json`, JSON.stringify({ rows, errs }, null, 1));

let bad = 0;
console.log('vp       beat          arch(px)            gradedLum rawLum ratio satDrop');
for (const r of rows) {
  if (r.error) { console.log(r.vp, r.beat, 'ERROR', r.error); bad++; continue; }
  const flag = r.ratio >= FLOOR ? '' : '  <-- BELOW FLOOR';
  console.log(
    `${r.vp.padEnd(8)} ${r.beat.padEnd(13)} ${JSON.stringify(r.arch).padEnd(20)} `
    + `${String(r.graded.lum).padStart(8)} ${String(r.raw.lum).padStart(6)} `
    + `${String(r.ratio).padStart(5)} ${String(r.satDrop).padStart(6)}${flag}`
  );
  if (r.ratio < FLOOR) bad++;
  if (r.satDrop > 0.15 + 1e-6) { console.log(`   satDrop ${r.satDrop} > 0.15`); bad++; }
  if (r.geo) {
    const archPct = ((r.arch[2] / r.geo.cardW) * 100).toFixed(1);
    console.log(
      `   card=${r.geo.cardW} arch=${r.arch[2]}x${r.arch[3]} (${archPct}% of card) `
      + `canvas=${r.geo.portW}x${r.geo.portH} margins=${r.geo.marginL}/${r.geo.marginR} `
      + `gaps=${r.geo.gapPortToName}/${r.geo.gapNameToTaunt} scrollW=${r.geo.docScrollW}/${r.geo.innerW}`
    );
    if (Math.min(r.geo.marginL, r.geo.marginR) < 44) { console.log('   margin under 44px'); bad++; }
    if (r.geo.docScrollW > r.geo.innerW) { console.log('   horizontal scroll'); bad++; }
  }
}
if (errs.length) { console.error('PAGE ERRORS', JSON.stringify(errs, null, 1)); bad++; }
console.log(`REST_FLOOR ${REST_FLOOR} / FINAL_FLOOR ${FLOOR}`);
console.log(bad === 0 ? 'CARDLIGHT: GREEN' : `CARDLIGHT: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
