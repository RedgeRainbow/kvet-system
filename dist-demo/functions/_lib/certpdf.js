/* The certificate as a PDF, drawn on the server (v3.36).
   Candidates and companies used to receive the certificate's parts - the signature picture among them - and their browser
   put the page together. Now they receive the finished document only: the signature image never leaves the server as a
   file of its own.
   The layout is the one of public/js/cert.js (certHtml + its CSS), measured in CSS pixels on an A4 page of 794 x 1123;
   the office's preview and print still use that browser version, so THE TWO MUST BE CHANGED TOGETHER.
   test/phase4.test.mjs compares the text of both. */
import * as S from '../../public/js/shared.js';
import { qrMatrix } from '../../public/js/qr.js';
import { loadFont } from './font.js';
import { decodePng } from './png.js';
import { pdfDoc, packImage, openImage } from './pdf.js';
import { getSettings, accredKeys } from './core.js';
import { sha } from './auth.js';

const BLUE = '#3568b4', INK = '#111';
/** parsed fonts are kept for the life of the worker (parsing a font for every certificate would be wasted work) */
const fontCache = new Map();
/** prepared pictures, by name: in this worker's memory, then in storage (ctx.keep), made from the PNG only when neither has it */
const imgCache = new Map();
function prepared(ctx, name, load) {
  if (!imgCache.has(name)) {
    if (imgCache.size > 60) imgCache.clear();
    imgCache.set(name, (async () => { const kept = await ctx.keep?.get(name).catch(() => null); if (kept) return kept; const png = await load(); if (!png) return null; const b = await packImage(await decodePng(png)); await ctx.keep?.put(name, b).catch(() => {}); return b; })().catch(() => null).then(b => { if (!b) imgCache.delete(name); return b; }));
  }
  return imgCache.get(name);
}
const fontOf = (ctx, name) => { if (!fontCache.has(name)) fontCache.set(name, ctx.static(`/fonts/${name}.woff`).then(loadFont).catch(e => { fontCache.delete(name); throw e; })); return fontCache.get(name); };
const addressLine = info => ['address', 'phone', 'email', 'website'].map(k => (info?.[k] ? ({ address: 'Address: ', phone: 'Tel: ', email: 'Email ', website: '' }[k]) + info[k] : '')).filter(Boolean).join(' | ');
/* how much the middle text must shrink to fit above the info block - the same estimate as cert.js certScale */
function certScale(parts) {
  const lines = (txt, px) => (txt ? String(txt).split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length * px * 0.52 / 707)), 0) : 0);
  const h = 31 + (parts.n2 ? 27 : 0) + lines(parts.co, 15.7) * 20.4 + 11 + lines(parts.desc, 15.7) * 19.6 + 8 + lines(parts.q1, 21.6) * 27 + (parts.q2 ? lines(parts.q2, 19.6) * 24.6 : 0) + (parts.det ? 6 + lines(parts.det, 14.7) * 19.1 : 0);
  const avail = 1123 - 322 - 324.9 - parts.lower;
  return h <= avail ? 1 : Math.max(0.62, Math.floor(avail / h * 100) / 100);
}
/* Every text of the certificate, as the browser version composes it. Exported for the test that compares the two. */
export function certTexts(c, info = /** @type {any} */ ({})) {
  const s = c.snap, b = s.blank, en = s.lang === 'en';
  const descAz = String(b.descAz || '').replaceAll('{qual}', b.qualAz || ''), descEn = String(b.descEn || '').replaceAll('{qual}', b.qualEn || '');
  const sg = c.sign || (c.esign ? { ...c.esign, mode: 'esign' } : null), names = s.names || { az: '', en: '' };
  const lb = (k, n) => { const l = S.certLabel(b, k), f = x => String(x || '').replaceAll('{0}', n ?? ''); return en ? f(l.en) : [f(l.az), f(l.en)].filter(Boolean).join(' / '); };
  const two = (k, v) => { const l = lb(k); return l ? [l, String(v ?? '')] : []; }, one = (k, v) => { const l = lb(k); return l ? [`${l} - ${v}`] : []; };
  const cr = Number(b.credits) > 0 ? lb('credits', b.credits) : '';
  const left = [two('provider', b.provider), [...one('start', S.fmtDate(c.start)), ...one('end', S.fmtDate(c.end || c.start)), ...(cr ? [cr] : [])]].filter(x => x.length);
  const right = [two('learner', s.att || c.att), s.trainer ? two('trainer', s.trainer) : []].filter(x => x.length);
  const count = cols => cols.reduce((n, x) => n + x.length, 0), co = S.certCompanyLine(s), valid = lb('valid');
  const lower = 18 + Math.max(count(left), count(right)) * 17.6 + 7 + (s.reg ? 27 : 0) + (valid ? 48 : 0);
  const q1 = en ? b.qualEn : b.qualAz, q2 = en ? '' : b.qualEn, desc = en ? descEn : [descAz, descEn].filter(Boolean).join(' / ');
  return {
    en, sg, h1: en ? b.titleEn : b.titleAz, h2: en ? '' : b.titleEn, no: 'No: ' + c.no, intro: lb('intro'),
    n1: names.az && !en ? names.az : '', n2: names.en, co, desc, q1, q2, det: s.details || '', left, right, reg: s.reg || '', valid, expiry: valid ? S.fmtDate(c.expiry) : '',
    k: certScale({ n2: names.az && !en, co, desc, q1, q2, det: s.details, lower }),
    sigL: lb('signature'), chief: lb('chief'), director: info.director || '',
    foot: en ? b.footEn || '' : [b.footAz, b.footEn].filter(Boolean).join(' / '), addr: addressLine(info),
  };
}

/** @param {{ static: (path: string) => Promise<Uint8Array>, asset: (key: string) => Promise<Uint8Array | null>, keep?: { get: (name: string) => Promise<Uint8Array | null>, put: (name: string, b: Uint8Array) => Promise<any> } }} ctx
 *  @param {any} c the certificate  @param {{ origin: string, info?: any, logo?: string, accred?: string[], sigKey?: string }} o
 *  logo / accred / sigKey: asset keys ("default:3" = a built-in accreditation logo; '' = the built-in KVET logo) */
export async function certPdf(ctx, c, o) {
  const T = certTexts(c, o.info || {}), all = Object.values(T).flat(3).filter(x => typeof x === 'string').join('') + (T.sg ? `${T.sg.name}${T.sg.title || ''}${T.sg.code || ''}` : '');
  const [reg, semi, bold] = await Promise.all(['Mulish-Regular', 'Mulish-SemiBold', 'Mulish-Bold'].map(n => fontOf(ctx, n)));
  const odd = [...all].some(ch => !reg.has(ch.codePointAt(0)) && ch !== '\n');                       // letters Mulish does not have: Carlito steps in
  const [fbR, fbB] = odd ? await Promise.all(['Carlito-Regular', 'Carlito-Bold'].map(n => fontOf(ctx, n))) : [null, null];
  const doc = pdfDoc({ title: c.no, author: o.info?.name || 'KVET' });
  const R = [doc.addFont(reg, 'Mulish-Regular'), ...(fbR ? [doc.addFont(fbR, 'Carlito-Regular')] : [])], SB = [doc.addFont(semi, 'Mulish-SemiBold'), ...(fbB ? [doc.addFont(fbB, 'Carlito-Bold')] : [])], B = [doc.addFont(bold, 'Mulish-Bold'), ...(fbB ? [SB[1]] : [])];
  const pg = doc.page(794, 1123);
  /* a picture by its asset key ('' = the built-in logo, "default:N" = a built-in accreditation logo); null when it cannot be had */
  const picture = async key => { const k = String(key || ''), path = !k ? '/img/logo.png' : k.startsWith('default:') ? `/img/accred/accred-${Number(k.slice(8))}.png` : '';
    try { const b = await prepared(ctx, path ? 'static' + path.replaceAll('/', '-') : k, () => (path ? ctx.static(path) : ctx.asset(k))); return b ? doc.addImage(openImage(b)) : null; } catch { return null; } };
  /* a paragraph: wrapped to w, each line with its baseline where CSS puts it (line box = lh, the font centred in it) */
  const wrap = (chain, text, size, w, pre) => { const out = []; for (const par of pre ? String(text).split('\n') : [String(text)]) { let line = ''; for (const word of par.split(/\s+/).filter(Boolean)) { const t = line ? line + ' ' + word : word; if (line && pg.width(chain, t, size) > w) { out.push(line); line = word; } else line = t; } out.push(line); } return out; };
  const para = (chain, text, { x, y, w, size, lh, align = 'center', color = INK, pre = false }) => {
    const f = chain[0].font, L = lh < 4 ? lh * size : lh, base = (L - (f.ascent + f.descent) * size / f.upm) / 2 + f.ascent * size / f.upm, lines = wrap(chain, text, size, w, pre);
    lines.forEach((l, i) => { if (!l) return; const lw = pg.width(chain, l, size); pg.text(chain, l, align === 'center' ? x + (w - lw) / 2 : x, y + i * L + base, size, color); });
    return lines.length * L;
  };

  // header
  const logo = await picture(o.logo);
  if (logo) { const k = Math.min(196 / logo.img.w, 66 / logo.img.h), w = logo.img.w * k, h = logo.img.h * k; pg.image(logo, 555 + 196 - w, 38.2, w, h); }
  para(B, T.h1, { x: 0, y: 168.9, w: 794, size: 29.4, lh: 1.255 });
  if (T.h2) para(B, T.h2, { x: 0, y: 206.7, w: 794, size: 21.6, lh: 1.255 });
  para(SB, T.no, { x: 0, y: 241.4, w: 794, size: 17.6, lh: 1.255 });
  if (T.intro) para(R, T.intro, { x: 0, y: 295.9, w: 794, size: 15.7, lh: 1.255 });

  // the middle: names, company, description, qualification, details - shrunk by k when long
  const k = T.k, X = 44, W = 707; let y = 324.9;
  if (T.n1) y += para(SB, T.n1, { x: X, y, w: W, size: 25.5 * k, lh: 1.23, color: BLUE });
  y += (T.n1 ? 0.4 : 0); y += para(SB, T.n2, { x: X, y, w: W, size: (T.n1 ? 21.6 : 25.5) * k, lh: T.n1 ? 1.255 : 1.23, color: BLUE });
  if (T.co) { y += 3; y += para(R, T.co, { x: X, y, w: W, size: 15.7 * k, lh: 1.3 }); }
  if (T.desc) { y += 11.4 * k; y += para(R, T.desc, { x: X, y, w: W, size: 15.7 * k, lh: 1.25 }); }
  y += 8.1 * k; y += para(SB, T.q1 || '', { x: X, y, w: W, size: 21.6 * k, lh: 1.25, color: BLUE });
  if (T.q2) { y += 1.5; y += para(SB, T.q2, { x: X, y, w: W, size: 19.6 * k, lh: 1.255, color: BLUE }); }
  if (T.det) { y += 6 * k; y += para(R, T.det, { x: X, y, w: W, size: 14.7 * k, lh: 1.3, pre: true }); }

  // the info block, anchored to the bottom of the middle area (y = 801)
  const LW = 434.2, RW = W - LW, LH = 17.6;
  const colLines = (cols, w) => cols.map(blk => blk.flatMap(t => wrap(R, t, 13.7, w, false)));
  const lCols = colLines(T.left, LW), rCols = colLines(T.right, RW), colH = cols => cols.reduce((h, b) => h + b.length * LH, 0) + Math.max(0, cols.length - 1) * 7;
  const infoH = Math.max(colH(lCols), colH(rCols)), lowerH = 9 + 1 + 9 + infoH + (T.reg ? 9 + LH : 0) + (T.valid ? 7 + 2 * 20.6 : 0);
  let ly = 801 - lowerH + 9; pg.rect(X, ly, W, 1, { fill: INK }); ly += 1 + 9;
  const drawCol = (cols, x) => { let yy = ly; cols.forEach((blk, i) => { if (i) yy += 7; for (const l of blk) { para(R, l, { x, y: yy, w: 2000, size: 13.7, lh: LH, align: 'left' }); yy += LH; } }); };
  drawCol(lCols, X); drawCol(rCols, X + LW); ly += infoH;
  if (T.reg) { ly += 9; para(SB, T.reg, { x: X, y: ly, w: W, size: 14.7, lh: LH, align: 'left' }); ly += LH; }
  if (T.valid) { ly += 7; para(R, T.valid, { x: X, y: ly, w: W, size: 16.7, lh: 20.6, align: 'left', color: '#f00' }); para(R, T.expiry, { x: X, y: ly + 20.6, w: W, size: 16.7, lh: 20.6, align: 'left', color: '#f00' }); }

  // signature
  const sx = 352.6, sy = 809.3, sBase = sy + reg.ascent * 15.7 / reg.upm, lw = pg.text(R, T.sigL, sx, sBase, 15.7, INK), sg = T.sg;
  const sigKey = sg?.mode === 'image' && sg.img ? sg.img : !sg ? o.sigKey || '' : '';
  const sig = sigKey ? await picture(sigKey) : null;
  if (sig) { const q = Math.min(1, 237 / sig.img.w, 64 / sig.img.h), w = sig.img.w * q, h = sig.img.h * q; pg.image(sig, sx + lw + 118.5 - w / 2, sBase + 6 - h, w, h); }
  else if (sg) {
    const label = T.en ? 'Signed electronically' : 'Elektron imzalanıb / Signed electronically', tw = pg.width(SB, label, 11), bw = tw + 13 + 18 + 3, bh = 11 * 1.25 + 6 + 3, cx = sx + lw + 14 + 118.5, by = sBase + 3 - bh;
    pg.rect(cx - bw / 2 + 0.75, by + 0.75, bw - 1.5, bh - 1.5, { stroke: BLUE, line: 1.5, radius: 6 });
    const tx = cx - bw / 2 + 1.5 + 9, tb = by + 1.5 + 3 + (11 * 1.25 - (semi.ascent + semi.descent) * 11 / semi.upm) / 2 + semi.ascent * 11 / semi.upm;
    pg.path([[tx, tb - 4], [tx + 3.4, tb - 0.6], [tx + 9.4, tb - 8.2]], { stroke: BLUE, line: 1.6 }); pg.text(SB, label, tx + 13, tb, 11, BLUE);
  } else pg.text(R, '________________________________', sx + lw, sBase, 15.7, INK);
  if (sg) { para(SB, sg.name || '', { x: sx + 68, y: sy + 16.6, w: 330, size: 13.7, lh: 1.3 }); para(R, sg.title || T.chief, { x: sx + 68, y: sy + 16.6 + 13.7 * 1.3, w: 330, size: 13.7, lh: 1.3 }); }
  else { const txt = T.chief + (T.director ? ' · ' + T.director : ''); para(R, txt, { x: Math.min(sx + 176.6, Math.max(44, 750.6 - pg.width(R, txt, 13.7))), y: sy + 16.6, w: 2000, size: 13.7, lh: 1.255, align: 'left' }); }
  if (sg) {
    const a = `${T.en ? 'Electronic signature' : 'Elektron imza / Electronic signature'} · ${S.fmtDateTime(sg.at)} · ${T.en ? 'code' : 'kod / code'} `, wa = pg.width(R, a, 9.5), wb = pg.width(B, sg.code || '', 9.5);
    const x0 = wa + wb <= 330 ? 420.6 + (330 - wa - wb) / 2 : Math.max(44, 750.6 - wa - wb),      // centred under the signature; a long line grows to the left, never off the page
       base = 866 + (9.5 * 1.35 - (reg.ascent + reg.descent) * 9.5 / reg.upm) / 2 + reg.ascent * 9.5 / reg.upm;
    pg.text(R, a, x0, base, 9.5, '#555'); pg.text(B, sg.code || '', x0 + wa, base, 9.5, '#555');
  }

  // footer: note, QR code, accreditation logos, address
  if (T.foot) para(R, T.foot, { x: 43.6, y: 892.5, w: 707, size: 13.7, lh: 17.6, align: 'left' });
  if (c.vh) {
    const M = qrMatrix(`${o.origin}/verify.html?n=${encodeURIComponent(c.no)}&h=${encodeURIComponent(c.vh || '')}`), n = M.length, u = 98 / (n + 2), cells = [];
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n;) { if (!M[yy][xx]) { xx++; continue; } let e = xx; while (e < n && M[yy][e]) e++; cells.push([43.1 + (xx + 1) * u, 956.5 + (yy + 1) * u, (e - xx) * u + 0.05, u + 0.05]); xx = e; }
    pg.rect(43.1, 956.5, 98, 98, { fill: '#fff' }); pg.cells(cells);
  }
  const acc = await Promise.all((o.accred || []).slice(0, 7).map(picture));
  acc.forEach((im, i) => { if (!im) return; const bx = 185.4 + i * (58.8 + 25.7), h0 = 58.8 * im.img.h / im.img.w; if (h0 <= 66) pg.image(im, bx, 965.5, 58.8, h0); else { const w = 66 * im.img.w / im.img.h; pg.image(im, bx + (58.8 - w) / 2, 965.5, w, 66); } });
  if (T.addr) para(R, T.addr, { x: 159.5, y: 1041.5, w: 592, size: 9.7, lh: 1.255, align: 'left', color: '#000' });
  return doc.bytes();
}

/* The certificate's PDF for a portal. Drawn once: the file is kept in storage ("certpdf/") with a fingerprint of all
   it was drawn from (the certificate, the centre's details, the pictures' keys, this layout's version); it is drawn again
   only when one of those changes - a new signature, a correction, a new logo.
   c = the request context. */
const LAYOUT = 1;
const u8 = async o => (o ? new Uint8Array(await o.arrayBuffer()) : null);
export async function certDocument(c, cert) {
  const st = await getSettings(c.D), sigKey = !cert.sign && !cert.esign && cert.sigId ? (await c.D.get('sigs', cert.sigId))?.key || '' : '';
  const o = { origin: c.url.origin, info: st.company || {}, logo: st.logo || '', accred: accredKeys(st), sigKey };
  const mark = await sha(JSON.stringify([LAYOUT, cert, o])), key = 'certpdf/' + cert.no.replace(/[^A-Za-z0-9]+/g, '-') + '.pdf';
  const old = await c.B.get(key).catch(() => null); if (old && old.customMetadata?.mark === mark) return /** @type {Uint8Array} */ (await u8(old));
  const pdf = await certPdf({
    static: c.files,
    asset: async k => (/^[a-f0-9]{16}\.png$/.test(k) ? u8(await c.B.get('assets/' + k)) : null),
    keep: { get: async n => u8(await c.B.get('pdfimg/' + n)), put: (n, b) => c.B.put('pdfimg/' + n, b) },
  }, cert, o);
  await c.B.put(key, pdf, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: { mark } }).catch(() => {});
  return pdf;
}
