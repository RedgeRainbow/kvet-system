/* Minimal QR Code encoder: byte mode, error correction level M, versions 1-12 (up to ~260 bytes), automatic mask choice.
   qrSvg(text) -> SVG string. Verified against OpenCV's decoder in the test suite. */
const ECC_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26];
const BLK_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 8, 9, 9, 10, 10, 11, 13, 14];

const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; } return r; };
const dataWords = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLK_M[v];

/* GF(256) Reed-Solomon */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGen(deg) { let p = [1]; for (let i = 0; i < deg; i++) { const n = new Array(p.length + 1).fill(0); for (let j = 0; j < p.length; j++) { n[j] ^= p[j]; n[j + 1] ^= mul(p[j], EXP[i]); } p = n; } return p; }
function rsRem(data, deg) { const g = rsGen(deg), r = new Array(deg).fill(0); for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < deg; i++) r[i] ^= mul(g[i + 1], f); } return r; }

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1; for (; ver <= 12; ver++) { const cc = ver <= 9 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataWords(ver) * 8) break; }
  if (ver > 12) throw new Error('qr too long');
  const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
  const cap = dataWords(ver) * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  // blocks + ECC + interleave
  const nb = BLK_M[ver], ecc = ECC_M[ver], raw = Math.floor(rawModules(ver) / 8), short = Math.floor(raw / nb), nShort = nb - (raw % nb), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) { const len = short - ecc + (i < nShort ? 0 : 1); const d = data.slice(k, k + len); k += len; blocks.push({ d, e: rsRem(d, ecc) }); }
  const all = []; for (let i = 0; i < short - ecc + 1; i++) blocks.forEach(b => { if (i < b.d.length) all.push(b.d[i]); });
  for (let i = 0; i < ecc; i++) blocks.forEach(b => all.push(b.e[i]));

  const size = ver * 4 + 17, M = Array.from({ length: size }, () => new Array(size).fill(false)), F = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < size && y < size) { M[y][x] = v; F[y][x] = true; } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const na = ver === 1 ? 0 : Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
  for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
  pos.forEach((x, i) => pos.forEach((y, j) => { if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const fmt = mask => {
    const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i)); set(8, size - 8, true);
  };
  fmt(0);
  if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const c = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), d = Math.floor(i / 3); set(a, d, c); set(d, a, c); } }
  // data placement
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
      if (!F[y][x] && k < all.length * 8) { M[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
    }
  }
  const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && masks[m](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => {
    let p = 0;
    for (let a = 0; a < size; a++) for (const get of [(i) => M[a][i], (i) => M[i][a]]) {
      let run = 1; for (let i = 1; i < size; i++) { if (get(i) === get(i - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      for (let i = 0; i + 10 < size; i++) { const s = []; for (let j = 0; j < 11; j++) s.push(get(i + j) ? 1 : 0); const j = s.join(''); if (j === '10111010000' || j === '00001011101') p += 40; }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3;
    let dark = 0; for (const r of M) for (const c of r) if (c) dark++;
    return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  };
  let best = 0, bp = Infinity;
  for (let m = 0; m < 8; m++) { apply(m); fmt(m); const p = penalty(); if (p < bp) { bp = p; best = m; } apply(m); }
  apply(best); fmt(best);
  return M;
}

/** @param {any} [text] @param {any} o1 */
export function qrSvg(text, { margin = 2, px = 0 } = {}) {
  const M = qrMatrix(text), n = M.length, d = [];
  for (let y = 0; y < n; y++) { let x = 0; while (x < n) { if (M[y][x]) { let e = x; while (e < n && M[y][e]) e++; d.push(`M${x + margin} ${y + margin}h${e - x}v1h-${e - x}z`); x = e; } else x++; } }
  const s = n + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" ${px ? `width="${px}" height="${px}"` : ''} shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d.join('')}" fill="#000"/></svg>`;
}
