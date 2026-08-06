// One-off reference capture (docs/QUALITY.md): screenshots the accepted
// prior at https://rrocap.github.io/roca-airways/ for later side-by-side
// comparison. NOT a Playwright test (not run by the e2e suite / gates) and
// NOT part of the offline contract — this is the one explicitly-authorized
// use of the network in this suite. Run manually: node tests/e2e/_reference-capture.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const OUT = 'artifacts/reference';
mkdirSync(OUT, { recursive: true });
const URL = 'https://rrocap.github.io/roca-airways/';
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'iphone', width: 390, height: 844 },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.setDefaultTimeout(15000);
  console.log(`\n== ${vp.name} (${vp.width}x${vp.height}) ==`);

  await page.goto(URL, { waitUntil: 'networkidle' }).catch(async () => {
    await page.goto(URL, { waitUntil: 'load' });
  });
  await page.waitForTimeout(1200); // allow intro animation/fonts to settle
  await page.screenshot({ path: `${OUT}/01-landing-${vp.name}.png` });
  console.log(`shot: 01-landing-${vp.name}.png`);

  // Landing is a compass/dial (a "Para Andrea" wayfinding puzzle, red radial
  // markers around a centre point) rather than a button-driven boarding
  // screen. Try dragging one red marker toward the top heading (the most
  // legible affordance actually on screen), then fall back to a generic
  // full-screen tap. Best-effort: capture whatever actually loads, do not
  // force progress through any login/paywall.
  let shotN = 2;
  const cx = vp.width / 2, cy = 390; // dial centre is roughly fixed regardless of viewport width
  const dragAttempts = [
    { from: { x: cx - 105, y: cy + 15 }, to: { x: cx, y: cy - 100 } }, // inner-left marker -> top heading
    { from: { x: cx + 140, y: cy - 25 }, to: { x: cx, y: cy - 100 } }, // outer-right marker -> top heading
  ];
  for (const { from, to } of dragAttempts) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${String(shotN).padStart(2, '0')}-after-drag-${vp.name}.png` });
  console.log(`shot: ${String(shotN).padStart(2, '0')}-after-drag-${vp.name}.png`);
  shotN += 1;

  const ctaPatterns = [
    /board/i, /begin/i, /start/i, /play/i, /enter/i, /continue/i, /tap|click|press/i,
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    let clicked = false;
    for (const pattern of ctaPatterns) {
      const btn = page.getByRole('button', { name: pattern }).first();
      if (await btn.count().catch(() => 0)) {
        if (await btn.isVisible().catch(() => false)) {
          await btn.click().catch(() => {});
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) {
      // fall back to a generic full-screen tap (many of these are canvas/tap-to-start games)
      await page.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
    }
    await page.waitForTimeout(1500);
    const name = `${String(shotN).padStart(2, '0')}-progress${attempt + 1}-${vp.name}.png`;
    await page.screenshot({ path: `${OUT}/${name}` });
    console.log(`shot: ${name}`);
    shotN += 1;
  }

  await page.close();
}

await browser.close();
console.log('\ndone');
