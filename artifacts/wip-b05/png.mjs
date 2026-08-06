// Minimal PNG reader (8-bit, colour type 2 or 6) so the density rubric can be
// measured on the REAL rendered field — DOM chrome included — not just on the
// board canvas. No dependencies: node:zlib does the inflate.
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8;
  let w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6)) throw new Error(`unsupported png ${depth}/${ctype}`);
  const bpp = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prior ? prior[x] : 0;
      const c = prior && x >= bpp ? prior[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

const srgb = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

/** Density rubric over a decoded image. tile = probe size in image px. */
export function density(img, { tile = 16, delta = 12, avoid = null } = {}) {
  const { w, h, bpp, data } = img;
  const cols = Math.floor(w / tile), rows = Math.floor(h / tile);
  const feat = new Uint8Array(cols * rows);
  const ratio = new Float64Array(cols * rows);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      let lo = 1e9, hi = -1e9;
      for (let y = 0; y < tile; y += 2) {
        for (let x = 0; x < tile; x += 2) {
          const i = ((ty * tile + y) * w + (tx * tile + x)) * bpp;
          const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          if (l < lo) lo = l;
          if (l > hi) hi = l;
        }
      }
      const k = ty * cols + tx;
      ratio[k] = (srgb(hi) + 0.05) / (srgb(lo) + 0.05);
      feat[k] = hi - lo >= delta ? 1 : 0;
    }
  }
  let featured = 0;
  for (let k = 0; k < feat.length; k++) featured += feat[k];

  const seen = new Uint8Array(cols * rows);
  let maxVoid = 0;
  const stack = [];
  for (let k = 0; k < feat.length; k++) {
    if (feat[k] || seen[k]) continue;
    let n = 0;
    stack.length = 0; stack.push(k); seen[k] = 1;
    while (stack.length) {
      const c = stack.pop();
      n++;
      const cx = c % cols, cy = (c / cols) | 0;
      const nb = [];
      if (cx > 0) nb.push(c - 1);
      if (cx < cols - 1) nb.push(c + 1);
      if (cy > 0) nb.push(c - cols);
      if (cy < rows - 1) nb.push(c + cols);
      for (const m of nb) if (!seen[m] && !feat[m]) { seen[m] = 1; stack.push(m); }
    }
    if (n > maxVoid) maxVoid = n;
  }

  const dz = [];
  const boxes = avoid ? (Array.isArray(avoid) ? avoid : [avoid]) : null;
  if (boxes) {
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const k = ty * cols + tx;
        if (!feat[k]) continue;
        const px = tx * tile, py = ty * tile;
        const inside = boxes.some((b) => px + tile > b.x && px < b.x + b.w && py + tile > b.y && py < b.y + b.h);
        if (!inside) dz.push(ratio[k]);
      }
    }
    dz.sort((a, b) => a - b);
  }
  const q = (arr, p) => (arr.length ? +arr[Math.min(arr.length - 1, Math.floor(arr.length * p))].toFixed(2) : null);
  return {
    grid: `${cols}x${rows}`,
    occupancy: +(featured / (cols * rows) * 100).toFixed(1),
    maxVoid: +(maxVoid / (cols * rows) * 100).toFixed(1),
    deadZoneN: dz.length,
    deadZoneMedian: q(dz, 0.5),
    deadZoneP90: q(dz, 0.9),
  };
}

/** Distinguishable material layers in a crop: luminance bands holding >= 2%. */
export function layers(img, x, y, cw, ch) {
  const { w, bpp, data } = img;
  const hist = new Array(16).fill(0);
  let n = 0;
  for (let yy = y; yy < y + ch; yy++) {
    for (let xx = x; xx < x + cw; xx++) {
      const i = (yy * w + xx) * bpp;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      hist[Math.min(15, Math.floor(l / 16))]++;
      n++;
    }
  }
  return hist.filter((v) => v / n >= 0.02).length;
}
