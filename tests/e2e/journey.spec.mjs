// Full real-input journey, both projects (desktop 1280x800, iphone 390x844
// per playwright.config.mjs). docs/CONTRACT.md §7 gate 7: drives all fifteen
// locks open with real input events, one screenshot per distinct moment, and
// a clean console throughout.
import { test, expect } from '@playwright/test';
import {
  gotoAutotest, makeShotter, beginFromThreshold, openLockFromLid,
  expectDareCard, expectNoDareCard, answerTheDare, resolveCeremony,
  drivers, owAnswerAndInstance, owLockMeta, DUEL_ORDER, duelFor,
} from './helpers.mjs';

test('full journey: threshold -> fifteen locks -> finale -> credits', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const shot = makeShotter(page, testInfo);
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // docs/CONTRACT.md §1: music.mp3/credits.mp3 are allowed to fail to
    // fetch/decode (e.g. blocked autoplay) and must degrade silently — that
    // is not a thrown application error.
    const url = m.location() && m.location().url || '';
    if (/\/(music|credits)\.mp3(\?|$)/.test(url)) return;
    errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e}`));

  await test.step('threshold', async () => {
    await gotoAutotest(page);
    await expect(page.locator('.screen-threshold')).toBeVisible();
    await expect(page.locator('.title')).toHaveText('VALHALLA');
    await expect(page.locator('.subtitle')).toHaveText('Fifteen Locks of the Northmen');
    await shot('threshold');
  });

  await test.step('begin -> lid (hub)', async () => {
    await beginFromThreshold(page);
    await shot('lid-hub');
  });

  const locks = await owLockMeta(page);
  expect(locks.map((l) => l.ordinal)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  expect(DUEL_ORDER[DUEL_ORDER.length - 1]).toBe(15); // Ärya, last of the five, per docs/JARLS.md

  for (const lock of locks) {
    const { ordinal, id } = lock;
    await test.step(`lock ${ordinal} — ${id}`, async () => {
      const isDuel = DUEL_ORDER.includes(ordinal);

      if (isDuel) {
        await expect(page.locator('.duel-banner')).toBeVisible();
        await shot(`lid-duel-banner-${ordinal}`);
      }

      await openLockFromLid(page, ordinal);

      if (isDuel) {
        const duel = await expectDareCard(page, ordinal);
        expect(duel.name).toBe(duelFor(ordinal).name);
        await shot(`dare-${String(ordinal).padStart(2, '0')}-${id}`);
        await answerTheDare(page);
      } else {
        await expectNoDareCard(page);
      }

      await expect(page.locator('.lock-root')).toBeVisible();
      await shot(`lockroom-${id}`);

      const { answer, instance } = await owAnswerAndInstance(page, id);
      const root = page.locator('.lock-root');

      // one deliberate wrong-answer + hint-horn demonstration (docs/QUALITY.md
      // capture-moments list): bounded to a single early, simple lock rather
      // than repeated across all fifteen.
      if (id === '02-bismer') {
        const wrongIdx = (answer.pouch + 1) % instance.pouches.length;
        for (let attempt = 1; attempt <= 3; attempt++) {
          await root.locator('[role="radio"].ow2-pouch').nth(wrongIdx).click();
          await root.getByRole('button', { name: 'Name the pouch', exact: true }).click();
          await expect(page.locator('.attempts-dots .dot')).toHaveCount(attempt);
          if (attempt === 1) await shot('wrong-answer-02-bismer');
        }
        await expect(page.locator('.hint-slot').first()).toHaveAttribute('data-state', 'armed');
        await page.locator('.hint-slot').first().click();
        await expect(page.locator('.hint-text p').first()).toHaveText(lock.hints[0]);
        await shot('hint-taken-02-bismer');
      }

      await drivers[id](page, root, answer, instance);
      await resolveCeremony(page, { ordinal });

      if (ordinal !== 15) {
        await expect(page.locator('.screen-lid')).toBeVisible();
        await shot(`lid-after-${id}`);
      }
    });
  }

  await test.step('finale', async () => {
    await expect(page.locator('.screen-finale')).toBeVisible();
    if (await page.locator('.skip-hint').count()) {
      await page.locator('.screen-finale').click(); // "skippable by tap" per docs/SHELL.md #4
    }

    await expect(page.locator('.finale-title')).toHaveText('TEBI THE OSTEOPATH · Snake-in-the-Eye');
    await expect(page.locator('.finale-sub')).toHaveText('The hoard of the fifteen locks.');
    await shot('finale-tebi');

    await page.locator('.finale-reveal').click();
    await expect(page.locator('.finale-title')).toHaveText('JARL ÅLANØ');
    await expect(page.locator('.finale-sub')).toContainText('the Troll-Burster · Friend of the Children');
    await expect(page.locator('.finale-epithet')).toContainText('Praised in every fjord');
    await shot('finale-alano');

    await page.locator('.finale-reveal').click();
    await expect(page.locator('.finale-tableau')).toBeVisible();
    await expect(page.locator('.finale-tableau figcaption')).toHaveText([
      'TEBI THE OSTEOPATH · Snake-in-the-Eye',
      'JARL ÅLANØ',
    ]);
    await expect(page.getByRole('button', { name: 'Raise the horns', exact: true })).toBeVisible();
    await shot('finale-tableau');
  });

  await test.step('credits', async () => {
    await page.getByRole('button', { name: 'Raise the horns', exact: true }).click();
    await expect(page.locator('.screen-credits')).toBeVisible();

    const scroll = page.locator('.credits-scroll');
    await expect(scroll).toBeVisible();
    await expect(scroll.locator('.credits-title')).toHaveText('VALHALLA');
    await expect(scroll.getByText('THE CHALLENGERS', { exact: true })).toBeVisible();

    const expectedChallengers = DUEL_ORDER.map((ord) => duelFor(ord).name);
    const names = await scroll.locator('.credits-challengers figcaption').allTextContents();
    expect(names).toEqual(expectedChallengers);

    const ramon = scroll.locator('.credits-portrait-white');
    await expect(ramon).toBeVisible();
    await expect(ramon.locator('figcaption')).toHaveText('JARL RAMON');

    // scroll affordance genuinely scrolls (docs/SHELL.md #5 "wheel/keys/touch also scrub")
    const scrollable = await scroll.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrollable, 'credits scroll has more content than the viewport').toBe(true);
    const before = await scroll.evaluate((el) => el.scrollTop);
    await scroll.evaluate((el) => el.scrollBy(0, 200));
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);

    await shot('credits');

    // sticker overlay canvas: non-blank pixels, sampled via getImageData
    // (particles start falling immediately but take a few hundred ms to
    // enter the visible canvas region — poll, don't sleep).
    const nonBlankFraction = () => page.evaluate(() => {
      const c = document.querySelector('.sticker-canvas');
      if (!c || !c.width || !c.height) return 0;
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
      return painted / (data.length / 4);
    });
    await expect.poll(nonBlankFraction, { timeout: 8000, message: 'sticker canvas stayed blank' }).toBeGreaterThan(0);
    await shot('credits-stickers-falling');

    const ramonCanvasPainted = await ramon.locator('canvas').evaluate((c) => {
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    });
    expect(ramonCanvasPainted, 'JARL RAMON white-border portrait canvas is blank').toBe(true);
  });

  expect(errors, `console errors during the journey:\n${errors.join('\n')}`).toEqual([]);
});
