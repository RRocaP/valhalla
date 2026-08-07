// Detect the 15 bronze medallion centers in heroes/chest.jpg -> fractions.
import * as H from './harness.mjs';
import { writeFileSync } from 'node:fs';

const browser = await H.launch();
const page = await H.newPage(browser, H.DESKTOP);
await page.goto(H.URL_BASE.replace('index.html', 'heroes/chest.jpg'), { waitUntil: 'load' });
const result = await page.evaluate(async () => {
  const img = document.querySelector('img') || await new Promise((res) => {
    const i = new Image(); i.onload = () => res(i); i.src = location.href;
  });
  const W = img.naturalWidth;
  const HH = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = HH;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, HH).data;
  // bronze medallions: warm and bright vs the dark planks
  const mask = new Uint8Array(W * HH);
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = d[i]; const gg = d[i + 1]; const b = d[i + 2];
      if (r > 55 && gg > 36 && r > b + 22 && r + gg > 100) mask[y * W + x] = 1;
    }
  }
  // connected components (BFS, coarse: sample every pixel)
  const seen = new Uint8Array(W * HH);
  const blobs = [];
  const qx = new Int32Array(W * HH);
  const qy = new Int32Array(W * HH);
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!mask[idx] || seen[idx]) continue;
      let head = 0; let tail = 0;
      qx[tail] = x; qy[tail] = y; tail++;
      seen[idx] = 1;
      let n = 0; let sx = 0; let sy = 0; let minx = x; let maxx = x; let miny = y; let maxy = y;
      while (head < tail) {
        const cx = qx[head]; const cy = qy[head]; head++;
        n++; sx += cx; sy += cy;
        if (cx < minx) minx = cx; if (cx > maxx) maxx = cx;
        if (cy < miny) miny = cy; if (cy > maxy) maxy = cy;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx2 = cx + ox; const ny2 = cy + oy;
          if (nx2 < 0 || ny2 < 0 || nx2 >= W || ny2 >= HH) continue;
          const nidx = ny2 * W + nx2;
          if (mask[nidx] && !seen[nidx]) { seen[nidx] = 1; qx[tail] = nx2; qy[tail] = ny2; tail++; }
        }
      }
      const bw = maxx - minx + 1; const bh = maxy - miny + 1;
      const round = bw / bh > 0.6 && bw / bh < 1.7;
      if (n > 1500 && round) blobs.push({ x: sx / n, y: sy / n, n, bw, bh });
    }
  }
  blobs.sort((a, b) => b.n - a.n);
  const top = blobs.slice(0, 15).sort((a, b) => a.y - b.y || a.x - b.x);
  return { W, HH, blobs: top.map((b) => ({ fx: +(b.x / W).toFixed(4), fy: +(b.y / HH).toFixed(4), r: +((b.bw + b.bh) / 4 / W).toFixed(4), n: b.n })) };
});
console.log(JSON.stringify(result, null, 1));
writeFileSync('artifacts/wip-magic/medallions.json', JSON.stringify(result, null, 1));
await browser.close();
