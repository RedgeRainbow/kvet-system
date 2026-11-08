/* Windows metafiles in presentations: a WMF / EMF that wraps a picture gives the picture back; an EMF drawing becomes SVG
   (clipping and the picture frame respected). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { metafileToBlob } from '../public/js/emf.js';

// a 2x1 24-bit DIB (BITMAPINFOHEADER + pixels)
const dib = () => { const b = new Uint8Array(40 + 8), v = new DataView(b.buffer); v.setUint32(0, 40, true); v.setInt32(4, 2, true); v.setInt32(8, 1, true); v.setUint16(12, 1, true); v.setUint16(14, 24, true); b.set([0, 0, 255, 0, 255, 0], 40); return b; };
const rec = (type, body) => { const b = new Uint8Array(8 + body.length), v = new DataView(b.buffer); v.setUint32(0, type, true); v.setUint32(4, b.length, true); b.set(body, 8); return b; };
const ints = (...a) => { const b = new Uint8Array(a.length * 4), v = new DataView(b.buffer); a.forEach((x, i) => v.setInt32(i * 4, x, true)); return b; };
const cat = (...parts) => { const n = parts.reduce((s, p) => s + p.length, 0), o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
// EMF header: bounds 0,0,99,49; frame 0,0,2000,1000 (0.01 mm); device 100x50 px for 20x10 mm -> 5 px/mm
const header = () => { const body = new Uint8Array(100), v = new DataView(body.buffer); [0, 0, 99, 49, 0, 0, 2000, 1000].forEach((x, i) => v.setInt32(i * 4, x, true)); v.setUint32(32, 0x464d4520, true); v.setInt32(64, 100, true); v.setInt32(68, 50, true); v.setInt32(72, 20, true); v.setInt32(76, 10, true); return rec(1, body); };

test('a WMF that wraps a picture gives the picture back', async () => {
  const d = dib(), wmfHead = new Uint8Array(18); new DataView(wmfHead.buffer).setUint16(2, 9, true);
  const r = new Uint8Array(26 + d.length), v = new DataView(r.buffer); v.setUint32(0, r.length / 2, true); v.setUint16(4, 0x0b41, true); r.set(d, 26);
  const end = new Uint8Array(6); new DataView(end.buffer).setUint32(0, 3, true);
  const b = await metafileToBlob(cat(wmfHead, r, end), 'wmf'); assert.equal(b.type, 'image/bmp');
  const bytes = new Uint8Array(await b.arrayBuffer()); assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'BM'); assert.equal(new DataView(bytes.buffer).getUint32(10, true), 54, 'pixels after file + info header');
});

test('an EMF drawing becomes SVG: frame as extent, pens / brushes, text, clipping', async () => {
  const pen = rec(38, ints(1, 0, 2, 0, 0x0000ff)), brush = rec(39, ints(2, 0, 0x00ff00)), sel = h => rec(37, ints(h));
  const rect = rec(43, ints(10, 10, 60, 40)), clip = rec(30, ints(0, 0, 50, 50));
  const s = 'Hi', t = new Uint8Array(76 - 8 + s.length * 2), tv = new DataView(t.buffer); [10, 20].forEach((x, i) => tv.setInt32(28 + i * 4, x, true)); tv.setUint32(36, s.length, true); tv.setUint32(40, 76, true); for (let i = 0; i < s.length; i++) tv.setUint16(68 + i * 2, s.charCodeAt(i), true);
  const b = await metafileToBlob(cat(header(), pen, sel(1), brush, sel(2), clip, rect, rec(84, t), rec(14, ints(0, 0, 0))), 'emf');
  assert.equal(b.type, 'image/svg+xml'); const svg = await b.text();
  assert.match(svg, /viewBox="0 0 100 50"/, 'extent from the frame (20 mm x 5 px/mm)');
  assert.match(svg, /<rect x="10" y="10" width="50" height="30"\s+fill="rgb\(0,255,0\)"[^>]*stroke="rgb\(255,0,0\)"/);
  assert.match(svg, /clip-path="url\(#c0\)"/); assert.match(svg, /<clipPath id="c0"><rect x="0" y="0" width="50" height="50"\/>/);
  assert.match(svg, />Hi<\/text>/);
});

test('an EMF that holds one picture gives the picture back', async () => {
  const d = dib(), body = new Uint8Array(80 - 8), v = new DataView(body.buffer); v.setUint32(48 - 8, 80, true); v.setUint32(52 - 8, 40, true); v.setUint32(56 - 8, 120, true); v.setUint32(60 - 8, 8, true);
  const r = rec(81, cat(body, d)); const b = await metafileToBlob(cat(header(), r, rec(14, ints(0, 0, 0))), 'emf'); assert.equal(b.type, 'image/bmp');
});
