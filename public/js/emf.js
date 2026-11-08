/* Windows metafiles (EMF / WMF) in presentations, which browsers cannot show.
   - A metafile that just wraps a picture (very common: photos pasted into old decks, previews of embedded objects)
     gives back that picture as a normal image (BMP / JPEG / PNG).
   - An EMF drawing (lines, shapes, text: e.g. an embedded Word / Excel table) is converted to SVG. The common records are
     supported (pens, brushes, polylines / polygons, rectangles, ellipses, paths, text, window / viewport mapping, world
     transform, bitmaps); anything else is skipped.
   metafileToBlob(bytes, ext) -> Blob | null (null: nothing that can be shown). */

const u8 = b => (b instanceof Uint8Array ? b : new Uint8Array(b));
// a DIB (BITMAPINFO + pixels) as a file the browser can open
function dibBlob(bytes, bmiOff, bmiLen, bitsOff, bitsLen) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset), comp = dv.getUint32(bmiOff + 16, true);
  const bits = bytes.subarray(bitsOff, bitsOff + bitsLen);
  if (comp === 4) return new Blob([bits], { type: 'image/jpeg' });             // BI_JPEG
  if (comp === 5) return new Blob([bits], { type: 'image/png' });              // BI_PNG
  const head = new Uint8Array(14), hv = new DataView(head.buffer);
  head[0] = 0x42; head[1] = 0x4d; hv.setUint32(2, 14 + bmiLen + bitsLen, true); hv.setUint32(10, 14 + bmiLen, true);
  return new Blob([head, bytes.subarray(bmiOff, bmiOff + bmiLen), bits], { type: 'image/bmp' });
}
// BITMAPINFO length from its header (header + colour masks + palette)
function bmiLength(bytes, off) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset), hs = dv.getUint32(off, true);
  if (hs === 12) { const bc = dv.getUint16(off + 10, true); return 12 + (bc <= 8 ? (1 << bc) * 3 : 0); }
  const bc = dv.getUint16(off + 14, true), comp = dv.getUint32(off + 16, true), used = dv.getUint32(off + 32, true);
  return hs + (comp === 3 && hs === 40 ? 12 : comp === 6 && hs === 40 ? 16 : 0) + (bc <= 8 ? (used || 1 << bc) * 4 : used * 4);
}

/* ------------------------------------------------------------------ WMF: the embedded picture */
function wmfBlob(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset); let off = dv.getUint32(0, true) === 0x9ac6cdd7 ? 22 : 0;
  off += dv.getUint16(off + 2, true) * 2;                                        // header size in words
  /** @type {any} */ let best = null;
  while (off + 6 <= bytes.length) {
    const size = dv.getUint32(off, true) * 2, fn = dv.getUint16(off + 4, true); if (size < 6 || off + size > bytes.length) break;
    let dib = 0;
    if (fn === 0x0b41) dib = off + 26;                                           // META_DIBSTRETCHBLT
    else if (fn === 0x0940) dib = off + 22;                                      // META_DIBBITBLT
    else if (fn === 0x0f43) dib = off + 28;                                      // META_STRETCHDIB
    if (dib && dib + 40 < off + size) { const bl = bmiLength(bytes, dib), len = off + size - dib - bl; if (!best || len > best.len) best = { dib, bl, len }; }
    if (fn === 0) break; off += size;
  }
  return best ? dibBlob(bytes, best.dib, best.bl, best.dib + best.bl, best.len) : null;
}

/* ------------------------------------------------------------------ EMF */
const STOCK = { 0: { b: '#fff' }, 1: { b: '#c0c0c0' }, 2: { b: '#808080' }, 3: { b: '#404040' }, 4: { b: '#000' }, 5: { b: null }, 6: { p: { c: '#fff', w: 0 } }, 7: { p: { c: '#000', w: 0 } }, 8: { p: null } };
const rgbOf = v => `rgb(${v & 255},${(v >> 8) & 255},${(v >> 16) & 255})`;
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = async blob => { const b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return `data:${blob.type};base64,${btoa(s)}`; };

async function emfBlob(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset), i32 = o => dv.getInt32(o, true), u32 = o => dv.getUint32(o, true), i16 = o => dv.getInt16(o, true), f32 = o => dv.getFloat32(o, true);
  if (u32(0) !== 1) return null;
  // the picture's extent is its frame (0.01 mm, converted with the reference device's pixels per mm), not the tight
  // bounds of what is drawn: PowerPoint fits the frame to the shape
  let bx = i32(8), by = i32(12), bw = i32(16) - bx + 1, bh = i32(20) - by + 1;
  { const kx = i32(72) / (i32(80) || 1), ky = i32(76) / (i32(84) || 1), fx = i32(24) / 100 * kx, fy = i32(28) / 100 * ky, fw = (i32(32) - i32(24)) / 100 * kx, fh = (i32(36) - i32(28)) / 100 * ky;
    if (fw > 1 && fh > 1 && Number.isFinite(fw + fh + fx + fy)) { bx = fx; by = fy; bw = fw; bh = fh; } }
  // pass 1: is it just one picture? (then the picture itself is returned, sharper and smaller than an SVG around it)
  let off = 0, pics = [], vec = 0;
  while (off + 8 <= bytes.length) { const t = u32(off), sz = u32(off + 4); if (sz < 8 || off + sz > bytes.length) break;
    if (t === 81 && u32(off + 52)) pics.push({ off, bmi: off + u32(off + 48), bl: u32(off + 52), bits: off + u32(off + 56), len: u32(off + 60) });
    else if ((t === 76 || t === 77) && u32(off + 88)) pics.push({ off, bmi: off + u32(off + 84), bl: u32(off + 88), bits: off + u32(off + 92), len: u32(off + 96) });
    else if ([3, 4, 5, 6, 7, 42, 43, 44, 54, 84, 85, 86, 87, 88, 89, 90, 91, 62, 63, 64].includes(t) || (t === 76 && !u32(off + 88))) vec++;
    if (t === 14) break; off += sz; }
  if (pics.length === 1 && vec <= 2) { const p = pics[0]; return dibBlob(bytes, p.bmi, p.bl, p.bits, p.len); }

  // pass 2: drawing -> SVG in device units
  const objs = new Map(), out = [];
  let S = { clip: /** @type {number[] | null} */ (null), pen: { c: '#000', w: 0 }, brush: '#fff', font: { h: 12, w: 400, i: false, face: 'Arial' }, tc: '#000', ta: 0, mm: 1, wo: [0, 0], we: [1, 1], vo: [0, 0], ve: [1, 1], xf: [1, 0, 0, 1, 0, 0], cur: [0, 0], fill: 'evenodd' };
  const stack = []; let path = /** @type {any} */ (null); const clips = new Map();
  // clipping: the intersection of clip rectangles (device units), kept with SaveDC / RestoreDC; each drawn element is clipped
  const put = svg => { if (!S.clip) return out.push(svg); const k = S.clip.map(v => v.toFixed(1)).join(','); if (!clips.has(k)) clips.set(k, 'c' + clips.size); out.push(`<g clip-path="url(#${clips.get(k)})">${svg}</g>`); };
  const pt = (x, y) => { const [a, b, c, d, e, f] = S.xf, wx = a * x + c * y + e, wy = b * x + d * y + f;
    if (S.mm === 7 || S.mm === 8) return [(wx - S.wo[0]) * S.ve[0] / (S.we[0] || 1) + S.vo[0] - bx, (wy - S.wo[1]) * S.ve[1] / (S.we[1] || 1) + S.vo[1] - by];
    return [wx - S.wo[0] + S.vo[0] - bx, wy - S.wo[1] + S.vo[1] - by]; };
  const sx = () => { const [a, b] = S.xf; const k = (S.mm === 7 || S.mm === 8) ? Math.abs(S.ve[0] / (S.we[0] || 1)) : 1; return Math.hypot(a, b) * k; };
  const sy = () => { const [, , c, d] = S.xf; const k = (S.mm === 7 || S.mm === 8) ? Math.abs(S.ve[1] / (S.we[1] || 1)) : 1; return Math.hypot(c, d) * k; };
  const stroke = () => (S.pen ? `stroke="${S.pen.c}" stroke-width="${Math.max(1, S.pen.w * sx())}"` : 'stroke="none"');
  const fill = () => `fill="${S.brush || 'none'}" fill-rule="${S.fill}"`;
  const P = (x, y) => pt(x, y).map(v => +v.toFixed(2)).join(',');
  const emit = (d, f, s) => { if (path !== null) { path += d; return; } put(`<path d="${d}" ${f ? fill() : 'fill="none"'} ${s ? stroke() : 'stroke="none"'}/>`); };
  const poly = (n, at, w16, close, f, s, kind = 'L') => { if (!n) return; let d = ''; for (let k = 0; k < n; k++) { const x = w16 ? i16(at + k * 4) : i32(at + k * 8), y = w16 ? i16(at + k * 4 + 2) : i32(at + k * 8 + 4); d += (k ? (kind === 'C' && (k - 1) % 3 === 0 ? 'C' : ' ') : 'M') + P(x, y); if (k === n - 1) S.cur = [x, y]; } emit(d + (close ? 'Z' : ''), f, s); };
  off = 0;
  while (off + 8 <= bytes.length) {
    const t = u32(off), sz = u32(off + 4); if (sz < 8 || off + sz > bytes.length) break; const o = off;
    try {
      switch (t) {
        case 9: S.we = [i32(o + 8), i32(o + 12)]; break; case 10: S.wo = [i32(o + 8), i32(o + 12)]; break;
        case 11: S.ve = [i32(o + 8), i32(o + 12)]; break; case 12: S.vo = [i32(o + 8), i32(o + 12)]; break;
        case 17: S.mm = u32(o + 8); break; case 19: S.fill = u32(o + 8) === 2 ? 'nonzero' : 'evenodd'; break;
        case 22: S.ta = u32(o + 8); break; case 24: S.tc = rgbOf(u32(o + 8)); break;
        case 33: stack.push(JSON.stringify(S)); break;
        case 34: { const n = i32(o + 8); let s; for (let k = 0; k < -n && stack.length; k++) s = stack.pop(); if (s) S = JSON.parse(s); break; }
        case 35: S.xf = [f32(o + 8), f32(o + 12), f32(o + 16), f32(o + 20), f32(o + 24), f32(o + 28)]; break;
        case 36: { const m = [f32(o + 8), f32(o + 12), f32(o + 16), f32(o + 20), f32(o + 24), f32(o + 28)], mode = u32(o + 32), X = S.xf;
          const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3], A[4] * B[0] + A[5] * B[2] + B[4], A[4] * B[1] + A[5] * B[3] + B[5]];
          S.xf = mode === 1 ? [1, 0, 0, 1, 0, 0] : mode === 2 ? mul(m, X) : mode === 3 ? mul(X, m) : m; break; }
        case 37: { const h = u32(o + 8); if (h & 0x80000000) { const s = STOCK[h & 0x7fffffff]; if (s && 'b' in s) S.brush = s.b; if (s && 'p' in s) S.pen = s.p; } else { const x = objs.get(h); if (x?.pen !== undefined) S.pen = x.pen; if (x?.brush !== undefined) S.brush = x.brush; if (x?.font) S.font = x.font; } break; }
        case 38: objs.set(u32(o + 8), { pen: (u32(o + 12) & 15) === 5 ? null : { c: rgbOf(u32(o + 24)), w: i32(o + 16) } }); break;
        case 95: objs.set(u32(o + 8), { pen: (u32(o + 28) & 15) === 5 ? null : { c: rgbOf(u32(o + 40)), w: u32(o + 32) } }); break;
        case 39: { const st = u32(o + 12); objs.set(u32(o + 8), { brush: st === 1 ? null : rgbOf(u32(o + 16)) }); break; }
        case 40: objs.delete(u32(o + 8)); break;
        case 82: { let face = ''; for (let k = 0; k < 32; k++) { const c = dv.getUint16(o + 40 + k * 2, true); if (!c) break; face += String.fromCharCode(c); } objs.set(u32(o + 8), { font: { h: Math.abs(i32(o + 12)) || 12, w: i32(o + 28), i: !!bytes[o + 32], face: face || 'Arial' } }); break; }
        case 27: S.cur = [i32(o + 8), i32(o + 12)]; if (path !== null) path += 'M' + P(...S.cur); break;
        case 54: { const x = i32(o + 8), y = i32(o + 12); if (path !== null) path += 'L' + P(x, y); else put(`<path d="M${P(...S.cur)}L${P(x, y)}" fill="none" ${stroke()}/>`); S.cur = [x, y]; break; }
        case 43: case 42: case 44: { const l = i32(o + 8), tp = i32(o + 12), r = i32(o + 16), b = i32(o + 20), [x1, y1] = pt(l, tp), [x2, y2] = pt(r, b);
          if (t === 42) put(`<ellipse cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}" ${fill()} ${stroke()}/>`);
          else put(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" ${t === 44 ? `rx="${i32(o + 24) * sx() / 2}"` : ''} ${fill()} ${stroke()}/>`); break; }
        case 86: poly(u32(o + 24), o + 28, true, true, true, true); break;   // POLYGON16
        case 87: poly(u32(o + 24), o + 28, true, false, false, true); break; // POLYLINE16
        case 85: poly(u32(o + 24), o + 28, true, false, false, true, 'C'); break;
        case 3: poly(u32(o + 24), o + 28, false, true, true, true); break; case 4: poly(u32(o + 24), o + 28, false, false, false, true); break;
        case 88: case 89: { const n = u32(o + 24); let d = ''; for (let k = 0; k < n; k++) { const x = i16(o + 28 + k * 4), y = i16(o + 30 + k * 4); d += (t === 88 ? (k % 3 === 0 ? 'C' : ' ') : 'L') + P(x, y); if (k === n - 1) S.cur = [x, y]; } if (path !== null) path += d; else put(`<path d="M${P(...S.cur)}${d}" fill="none" ${stroke()}/>`); break; }
        case 90: case 91: { const np = u32(o + 24); let at = o + 32 + np * 4, d = ''; for (let q = 0; q < np; q++) { const n = u32(o + 32 + q * 4); for (let k = 0; k < n; k++) d += (k ? 'L' : 'M') + P(i16(at + k * 4), i16(at + k * 4 + 2)); if (t === 91) d += 'Z'; at += n * 4; } emit(d, t === 91, true); break; }
        case 59: path = ''; break; case 60: break; case 61: if (path !== null) path += 'Z'; break;
        case 62: case 63: case 64: if (path) put(`<path d="${path}" ${t !== 64 ? fill() : 'fill="none"'} ${t !== 62 ? stroke() : 'stroke="none"'}/>`); path = null; break;
        case 84: { // EXTTEXTOUTW
          const rx = i32(o + 36), ry = i32(o + 40), n = u32(o + 44), so = u32(o + 48); if (!n) break;
          let s = ''; for (let k = 0; k < n; k++) s += String.fromCharCode(dv.getUint16(o + so + k * 2, true));
          const [x, y] = (S.ta & 1) ? pt(...S.cur) : pt(rx, ry), fsz = S.font.h * sy(), anchor = (S.ta & 6) === 6 ? 'middle' : (S.ta & 6) === 2 ? 'end' : 'start';
          const base = (S.ta & 24) === 24 ? 'alphabetic' : (S.ta & 8) ? 'text-after-edge' : 'text-before-edge';
          put(`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="${esc(S.font.face)},Arial,sans-serif" font-size="${fsz.toFixed(2)}" ${S.font.w >= 600 ? 'font-weight="700"' : ''} ${S.font.i ? 'font-style="italic"' : ''} fill="${S.tc}" text-anchor="${anchor}" dominant-baseline="${base}" xml:space="preserve">${esc(s)}</text>`); break; }
        case 81: { const bl = u32(o + 52); const [x1, y1] = pt(i32(o + 24), i32(o + 28)), [x2, y2] = pt(i32(o + 24) + i32(o + 72), i32(o + 28) + i32(o + 76));
          if (bl) put(`<image x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" preserveAspectRatio="none" href="${await b64(dibBlob(bytes, o + u32(o + 48), bl, o + u32(o + 56), u32(o + 60)))}"/>`); break; }
        case 76: case 77: { const [x1, y1] = pt(i32(o + 24), i32(o + 28)), [x2, y2] = pt(i32(o + 24) + i32(o + 32), i32(o + 28) + i32(o + 36)), bl = u32(o + 88);
          const r = `x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}"`;
          if (bl) put(`<image ${r} preserveAspectRatio="none" href="${await b64(dibBlob(bytes, o + u32(o + 84), bl, o + u32(o + 92), u32(o + 96)))}"/>`);
          else { const rop = u32(o + 40); const c = rop === 0x42 ? '#000' : rop === 0xff0062 ? '#fff' : S.brush; if (c) put(`<rect ${r} fill="${c}"/>`); } break; }
        case 30: { const [x1, y1] = pt(i32(o + 8), i32(o + 12)), [x2, y2] = pt(i32(o + 16), i32(o + 20)), r = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
          S.clip = S.clip ? [Math.max(S.clip[0], r[0]), Math.max(S.clip[1], r[1]), Math.min(S.clip[2], r[2]), Math.min(S.clip[3], r[3])] : r; break; }
        case 75: if (u32(o + 12) === 5 || !u32(o + 8)) S.clip = null; break;            // EXTSELECTCLIPRGN: reset (region data not supported)
        case 14: off = bytes.length; continue;
        default: break;
      }
    } catch { /* a damaged record: skipped */ }
    off += sz;
  }
  if (!out.length) return null;
  const defs = [...clips].map(([k, id]) => { const [a, b, c, d] = k.split(',').map(Number); return `<clipPath id="${id}"><rect x="${a}" y="${b}" width="${Math.max(0, c - a)}" height="${Math.max(0, d - b)}"/></clipPath>`; }).join('');
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bw} ${bh}" width="${bw}" height="${bh}"><defs>${defs}</defs>${out.join('')}</svg>`], { type: 'image/svg+xml' });
}

export async function metafileToBlob(buf, ext) {
  const bytes = u8(buf);
  try { return ext === 'wmf' ? wmfBlob(bytes) : await emfBlob(bytes); } catch { return null; }
}
