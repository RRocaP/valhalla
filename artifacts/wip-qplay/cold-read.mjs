// Cold pass: enter each of locks 06..15 with no prior knowledge and record
// exactly what a first-time player can read before touching anything.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const ORDS = process.argv[2]
  ? process.argv[2].split(',').map(Number)
  : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const browser = await H.launch();
const out = [];

for (const ord of ORDS) {
  const page = await H.newPage(browser, H.DESKTOP);
  await H.boot(page, { save: H.saveWithOpenedUpTo(ord) });
  await H.crossThreshold(page);
  const lidJournal = await H.journal(page);
  await H.enterLock(page, ord);
  const dare = await page.locator('.dare-card').count() > 0;
  let dareText = null;
  if (dare) {
    dareText = await page.locator('.dare-card').innerText();
    await H.shot(page, `dare-${String(ord).padStart(2, '0')}`);
    await H.answerDare(page);
  }
  await page.waitForTimeout(400);
  const room = await H.readRoom(page);
  const j = await H.journal(page);
  const sizes = await H.targetSizes(page);
  await H.shot(page, `cold-${String(ord).padStart(2, '0')}-desktop`);

  // phone framing of the same state
  const p2 = await H.newPage(browser, H.PHONE);
  await H.boot(p2, { save: H.saveWithOpenedUpTo(ord) });
  await H.crossThreshold(p2);
  await H.enterLock(p2, ord);
  await H.answerDare(p2);
  await p2.waitForTimeout(300);
  const phoneSizes = await H.targetSizes(p2);
  const overflow = await p2.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    rootScrollH: document.querySelector('.lock-root')?.scrollHeight || 0,
    rootClientH: document.querySelector('.lock-root')?.clientHeight || 0,
  }));
  await H.shot(p2, `cold-${String(ord).padStart(2, '0')}-phone`);
  await p2.context().close();

  out.push({ ord, dare, dareText, lidJournal, room, journal: j, sizes, phoneSizes, overflow, errors: page.__errors });
  console.log(`--- LOCK ${ord} ${room.title} ---`);
  console.log('epigraph:', room.epigraph);
  console.log('board:\n' + room.board.split('\n').slice(0, 40).join('\n'));
  console.log('journal:', JSON.stringify(j.slice(-4)));
  console.log('targets desktop under44:', sizes && sizes.under44, 'phone under44:', phoneSizes && phoneSizes.under44);
  console.log('phone smallest:', JSON.stringify((phoneSizes && phoneSizes.smallest) || []));
  console.log('overflow:', JSON.stringify(overflow));
  console.log('canvasNotes:', JSON.stringify(room.canvasNotes.slice(0, 8)));
  console.log('errors:', JSON.stringify(page.__errors));
  await page.context().close();
}

writeFileSync('artifacts/wip-qplay/cold-read.json', JSON.stringify(out, null, 1));
await browser.close();
