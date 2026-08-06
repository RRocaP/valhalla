// Reference capture: ROCA AIRWAYS RA-2027 (docs/QUALITY.md accepted prior).
// Only permitted network use. Retina dsf 2, both QUALITY.md viewports.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'artifacts/reference';
mkdirSync(OUT, { recursive: true });
const URL = 'https://rrocap.github.io/roca-airways/';

const browser = await chromium.launch();
for (const [tag, viewport] of [['d', { width: 1280, height: 800 }], ['m', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, hasTouch: tag === 'm', isMobile: tag === 'm' });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.error('goto', e.message));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/ref-01-boot-${tag}.png` });
  // tight crops for the surface/typography axes
  const vp = page.viewportSize();
  await page.screenshot({ path: `${OUT}/ref-01b-crop-${tag}.png`, clip: { x: 0, y: 0, width: Math.min(420, vp.width), height: 300 } });

  // try the primary CTA to reach the next screen, whatever it is called
  const btns = page.locator('button, a[role="button"], .btn, [class*="btn"]');
  const n = await btns.count();
  console.log(tag, 'buttons:', n);
  for (let i = 0; i < Math.min(n, 6); i++) {
    const t = (await btns.nth(i).textContent().catch(() => '')) || '';
    console.log(tag, i, JSON.stringify(t.trim().slice(0, 40)));
  }
  if (n) {
    await btns.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/ref-02-next-${tag}.png` });
    await page.screenshot({ path: `${OUT}/ref-02b-crop-${tag}.png`, clip: { x: 0, y: 0, width: Math.min(420, vp.width), height: 300 } });
  }
  await page.close();
}
await browser.close();
console.log('reference captured ->', OUT);
