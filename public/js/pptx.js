/* In-browser PowerPoint (.pptx) renderer on top of JSZip. The file is parsed from memory and drawn as HTML,
   so presentations can be shown inside the system without offering a download. Supports text (with inheritance
   from layout/master), shapes, pictures, groups, tables and backgrounds; charts / SmartArt show a placeholder. */
import { metafileToBlob } from './emf.js';
const EMU = 9525;
const ln = n => n?.localName;
const kid = (n, name) => { if (!n) return null; for (const c of n.children) if (ln(c) === name) return c; return null; };
const kids = (n, name) => (n ? [...n.children].filter(c => !name || ln(c) === name) : []);
const path = (n, ...names) => { for (const x of names) { n = kid(n, x); if (!n) return null; } return n; };
const attr = (n, a, d) => (n && n.hasAttribute(a) ? n.getAttribute(a) : d);
const px = v => (Number(v) || 0) / EMU;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function rgb(h, s, l) { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; if (!s) { const v = Math.round(l * 255); return [v, v, v]; } const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map(x => Math.round(x * 255)); }

export async function openPptx(buf) {
  const Z = await JSZip.loadAsync(buf), dom = s => new DOMParser().parseFromString(s, 'application/xml');
  const read = async p => { const f = Z.file(p); return f ? dom(await f.async('string')) : null; };
  const relsOf = async p => { const d = await read(p.replace(/([^/]+)$/, '_rels/$1.rels')); const m = {}; if (d) for (const r of d.getElementsByTagName('Relationship')) { let tg = r.getAttribute('Target') || ''; const base = p.split('/').slice(0, -1); if (tg.startsWith('/')) tg = tg.slice(1); else { const parts = [...base]; for (const s of tg.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); } tg = parts.join('/'); } m[r.getAttribute('Id')] = { target: tg, type: r.getAttribute('Type') }; } return m; };

  const pres = await read('ppt/presentation.xml'), prels = await relsOf('ppt/presentation.xml'); if (!pres) throw new Error('badFile');
  const sz = path(pres.documentElement, 'sldSz'), SW = px(attr(sz, 'cx', 12192000)), SH = px(attr(sz, 'cy', 6858000));
  const slidePaths = kids(path(pres.documentElement, 'sldIdLst'), 'sldId').map(s => prels[s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')]?.target).filter(Boolean);
  // colours and fonts come from the theme of each slide master (a deck can have several masters / themes)
  const themes = new Map();
  async function loadTheme(tp) {
    if (themes.has(tp)) return themes.get(tp);
    const t = { colors: {}, major: 'Calibri', minor: 'Calibri' }, td = tp && await read(tp);
    const cs = td && td.getElementsByTagNameNS('*', 'clrScheme')[0]; if (cs) for (const c of cs.children) { const x = c.firstElementChild; t.colors[ln(c)] = attr(x, 'lastClr', attr(x, 'val', '000000')); }
    const fs = td && td.getElementsByTagNameNS('*', 'fontScheme')[0]; if (fs) { t.major = attr(path(fs, 'majorFont', 'latin'), 'typeface', t.major); t.minor = attr(path(fs, 'minorFont', 'latin'), 'typeface', t.minor); }
    themes.set(tp, t); return t;
  }
  let theme = (await loadTheme(Object.values(prels).find(r => /theme$/.test(r.type))?.target || 'ppt/theme/theme1.xml')).colors, fonts = themes.values().next().value;
  // PowerPoint's usual fonts are not on every device: metric-compatible open fonts keep line breaks as in PowerPoint (app.css)
  const fontCss = f => { const n = f === '+mj-lt' ? fonts.major : f === '+mn-lt' ? fonts.minor : f; return n && !n.startsWith('+') ? `"${n}",${/light/i.test(n) ? '"Calibri Light",' : ''}Calibri,"Segoe UI",Arial,sans-serif` : null; };
  const MAP = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
  const imgCache = new Map(), urls = [];
  // images; Windows metafiles (EMF / WMF, which browsers cannot show) are converted (emf.js)
  const media = async p => { if (imgCache.has(p)) return imgCache.get(p); const job = (async () => { const f = Z.file(p); if (!f) return '';
      const ext = p.split('.').pop().toLowerCase(), mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff' }[ext];
      /** @type {any} */ let blob = null; if (mime) blob = new Blob([await f.async('uint8array')], { type: mime }); else if (ext === 'emf' || ext === 'wmf') blob = await metafileToBlob(await f.async('uint8array'), ext);
      if (!blob) return ''; const u = URL.createObjectURL(blob); urls.push(u); return u; })(); imgCache.set(p, job); return job; };

  function color(node) {
    if (!node) return null; let c = node; if (['solidFill', 'gsLst', 'buClr', 'lnRef', 'fontRef', 'fillRef', 'clrFrom', 'clrTo', 'fgClr', 'bgClr'].includes(ln(c))) c = c.firstElementChild;
    if (!c) return null; let hex;
    if (ln(c) === 'srgbClr') hex = c.getAttribute('val'); else if (ln(c) === 'sysClr') hex = attr(c, 'lastClr', '000000'); else if (ln(c) === 'schemeClr') { const v = c.getAttribute('val'); hex = theme[MAP[v] || v] || (v === 'phClr' ? '000000' : '000000'); } else if (ln(c) === 'prstClr') hex = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00' }[c.getAttribute('val')] || '000000'; else return null;
    let [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)), a = 1;
    for (const m of c.children) { const v = Number(m.getAttribute('val')) / 100000; let [h, s, l] = hsl(r, g, b);
      if (ln(m) === 'lumMod') l *= v; else if (ln(m) === 'lumOff') l += v; else if (ln(m) === 'tint') l = l + (1 - l) * (1 - v); else if (ln(m) === 'shade') l *= v; else if (ln(m) === 'satMod') s *= v; else if (ln(m) === 'alpha') { a = v; continue; } else continue;
      [r, g, b] = rgb(h, s, clampN(l, 0, 1)); }
    return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
  }
  const fillCss = async (spPr, rels) => {
    if (!spPr) return null; if (kid(spPr, 'noFill')) return 'transparent';
    const sf = kid(spPr, 'solidFill'); if (sf) return color(sf);
    const gf = kid(spPr, 'gradFill'); if (gf) { const stops = kids(path(gf, 'gsLst'), 'gs').map(g => `${color(g)} ${Number(g.getAttribute('pos')) / 1000}%`); const ang = Number(attr(path(gf, 'lin'), 'ang', 5400000)) / 60000; if (stops.length) return `linear-gradient(${(ang + 90) % 360}deg,${stops.join(',')})`; }
    const bf = kid(spPr, 'blipFill'); if (bf && rels) { const rid = attr(kid(bf, 'blip'), 'r:embed', null) || kid(bf, 'blip')?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'); const u = rid && rels[rid] && await media(rels[rid].target); if (u) return `url(${u}) center/cover no-repeat`; }
    return null;
  };
  const xfrmOf = n => { const x = n && (kid(n, 'xfrm') || path(n, 'spPr', 'xfrm') || path(n, 'grpSpPr', 'xfrm')); if (!x) return null; const o = kid(x, 'off'), e = kid(x, 'ext'); return { x: px(attr(o, 'x', 0)), y: px(attr(o, 'y', 0)), w: px(attr(e, 'cx', 0)), h: px(attr(e, 'cy', 0)), rot: Number(attr(x, 'rot', 0)) / 60000, fh: attr(x, 'flipH') === '1', fv: attr(x, 'flipV') === '1' }; };

  /* placeholders of layout/master, for inherited position and text defaults */
  async function loadLayout(slidePath, rels) {
    const lr = Object.values(rels).find(r => /slideLayout$/.test(r.type)); if (!lr) return {};
    const lay = await read(lr.target), lrels = await relsOf(lr.target), mr = Object.values(lrels).find(r => /slideMaster$/.test(r.type)), mas = mr && await read(mr.target), mrels = mr ? await relsOf(mr.target) : {};
    return { lay, lrels, lpath: lr.target, mas, mrels, mpath: mr?.target };
  }
  const phKey = sp => { const ph = path(sp, 'nvSpPr', 'nvPr', 'ph') || path(sp, 'nvPicPr', 'nvPr', 'ph'); return ph ? { type: attr(ph, 'type', 'body'), idx: attr(ph, 'idx', null) } : null; };
  const findPh = (tree, k) => { if (!tree || !k) return null; const list = kids(path(tree.documentElement, 'cSld', 'spTree'), 'sp'); return list.find(s => { const p = phKey(s); return p && ((k.idx !== null && p.idx === k.idx) || (p.type === k.type && (k.idx === null || p.idx === null))); }) || list.find(s => { const p = phKey(s); return p && p.type === k.type; }) || null; };

  const sizeFor = (lvl, kind, ctx) => {
    const chain = [];
    for (const src of ctx.chain) { const lst = src; const pp = kid(lst, 'lvl' + (lvl + 1) + 'pPr'); if (pp) chain.push(pp); }
    for (const pp of chain) { const d = kid(pp, 'defRPr'); const v = d && d.getAttribute('sz'); if (kind === 'sz' && v) return Number(v) / 100; }
    return null;
  };

  /* custom geometry (freehand shapes, curves) -> SVG paths in the shape's box. Guides: */ /* "*\/ a b c", "+- a b c", "val x" and friends */
  function custPaths(cg, W, H) {
    const G = { w: W, h: H, wd2: W / 2, hd2: H / 2, l: 0, t: 0, r: W, b: H, ss: Math.min(W, H), ls: Math.max(W, H), cd2: 10800000, cd4: 5400000, '3cd4': 16200000 };
    const ev = v => { if (v === null || v === undefined) return 0; const n = Number(v); return Number.isFinite(n) ? n : (G[v] ?? 0); };
    for (const gd of kids(path(cg, 'gdLst'), 'gd')) { const [op, a, b, c] = (gd.getAttribute('fmla') || '').split(/\s+/), x = ev(a), y = ev(b), z = ev(c);
      G[gd.getAttribute('name')] = op === '*/' ? x * y / (z || 1) : op === '+-' ? x + y - z : op === '+/' ? (x + y) / (z || 1) : op === 'abs' ? Math.abs(x) : op === 'sqrt' ? Math.sqrt(x) : op === 'max' ? Math.max(x, y) : op === 'min' ? Math.min(x, y) : op === 'sin' ? x * Math.sin(y / 60000 * Math.PI / 180) : op === 'cos' ? x * Math.cos(y / 60000 * Math.PI / 180) : op === 'at2' ? Math.atan2(y, x) * 180 / Math.PI * 60000 : op === 'cat2' ? x * Math.cos(Math.atan2(z, y)) : op === 'sat2' ? x * Math.sin(Math.atan2(z, y)) : op === 'mod' ? Math.hypot(x, y, z) : op === 'pin' ? Math.max(x, Math.min(z, y)) : op === '?:' ? (x > 0 ? y : z) : x; }
    const out = [];
    for (const pa of kids(path(cg, 'pathLst'), 'path')) {
      const pw = Number(attr(pa, 'w', 0)) || W, ph = Number(attr(pa, 'h', 0)) || H, kx = W / pw, ky = H / ph; let d = '', cur = [0, 0];
      const P = n => [ev(attr(n, 'x', 0)) * kx, ev(attr(n, 'y', 0)) * ky];
      for (const c of pa.children) { const t = ln(c), pts = kids(c, 'pt').map(P);
        if (t === 'moveTo') { cur = pts[0]; d += `M${cur}`; } else if (t === 'lnTo') { cur = pts[0]; d += `L${cur}`; }
        else if (t === 'cubicBezTo') { d += `C${pts.join(' ')}`; cur = pts[2]; } else if (t === 'quadBezTo') { d += `Q${pts.join(' ')}`; cur = pts[1]; }
        else if (t === 'arcTo') { const wr = ev(attr(c, 'wR', 0)) * kx, hr = ev(attr(c, 'hR', 0)) * ky, st = ev(attr(c, 'stAng', 0)) / 60000 * Math.PI / 180, sw = ev(attr(c, 'swAng', 0)) / 60000 * Math.PI / 180;
          const cx = cur[0] - wr * Math.cos(st), cy = cur[1] - hr * Math.sin(st), e = [cx + wr * Math.cos(st + sw), cy + hr * Math.sin(st + sw)]; d += `A${wr},${hr} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${e}`; cur = e; }
        else if (t === 'close') d += 'Z'; }
      out.push({ d, fill: attr(pa, 'fill', 'norm') !== 'none', stroke: attr(pa, 'stroke', '1') !== '0' });
    }
    return out;
  }
  // arc-type presets (angles in 60000ths of a degree, PowerPoint defaults)
  function presetPath(geom, spPr, W, H) {
    const av = {}; for (const g of kids(path(spPr, 'prstGeom', 'avLst'), 'gd')) av[g.getAttribute('name')] = Number((g.getAttribute('fmla') || '').split(' ')[1]);
    const rad = a => a / 60000 * Math.PI / 180, pt = a => [W / 2 + W / 2 * Math.cos(rad(a)), H / 2 + H / 2 * Math.sin(rad(a))];
    const a1 = av.adj1 ?? (geom === 'chord' ? 2700000 : geom === 'pie' ? 0 : 16200000), a2 = av.adj2 ?? (geom === 'chord' ? 16200000 : geom === 'pie' ? 16200000 : 0);
    const sw = ((a2 - a1) % 21600000 + 21600000) % 21600000, s0 = pt(a1), s1 = pt(a2), arc = `A${W / 2},${H / 2} 0 ${sw > 10800000 ? 1 : 0} 1 ${s1}`;
    if (geom === 'arc') return [{ d: `M${s0}${arc}`, fill: false, stroke: true }];
    if (geom === 'pie') return [{ d: `M${W / 2},${H / 2}L${s0}${arc}Z`, fill: true, stroke: true }];
    return [{ d: `M${s0}${arc}Z`, fill: true, stroke: true }];
  }
  // "transparent colour" set on a picture in PowerPoint (a:clrChange): that colour becomes see-through
  const keyed = new Map();
  async function clrChanged(url, blip) {
    const cc = kid(blip, 'clrChange'), from = cc && color(kid(cc, 'clrFrom')); if (!from) return url; const k = url + from; if (keyed.has(k)) return keyed.get(k);
    const job = new Promise(res => { const im = new Image(); im.onload = () => { try { const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height), [r, gg, b] = from.match(/\d+/g).map(Number), px_ = d.data;
      for (let i = 0; i < px_.length; i += 4) if (Math.abs(px_[i] - r) < 8 && Math.abs(px_[i + 1] - gg) < 8 && Math.abs(px_[i + 2] - b) < 8) px_[i + 3] = 0;
      g.putImageData(d, 0, 0); cv.toBlob(bl => { if (!bl) return res(url); const u = URL.createObjectURL(bl); urls.push(u); res(u); }, 'image/png'); } catch { res(url); } }; im.onerror = () => res(url); im.src = url; });
    keyed.set(k, job); return job;
  }

  // Wingdings / Symbol bullets as the characters they show
  const SYM = { 'Wingdings': { 'ü': '✓', '§': '▪', 'Ø': '➢', 'q': '❑', 'v': '❖', 'n': '■', 'l': '●', 'w': '◆', 'u': '◆', 'Ü': '➢', 'à': '➔', 'è': '➔', 'o': '□', 'p': '■', 'ª': '◘', '\uF0FC': '✓', '\uF0A7': '■', '\uF0D8': '➢' }, 'Symbol': { '·': '•', '\uF0B7': '•', 'Þ': '⇒', '®': '→' } };
  const bulletText = (ch, font) => { const m = SYM[Object.keys(SYM).find(k => (font || '').startsWith(k))] || {}; if (m[ch]) return m[ch]; if (/^Courier/.test(font || '') && ch === 'o') return '○'; const c = ch.codePointAt(0); return c >= 0xF000 && c <= 0xF0FF ? (m[String.fromCharCode(c - 0xF000)] || '•') : ch; };
  const autoNum = (type, n) => { const roman = x => { let r = '', v = x; for (const [a, b] of /** @type {[number, string][]} */ ([[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']])) while (v >= a) { r += b; v -= a; } return r; };
    const t = type || 'arabicPeriod', core = /alphaLc/.test(t) ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : /alphaUc/.test(t) ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : /romanLc/.test(t) ? roman(n) : /romanUc/.test(t) ? roman(n).toUpperCase() : String(n);
    return /ParenBoth/.test(t) ? `(${core})` : /ParenR/.test(t) ? `${core})` : /Plain/.test(t) ? core : `${core}.`; };

  async function renderTxBody(tx, ctx, box) {
    // body properties: the shape's own, then the layout / master placeholder's (anchor, insets, autofit)
    const bodies = [kid(tx, 'bodyPr'), ...(ctx.bodies || [])].filter(Boolean), bp = (a, d) => { for (const b of bodies) if (b.hasAttribute(a)) return b.getAttribute(a); return d; };
    const anchor = bp('anchor', 't'), li = px(bp('lIns', 91440)), ri = px(bp('rIns', 91440)), ti = px(bp('tIns', 45720)), bi = px(bp('bIns', 45720));
    const na = bodies.map(b => kid(b, 'normAutofit')).find(Boolean), scale = Number(attr(na, 'fontScale', 100000)) / 100000, lnRed = Number(attr(na, 'lnSpcReduction', 0)) / 100000;
    const vert = bp('vert', 'horz'), wrapNone = bp('wrap', 'square') === 'none';
    const wrap = document.createElement('div');
    // text is never clipped (PowerPoint lets it run past the box); vertical anchoring as in the slide
    wrap.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;justify-content:${{ t: 'flex-start', ctr: 'center', b: 'flex-end' }[anchor] || 'flex-start'};padding:${ti}px ${ri}px ${bi}px ${li}px;overflow:visible;box-sizing:border-box;${wrapNone ? 'white-space:nowrap;' : ''}${vert === 'vert' || vert === 'eaVert' ? 'writing-mode:vertical-rl;' : vert === 'vert270' ? 'writing-mode:vertical-rl;transform:rotate(180deg);' : ''}${ctx.flipText ? 'transform:rotate(180deg);' : ''}`;
    const lstShape = kid(tx, 'lstStyle'), counters = {};
    for (const p of kids(tx, 'p')) {
      const ppr = kid(p, 'pPr'), lvl = Number(attr(ppr, 'lvl', 0)), chain = [...(lstShape ? [lstShape] : []), ...ctx.chain];
      // a paragraph property: the paragraph's own, else the first list style (shape -> layout -> master) that has it
      const find = (sel) => { for (const l of chain) { const pp = kid(l, 'lvl' + (lvl + 1) + 'pPr'); if (pp) { const v = sel(pp); if (v !== undefined && v !== null) return v; } } return undefined; };
      const own = (sel) => { const v = ppr ? sel(ppr) : undefined; return v !== undefined && v !== null ? v : find(sel); };
      const algn = own(pp => pp.getAttribute('algn')) || 'l', marL = px(own(pp => pp.getAttribute('marL')) ?? 0), indent = px(own(pp => pp.getAttribute('indent')) ?? 0);
      const BU = ['buNone', 'buChar', 'buAutoNum', 'buBlip'], bu = own(pp => BU.map(k => kid(pp, k)).find(Boolean));
      const spcOf = tag => own(pp => { const s1 = path(pp, tag, 'spcPts'); if (s1) return { pts: Number(s1.getAttribute('val')) / 100 }; const s2 = path(pp, tag, 'spcPct'); if (s2) return { pct: Number(s2.getAttribute('val')) / 100000 }; return undefined; });
      const lnSp = own(pp => { const a = path(pp, 'lnSpc', 'spcPct'); if (a) return { pct: Number(a.getAttribute('val')) / 100000 }; const b = path(pp, 'lnSpc', 'spcPts'); if (b) return { pts: Number(b.getAttribute('val')) / 100 }; return undefined; });
      const para = document.createElement('div');
      // runs first: the bullet takes size / colour / font from the first run
      const runs = []; let firstSize = /** @type {any} */ (null), firstColor = /** @type {any} */ (null), firstFont = /** @type {any} */ (null);
      for (const r of p.children) {
        if (!['r', 'br', 'fld'].includes(ln(r))) continue;
        if (ln(r) === 'br') { runs.push(document.createElement('br')); continue; }
        const rpr = kid(r, 'rPr'), txt = kid(r, 't')?.textContent ?? ''; if (!txt) continue;
        const sp = document.createElement('span'); sp.textContent = txt; sp.style.whiteSpace = 'pre-wrap';
        const rp = (a) => attr(rpr, a, find(pp => path(pp, 'defRPr')?.getAttribute(a)));
        const szv = rp('sz'), size = (szv ? Number(szv) / 100 : ctx.defSz || 18) * scale;
        sp.style.fontSize = size * 1.333 + 'px';
        if (rp('b') === '1') sp.style.fontWeight = '700'; else if (rp('b') === '0') sp.style.fontWeight = '400';
        if (rp('i') === '1') sp.style.fontStyle = 'italic';
        const u = rp('u') || '', st = rp('strike') || ''; sp.style.textDecoration = [/^(sng|dbl|heavy|wavy|dash|dot)/.test(u) ? 'underline' : '', /sngStrike|dblStrike/.test(st) ? 'line-through' : ''].filter(Boolean).join(' ');
        if (rp('cap') === 'all') sp.style.textTransform = 'uppercase'; else if (rp('cap') === 'small') sp.style.fontVariant = 'small-caps';
        let col = color(kid(rpr, 'solidFill')); if (!col) col = find(pp => { const d = path(pp, 'defRPr'); const f = d && kid(d, 'solidFill'); return f ? color(f) : undefined; }); col = col || ctx.defColor || '#000'; col = String(col); sp.style.color = col;
        const face = kid(rpr, 'latin')?.getAttribute('typeface') || find(pp => path(pp, 'defRPr', 'latin')?.getAttribute('typeface')) || ctx.defFont; const fc = face && fontCss(face); if (fc) sp.style.fontFamily = fc;
        const bl = Number(rp('baseline') || 0); if (bl) { sp.style.verticalAlign = bl > 0 ? 'super' : 'sub'; sp.style.fontSize = size * 0.75 * 1.333 + 'px'; }
        if (firstSize === null) { firstSize = size; firstColor = col; firstFont = fc; }
        runs.push(sp);
      }
      const endSz = (Number(attr(path(p, 'endParaRPr'), 'sz', 0)) / 100 || find(pp => { const v = path(pp, 'defRPr')?.getAttribute('sz'); return v ? Number(v) / 100 : undefined; }) || ctx.defSz || 18) * scale;
      const base = firstSize ?? endSz;
      const lh = lnSp?.pct ? Math.max(0.5, lnSp.pct * (1 - lnRed)) * 1.2 : lnSp?.pts ? lnSp.pts * 1.333 / (base * 1.333) : 1.2 * (1 - lnRed);
      const gap = s1 => (s1?.pts ? s1.pts * 1.333 : s1?.pct ? s1.pct * base * 1.2 * 1.333 : 0);
      para.style.cssText = `text-align:${{ l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[algn] || 'left'};padding-left:${Math.max(0, marL)}px;text-indent:${indent}px;margin-top:${gap(spcOf('spcBef'))}px;margin-bottom:${gap(spcOf('spcAft'))}px;line-height:${lh};font-size:${base * 1.333}px;overflow-wrap:break-word;`;
      // bullet: placed at marL+indent, text starts at marL (hanging indent), as in PowerPoint
      const hasText = runs.some(r => r.tagName === 'SPAN');
      if (bu && ln(bu) !== 'buNone' && hasText) {
        const m = document.createElement('span'), bsz = own(pp => { const a = kid(pp, 'buSzPct'); if (a) return Number(a.getAttribute('val')) / 100000; const b = kid(pp, 'buSzPts'); return b ? -Number(b.getAttribute('val')) / 100 : undefined; }) ?? 1;
        const bcol = own(pp => { const c = kid(pp, 'buClr'); return c ? color(c) : undefined; }) || firstColor || ctx.defColor || '#000', bfont = own(pp => kid(pp, 'buFont')?.getAttribute('typeface'));
        if (ln(bu) === 'buAutoNum') { const k = lvl + ':' + attr(bu, 'type', ''); counters[k] = (counters[k] ?? (Number(attr(bu, 'startAt', 1)) - 1)) + 1; for (const x of Object.keys(counters)) if (Number(x.split(':')[0]) > lvl) delete counters[x]; m.textContent = autoNum(attr(bu, 'type', ''), counters[k]); }
        else if (ln(bu) === 'buBlip') m.textContent = '•';
        else m.textContent = bulletText(attr(bu, 'char', '•'), bfont);
        const fsz = bsz < 0 ? -bsz : base * bsz;
        m.style.cssText = `display:inline-block;text-indent:0;color:${bcol};font-size:${fsz * 1.333}px;font-weight:400;font-style:normal;${indent < 0 ? `min-width:${-indent}px;` : 'padding-right:.15em;'}${ln(bu) === 'buChar' && bfont && !/^(Wingdings|Symbol)/.test(bfont) && fontCss(bfont) ? `font-family:${fontCss(bfont)};` : (firstFont ? `font-family:${firstFont};` : '')}`;
        para.append(m);
      } else if (ln(bu || {}) !== 'buAutoNum') { for (const x of Object.keys(counters)) if (Number(x.split(':')[0]) >= lvl) delete counters[x]; }
      for (const r of runs) para.append(r);
      if (!hasText) { para.style.minHeight = endSz * 1.333 * lh + 'px'; }
      wrap.append(para);
    }
    box.append(wrap);
  }

  /** @param {any} [tree] @param {any} [rels] @param {any} [parent] @param {any} [ctxBase] @param {any} o4 */
  async function renderTree(tree, rels, parent, ctxBase, { skipPh = false, frame = /** @type {any} */ (null) } = {}) {
    for (const n of tree.children) {
      const name = ln(n); if (!['sp', 'pic', 'grpSp', 'graphicFrame', 'cxnSp'].includes(name)) continue;
      try {
        if (skipPh && phKey(n)) continue;
        // a placeholder inherits position, text styles and body settings from the layout, then the master
        let xf = xfrmOf(n); const key = phKey(n), lph = key && !skipPh ? findPh(ctxBase.lay, key) : null, mph = key && !skipPh ? findPh(ctxBase.mas, key) : null, ph = lph || mph;
        if (!xf && key) xf = xfrmOf(lph) || xfrmOf(mph);
        if (!xf) continue;
        const el = document.createElement('div'); el.style.cssText = `position:absolute;left:${xf.x}px;top:${xf.y}px;width:${xf.w}px;height:${xf.h}px;box-sizing:border-box;${xf.rot ? `transform:rotate(${xf.rot}deg);` : ''}`;
        // flips mirror pictures and shapes; text in a flipped shape stays readable (vertical flip turns it 180°), as in PowerPoint
        const flip = xf.fh || xf.fv ? `scale(${xf.fh ? -1 : 1},${xf.fv ? -1 : 1})` : '';
        if (flip && (name === 'pic' || name === 'cxnSp')) el.style.transform = (el.style.transform || '') + ' ' + flip;
        // inside a group: child coordinates scaled onto the group's box (by the centre; a shape turned by 90° swaps the scales)
        let W = xf.w, Hh = xf.h;
        if (frame) { const k = frame, turned = Math.abs((((xf.rot % 180) + 180) % 180) - 90) < 1; W = xf.w * (turned ? k.sy : k.sx); Hh = xf.h * (turned ? k.sx : k.sy);
          const cx = (xf.x + xf.w / 2 - k.cx) * k.sx + k.ox, cy = (xf.y + xf.h / 2 - k.cy) * k.sy + k.oy; el.style.left = cx - W / 2 + 'px'; el.style.top = cy - Hh / 2 + 'px'; el.style.width = W + 'px'; el.style.height = Hh + 'px'; }
        if (name === 'grpSp') {
          // a group: its box (in the parent's coordinates, also inside another group) holds its children, whose
          // coordinates are mapped from chOff/chExt onto that box
          const gx = kid(path(n, 'grpSpPr'), 'xfrm'), co = kid(gx, 'chOff'), ce = kid(gx, 'chExt');
          const left = frame ? (xf.x - frame.cx) * frame.sx : xf.x, top = frame ? (xf.y - frame.cy) * frame.sy : xf.y, gw = frame ? xf.w * frame.sx : xf.w, gh = frame ? xf.h * frame.sy : xf.h;
          const cw = px(attr(ce, 'cx', 0)) || xf.w || 1, chh = px(attr(ce, 'cy', 0)) || xf.h || 1;
          const g = document.createElement('div'); g.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${gw}px;height:${gh}px;overflow:visible;${xf.rot || flip ? `transform:${xf.rot ? `rotate(${xf.rot}deg) ` : ''}${flip};` : ''}`;
          await renderTree(n, rels, g, ctxBase, { frame: { cx: px(attr(co, 'x', 0)), cy: px(attr(co, 'y', 0)), sx: gw / cw, sy: gh / chh, ox: 0, oy: 0 } }); parent.append(g); continue;
        }
        if (name === 'pic') {
          const bf = kid(n, 'blipFill'), blip = kid(bf, 'blip'), rid = blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'); let u = rid && rels[rid] && await media(rels[rid].target);
          if (u && kid(blip, 'clrChange')) u = await clrChanged(u, blip);
          if (u) { const im = document.createElement('img'); im.src = u; im.draggable = false; const sr = kid(bf, 'srcRect'); const l = Number(attr(sr, 'l', 0)) / 1000, tt = Number(attr(sr, 't', 0)) / 1000, r = Number(attr(sr, 'r', 0)) / 1000, b = Number(attr(sr, 'b', 0)) / 1000;
            im.style.cssText = sr ? `position:absolute;left:${-l / (100 - l - r) * 100}%;top:${-tt / (100 - tt - b) * 100}%;width:${10000 / (100 - l - r)}%;height:${10000 / (100 - tt - b)}%;` : 'width:100%;height:100%;object-fit:fill;'; el.style.overflow = 'hidden'; el.append(im); }
        } else if (name === 'graphicFrame') {
          const tbl = n.getElementsByTagNameNS('*', 'tbl')[0], blip = !tbl && n.getElementsByTagNameNS('*', 'blip')[0];
          const brid = blip && blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'), bu = brid && rels[brid] && await media(rels[brid].target);
          if (tbl) await renderTable(tbl, el, xf, ctxBase);
          else if (bu) { const im = document.createElement('img'); im.src = bu; im.draggable = false; im.style.cssText = 'width:100%;height:100%;object-fit:fill'; el.append(im); }   // embedded object (Word / Excel …): its preview picture
          else { el.style.cssText += 'border:1px dashed #aaa;display:grid;place-items:center;color:#888;font:14px sans-serif'; el.textContent = '▦'; }
        } else {
          const spPr = kid(n, 'spPr'), geom = attr(path(spPr, 'prstGeom'), 'prst', 'rect');
          let bg = await fillCss(spPr, rels);
          if (bg === null && key) bg = null;
          // the shape itself is drawn on its own layer, so a flip mirrors the shape but not its text
          const shape = document.createElement('div'); shape.style.cssText = `position:absolute;inset:0;box-sizing:border-box;${flip ? `transform:${flip};` : ''}`;
          if (bg && bg !== 'transparent') shape.style.background = bg;
          const l = kid(spPr, 'ln'), styleLn = path(n, 'style', 'lnRef'), lf = (l && kid(l, 'solidFill')) || (!l || !kid(l, 'noFill') ? (Number(attr(styleLn, 'idx', 0)) ? styleLn : null) : null);
          const lw = l && kid(l, 'noFill') ? 0 : lf ? Math.max(1, px(attr(l, 'w', 12700))) : 0;
          if (name === 'cxnSp' || geom === 'line' || geom === 'straightConnector1') {
            // lines are often 0 px high or wide: drawn with an SVG that overflows the box
            const c = color(lf) || '#444', w = W, h = Hh, sw = lw || 1, dash = attr(path(l, 'prstDash'), 'val'), head = path(l, 'tailEnd') && attr(path(l, 'tailEnd'), 'type', 'none') !== 'none';
            const ln_ = document.createElement('div'); ln_.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible';
            const pd = sw * 2 + 6;   // drawing area padded by the stroke, so 0-px high / wide lines are painted
            ln_.innerHTML = `<svg width="${w + 2 * pd}" height="${h + 2 * pd}" viewBox="${-pd} ${-pd} ${w + 2 * pd} ${h + 2 * pd}" style="overflow:visible;position:absolute;left:${-pd}px;top:${-pd}px">${head ? `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker></defs>` : ''}<line x1="0" y1="0" x2="${w}" y2="${h}" stroke="${c}" stroke-width="${sw}" ${dash && dash !== 'solid' ? `stroke-dasharray="${sw * 4} ${sw * 3}"` : ''} ${head ? 'marker-end="url(#ah)"' : ''}/></svg>`;
            if (flip) ln_.style.transform = flip; el.style.overflow = 'visible'; el.append(ln_);
          } else {
            if (lw && lf) shape.style.border = `${lw}px solid ${color(lf)}`;
            if (geom === 'ellipse') shape.style.borderRadius = '50%'; else if (geom === 'roundRect') shape.style.borderRadius = Math.min(xf.w, xf.h) * 0.1667 + 'px'; else if (geom === 'triangle') shape.style.clipPath = 'polygon(50% 0,0 100%,100% 100%)'; else if (geom === 'rtTriangle') shape.style.clipPath = 'polygon(0 0,0 100%,100% 100%)'; else if (geom === 'diamond') shape.style.clipPath = 'polygon(50% 0,100% 50%,50% 100%,0 50%)'; else if (geom === 'upArrow') shape.style.clipPath = 'polygon(50% 0,100% 40%,75% 40%,75% 100%,25% 100%,25% 40%,0 40%)'; else if (geom === 'downArrow') shape.style.clipPath = 'polygon(25% 0,75% 0,75% 60%,100% 60%,50% 100%,0 60%,25% 60%)'; else if (geom === 'rightArrow') shape.style.clipPath = 'polygon(0 25%,60% 25%,60% 0,100% 50%,60% 100%,60% 75%,0 75%)'; else if (geom === 'leftArrow') shape.style.clipPath = 'polygon(100% 25%,40% 25%,40% 0,0 50%,40% 100%,40% 75%,100% 75%)'; else if (geom === 'chevron' || geom === 'homePlate') shape.style.clipPath = geom === 'chevron' ? 'polygon(0 0,75% 0,100% 50%,75% 100%,0 100%,25% 50%)' : 'polygon(0 0,80% 0,100% 50%,80% 100%,0 100%)';
            const cg = kid(spPr, 'custGeom');
            if (cg || ['chord', 'arc', 'pie'].includes(geom)) {        // freehand / curved shapes as SVG paths
              const fc = bg && bg !== 'transparent' && !/url|gradient/.test(bg) ? bg : 'none', sc = lf ? color(lf) : 'none', sw = lw || 1;
              const ps = cg ? custPaths(cg, W, Hh) : presetPath(geom, spPr, W, Hh);
              shape.style.background = ''; shape.style.border = '';
              shape.innerHTML = `<svg width="${W}" height="${Hh}" style="overflow:visible;position:absolute;left:0;top:0">${ps.map(q => `<path d="${q.d}" fill="${q.fill ? fc : 'none'}" stroke="${q.stroke ? sc : 'none'}" stroke-width="${sw}"/>`).join('')}</svg>`; el.append(shape);
            } else if (geom === 'can' || geom === 'cube') {   // 3-D looking presets, drawn as SVG
              const w = W, h = Hh, fc = bg && bg !== 'transparent' && !/url|gradient/.test(bg) ? bg : '#4472c4', sc = lf ? color(lf) : 'none', sw = lw || 1;
              const adj = Number((path(spPr, 'prstGeom', 'avLst')?.firstElementChild?.getAttribute('fmla') || '').split(' ')[1]) || 25000, k = Math.min(w, h) * adj / 100000;
              const svg = geom === 'can' ? `<path d="M0,${k / 2} A${w / 2},${k / 2} 0 0 0 ${w},${k / 2} V${h - k / 2} A${w / 2},${k / 2} 0 0 1 0,${h - k / 2} Z" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/><ellipse cx="${w / 2}" cy="${k / 2}" rx="${w / 2}" ry="${k / 2}" fill="${fc}" stroke="${sc}" stroke-width="${sw}" style="filter:brightness(1.25)"/>`
                : `<path d="M0,${k} L${k},0 H${w} V${h - k} L${w - k},${h} H0 Z" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/><path d="M0,${k} L${k},0 H${w} L${w - k},${k} Z" fill="${fc}" style="filter:brightness(1.2)" stroke="${sc}" stroke-width="${sw}"/><path d="M${w - k},${k} L${w},0 V${h - k} L${w - k},${h} Z" fill="${fc}" style="filter:brightness(.8)" stroke="${sc}" stroke-width="${sw}"/>`;
              shape.style.background = ''; shape.style.border = ''; shape.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible">${svg}</svg>`; el.append(shape);
            } else if (shape.style.background || shape.style.border) el.append(shape);
          }
          const tx = kid(n, 'txBody');
          if (tx && kids(tx, 'p').some(p => p.textContent.trim() || kids(p).length)) {
            // list styles: shape -> layout placeholder -> master placeholder -> master text styles (title / body / other)
            const chain = [], bodies = [];
            for (const x of [lph, mph]) if (x && x !== n) { const pl = path(x, 'txBody', 'lstStyle'); if (pl) chain.push(pl); const b = path(x, 'txBody', 'bodyPr'); if (b) bodies.push(b); }
            const ts = ctxBase.mas && path(ctxBase.mas.documentElement, 'txStyles'), isTitle = key && ['title', 'ctrTitle'].includes(key.type); const style = key ? (isTitle ? kid(ts, 'titleStyle') : kid(ts, 'bodyStyle')) : kid(ts, 'otherStyle'); if (style) chain.push(style);
            const fr = path(n, 'style', 'fontRef'); const defColor = fr ? color(fr) : null;
            await renderTxBody(tx, { chain, bodies, defSz: isTitle ? 44 : 18, defColor, defFont: isTitle ? '+mj-lt' : '+mn-lt', flipText: xf.fv }, el);
          }
        }
        parent.append(el);
      } catch (/** @type {any} */ e) { console.warn('pptx shape skipped', e); }
    }
  }
  async function renderTable(tbl, el, xf, ctxBase) {
    const cols = kids(path(tbl, 'tblGrid'), 'gridCol').map(c => px(attr(c, 'w', 0))), t = document.createElement('table');
    t.style.cssText = `width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-size:16px`; const cg = document.createElement('colgroup'); cols.forEach(w => { const c = document.createElement('col'); c.style.width = w + 'px'; cg.append(c); }); t.append(cg);
    for (const tr of kids(tbl, 'tr')) { const row = document.createElement('tr'); row.style.height = px(attr(tr, 'h', 0)) + 'px';
      for (const tc of kids(tr, 'tc')) { if (attr(tc, 'hMerge') === '1' || attr(tc, 'vMerge') === '1') continue; const td = document.createElement('td'); td.colSpan = Number(attr(tc, 'gridSpan', 1)); td.rowSpan = Number(attr(tc, 'rowSpan', 1)); td.style.cssText = 'border:1px solid #999;padding:4px 8px;position:relative;vertical-align:middle;overflow:hidden';
        const pr = kid(tc, 'tcPr'), bg = pr && await fillCss(pr); if (bg) td.style.background = bg;
        const tx = kid(tc, 'txBody'); if (tx) { const holder = document.createElement('div'); holder.style.cssText = 'position:relative;min-height:1.2em'; await renderTxBody(tx, { chain: [], defSz: 16 }, holder); const w = holder.firstElementChild; if (w) { w.style.position = 'static'; w.style.padding = '0'; w.style.overflow = 'visible'; } td.append(holder); }
        row.append(td); } t.append(row); }
    el.append(t);
  }

  async function renderSlide(i) {
    const sp = slidePaths[i], doc = await read(sp), rels = await relsOf(sp), base = await loadLayout(sp, rels); if (!doc) throw new Error('badFile');
    { const tr = base.mrels && Object.values(base.mrels).find(r => /theme$/.test(r.type)); if (tr) { const t = await loadTheme(tr.target); theme = t.colors; fonts = t; } }
    const root = document.createElement('div'); root.style.cssText = `position:relative;width:${SW}px;height:${SH}px;overflow:hidden;background:#fff;font-family:${fontCss('+mn-lt')};`;
    // background: slide -> layout -> master
    for (const [d, r] of [[doc, rels], [base.lay, base.lrels], [base.mas, base.mrels]]) { const bgPr = d && path(d.documentElement, 'cSld', 'bg', 'bgPr'); if (bgPr) { const css = await fillCss(bgPr, r); if (css && css !== 'transparent') { root.style.background = css; break; } } const ref = d && path(d.documentElement, 'cSld', 'bg', 'bgRef'); if (ref) { const c = color(ref); if (c) { root.style.background = c; break; } } }
    if (attr(doc.documentElement, 'showMasterSp') !== '0') {
      if (base.mas && attr(base.lay?.documentElement, 'showMasterSp') !== '0') await renderTree(path(base.mas.documentElement, 'cSld', 'spTree'), base.mrels, root, base, { skipPh: true });
      if (base.lay) await renderTree(path(base.lay.documentElement, 'cSld', 'spTree'), base.lrels, root, base, { skipPh: true });
    }
    await renderTree(path(doc.documentElement, 'cSld', 'spTree'), rels, root, base);
    return root;
  }
  return { count: slidePaths.length, width: SW, height: SH, render: renderSlide, destroy: () => urls.forEach(u => URL.revokeObjectURL(u)) };
}

/* Counts slides without rendering (used at upload time). */
export async function countSlides(buf) {
  const Z = await JSZip.loadAsync(buf), f = Z.file('ppt/presentation.xml'); if (!f) throw new Error('badFile');
  return (await f.async('string')).match(/<p:sldId\s/g)?.length || 0;
}
