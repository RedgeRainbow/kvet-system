/* A small PDF writer for server-made documents (certificates): pages in CSS pixels (96 per inch, origin top left),
   text in embedded TrueType fonts (any Unicode the font covers; selectable and searchable), PNG pictures with
   transparency (prepared by packImage), lines, rectangles. No dependencies; runs in a Worker. */
import { deflate } from './font.js';

const enc = new TextEncoder(), K = 0.75;                       // CSS px -> PDF points
const n2 = x => (Math.round(x * 1000) / 1000).toString();
const hex4 = g => g.toString(16).padStart(4, '0');
const rgbOf = c => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || '#000'); let h = m ? m[1] : '000'; if (h.length === 3) h = h.replace(/./g, x => x + x); return [0, 2, 4].map(i => n2(parseInt(h.slice(i, i + 2), 16) / 255)).join(' '); };

export function pdfDoc({ title = '', author = '' } = {}) {
  /** @type {any[]} */ const fonts = [], images = [], pages = [];
  /** fonts: a list in order of preference - a character missing from the first is taken from the next */
  const addFont = (font, name) => { const f = { font, name, id: 'F' + (fonts.length + 1), used: new Map() }; fonts.push(f); return f; };
  const addImage = img => { const x = { img, id: 'I' + (images.length + 1) }; images.push(x); return x; };
  /* runs of one font each for a text in a fallback chain */
  const runs = (chain, text) => {
    const out = []; for (const ch of String(text)) { const cp = ch.codePointAt(0) || 0, f = chain.find(x => x.font.has(cp)) || chain[0], g = f.font.glyph(cp); f.used.set(g, cp); const last = out.at(-1); if (last && last.f === f) { last.k.push(f.font.kern(last.g.at(-1), g)); last.g.push(g); } else out.push({ f, g: [g], k: [] }); }
    for (const r of out) r.w = r.g.reduce((s, g) => s + r.f.font.advance(g), 0) + r.k.reduce((s, k) => s + k, 0);
    return out;
  };
  const width = (chain, text, size) => runs(chain, text).reduce((w, r) => w + r.w * size / r.f.font.upm, 0);
  function page(wpx = 794, hpx = 1123) {
    const ops = [], H = hpx, P = { w: wpx, h: hpx, ops, xo: new Set(), fo: new Set() };
    pages.push(P);
    return {
      width,
      /* text with its BASELINE at y */
      text(chain, text, x, y, size, color = '#000') {
        let cx = x;
        for (const r of runs(chain, text)) {
          P.fo.add(r.f); const s = 1000 / r.f.font.upm; let tj = '<';
          r.g.forEach((g, i) => { tj += hex4(g); if (r.k[i]) tj += `> ${n2(-r.k[i] * s)} <`; });
          ops.push(`BT /${r.f.id} ${n2(size * K)} Tf ${rgbOf(color)} rg 1 0 0 1 ${n2(cx * K)} ${n2((H - y) * K)} Tm [${tj}>] TJ ET`); cx += r.w * size / r.f.font.upm;
        }
        return cx - x;
      },
      image(im, x, y, w, h) { P.xo.add(im); ops.push(`q ${n2(w * K)} 0 0 ${n2(h * K)} ${n2(x * K)} ${n2((H - y - h) * K)} cm /${im.id} Do Q`); },
      rect(x, y, w, h, { fill = '', stroke = '', line = 1, radius = 0 } = {}) {
        const X = x * K, Y = (H - y - h) * K, W = w * K, Hh = h * K, r = Math.min(radius * K, W / 2, Hh / 2), c = r * 0.5523;
        const path = r ? `${n2(X + r)} ${n2(Y)} m ${n2(X + W - r)} ${n2(Y)} l ${n2(X + W - r + c)} ${n2(Y)} ${n2(X + W)} ${n2(Y + r - c)} ${n2(X + W)} ${n2(Y + r)} c ${n2(X + W)} ${n2(Y + Hh - r)} l ${n2(X + W)} ${n2(Y + Hh - r + c)} ${n2(X + W - r + c)} ${n2(Y + Hh)} ${n2(X + W - r)} ${n2(Y + Hh)} c ${n2(X + r)} ${n2(Y + Hh)} l ${n2(X + r - c)} ${n2(Y + Hh)} ${n2(X)} ${n2(Y + Hh - r + c)} ${n2(X)} ${n2(Y + Hh - r)} c ${n2(X)} ${n2(Y + r)} l ${n2(X)} ${n2(Y + r - c)} ${n2(X + r - c)} ${n2(Y)} ${n2(X + r)} ${n2(Y)} c h` : `${n2(X)} ${n2(Y)} ${n2(W)} ${n2(Hh)} re`;
        ops.push(`q ${fill ? rgbOf(fill) + ' rg ' : ''}${stroke ? `${rgbOf(stroke)} RG ${n2(line * K)} w ` : ''}${path} ${fill && stroke ? 'B' : fill ? 'f' : 'S'} Q`);
      },
      /* a polyline (open), e.g. a tick mark */
      path(points, { stroke = '#000', line = 1 } = {}) { ops.push(`q ${rgbOf(stroke)} RG ${n2(line * K)} w 1 J 1 j ${points.map(([x, y], i) => `${n2(x * K)} ${n2((H - y) * K)} ${i ? 'l' : 'm'}`).join(' ')} S Q`); },
      /* many small black squares in one go (a QR code) */
      cells(list, color = '#000') { if (list.length) ops.push(`q ${rgbOf(color)} rg ${list.map(([x, y, w, h]) => `${n2(x * K)} ${n2((H - y - h) * K)} ${n2(w * K)} ${n2(h * K)} re`).join(' ')} f Q`); },
    };
  }
  async function bytes() {
    /** @type {(Uint8Array | null)[]} */ const objs = [null];                                     // 1-based object numbers
    const add = body => { objs.push(typeof body === 'string' ? enc.encode(body) : body); return objs.length - 1; };
    const reserve = () => { objs.push(null); return objs.length - 1; };
    const stream = async (dict, data, z = true) => { const d = z ? await deflate(data) : data, head = enc.encode(`<< ${dict}${z ? ' /Filter /FlateDecode' : ''} /Length ${d.length} >>\nstream\n`), tail = enc.encode('\nendstream'); const out = new Uint8Array(head.length + d.length + tail.length); out.set(head); out.set(d, head.length); out.set(tail, head.length + d.length); return out; };
    const catalog = reserve(), tree = reserve();
    for (const f of fonts) {
      if (!f.used.size) continue; const F = f.font, s = 1000 / F.upm, gl = [...f.used.keys()].sort((a, b) => a - b);
      F.z ||= deflate(F.ttf);                                   // compressed once per font, not once per document
      const file = add(await stream(`/Length1 ${F.ttf.length} /Filter /FlateDecode`, await F.z, false));
      const desc = add(`<< /Type /FontDescriptor /FontName /${f.name} /Flags 4 /FontBBox [${n2(-200)} ${n2(-F.descent * s)} 1300 ${n2(F.ascent * s)}] /ItalicAngle 0 /Ascent ${n2(F.ascent * s)} /Descent ${n2(-F.descent * s)} /CapHeight ${n2(F.ascent * s * 0.7)} /StemV 80 /FontFile2 ${file} 0 R >>`);
      const cid = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${f.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 1000 /W [${gl.map(g => `${g} [${n2(F.advance(g) * s)}]`).join(' ')}] /CIDToGIDMap /Identity >>`);
      const u16 = cp => (cp > 0xffff ? hex4(0xd800 + ((cp - 0x10000) >> 10)) + hex4(0xdc00 + ((cp - 0x10000) & 0x3ff)) : hex4(cp));
      const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n` + chunk(gl, 100).map(part => `${part.length} beginbfchar\n${part.map(g => `<${hex4(g)}> <${u16(f.used.get(g))}>`).join('\n')}\nendbfchar`).join('\n') + '\nendcmap CMapName currentdict /CMap defineresource pop end end';
      const tu = add(await stream('', enc.encode(cmap)));
      f.obj = add(`<< /Type /Font /Subtype /Type0 /BaseFont /${f.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tu} 0 R >>`);
    }
    for (const x of images) {
      const { w, h, rgb, alpha } = x.img; let sm = '';
      const parms = n => ` /DecodeParms << /Predictor 15 /Colors ${n} /BitsPerComponent 8 /Columns ${w} >>`;
      if (alpha) sm = ` /SMask ${add(await stream(`/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode${parms(1)}`, alpha, false))} 0 R`;
      x.obj = add(await stream(`/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${parms(3)}${sm}`, rgb, false));
    }
    const kids = [];
    for (const P of pages) {
      const content = add(await stream('', enc.encode(P.ops.join('\n'))));
      kids.push(add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${n2(P.w * K)} ${n2(P.h * K)}] /Contents ${content} 0 R /Resources << /Font << ${[...P.fo].map(f => `/${f.id} ${f.obj} 0 R`).join(' ')} >> /XObject << ${[...P.xo].map(i => `/${i.id} ${i.obj} 0 R`).join(' ')} >> >> >>`));
    }
    objs[tree] = enc.encode(`<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`);
    objs[catalog] = enc.encode(`<< /Type /Catalog /Pages ${tree} 0 R >>`);
    const pdfStr = s => '<feff' + [...String(s)].map(ch => { const cp = ch.codePointAt(0) || 0; return cp > 0xffff ? hex4(0xd800 + ((cp - 0x10000) >> 10)) + hex4(0xdc00 + ((cp - 0x10000) & 0x3ff)) : hex4(cp); }).join('') + '>';
    const info = add(`<< /Title ${pdfStr(title)} /Author ${pdfStr(author)} /Producer ${pdfStr('KVET')} >>`);
    /** @type {Uint8Array[]} */ const parts = [enc.encode('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')], offs = [0]; let pos = parts[0].length;
    for (let i = 1; i < objs.length; i++) { const head = enc.encode(`${i} 0 obj\n`), tail = enc.encode('\nendobj\n'); offs[i] = pos; parts.push(head, /** @type {Uint8Array} */ (objs[i]), tail); pos += head.length + /** @type {Uint8Array} */ (objs[i]).length + tail.length; }
    parts.push(enc.encode(`xref\n0 ${objs.length}\n0000000000 65535 f \n${offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
  }
  return { addFont, addImage, page, bytes, width };
}
/* PNG row filters (none / sub / up / Paeth, whichever leaves the smallest numbers in a row) before compression: pictures
   then take about as much room in the PDF as the PNG file did - without them, three to four times more. */
function predict(px, w, h, n) {
  const row = w * n, out = new Uint8Array((row + 1) * h), cand = [new Uint8Array(row), new Uint8Array(row), new Uint8Array(row), new Uint8Array(row)], types = [0, 1, 2, 4];
  for (let y = 0; y < h; y++) {
    const o = y * row, sums = [0, 0, 0, 0];
    for (let i = 0; i < row; i++) {
      const v = px[o + i], a = i >= n ? px[o + i - n] : 0, b = y ? px[o + i - row] : 0, c = y && i >= n ? px[o + i - row - n] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c), pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const f = [v, (v - a) & 255, (v - b) & 255, (v - pr) & 255]; for (let k = 0; k < 4; k++) { cand[k][i] = f[k]; sums[k] += f[k] < 128 ? f[k] : 256 - f[k]; }
    }
    let best = 0; for (let k = 1; k < 4; k++) if (sums[k] < sums[best]) best = k;
    out[y * (row + 1)] = types[best]; out.set(cand[best], y * (row + 1) + 1);
  }
  return out;
}
/* A picture made ready for PDFs: its colours and its transparency as two compressed streams, in one block of bytes
   ([width][height][colour bytes][alpha bytes] + the streams). Preparing costs processor time, so it is done once per
   picture and the block is kept (certpdf.js). addImage() takes the opened block. */
export async function packImage(img) {
  const rgb = await deflate(predict(img.rgb, img.w, img.h, 3)), alpha = img.alpha ? await deflate(predict(img.alpha, img.w, img.h, 1)) : new Uint8Array(0);
  const out = new Uint8Array(16 + rgb.length + alpha.length), v = new DataView(out.buffer);
  v.setUint32(0, img.w); v.setUint32(4, img.h); v.setUint32(8, rgb.length); v.setUint32(12, alpha.length); out.set(rgb, 16); out.set(alpha, 16 + rgb.length); return out;
}
/** @param {Uint8Array} b */
export function openImage(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), w = v.getUint32(0), h = v.getUint32(4), n = v.getUint32(8), m = v.getUint32(12);
  if (!w || !h || 16 + n + m !== b.length) throw new Error('pdf: bad prepared image');
  return { w, h, rgb: b.subarray(16, 16 + n), alpha: m ? b.subarray(16 + n) : null };
}
const chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
