// Shell localization gate (CONTRACT §4.1 amendment 2026-08-06, OW-LOCALE-SHELL).
// Runs in both playwright projects (desktop 1280×800, iphone 390×844 touch) —
// the iphone pass is the es/ca long-string overflow check for the switcher,
// settings labels and threshold. Structural selectors only (.btn-carved,
// .settings-nail, [data-lang]) — button LABELS localize for real players, so
// no driver may key on English text outside #autotest.
import { test, expect } from '@playwright/test';

const SAVE_KEY = 'oathwood.v1';
const CA_SAVE = {
  opened: [], attempts: {}, hints: {}, journal: [],
  settings: { muted: false, reducedMotion: null, lang: 'ca' },
  startedAt: '2026-08-06T00:00:00.000Z',
};

// Frozen lines (docs/JARLS.md "Frozen localized lines" / strings.js) — verbatim.
const SUBTITLE = {
  en: 'Fifteen Locks of the Northmen',
  es: 'Quince Cerraduras de los Hombres del Norte',
  ca: 'Quinze Panys dels Homes del Nord',
};

async function seed(page, save) {
  // init scripts run on EVERY navigation — only seed an absent key, so the
  // save the app itself persisted (e.g. lang switched to es) survives reloads.
  await page.addInitScript(([k, v]) => {
    if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
  }, [SAVE_KEY, save]);
}

async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow at "${label}": ${overflow}px`).toBeLessThanOrEqual(1);
}

test('boots in ca, switcher live-swaps to es, persists, journal echoes', async ({ page }, testInfo) => {
  const proj = testInfo.project.name;
  await seed(page, CA_SAVE);
  await page.goto('/');

  // boots in ca: frozen threshold subtitle + effective-lang hook
  await expect(page.locator('#app')).toHaveAttribute('data-lang', 'ca');
  await expect(page.locator('.subtitle')).toHaveText(SUBTITLE.ca);
  await assertNoHorizontalScroll(page, 'threshold-ca');
  await page.screenshot({ path: `artifacts/wip-locale-shell/threshold-ca-${proj}.png` });

  // into the hall (structural: the one carved button is Continue for a saved
  // chest). The wager framing card (docs/JARLS.md "The wager") may interpose
  // once after the gesture — take it when offered.
  await page.locator('.threshold-actions .btn-carved').first().click();
  await expect(page.locator('.wager-continue, .screen-lid').first()).toBeVisible();
  if (await page.locator('.wager-continue').count()) {
    await page.locator('.wager-continue').click();
  }
  await expect(page.locator('.screen-lid')).toBeVisible();

  // settings shows CA gold-struck, all three targets >= 44px
  await page.locator('.settings-nail').click();
  await expect(page.locator('.overlay-title')).toHaveText('Configuració');
  await expect(page.locator('.lang-btn[data-lang="ca"]')).toHaveAttribute('aria-pressed', 'true');
  for (const code of ['en', 'es', 'ca']) {
    const box = await page.locator(`.lang-btn[data-lang="${code}"]`).boundingBox();
    expect(box.width, `lang-btn ${code} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `lang-btn ${code} height`).toBeGreaterThanOrEqual(44);
  }
  await assertNoHorizontalScroll(page, 'settings-ca');
  await page.waitForTimeout(400); // let the drawer's 280ms slide finish for the evidence shot
  await page.screenshot({ path: `artifacts/wip-locale-shell/settings-ca-${proj}.png` });

  // switch to es LIVE: panel re-renders localized, effective lang swaps
  await page.locator('.lang-btn[data-lang="es"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-lang', 'es');
  await expect(page.locator('.overlay-title')).toHaveText('Ajustes');
  await expect(page.locator('.lang-btn[data-lang="es"]')).toHaveAttribute('aria-pressed', 'true');
  await assertNoHorizontalScroll(page, 'settings-es');
  await page.waitForTimeout(400); // drawer slide settle (evidence only)
  await page.screenshot({ path: `artifacts/wip-locale-shell/settings-es-${proj}.png` });

  // persisted + journal echo in the NEW language
  const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY));
  expect(stored.settings.lang).toBe('es');
  expect(
    stored.journal.some((l) => l.includes('El salón ahora habla español.')),
    `journal echo missing in: ${JSON.stringify(stored.journal)}`,
  ).toBe(true);

  // subtitle swaps: the threshold now speaks es (also proves persistence)
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-lang', 'es');
  await expect(page.locator('.subtitle')).toHaveText(SUBTITLE.es);
  await assertNoHorizontalScroll(page, 'threshold-es');
  await page.screenshot({ path: `artifacts/wip-locale-shell/threshold-es-${proj}.png` });
});

test('finale + credits speak es (longest strings; no clipping at 390px)', async ({ page }, testInfo) => {
  const proj = testInfo.project.name;
  // real lock ids from the autotest hook, so a completed save can be seeded
  // without hardcoding filenames that other workers may still be reshaping
  await page.goto('/#autotest');
  const ids = await page.evaluate(() => window.__OW.locks.map((l) => l.id));
  await seed(page, {
    ...CA_SAVE,
    opened: ids,
    journal: ['12:00 — seeded'],
    settings: { ...CA_SAVE.settings, lang: 'es' },
  });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-lang', 'es');

  // Continue → (wager once, if offered) → straight into the finale reveals
  await page.locator('.threshold-actions .btn-carved').first().click();
  await expect(page.locator('.wager-continue, .screen-finale').first()).toBeVisible();
  if (await page.locator('.wager-continue').count()) {
    await page.locator('.wager-continue').click();
  }
  await expect(page.locator('.screen-finale')).toBeVisible();

  // reveal 1 — frozen es Tebi title, the longest title string
  await expect(page.locator('.finale-title')).toHaveText('TEBI EL OSTEÓPATA · Serpiente-en-el-Ojo');
  await assertNoHorizontalScroll(page, 'finale-tebi-es');
  await page.screenshot({ path: `artifacts/wip-locale-shell/finale-tebi-es-${proj}.png` });

  // reveal 2 — Ålanø with the frozen es epithet line (longest string overall)
  await page.locator('.finale-reveal').press('Enter');
  await expect(page.locator('.finale-epithet')).toContainText('Alabado en todos los fiordos');
  await assertNoHorizontalScroll(page, 'finale-alano-es');
  await page.screenshot({ path: `artifacts/wip-locale-shell/finale-alano-es-${proj}.png` });

  // tableau + localized footer
  await page.locator('.finale-reveal').press('Enter');
  await expect(page.locator('.finale-footer')).toBeVisible();
  await expect(page.locator('.finale-colophon')).toHaveText('tallado por manos de máquina · MMXXVI');
  await assertNoHorizontalScroll(page, 'finale-tableau-es');
  await page.screenshot({ path: `artifacts/wip-locale-shell/finale-tableau-es-${proj}.png` });

  // credits — es headings + frozen colophon, no h-scroll on the long scroll
  await page.locator('.finale-footer .btn-carved').click();
  await expect(page.locator('.screen-credits')).toBeVisible();
  await expect(page.locator('.credits-scroll')).toContainText('LOS DESAFIANTES');
  await expect(page.locator('.credits-scroll')).toContainText('tallado por manos de máquina · MMXXVI');
  await assertNoHorizontalScroll(page, 'credits-es');
  await page.screenshot({ path: `artifacts/wip-locale-shell/credits-es-${proj}.png` });
});

test('#autotest forces en even over a ca save (e2e label contract holds)', async ({ page }) => {
  await seed(page, CA_SAVE);
  await page.goto('/#autotest');
  await expect(page.locator('#app')).toHaveAttribute('data-lang', 'en');
  await expect(page.locator('.subtitle')).toHaveText(SUBTITLE.en);
  // the drivers' frozen English label still resolves under #autotest
  await expect(page.getByRole('button', { name: /^(Continue|Lay hands on the chest)$/ })).toBeVisible();
});
