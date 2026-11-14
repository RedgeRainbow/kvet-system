/* Fonts for server-made PDFs: reads a WOFF (version 1) file, rebuilds the TrueType file inside it and reads the few tables a
   PDF needs: which glyph draws which character (cmap), how wide each glyph is (hmtx), the vertical measures (head, hhea, OS/2) and the kerning pairs (GPOS). */
const inflate = async u8 => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
export const deflate = async u8 => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());

/** @param {ArrayBuffer | Uint8Array} file a .woff (or already a .ttf) */
export async function loadFont(file) {
  let b = file instanceof Uint8Array ? file : new Uint8Array(file);
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) === 'wOFF') b = await woffToSfnt(b);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), n = v.getUint16(4), /** @type {Record<string, [number, number]>} */ T = {};
  if (v.getUint32(0) !== 0x00010000) throw new Error('font: only TrueType outlines are supported');
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; T[String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])] = [v.getUint32(o + 8), v.getUint32(o + 12)]; }
  const need = k => { if (!T[k]) throw new Error('font: no ' + k + ' table'); return T[k][0]; };
  const head = need('head'), hhea = need('hhea'), maxp = need('maxp'), hmtx = need('hmtx'), os2 = T['OS/2']?.[0];
  const upm = v.getUint16(head + 18), nGlyphs = v.getUint16(maxp + 4), nH = v.getUint16(hhea + 34);
  const typo = os2 !== undefined && (v.getUint16(os2 + 62) & 0x80) !== 0;                    // USE_TYPO_METRICS
  const ascent = typo ? v.getInt16(os2 + 68) : v.getInt16(hhea + 4), descent = typo ? -v.getInt16(os2 + 70) : -v.getInt16(hhea + 6), lineGap = typo ? v.getInt16(os2 + 72) : v.getInt16(hhea + 8);
  const adv = new Uint16Array(nGlyphs); for (let g = 0; g < nGlyphs; g++) adv[g] = v.getUint16(hmtx + Math.min(g, nH - 1) * 4);
  // cmap: the Unicode subtable with the widest range (format 12, else format 4)
  const cm = need('cmap'), nSub = v.getUint16(cm + 2); let best = -1, bestFmt = 0;
  for (let i = 0; i < nSub; i++) { const pid = v.getUint16(cm + 4 + i * 8), eid = v.getUint16(cm + 6 + i * 8), off = cm + v.getUint32(cm + 8 + i * 8), fmt = v.getUint16(off); if ((pid === 0 || (pid === 3 && (eid === 1 || eid === 10))) && (fmt === 12 || fmt === 4) && fmt >= bestFmt) { best = off; bestFmt = fmt; } }
  if (best < 0) throw new Error('font: no Unicode cmap');
  /** @type {Map<number, number>} */ const map = new Map();
  if (bestFmt === 12) { const ng = v.getUint32(best + 12); for (let i = 0; i < ng; i++) { const o = best + 16 + i * 12, s = v.getUint32(o), e = v.getUint32(o + 4), g = v.getUint32(o + 8); for (let ch = s; ch <= e; ch++) map.set(ch, g + ch - s); } }
  else {
    const segX2 = v.getUint16(best + 6), endO = best + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let i = 0; i < segX2; i += 2) { const e = v.getUint16(endO + i), s = v.getUint16(startO + i), d = v.getInt16(deltaO + i), r = v.getUint16(rangeO + i); if (s === 0xffff) break;
      for (let ch = s; ch <= e; ch++) { let g; if (r === 0) g = (ch + d) & 0xffff; else { const go = rangeO + i + r + (ch - s) * 2; g = v.getUint16(go); if (g) g = (g + d) & 0xffff; } if (g) map.set(ch, g); } }
  }
  return { ttf: slim(b), upm, ascent, descent, lineGap, nGlyphs, glyph: ch => map.get(ch) || 0, has: ch => map.has(ch), advance: g => adv[g] || 0, kern: kerning(v, T) };
}
/* a TrueType file from its tables */
function sfnt(tables) {
  const n = tables.length; let size = 12 + n * 16; for (const t of tables) size += (t.data.length + 3) & ~3;
  const out = new Uint8Array(size), ov = new DataView(out.buffer), e = Math.floor(Math.log2(n)), sr = (1 << e) * 16;
  ov.setUint32(0, 0x00010000); ov.setUint16(4, n); ov.setUint16(6, sr); ov.setUint16(8, e); ov.setUint16(10, n * 16 - sr);
  let pos = 12 + n * 16;
  tables.forEach((t, i) => {
    const o = 12 + i * 16; for (let k = 0; k < 4; k++) out[o + k] = t.tag.charCodeAt(k);
    out.set(t.data, pos); let sum = 0; for (let k = pos; k < pos + ((t.data.length + 3) & ~3); k += 4) sum = (sum + ov.getUint32(k)) >>> 0;
    ov.setUint32(o + 4, sum); ov.setUint32(o + 8, pos); ov.setUint32(o + 12, t.data.length); pos += (t.data.length + 3) & ~3;
  });
  return out;
}
const tablesOf = b => { const v = new DataView(b.buffer, b.byteOffset, b.byteLength), n = v.getUint16(4), out = []; for (let i = 0; i < n; i++) { const o = 12 + i * 16; out.push({ tag: String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]), data: b.subarray(v.getUint32(o + 8), v.getUint32(o + 8) + v.getUint32(o + 12)) }); } return out; };
/* the file put into a PDF: only the tables that draw glyphs (a PDF reader looks glyphs up by number and takes the widths
   from the PDF itself, so the character map, kerning, substitutions and names are dead weight there) */
const PDF_TABLES = new Set(['head', 'hhea', 'maxp', 'hmtx', 'loca', 'glyf', 'cvt ', 'fpgm', 'prep']);
const slim = b => sfnt(tablesOf(b).filter(t => PDF_TABLES.has(t.tag)));
async function woffToSfnt(w) {
  const v = new DataView(w.buffer, w.byteOffset, w.byteLength), n = v.getUint16(12), tables = [];
  if (v.getUint32(4) !== 0x00010000) throw new Error('font: only TrueType outlines are supported');
  for (let i = 0; i < n; i++) { const o = 44 + i * 20, off = v.getUint32(o + 4), comp = v.getUint32(o + 8), orig = v.getUint32(o + 12); let data = w.subarray(off, off + comp); if (comp < orig) data = await inflate(data); if (data.length !== orig) throw new Error('font: bad WOFF table'); tables.push({ tag: String.fromCharCode(...w.subarray(o, o + 4)), data }); }
  return sfnt(tables);
}

/* Kerning: the "kern" feature of the GPOS table (pair adjustment, formats 1 and 2, also behind an extension lookup).
   Browsers apply it by default, so the server must as well - or its lines come out a little wider than the browser's and
   break at other words. Returns the change of the first glyph's advance, in font units. */
function kerning(v, T) {
  if (!T.GPOS) return () => 0;
  const G = T.GPOS[0], u = o => v.getUint16(o), fl = G + u(G + 6), ll = G + u(G + 8), idx = new Set();
  for (let i = 0, n = u(fl); i < n; i++) { const o = fl + 2 + i * 6; if (String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)) !== 'kern') continue; const f = fl + u(o + 4); for (let k = 0, m = u(f + 2); k < m; k++) idx.add(u(f + 4 + k * 2)); }
  const bits = x => { let n = 0; for (; x; x >>= 1) n += x & 1; return n; };
  const coverage = o => { const m = new Map(); if (u(o) === 1) for (let i = 0, n = u(o + 2); i < n; i++) m.set(u(o + 4 + i * 2), i); else for (let i = 0, n = u(o + 2); i < n; i++) { const r = o + 4 + i * 6, s = u(r), e = u(r + 2), c = u(r + 4); for (let g = s; g <= e; g++) m.set(g, c + g - s); } return m; };
  const classDef = o => { const m = new Map(); if (u(o) === 1) { const s = u(o + 2); for (let i = 0, n = u(o + 4); i < n; i++) m.set(s + i, u(o + 6 + i * 2)); } else for (let i = 0, n = u(o + 2); i < n; i++) { const r = o + 4 + i * 6, c = u(r + 4); for (let g = u(r); g <= u(r + 2); g++) m.set(g, c); } return m; };
  /** @type {((a: number, b: number) => number | null)[][]} */ const lookups = [];
  for (const li of [...idx].sort((a, b) => a - b)) {
    const L = ll + u(ll + 2 + li * 2), subs = []; let type = u(L);
    for (let i = 0, n = u(L + 4); i < n; i++) {
      let s = L + u(L + 6 + i * 2), ty = type; if (ty === 9) { ty = u(s + 2); s += v.getUint32(s + 4); } if (ty !== 2) continue;
      const fmt = u(s), cov = coverage(s + u(s + 2)), vf1 = u(s + 4), vf2 = u(s + 6), s1 = bits(vf1) * 2, s2 = bits(vf2) * 2, xa = vf1 & 4 ? bits(vf1 & 3) * 2 : -1;
      if (fmt === 1) subs.push((a, b) => { const ci = cov.get(a); if (ci === undefined) return null; const ps = s + u(s + 10 + ci * 2), rec = 2 + s1 + s2; let lo = 0, hi = u(ps) - 1; while (lo <= hi) { const mid = (lo + hi) >> 1, r = ps + 2 + mid * rec, g = u(r); if (g === b) return xa < 0 ? 0 : v.getInt16(r + 2 + xa); if (g < b) lo = mid + 1; else hi = mid - 1; } return null; });
      else if (fmt === 2) { const c1 = classDef(s + u(s + 8)), c2 = classDef(s + u(s + 10)), n2 = u(s + 14), rec = s1 + s2; subs.push((a, b) => (cov.has(a) ? (xa < 0 ? 0 : v.getInt16(s + 16 + ((c1.get(a) || 0) * n2 + (c2.get(b) || 0)) * rec + xa)) : null)); }
    }
    if (subs.length) lookups.push(subs);
  }
  const memo = new Map();
  return (a, b) => { const key = a * 65536 + b; let k = memo.get(key); if (k === undefined) { k = 0; for (const subs of lookups) for (const f of subs) { const x = f(a, b); if (x !== null) { k += x; break; } } memo.set(key, k); } return k; };
}
