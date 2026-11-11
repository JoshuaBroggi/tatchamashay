// Procedural PNG textures for the chest (wood planks and rusty iron), drawn
// pixel by pixel so the build needs no browser or canvas library. Patterns
// follow the look of the design mockup's render/chest.html.

import zlib from 'node:zlib';

function png(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 1; // "sub" filter: smooth gradients compress far better
    for (let x = 0; x < w * 3; x++) {
      const i = (y * w * 3) + x;
      raw[row + 1 + x] = (rgb[i] - (x >= 3 ? rgb[i - 3] : 0)) & 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y, seed, wrap) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = (v) => (wrap ? ((v % wrap) + wrap) % wrap : v);
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(w(xi), yi, seed), b = hash(w(xi + 1), yi, seed);
  const c = hash(w(xi), yi + 1, seed), d = hash(w(xi + 1), yi + 1, seed);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f, seed + i * 17); amp /= 2; f *= 2; }
  return v;
}

const clamp = (v) => Math.max(0, Math.min(255, v));

// Planks run along `u`; there are `planks` of them stacked along `v`.
// `across: true` swaps the axes (for the lid, whose UVs wrap around the arc).
export function woodPNG({ size = 512, planks = 5, seed = 5, across = false }) {
  const px = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let u = x / size, v = 1 - y / size; // texture row 0 is the top (v = 1)
    if (across) [u, v] = [v, u];
    const pv = v * planks, p = Math.floor(pv), fv = pv - p;
    const tone = hash(p, 1, seed);
    let r = 92 + tone * 34, g = 55 + tone * 18, b = 28 + tone * 10;
    const warp = fbm(u * 3, pv * 2 + p * 7, seed) * 5;
    const grain = Math.sin((fv * 9 + warp) * Math.PI * 2);
    const fine = fbm(u * 40, pv * 6, seed + 3, 2);
    const k = 0.86 + 0.09 * grain + 0.12 * (fine - 0.5);
    r *= k; g *= k; b *= k;
    const edge = Math.min(fv, 1 - fv);
    if (edge < 0.03) { const d = 0.25 + 0.75 * (edge / 0.03); r *= d; g *= d; b *= d; }
    const dirt = across ? 0 : Math.max(0, 0.18 - v) * 1.6; // grime near the ground
    r = r * (1 - dirt) + 40 * dirt; g = g * (1 - dirt) + 32 * dirt; b = b * (1 - dirt) + 14 * dirt;
    if (!across && v < 0.14 && fbm(u * 18, v * 18, seed + 9) > 0.62) { r = r * 0.5 + 38; g = g * 0.5 + 52; b = b * 0.5 + 20; } // moss
    const i = (y * size + x) * 3;
    px[i] = clamp(r); px[i + 1] = clamp(g); px[i + 2] = clamp(b);
  }
  return png(size, size, px);
}

export function ironPNG({ size = 256, seed = 3 }) {
  const px = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * 8, v = y / size * 8;
    const n = fbm(u, v, seed);
    let r = 70 + n * 40, g = 64 + n * 34, b = 58 + n * 30;
    const rust = fbm(u * 1.5 + 9, v * 1.5, seed + 5);
    if (rust > 0.55) { const t = Math.min(1, (rust - 0.55) * 5); r = r * (1 - t) + 140 * t; g = g * (1 - t) + 72 * t; b = b * (1 - t) + 34 * t; }
    const i = (y * size + x) * 3;
    px[i] = clamp(r); px[i + 1] = clamp(g); px[i + 2] = clamp(b);
  }
  return png(size, size, px);
}
