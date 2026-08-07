// Deterministic accessibility + resilience floors (docs/CONTRACT.md §8,
// docs/SHELL.md "Input + accessibility floor", gate 8). Runs its own short
// traversal (lid -> lock 1 -> lock 2 -> lock 3's dare card) rather than
// duplicating journey.spec.mjs's full fifteen-lock playthrough.
import { test, expect } from '@playwright/test';
import {
  gotoAutotest, beginFromThreshold, openLockFromLid, expectDareCard,
  expectNoDareCard, answerTheDare,
  drivers, owAnswerAndInstance, owSave, assertTouchTargets, sampleContrastRatio,
} from './helpers.mjs';

async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow at "${label}": ${overflow}px`).toBeLessThanOrEqual(1);
}

async function solveByRealInput(page, id) {
  const { answer, instance } = await owAnswerAndInstance(page, id);
  const root = page.locator('.lock-root');
  await drivers[id](page, root, answer, instance);
  const overlay = page.locator('.ceremony-overlay');
  await expect(overlay).toBeVisible();
  // .ceremony-overlay has pointer-events:none (see helpers.mjs resolveCeremony
  // for the full note) — Enter is the working real-input skip path.
  await page.keyboard.press('Enter');
}

test('floors: console, horizontal scroll, touch targets, contrast, offline reload', async ({ page, context }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The offline gate (docs/CONTRACT.md §1) expects music.mp3/credits.mp3 to
    // fail to fetch while offline and degrade silently to the synthesized
    // drone — that failed *fetch* is itself expected and is not a thrown
    // error; only genuine application errors should fail this floor. The
    // hero plates (heroes/*.jpg, CONTRACT amendment 2026-08-07) are the same
    // class: optional same-origin art that falls back to the procedural
    // painters when absent.
    const url = m.location() && m.location().url || '';
    if (/\/((music|credits|act\d+)\.mp3|heroes\/[-\w.]+\.jpg)(\?|$)/.test(url)) return;
    errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e}`));

  await test.step('threshold', async () => {
    await gotoAutotest(page);
    await assertNoHorizontalScroll(page, 'threshold');
  });

  const thresholdContrast = await sampleContrastRatio(page, '.subtitle');
  expect(thresholdContrast, '.subtitle contrast ratio').not.toBeNull();
  expect(thresholdContrast, '.subtitle contrast ratio (WCAG body text floor 4.5:1)').toBeGreaterThanOrEqual(4.5);

  await test.step('lid', async () => {
    await beginFromThreshold(page);
    await assertNoHorizontalScroll(page, 'lid');
    await assertTouchTargets(page, '.screen-lid');
  });

  await test.step('lock 1 room: touch targets + contrast + no h-scroll (incl. Bourj dare)', async () => {
    await openLockFromLid(page, 1);
    // gauntlet cadence: Bourj dares at lock 1 now (docs/JARLS.md v3) — audit
    // the dare card here, then answer it to reach the board
    const duel = await expectDareCard(page, 1);
    await assertNoHorizontalScroll(page, 'dare-card-01');
    await assertTouchTargets(page, '.dare-card');
    const tauntContrast = await sampleContrastRatio(page, '.dare-taunt');
    expect(tauntContrast, `.dare-taunt (${duel.name}) contrast`).toBeGreaterThanOrEqual(4.5);
    await answerTheDare(page);
    await assertNoHorizontalScroll(page, 'lockroom-01-runerow');
    await assertTouchTargets(page, '.screen-lockroom');
    const epigraphContrast = await sampleContrastRatio(page, '.lock-epigraph');
    expect(epigraphContrast, '.lock-epigraph contrast ratio').not.toBeNull();
    expect(epigraphContrast, '.lock-epigraph contrast ratio (WCAG body text floor 4.5:1)').toBeGreaterThanOrEqual(4.5);
    await solveByRealInput(page, '01-runerow');
    await expect(page.locator('.screen-lid')).toBeVisible();
  });

  await test.step('lock 2: solve to unlock the lock-3 duel', async () => {
    await openLockFromLid(page, 2);
    await solveByRealInput(page, '02-bismer');
    await expect(page.locator('.screen-lid')).toBeVisible();
  });

  await test.step('lock 3 room (gauntlet finale lock, no dare card here)', async () => {
    await openLockFromLid(page, 3);
    await expectNoDareCard(page);
    await assertNoHorizontalScroll(page, 'lockroom-03-beacons');
    await assertTouchTargets(page, '.screen-lockroom');
  });

  await test.step('offline: reload, then continue playing with the network blocked', async () => {
    await context.setOffline(true);

    let reloadedFresh = true;
    try {
      await page.reload({ waitUntil: 'load', timeout: 10_000 });
    } catch {
      reloadedFresh = false;
    }

    if (!reloadedFresh) {
      // The local dev server (scripts/serve.mjs) sends cache-control:no-store
      // for every response, by design for QA/dev freshness — so a cold reload
      // while offline cannot refetch the (uncached) document. This is a
      // dev-server artifact, not a product regression: the production target
      // (docs/STATUS.md — GitHub Pages) does not send no-store, and the
      // single-file/no-runtime-network contract (docs/CONTRACT.md §1) means a
      // real deploy's document is normally cacheable. Re-establish the page
      // from the same still-offline context and continue: this still proves
      // CONTRACT §2's "plays ... with the network blocked" (offline gate,
      // §7.8), which is the substance of this floor.
      await context.setOffline(false);
      await page.goto('/#autotest');
      await context.setOffline(true);
    }

    await expect(page.locator('#app')).not.toBeEmpty();

    // localStorage (not network) carries progress across reload — confirm it
    // did, then prove a lock is still genuinely playable offline: fully solve
    // lock 3's duel by real input with the network blocked throughout, and
    // confirm no error was thrown by the blocked music.mp3/credits.mp3
    // fetches (docs/CONTRACT.md §1 sound-track exception: absence must
    // degrade silently, not throw).
    const save = await owSave(page);
    expect(save.opened, 'progress persisted offline via localStorage').toEqual(
      expect.arrayContaining(['01-runerow', '02-bismer']),
    );

    const beginOrContinue = page.getByRole('button', { name: /^(Continue|Lay hands on the chest)$/, exact: true });
    if (await beginOrContinue.count()) {
      await beginOrContinue.click();
    }
    await expect(page.locator('.screen-lid')).toBeVisible();

    // gauntlet cadence: lock 3 is Bourj's yield lock — no dare card here
    // (his dare fired at lock 1, already answered pre-reload)
    await openLockFromLid(page, 3);
    await expectNoDareCard(page);
    await solveByRealInput(page, '03-beacons');
    await expect(page.locator('.screen-lid')).toBeVisible();

    await context.setOffline(false);
  });

  expect(errors, `console errors during the floors run:\n${errors.join('\n')}`).toEqual([]);
});
