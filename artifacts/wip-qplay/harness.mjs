// OW-QUALITY-PLAY harness. Real chromium, real build, no source edits.
import { chromium } from 'playwright-core';

export const URL_BASE = process.env.OW_URL || 'http://127.0.0.1:8791/index.html';
export const LOCK_IDS = [
  '01-runerow', '02-bismer', '03-beacons', '04-strakes', '05-knotwork',
  '06-jotunvillur', '07-tafl', '08-hacksilver', '09-sunstone', '10-drottkvaett',
  '11-skerry', '12-veitsla', '13-althing', '14-bindrune', '15-oathring',
];

export const DESKTOP = { width: 1280, height: 800 };
export const PHONE = { width: 390, height: 844 };

export async function launch(opts = {}) {
  const browser = await chromium.launch({ headless: opts.headless !== false });
  return browser;
}

export async function newPage(browser, viewport = DESKTOP, extra = {}) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: extra.dsr || 2,
    reducedMotion: extra.reducedMotion || 'no-preference',
    hasTouch: viewport.width < 500,
    isMobile: viewport.width < 500,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.__errors = errors;
  return page;
}

/** Seed a save so `ordinal` is the armed next lock. */
export function saveWithOpenedUpTo(ordinal, extra = {}) {
  return JSON.stringify({
    opened: LOCK_IDS.slice(0, ordinal - 1),
    attempts: extra.attempts || {},
    hints: extra.hints || {},
    journal: extra.journal || [],
    settings: { muted: extra.muted !== false, reducedMotion: extra.reducedMotion ?? null },
    startedAt: new Date().toISOString(),
  });
}

export async function boot(page, { save, hash = '#autotest' } = {}) {
  await page.goto(URL_BASE + hash, { waitUntil: 'domcontentloaded' });
  if (save) {
    await page.evaluate((s) => localStorage.setItem('oathwood.v1', s), save);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector('.screen', { timeout: 10000 });
}

/** Cross the threshold (this is the audio-enabling user gesture). */
export async function crossThreshold(page) {
  const btn = page.locator('.screen-threshold button').first();
  await btn.waitFor({ timeout: 8000 });
  await btn.click();
  // wager framing card gates first entry (docs/JARLS.md) — click through if shown
  const wager = page.locator('.wager-layer button, .wager-card button').first();
  try { await wager.waitFor({ state: 'visible', timeout: 2000 }); await wager.click(); } catch {}
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

/** Click the armed medallion for `ordinal` on the lid. */
export async function enterLock(page, ordinal) {
  const btn = page.locator(`.medallion-hit[aria-label^="Lock ${ordinal}:"]`);
  await btn.waitFor({ timeout: 8000 });
  await btn.click();
  await page.waitForSelector('.screen-lockroom', { timeout: 8000 });
}

export async function answerDare(page) {
  const dare = page.locator('.dare-card');
  if (await dare.count()) {
    await page.locator('.dare-card .btn-carved').click();
    await page.waitForSelector('.dare-card', { state: 'detached', timeout: 5000 });
    return true;
  }
  return false;
}

/** Everything a cold player can read in the lock room. */
export async function readRoom(page) {
  return page.evaluate(() => {
    const t = (s) => (document.querySelector(s)?.innerText || '').trim();
    const lockRoot = document.querySelector('.lock-root');
    const labels = [...(lockRoot?.querySelectorAll('[aria-label]') || [])]
      .map((e) => e.getAttribute('aria-label'));
    const focusables = [...(lockRoot?.querySelectorAll(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    ) || [])];
    return {
      numeral: t('.ledger-numeral'),
      title: t('.lock-title'),
      epigraph: t('.lock-epigraph'),
      board: (lockRoot?.innerText || '').trim(),
      nearLine: t('.near-line'),
      hintStates: [...document.querySelectorAll('.hint-slot')].map((b) => b.dataset.state),
      ariaLabels: labels.slice(0, 60),
      focusableCount: focusables.length,
      canvasNotes: [...(lockRoot?.querySelectorAll('canvas') || [])].map(
        (c) => c.getAttribute('aria-label') || (c.getAttribute('aria-hidden') === 'true' ? '[hidden]' : '[NO LABEL]')
      ),
    };
  });
}

export async function journal(page) {
  return page.evaluate(() => (window.__OW ? window.__OW.save.journal.slice() : []));
}

export async function attempts(page, id) {
  return page.evaluate((k) => (window.__OW ? window.__OW.save.attempts[k] || 0 : -1), id);
}

export async function shot(page, name) {
  await page.screenshot({ path: `artifacts/wip-qplay/shots/${name}.png` });
  return `artifacts/wip-qplay/shots/${name}.png`;
}

/** Smallest interactive-target box measurement over the lock root. */
export async function targetSizes(page, scope = '.lock-root') {
  return page.evaluate((sc) => {
    const root = document.querySelector(sc);
    if (!root) return null;
    const els = [...root.querySelectorAll('button,[role="option"],[role="button"],a,input')];
    const out = els.map((e) => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName, txt: (e.textContent || '').trim().slice(0, 18), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    }).filter((o) => o.w > 0);
    out.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h));
    return { n: out.length, smallest: out.slice(0, 8), under44: out.filter((o) => o.w < 44 || o.h < 44).length };
  }, scope);
}
