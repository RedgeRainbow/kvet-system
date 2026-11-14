/* Reads a PNG into plain pixels (for embedding in a PDF): every colour type and bit depth, interlaced or not.
   Result: { w, h, rgb: 3 bytes per pixel, alpha: 1 byte per pixel or null when the picture is fully opaque }. */
const inflate = async u8 => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());

export async function decodePng(file) {
  const b = file instanceof Uint8Array ? file : new Uint8Array(file), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 33 || v.getUint32(0) !== 0x89504e47 || v.getUint32(4) !== 0x0d0a1a0a) throw new Error('png: not a PNG file');
  let w = 0, h = 0, depth = 8, type = 6, lace = 0; const idat = [];
  /** @type {{ pal: any, trns: any }} */
  const X = { pal: null, trns: null };
  for (let o = 8; o + 8 <= b.length;) {
    const len = v.getUint32(o), tag = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]), d = b.subarray(o + 8, o + 8 + len);
    if (tag === 'IHDR') { w = v.getUint32(o + 8); h = v.getUint32(o + 12); depth = b[o + 16]; type = b[o + 17]; lace = b[o + 20]; }
    else if (tag === 'PLTE') X.pal = d; else if (tag === 'tRNS') X.trns = d; else if (tag === 'IDAT') idat.push(d); else if (tag === 'IEND') break;
    o += 12 + len;
  }
  if (!w || !h || w * h > 40e6) throw new Error('png: bad size');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; if (!ch) throw new Error('png: bad colour type');
  const raw = await inflate(concat(idat)), bpp = Math.max(1, (ch * depth) >> 3), rgb = new Uint8Array(w * h * 3), alpha = new Uint8Array(w * h).fill(255);
  const max = (1 << depth) - 1; let pos = 0, hasAlpha = false;
  /* one pass: pw x ph pixels at (x0 + i*dx, y0 + j*dy) */
  const pass = (x0, y0, dx, dy) => {
    const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy); if (pw <= 0 || ph <= 0) return;
    const stride = Math.ceil(pw * ch * depth / 8); let prev = new Uint8Array(stride);
    for (let j = 0; j < ph; j++) {
      const f = raw[pos++], line = raw.slice(pos, pos + stride); pos += stride; if (line.length < stride) throw new Error('png: cut off');
      for (let i = 0; i < stride; i++) {                                   // undo the row filter
        const a = i >= bpp ? line[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        if (f === 1) line[i] += a; else if (f === 2) line[i] += up; else if (f === 3) line[i] += (a + up) >> 1;
        else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); line[i] += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      }
      prev = line;
      const sample = k => { if (depth === 8) return line[k]; if (depth === 16) return line[k * 2]; const bit = k * depth; return (line[bit >> 3] >> (8 - depth - (bit & 7))) & max; };
      const to8 = s => (depth >= 8 ? s : Math.round(s * 255 / max));
      for (let i = 0; i < pw; i++) {
        const x = x0 + i * dx, y = y0 + j * dy, q = y * w + x; let r, g, bl, al = 255;
        if (type === 3) { const ix = sample(i); r = X.pal ? X.pal[ix * 3] : 0; g = X.pal ? X.pal[ix * 3 + 1] : 0; bl = X.pal ? X.pal[ix * 3 + 2] : 0; if (X.trns && ix < X.trns.length) al = X.trns[ix]; }
        else if (type === 0) { const s = sample(i); r = g = bl = to8(s); if (X.trns && X.trns.length >= 2 && ((X.trns[0] << 8) | X.trns[1]) === (depth === 16 ? (line[i * 2] << 8) | line[i * 2 + 1] : s)) al = 0; }
        else if (type === 4) { r = g = bl = sample(i * 2); al = sample(i * 2 + 1); }
        else { r = sample(i * ch); g = sample(i * ch + 1); bl = sample(i * ch + 2); if (type === 6) al = sample(i * ch + 3); }
        rgb[q * 3] = r; rgb[q * 3 + 1] = g; rgb[q * 3 + 2] = bl; alpha[q] = al; if (al !== 255) hasAlpha = true;
      }
    }
  };
  if (lace) for (const [x0, y0, dx, dy] of [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]) pass(x0, y0, dx, dy); else pass(0, 0, 1, 1);
  return { w, h, rgb, alpha: hasAlpha ? alpha : null };
}
const concat = list => { const out = new Uint8Array(list.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of list) { out.set(a, o); o += a.length; } return out; };
