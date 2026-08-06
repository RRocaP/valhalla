// Stitches the portrait-only crops into one before/after sheet at Ramon's
// angle (the arch, nothing else) plus a full-card pair. Pure canvas in a
// headless page — no new dependency.
//   node artifacts/wip-cardlight/sidebyside.mjs <beforeTag> <afterTag>
import { readFileSync, writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const [beforeTag = 'before', afterTag = 'after4'] = process.argv.slice(2);
const DIR = 'artifacts/wip-cardlight/shots';
const uri = (f) => `data:image/png;base64,${readFileSync(`${DIR}/${f}`).toString('base64')}`;

const SHEETS = [
  {
    out: 'sbs-dare-portrait-phone.png',
    title: 'BOURJ DARE — portrait only, 390x844 dSF2',
    a: `${beforeTag}-dare-bourj-crop-phone.png`,
    b: `${afterTag}-dare-bourj-crop-phone.png`,
  },
  {
    out: 'sbs-dare-card-phone.png',
    title: 'BOURJ DARE — full card, 390x844 dSF2',
    a: `${beforeTag}-dare-bourj-phone.png`,
    b: `${afterTag}-dare-bourj-phone.png`,
  },
  {
    out: 'sbs-yield-phone.png',
    title: 'BOURJ YIELD BEAT — 390x844 dSF2',
    a: `${beforeTag}-yield-bourj-phone.png`,
    b: `${afterTag}-yield-bourj-phone.png`,
  },
  {
    out: 'sbs-dare-card-desktop.png',
    title: 'BOURJ DARE — full card, 1280x800 dSF2',
    a: `${beforeTag}-dare-bourj-desktop.png`,
    b: `${afterTag}-dare-bourj-desktop.png`,
  },
];

const browser = await H.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('about:blank');

for (const s of SHEETS) {
  const png = await page.evaluate(async ([aUri, bUri, title]) => {
    const load = (u) => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u;
    });
    const [A, B] = await Promise.all([load(aUri), load(bUri)]);
    const H_ = Math.max(A.height, B.height);
    const gap = 28;
    const head = 62;
    const cv = document.createElement('canvas');
    cv.width = A.width + B.width + gap * 3;
    cv.height = H_ + head + gap * 2;
    const c = cv.getContext('2d');
    c.fillStyle = '#0c0906';
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#e9dcc3';
    c.font = '600 26px Georgia, serif';
    c.fillText(title, gap, 40);
    const drawOne = (img, x, label) => {
      c.drawImage(img, x, head + gap);
      c.fillStyle = '#eecf6d';
      c.font = '600 22px Georgia, serif';
      c.fillText(label, x, head + gap - 10);
      c.strokeStyle = 'rgba(233,220,195,.3)';
      c.lineWidth = 1;
      c.strokeRect(x - 0.5, head + gap - 0.5, img.width + 1, img.height + 1);
    };
    drawOne(A, gap, 'BEFORE (Ramon’s screen)');
    drawOne(B, gap * 2 + A.width, 'AFTER');
    return cv.toDataURL('image/png').split(',')[1];
  }, [uri(s.a), uri(s.b), s.title]);
  writeFileSync(`${DIR}/${s.out}`, Buffer.from(png, 'base64'));
  console.log('wrote', `${DIR}/${s.out}`);
}

await browser.close();
