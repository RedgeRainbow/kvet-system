/* Printable documents: certificate, attendance sheet, login slips, practical sheet. Print (vector) and PDF download (raster, no libraries). */
import { qrSvg } from './qr.js';
import { fmtDate, fmtDateTime, certLabel, certCompanyLine, penaltyRange, sessionDays as sessionDaysOf } from './shared.js';
import { esc, t, lang } from './ui.js';
import { FORMS_CSS } from './forms-css.js';

/* Mulish is the certificate typeface (the sample certificate uses Mulish Regular / SemiBold / Bold).
   1. self-hosted files in public/fonts/ (run `npm run fonts` once) are used when present - family "MulishSelf";
   2. otherwise Mulish is loaded from Google Fonts - family "Mulish";
   3. a similar system font is the last resort. */
const FONT = `MulishSelf,Mulish,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`;
const FACES = [[400, 'Regular'], [600, 'SemiBold'], [700, 'Bold']];
export const GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family=Mulish:wght@400;600;700&display=block';
export const FONT_CSS = FACES.map(([w, n]) => `@font-face{font-family:MulishSelf;font-weight:${w};src:url(/fonts/Mulish-${n}.woff) format("woff")}`).join('');
/** @type {any} */ let selfHosted = null;
async function hasSelfHosted() {
  if (selfHosted !== null) return selfHosted;
  try { const r = await fetch("/fonts/Mulish-Regular.woff", { method: "HEAD" }); selfHosted = r.ok && /font|octet/.test(r.headers.get('content-type') || ''); } catch { selfHosted = false; }
  return selfHosted;
}
/* Makes sure the page itself has Mulish (previews on screen). */
export async function ensureFonts(doc = document) {
  if (await hasSelfHosted()) return;
  if (!doc.querySelector('link[data-mulish]')) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = GOOGLE_FONTS; l.dataset.mulish = '1'; doc.head.append(l); }
  try { await Promise.all(FACES.map(([w]) => doc.fonts.load(`${w} 16px Mulish`, 'AaƏəŞşİı'))); } catch {}
}
if (typeof document !== 'undefined') ensureFonts().catch(() => {});
const toDataUrl = async u => { const b = await (await fetch(u)).blob(); return new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); }); };
/** @type {any} */ let fontInline = null;   // the faces with the files embedded (the PDF raster path cannot load external files)
async function inlineFonts() {
  if (fontInline !== null) return fontInline; fontInline = '';
  try {
    if (await hasSelfHosted()) { for (const [w, n] of FACES) fontInline += `@font-face{font-family:MulishSelf;font-weight:${w};src:url(${await toDataUrl(`/fonts/Mulish-${n}.woff`)}) format("woff")}`; return fontInline; }
    let css = await (await fetch(GOOGLE_FONTS)).text();
    // only the Latin / Latin-extended subsets are needed (Azerbaijani letters live in latin-ext)
    css = css.split(/(?=\/\*)/).filter(b => /\/\*\s*latin(-ext)?\s*\*\//.test(b)).join('');
    for (const u of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))]) css = css.split(u).join(await toDataUrl(u));
    fontInline = css;
  } catch { fontInline = ''; }
  return fontInline;
}
export const DOC_CSS = FONT_CSS + `
.doc{font-family:${FONT};color:#111;background:#fff;box-sizing:border-box}.doc *{box-sizing:border-box}
.cert{width:794px;height:1123px;position:relative;overflow:hidden;white-space:normal;text-align:center;font-weight:400;font-size:15.7px;line-height:1.255}
.cert>*{position:absolute}
.cert .logo{left:555px;top:38.2px;width:196px;height:66px;object-fit:contain;object-position:right top}
.cert h1{left:0;right:0;top:168.9px;margin:0;font-size:29.4px;font-weight:700;line-height:1.255}
.cert h2{left:0;right:0;top:206.7px;margin:0;font-size:21.6px;font-weight:700;line-height:1.255}
.cert .no{left:0;right:0;top:241.4px;font-size:17.6px;font-weight:600}
.cert .intro{left:0;right:0;top:295.9px}
.cert .mid{left:44px;right:43px;top:324.9px;bottom:322px;display:flex;flex-direction:column;--k:1}
.cert .flow{flex:1 1 auto;min-height:0;overflow:hidden}
.cert .nm{color:#3568b4;font-weight:600}.cert .n1{font-size:calc(25.5px*var(--k));line-height:1.23}.cert .n2{font-size:calc(21.6px*var(--k));line-height:1.255;margin-top:.4px}
.cert .co{font-size:calc(15.7px*var(--k));line-height:1.3;margin-top:3px;color:#111}
.cert .desc{font-size:calc(15.7px*var(--k));line-height:1.25;margin-top:calc(11.4px*var(--k))}
.cert .q1{font-size:calc(21.6px*var(--k));line-height:1.25;margin-top:calc(8.1px*var(--k))}.cert .q2{font-size:calc(19.6px*var(--k));line-height:1.255;margin-top:1.5px}
.cert .det{font-size:calc(14.7px*var(--k));line-height:1.3;margin-top:calc(6px*var(--k));white-space:pre-line}
.cert .lower{flex:none;text-align:left;font-size:13.7px;line-height:17.6px;padding-top:9px}
.cert .lower hr{border:0;border-top:1px solid #111;margin:0 0 9px}
.cert .info{display:flex}.cert .info>div{flex:none}.cert .info>div:first-child{width:434.2px}.cert .info>div:last-child{flex:1;min-width:0}
.cert .info .gap{margin-top:7px}
.cert .reg{margin-top:9px;font-size:14.7px;font-weight:600}
.cert .red{margin-top:7px;color:#f00;font-size:16.7px;line-height:20.6px}
.cert .sig{left:352.6px;top:809.3px;width:380px;text-align:left;font-size:15.7px;white-space:nowrap}
.cert .sig .sl{display:inline-block;width:237px;height:1px;position:relative;vertical-align:baseline}
.cert .sig .sl img{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);max-height:64px;max-width:237px;object-fit:contain}
.cert .esig{right:43.4px;top:866px;width:max-content;min-width:330px;text-align:center;font-size:9.5px;line-height:1.35;color:#555;white-space:nowrap}
.cert .sig .who{position:absolute;left:68px;width:330px;top:16.6px;text-align:center;font-size:13.7px;line-height:1.3;white-space:nowrap}.cert .sig .who b{font-weight:600}
.cert .sig .sl.st{margin-left:14px}.cert .sig .estamp{position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);border:1.5px solid #3568b4;color:#3568b4;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;white-space:nowrap;line-height:1.25}
.cert .sig small{color:#111;position:absolute;left:176.6px;top:16.6px;font-size:13.7px;white-space:nowrap}
.cert .foot{left:43.6px;width:707px;top:892.5px;font-size:13.7px;line-height:17.6px;text-align:left}
.cert .qr{left:43.1px;top:956.5px;width:98px;height:98px}.cert .qr svg{width:100%;height:100%;display:block}
.cert .acc{left:185.4px;top:965.5px;width:566px;display:flex;gap:25.7px;align-items:flex-start;flex-wrap:nowrap;overflow:hidden}.cert .acc img{width:58.8px;height:auto;max-height:66px;object-fit:contain;flex:none}
.cert .addr{left:159.5px;width:592px;top:1041.5px;font-size:9.7px;line-height:1.255;text-align:left;color:#000}
.sheet{width:794px;padding:36px 44px 40px;font-size:13px}
.sheet .hd{display:flex;gap:16px;align-items:flex-start;border-bottom:2px solid #2f5fb3;padding-bottom:12px}.sheet .hd img{height:56px}.sheet .hd .ci{margin-left:auto;text-align:right;font-size:11.5px;line-height:1.45;color:#333}
.sheet h1{font-size:20px;margin:16px 0 4px}.sheet .meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 24px;margin:8px 0 14px;font-size:13px}.sheet .meta b{color:#444;font-weight:600}
.sheet table{width:100%;border-collapse:collapse}.sheet th,.sheet td{border:1px solid #888;padding:6px 7px;text-align:left;font-size:12px;vertical-align:middle}.sheet th{background:#eef2fa}
.sheet td.sg{width:110px;height:34px}.sheet .signs{display:flex;justify-content:space-between;gap:30px;margin-top:34px;font-size:12px}.sheet .signs div{flex:1;border-top:1px solid #111;padding-top:4px;text-align:center}
.sheet .stamp{width:140px;height:90px;border:1.5px dashed #777;border-radius:8px;display:grid;place-items:center;color:#888;font-size:11px;margin-left:auto}
.ph{width:100%;border-collapse:collapse;margin-bottom:10px}.ph td{border:1px solid #888;padding:6px 8px;vertical-align:middle}.ph .lg{width:92px;text-align:center}.ph .lg img{height:54px;max-width:84px;object-fit:contain}.ph .tt{text-align:center;font-size:17px;font-weight:700}.ph .tt small{display:block;font-size:12px;font-weight:600;color:#333;margin-top:2px}.ph .ad{width:200px;font-size:10.5px;line-height:1.45;color:#222}
.sheet.form,.sheet.crane{position:relative;min-height:1123px;padding:30px 40px 60px;font-family:Arial,Helvetica,sans-serif}
.sheet .esc{font-size:9.5px;line-height:1.35;color:#1d4e2f}.sheet .esbox{margin-top:18px;padding:8px 10px;border:1px solid #9cc5a8;background:#f2faf4;border-radius:6px;font-size:11px;color:#1d4e2f}
.sheet .www{position:absolute;left:40px;bottom:26px;font-size:12px;color:#1155cc;text-decoration:underline}
.sheet .ph td{border:0}.sheet .ph .tt{font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.35}.sheet .ph .ad{font:bold 10px/1.35 "Times New Roman",serif;color:#333;width:190px}
.sheet table.det{width:100%;border-collapse:collapse;margin:14px 0}.sheet table.det td{border:1px solid #000;padding:2px 6px;font-size:11.5px;height:18px}.sheet table.det td.k{font-weight:700;width:16%}
.sheet.form table.rt{border:1px solid #000}.sheet.form table.rt td{border:1px solid #000;padding:1px 5px;font-size:11.5px;height:17px}.sheet.form table.rt td.c{width:26px;text-align:center}
.sheet.form table.rt tr.sec td{background:#d9d9d9;font-weight:700}
.sheet .box.tc{border:1px solid #000;min-height:58px;margin:16px 0 28px}.sheet .glegend{color:#00b050;font-weight:700;text-align:center;font-size:12px;margin:22px 0 34px}
.sheet table.ex{width:100%;border-collapse:collapse}.sheet table.ex td{border:1px solid #000;padding:3px 6px;font-size:11.5px;height:22px}.sheet table.ex td.k{background:#b4c2d9;text-align:right;width:20%}
.sheet.crane .hbs{display:flex;gap:14px;margin:10px 0 10px;align-items:flex-start}.sheet.crane .hbs table.hb{flex:1;border-collapse:collapse}
.sheet table.hb th{border:1px solid #000;font-weight:400;font-size:11.5px;padding:3px;text-align:center}.sheet table.hb td{border:1px solid #000;font-size:10.5px;padding:2px 5px;height:17px}.sheet table.hb td.lb{border-right:0}.sheet table.hb td.v{width:38%}.sheet table.hb td.tall{height:34px;width:auto}
.sheet.crane table.pt{border-collapse:collapse}.sheet.crane table.pt th{background:none;font-weight:400;font-size:9.5px;border:1px solid #000;padding:2px 3px}.sheet.crane table.pt td{border:1px solid #000;font-size:9.5px;padding:2px 3px;height:15px}
.sheet.crane table.pt tr.sec td{background:none;color:#00a651;font-weight:700;text-align:center}.sheet.crane table.pt tr.cf td{text-align:right}.sheet.crane table.pt tr.tot td{color:#00a651;font-weight:700;text-align:right}
.sheet .gnote{color:#00a651;font-weight:700;font-size:11px;margin:8px 0}
.sheet table.dq{width:100%;border-collapse:collapse;border:1px solid #000;margin-top:4px}.sheet table.dq td{padding:5px 8px;font-size:11px;border:1px solid #000}.sheet table.dq b,.sheet table.dq span{color:#00a651}.sheet table.dq td.dqi{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;padding:12px 8px;border:0}.sheet table.dq td.dqi span{color:#000}
.sheet .bx{display:inline-block;width:13px;height:13px;border:1.4px solid #000;vertical-align:-2px;text-align:center;line-height:11px;font-size:11px;font-weight:700}
.sheet table.rs td,.sheet table.sg td{border:1px solid #000;font-size:11px;padding:4px 6px}.sheet table.sg td{width:50%}.sheet table.sg td.sgv{height:44px}.sheet table.rs td.c{text-align:center}
.pg{width:100%;border-collapse:collapse;margin-bottom:10px}.pg td{border:1px solid #888;padding:4px 7px;font-size:12px}.pg td.k{background:#eef2fa;font-weight:600;width:20%}
.pcols{display:flex;gap:10px;align-items:flex-start}.pcols>table{flex:1;min-width:0}.sheet table.pt th,.sheet table.pt td{padding:3px 5px;font-size:10.5px}.sheet table.pt td.c,.sheet table.pt th.c{text-align:center}.sheet table.pt tr.sec td{background:#eef2fa;font-weight:700}.sheet table.pt tr.hit td{background:#fff4f4}
.sheet table.rt th,.sheet table.rt td{padding:4px 6px;font-size:11.5px}.sheet table.rt td.c,.sheet table.rt th.c{text-align:center;width:34px}.sheet table.rt tr.sec td{background:#eef2fa;font-weight:700}
.sheet .box{border:1px solid #888;min-height:54px;padding:6px 8px;font-size:12px;margin:10px 0;white-space:pre-wrap}.sheet .box b{display:block;margin-bottom:2px}
.res{display:flex;gap:18px;align-items:center;margin:10px 0;font-size:13px;flex-wrap:wrap}.res .ck{display:inline-block;width:15px;height:15px;border:1.5px solid #111;vertical-align:-3px;margin:0 5px;text-align:center;line-height:12px;font-size:13px;font-weight:700}
.sheet table.sg2 td{padding:9px 8px;font-size:12px;height:34px}.sheet table.sg2 td.k{width:25%;background:#eef2fa;font-weight:600}.sheet .leg{font-size:11px;margin:8px 0}
.slips{width:794px;height:1123px;padding:22px 20px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(8,1fr);border-collapse:collapse;align-content:start;break-after:page}.slips:last-child{break-after:auto}.slips.pg2{break-before:page}
.slip{border:1px dashed #999;margin:0 -1px -1px 0;padding:8px 10px;font-size:11px;overflow:hidden;break-inside:avoid;display:flex;flex-direction:column;justify-content:center}
.slip .sh{display:flex;align-items:center;gap:6px;color:#555;font-size:9px;line-height:1.2}.slip .sh img{height:18px;flex:none}.slip .sh span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slip h3{margin:5px 0 3px;font-size:12.5px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.slip .kv{display:flex;justify-content:space-between;align-items:baseline;padding:1px 0}.slip .kv span{color:#555}.slip .kv b{font-family:Consolas,"Courier New",monospace;font-size:14px;letter-spacing:.5px}
.slip .u{margin-top:3px;font-size:9px;color:#3568b4}
` + FORMS_CSS + ``;

/* ------------------------------------------------------------------ helpers */
const addressLine = info => ['address', 'phone', 'email', 'website'].map(k => info?.[k] ? ({ address: 'Address: ', phone: 'Tel: ', email: 'Email ', website: '' }[k]) + info[k] : '').filter(Boolean).join(' | ');
export const verifyUrl = c => `${location.origin}/verify.html?n=${encodeURIComponent(c.no)}&h=${encodeURIComponent(c.vh || '')}`;
/* Signature pictures are served to signed-in office users only: their address needs the day's pass (GET /state -> sigPass).
   The candidate and company portals never draw a signature - they show the PDF the server drew (certpdf.js). */
let SIG_PASS = '';
export const setSigPass = p => { SIG_PASS = p ? '?s=' + encodeURIComponent(p) : ''; };
export const sigSrc = key => '/api/asset/' + key + SIG_PASS;
export const logoSrc = assets => assets?.logo || '/img/logo.png';

/* ------------------------------------------------------------- certificate
   Absolute layout measured from the sample certificate (A4, 794 x 1123 px); every line sits within 1 px of the sample.
   snap.lang 'en' = English-only certificate (foreign candidates who asked for it); snap.showCo = company line (Settings). */
/* How much the middle text must shrink to fit above the info block (long descriptions / details / company texts). */
function certScale(parts) {
  const lines = (txt, px) => (txt ? String(txt).split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length * px * 0.52 / 707)), 0) : 0);
  const h = 31 + (parts.n2 ? 27 : 0) + lines(parts.co, 15.7) * 20.4 + 11 + lines(parts.desc, 15.7) * 19.6 + 8 + lines(parts.q1, 21.6) * 27 + (parts.q2 ? lines(parts.q2, 19.6) * 24.6 : 0) + (parts.det ? 6 + lines(parts.det, 14.7) * 19.1 : 0);
  const avail = 1123 - 322 - 324.9 - parts.lower;
  return h <= avail ? 1 : Math.max(0.62, Math.floor(avail / h * 100) / 100);
}
/** @param {any} [c] @param {any} [assets] @param {any} [info] @param {any} o3 */
export function certHtml(c, assets = /** @type {any} */ ({}), info = /** @type {any} */ ({}), { noSign = false } = {}) {
  const s = c.snap, b = s.blank, en = s.lang === 'en';
  const descAz = String(b.descAz || '').replaceAll('{qual}', b.qualAz || ''), descEn = String(b.descEn || '').replaceAll('{qual}', b.qualEn || '');
  // signature: by an admin / superadmin / approver under their own name - their signature image, or the electronic stamp.
  // (c.sigId = company signature image of certificates released by earlier versions)
  const sg = noSign ? null : c.sign || (c.esign ? { ...c.esign, mode: 'esign' } : null);
  const sig = c.sigData && !noSign ? c.sigData : sg?.mode === 'image' && sg.img ? sigSrc(sg.img) : !noSign && !sg ? assets.sigs?.find(x => x.id === c.sigId)?.img : '';
  const names = s.names || { az: '', en: '' };
  const foot = en ? b.footEn || '' : [b.footAz, b.footEn].filter(Boolean).join(' / ');
  // every fixed text comes from the template / the certificate (blank.labels); an empty one hides its line
  const lb = (k, n) => { const l = certLabel(b, k), f = x => String(x || '').replaceAll('{0}', n ?? ''); return en ? f(l.en) : [f(l.az), f(l.en)].filter(Boolean).join(' / '); };
  const line = (k, v, br = true) => { const l = lb(k); return l ? `${esc(l)}${br ? '<br>' : ' - '}${v}` : ''; };
  const co = certCompanyLine(s), desc = en ? descEn : [descAz, descEn].filter(Boolean).join(' / ');
  const cr = Number(b.credits) > 0 ? lb('credits', b.credits) : '';
  const left = [line('provider', esc(b.provider)), [line('start', fmtDate(c.start), false), line('end', fmtDate(c.end || c.start), false), cr ? esc(cr) : ''].filter(Boolean).join('<br>')].filter(Boolean);
  const right = [line('learner', esc(s.att || c.att)), s.trainer ? line('trainer', esc(s.trainer)) : ''].filter(Boolean);
  const leftLines = left.join('<br>').split('<br>').length, rightLines = right.join('<br>').split('<br>').length;
  const lower = 18 + Math.max(leftLines, rightLines) * 17.6 + 7 + (s.reg ? 27 : 0) + (lb('valid') ? 48 : 0);
  const k = certScale({ n2: names.az && !en, co, desc, q1: en ? b.qualEn : b.qualAz, q2: en ? '' : b.qualEn, det: s.details, lower });
  const intro = lb('intro'), chief = lb('chief'), sigL = lb('signature');
  return `<div class="doc cert">
 <img class="logo" src="${esc(logoSrc(assets))}" alt="">
 <h1>${esc(en ? b.titleEn : b.titleAz)}</h1>${en ? '' : `<h2>${esc(b.titleEn)}</h2>`}
 <div class="no">No: ${esc(c.no)}</div>
 ${intro ? `<div class="intro">${esc(intro)}</div>` : ''}
 <div class="mid" style="--k:${k}"><div class="flow">
  ${names.az && !en ? `<div class="nm n1">${esc(names.az)}</div>` : ''}<div class="nm ${names.az && !en ? 'n2' : 'n1'}">${esc(names.en)}</div>
  ${co ? `<div class="co">${esc(co)}</div>` : ''}
  ${desc ? `<div class="desc">${esc(desc)}</div>` : ''}
  ${en ? `<div class="nm q1">${esc(b.qualEn)}</div>` : `<div class="nm q1">${esc(b.qualAz)}</div>${b.qualEn ? `<div class="nm q2">${esc(b.qualEn)}</div>` : ''}`}
  ${s.details ? `<div class="det">${esc(s.details)}</div>` : ''}
 </div><div class="lower"><hr>
  <div class="info"><div>${left.join('<div class="gap"></div>')}</div><div>${right.join('<div class="gap"></div>')}</div></div>
  ${s.reg ? `<div class="reg">${esc(s.reg)}</div>` : ''}
  ${lb('valid') ? `<div class="red">${esc(lb('valid'))}<br>${fmtDate(c.expiry)}</div>` : ''}
 </div></div>
 <div class="sig">${esc(sigL)}${sig ? `<span class="sl"><img src="${esc(sig)}" alt=""></span>` : sg ? `<span class="sl st"><span class="estamp">✔ ${en ? 'Signed electronically' : 'Elektron imzalanıb / Signed electronically'}</span></span>` : '________________________________'}${sg ? `<span class="who"><b>${esc(sg.name)}</b><br>${esc(sg.title || chief)}</span>` : `<small>${esc(chief)}${info.director ? ' · ' + esc(info.director) : ''}</small>`}</div>
 ${sg ? `<div class="esig">${en ? 'Electronic signature' : 'Elektron imza / Electronic signature'} · ${esc(fmtDateTime(sg.at))} · ${en ? 'code' : 'kod / code'} <b>${esc(sg.code)}</b></div>` : ''}
 <div class="foot">${esc(foot)}</div>
 <div class="qr">${c.vh ? qrSvg(verifyUrl(c), { margin: 1 }) : ''}</div>
 <div class="acc">${(assets.accred || []).slice(0, 7).map(a => `<img src="${esc(a)}" alt="">`).join('')}</div>
 <div class="addr">${esc(addressLine(info))}</div></div>`;
}
/* Electronic signature line: "Signed electronically by Name Surname · 31.10.2026 13:52 · code ABCD-1234 · check: <site>/verify.html?s=CODE" */
export function esignLine(sg, en = false, { url = true } = {}) {
  if (!sg) return '';
  const who = esc(sg.name) + (sg.title ? ', ' + esc(sg.title) : '');
  return `${en ? 'Signed electronically by' : 'Elektron imzalanıb / Signed electronically by'} <b>${who}</b> · ${esc(fmtDateTime(sg.at))} · ${en ? 'code' : 'kod / code'} <b>${esc(sg.code)}</b>${url && typeof location !== 'undefined' ? `<br>${esc(location.host)}/verify.html?s=${esc(sg.code)}` : ''}`;
}
/* Several certificates, one per page (print all of a session / a selection). */
export const certsHtml = (list, assets, info, o) => list.map(c => certHtml(c, assets, info, o)).join('');
/* ZIP with one PDF per certificate. Needs JSZip (public/vendor/jszip.min.js). onStep(i, n) reports progress. */
export async function certsZip(list, assets, info, { noSign = false, onStep } = /** @type {any} */ ({})) {
  const zip = new window.JSZip();
  for (const [i, c] of list.entries()) { onStep?.(i + 1, list.length); zip.file(certFile(c), await htmlToPdf(certHtml(c, assets, info, { noSign }))); }
  return zip.generateAsync({ type: 'blob' });
}
/* Example data for the blank editor preview. */
export function sampleCert(blank, assets, info, extra = {}) {
  return { no: 'CRT/26/0001', vh: 'preview00000', att: 'E-202600001', start: '2026-10-23', end: '2026-10-23', expiry: '2028-10-22', sigId: assets?.sig?.id || '',
    snap: { names: { az: 'Azər Qocayev', en: 'Azar Gojayev' }, att: 'E-202600001', company: 'Company LLC', coMode: 'show', trainer: 'Taleh Bakirov', blank, lang: 'both', details: 'Industrial Truck Type: Counterbalance, Make: HELI', reg: 'ECITB reg: 934838', ...extra } };
}

/* -------------------------------------------------------- attendance sheet */
/* rows: [{az, en, att, company, attAt, by}] */
/* esignDays: { date: signature } of a multi-day training (one trainer signature per day). Signed by the trainer only: no stamp. */
export function attendanceHtml({ session, blank, trainer, rows, info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), sign = true, esign = /** @type {any} */ (null), esignDays = /** @type {any} */ ({}) }) {
  const by = { self: t('byself'), trainer: t('bytrainer'), staff: t('bystaff') };
  return `<div class="doc sheet"><div class="hd"><img src="${esc(logoSrc(assets))}" alt=""><div class="ci"><b>${esc(info.name || '')}</b><br>${esc(info.address || '')}<br>${esc([info.phone, info.email, info.website].filter(Boolean).join(' · '))}</div></div>
 <h1>${esc(t('attSheet'))}</h1>
 <div class="meta"><div><b>${esc(t('training'))}:</b> ${esc(blank?.name || '')}</div><div><b>${esc(t('trainer'))}:</b> ${esc(trainer || '')}</div>
  <div><b>${esc(t('date'))}:</b> ${fmtDate(session.date)}${session.endDate ? ' – ' + fmtDate(session.endDate) : ''}${session.time ? ' ' + esc(session.time) : ''}</div><div><b>${esc(t('location'))}:</b> ${esc(session.location || '')}</div></div>
 ${(() => { const days = sessionDaysOf(session); return days.length > 1 ? `<table><thead><tr><th>#</th><th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th><th>${esc(t('company'))}</th>${days.map((d, i) => `<th style="text-align:center">${esc(t('dayN', i + 1))}<br><span style="font-weight:400">${fmtDate(d).slice(0, 5)}</span></th>`).join('')}<th>${esc(t('signature'))}</th></tr></thead><tbody>
 ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.az || r.en)}${r.az && r.en && r.az !== r.en ? `<br><span style="color:#555">${esc(r.en)}</span>` : ''}</td><td>${esc(r.att)}</td><td>${r.company ? esc(r.company) : esc(t('private'))}</td>${days.map(d => { const m = r.days?.[d]; return `<td style="text-align:center">${m?.absent ? '✗' : m?.at ? '✓<br><span style="color:#555;font-size:9px">' + esc(fmtDateTime(m.at).slice(-5)) + '</span>' : '—'}</td>`; }).join('')}<td></td></tr>`).join('')}
 </tbody></table><div style="font-size:10px;color:#555;margin-top:4px">✓ ${esc(t('present'))} · ✗ ${esc(t('absent'))} · — ${esc(t('dayNotMarked'))}</div>` : ''; })()}
 ${sessionDaysOf(session).length > 1 ? '' : `<table><thead><tr><th>#</th><th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th><th>${esc(t('company'))}</th><th>${esc(t('confirmedAt'))}</th><th>${esc(t('signature'))}</th></tr></thead><tbody>
 ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.az || r.en)}${r.az && r.en && r.az !== r.en ? `<br><span style="color:#555">${esc(r.en)}</span>` : ''}</td><td>${esc(r.att)}</td><td>${r.company ? esc(r.company) : esc(t('private'))}</td><td>${r.attAt ? fmtDateTime(r.attAt) + (r.by && r.by !== 'self' ? `<br><span style="color:#555">(${esc(by[r.by] || r.by)})</span>` : '') : '—'}</td><td class="sg"></td></tr>`).join('')}
 </tbody></table>`}
 ${sessionDaysOf(session).length > 1 ? sessionDaysOf(session).map((d, i) => esignDays[d] ? `<div class="esbox">${esc(t('dayN', i + 1))} · ${fmtDate(d)} — ✔ ${esignLine(esignDays[d])}</div>` : '').join('') : esign ? `<div class="esbox">✔ ${esignLine(esign)}</div>` : ''}
 ${sign && !(sessionDaysOf(session).length > 1 ? sessionDaysOf(session).every(d => esignDays[d]) : esign) ? `<div class="signs"><div>${esc(t('trainer'))}: ${esc(trainer || '')}</div><div>${esc(t('signature'))}</div></div>` : ''}</div>`;
}

/* ------------------------------------------------------------ login slips */
/* Cut sheet: 3 x 8 = 24 slips per A4 page, dashed lines to cut along. meta = { training, date } printed on every slip. */
export function slipsHtml(list, { info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), portal = 'trainee', meta = /** @type {any} */ ({}) }) {
  const url = (location.origin + '/' + portal + '.html').replace(/^https?:\/\//, ''), PER = 24, pages = [];
  for (let i = 0; i < list.length; i += PER) pages.push(list.slice(i, i + PER));
  const slip = p => `<div class="slip"><div class="sh"><img src="${esc(logoSrc(assets))}" alt=""><span>${esc(meta.training || info.name || '')}${meta.date ? ' · ' + esc(meta.date) : ''}</span></div>
 <h3>${esc(p.name)}</h3><div class="kv"><span>${esc(t('login'))}</span><b>${esc(p.login)}</b></div><div class="kv"><span>${esc(t('password'))}</span><b>${esc(p.password)}</b></div><div class="u">${esc(url)}</div></div>`;
  return pages.map((pg, i) => `<div class="doc slips${i ? ' pg2' : ''}">${pg.map(slip).join('')}</div>`).join('');
}

/* ---------------------------------------------------------- practical sheet
   Printed like the paper forms:
   - penalty (Overhead Crane): header with Candidate / Truck Type / Time boxes, two-column criteria table (Faults x Penalty = Award) with
     Carry Forward, Time Penalties and TOTAL, mandatory disqualification boxes; page 2: PASS / FAIL, test date, signatures, comments
   - rating (Appointed Person): details table, duties rated 1-5 / N/A, Task / Comments box, scale legend, Theory / Practical / TOTAL block
   - passfail: same frame as the rating form with Pass / Fail / N/A columns */
export function practicalHtml({ sheet, prac, candidate, session, blank, info = /** @type {any} */ ({}), assets = /** @type {any} */ ({}), company = '', exam = /** @type {any} */ (null), signs = /** @type {any} */ ({}) }) {
  const es = sg => (sg ? `<div class="esc">✔ ${esignLine(sg, false, { url: false })}</div>` : '');
  const a = prac?.answers || {}, pen = sheet.mode === 'penalty', rate = sheet.mode === 'rating', max = sheet.rule?.maxPenalty ?? 40;
  const auto = { candidate: candidate.az || candidate.en || '', company, date: fmtDate(session?.date), learnerNo: candidate.att || '', training: blank?.name || '', location: session?.location || '' };
  const hv = h => prac?.header?.[h.id] || (h.auto ? auto[h.auto] : '') || '';
  const box = on => `<span class="bx">${on ? '✓' : ''}</span>`;
  const addr = [info.address, info.phone && 'Tel.: ' + info.phone, info.email && 'e-mail: ' + info.email].filter(Boolean).map(esc).join('<br>');
  const head = `<table class="ph"><tr><td class="lg"><img src="${esc(logoSrc(assets))}" alt=""></td><td class="tt">${esc(sheet.title || sheet.name)}${sheet.subtitle ? `<br>${esc(sheet.subtitle)}` : blank?.name ? `<small>${esc(blank.name)}</small>` : ''}</td><td class="ad">${addr}</td></tr></table>`;
  const foot = `<div class="www">${esc(info.website || '')}</div>`;
  const hf = sheet.headerFields || [], groups = [...new Set(hf.map(h => h.group || ''))];

  if (pen) {
    // header boxes (Candidate | Truck Type | Time), fields without a group go into a plain details table
    const boxes = groups.filter(Boolean).map(g => { const fs = hf.filter(h => h.group === g);
      const rows = g === 'Candidate' ? fs.map(h => `<tr><td class="lb" colspan="2">${esc(h.label)}:</td></tr><tr><td class="v tall" colspan="2">${esc(hv(h))}</td></tr>`).join('') : fs.map(h => `<tr><td class="lb">${esc(h.label)}</td><td class="v">${esc(hv(h))}</td></tr>`).join('');
      return `<table class="hb"><tr><th colspan="2">${esc(g)}</th></tr>${rows}</table>`; }).join('');
    const loose = hf.filter(h => !h.group), looseT = loose.length ? `<table class="pg">${loose.map(h => `<tr><td class="k">${esc(h.label)}</td><td>${esc(hv(h))}</td></tr>`).join('')}</table>` : '';
    // criteria: left column until the section marked "starts the right column" (or the middle), right column after it
    const secs = sheet.sections || [], cutAt = secs.findIndex(x => x.col2), mid = cutAt > 0 ? cutAt : Math.ceil(secs.length / 2);
    let n = 0; const award = id => (prac?.faults?.[id] ? prac.faults[id] * (prac.pts?.[id] ?? 0) : a[id] || 0);
    const rowsOf = list => list.map(sec => `<tr class="sec"><td colspan="5">${esc(sec.title)}</td></tr>${sec.items.map(it => { const f = prac?.faults?.[it.id] ?? (a[it.id] ? 1 : 0), aw = award(it.id), r = penaltyRange(it), p = prac?.pts?.[it.id];
      return `<tr><td class="c">${++n}</td><td>${esc(it.text)}</td><td class="c">${f || ''}</td><td class="c">${esc(it.penalty)}${f && r.max > r.min && p !== undefined ? `<br><b>${esc(p)}</b>` : ''}</td><td class="c b">${aw || ''}</td></tr>`; }).join('')}`).join('');
    const left = secs.slice(0, mid), right = secs.slice(mid);
    const leftSum = left.flatMap(x => x.items).reduce((t2, it) => t2 + award(it.id), 0);
    const th = `<thead><tr><th class="c" style="width:22px">№</th><th>Criteria Observed</th><th class="c" style="width:38px">Faults</th><th class="c" style="width:42px">Penalty</th><th class="c" style="width:40px">Award</th></tr></thead>`;
    const tp = sheet.timePenalty ? (prac?.timePenalty ?? '') : '';
    const L = `<table class="pt">${th}<tbody>${rowsOf(left)}<tr class="cf"><td colspan="4">Carry Forward</td><td class="c b">${prac ? leftSum : ''}</td></tr></tbody></table>`;
    const R = `<table class="pt">${th}<tbody>${rowsOf(right)}<tr class="tot"><td colspan="4">Time Penalties</td><td class="c b">${tp === 0 ? 0 : esc(tp)}</td></tr><tr class="tot"><td colspan="4">TOTAL</td><td class="c b">${prac ? prac.total : ''}</td></tr><tr class="tot"><td colspan="5">W/A – Where Applicable</td></tr></tbody></table>`;
    const disq = (sheet.disq || []).length ? `<table class="dq"><tr><td><b>Mandatory Disqualification</b> <span>${esc(sheet.disqNote || '')}</span></td></tr><tr><td class="dqi">${sheet.disq.map(d => `<span>${esc(d.text)} ${box((prac?.disq || []).includes(d.id))}</span>`).join('')}</td></tr></table>` : '';
    const page1 = `<div class="doc sheet crane">${head}<div class="hbs">${boxes}</div>${looseT}<div class="pcols">${L}${R}</div>${sheet.note ? `<p class="gnote">${esc(sheet.note)}</p>` : ''}${disq}${foot}</div>`;
    const pass = prac?.result === 'PASS', fail = prac?.result === 'FAIL';
    const page2 = `<div class="doc sheet crane pg2">${head}<table class="pg rs"><tr><td style="width:12%">PASS</td><td style="width:13%" class="c">${box(pass)}</td><td>FAIL (over ${esc(max)} Penalty points)</td><td style="width:13%" class="c">${box(fail)}</td></tr><tr><td colspan="2">Test Date:</td><td colspan="2">${esc(fmtDate(session?.date))}</td></tr></table>
      <table class="pg sg"><tr><td>Candidate’s Signature</td><td>Examiner’s Signature</td></tr><tr><td class="sgv">${es(signs.candidate)}</td><td class="sgv">${es(signs.examiner)}</td></tr><tr><td>Examiner’s Name<br><b>${esc(prac?.examiner || '')}</b></td><td>Examiner’s Reg. Number<br><b>${esc(prac?.examinerReg || '')}</b></td></tr></table>
      <div class="box"><b>Comments</b>${esc(prac?.comments || '')}</div>${signs.examiner || signs.candidate ? `<p class="leg">${esc(t('esignCheck'))}: ${esc(typeof location !== 'undefined' ? location.host : '')}/verify.html?s=${esc((signs.examiner || signs.candidate).code)}</p>` : ''}${prac && !prac.done && prac.result === 'INCOMPLETE' ? `<p class="leg"><i>${esc(t('pracNotDone'))}</i></p>` : ''}${foot}</div>`;
    return page1 + page2;
  }

  // rating / pass-fail: details table with the fields in two columns (first half left, second half right)
  const half = Math.ceil(hf.length / 2), det = hf.length ? `<table class="det">${Array.from({ length: half }, (_, i) => { const l = hf[i], r = hf[i + half];
    return `<tr><td class="k">${esc(l.label)}:</td><td>${esc(hv(l))}</td>${r ? `<td class="k">${esc(r.label)}:</td><td>${esc(hv(r))}</td>` : '<td class="k"></td><td></td>'}</tr>`; }).join('')}</table>`
    : `<table class="det"><tr><td class="k">Delegate Name:</td><td>${esc(auto.candidate)}</td><td class="k">Company:</td><td>${esc(company)}</td></tr><tr><td class="k">Attendance No:</td><td>${esc(auto.learnerNo)}</td><td class="k">Date:</td><td>${esc(auto.date)}</td></tr></table>`;
  let n = 0;
  const cols = rate ? [1, 2, 3, 4, 5, 'NA'] : ['P', 'F', 'NA'], colLabel = v => (v === 'NA' ? 'N/A' : v === 'P' ? 'Pass' : v === 'F' ? 'Fail' : v);
  const body = `<table class="rt">${(sheet.sections || []).map((sec, si) => `<tr class="sec"><td colspan="2">${esc(sec.title)}</td>${cols.map(v => `<td class="c">${si === 0 ? esc(colLabel(v)) : ''}</td>`).join('')}</tr>${sec.items.map(it => `<tr><td class="c" style="width:26px">${++n}</td><td>${esc(it.text)}</td>${cols.map(v => `<td class="c">${a[it.id] === v ? '✓' : ''}</td>`).join('')}</tr>`).join('')}`).join('')}</table>`;
  const comments = `<div class="box tc"><b>Task / Comments:</b>${esc(prac?.comments || '')}</div>`;
  const legend = rate ? `<p class="glegend">1. Unsafe &nbsp; 2. Poor &nbsp; 3. Satisfactory &nbsp; 4. Good &nbsp; 5. Excellent &nbsp;&nbsp; N/A - Not Applicable</p>` : '';
  const theory = exam?.score !== undefined && exam?.score !== null ? exam.score : '';
  const practical = prac ? (rate ? `${prac.total} / ${prac.max}${prac.avg != null ? ` (${prac.avg.toFixed(2)})` : ''}` : `${prac.total} / ${prac.max}`) : '';
  const res = prac?.result === 'PASS' ? 'PASS' : prac?.result === 'FAIL' ? 'FAIL' : '';
  const tail = `<table class="ex"><tr><td class="k">Theory Part:</td><td>${esc(theory)}</td><td class="k">Examiner’s Name:</td><td>${esc(prac?.examiner || '')}</td></tr><tr><td class="k">Practical Part:</td><td>${esc(practical)}</td><td class="k">Examiner’s<br>Signature:</td><td>${es(signs.examiner)}</td></tr><tr><td class="k">TOTAL Mark:</td><td>${prac ? esc(prac.total) : ''}</td><td class="k">Pass/Fail:</td><td><b>${res}</b></td></tr></table>`;
  const cand = signs.candidate ? `<p class="leg">Candidate: ${es(signs.candidate)}</p>` : '';
  const chk = signs.examiner || signs.candidate ? `<p class="leg mute">${esc(t('esignCheck'))}: ${esc(typeof location !== 'undefined' ? location.host : '')}/verify.html?s=${esc((signs.examiner || signs.candidate).code)}</p>` : '';
  return `<div class="doc sheet form">${head}${det}${body}${comments}${legend}${tail}${cand}${chk}${foot}</div>`;
}

/* ---------------------------------------------------------------- output */
async function dataUrl(src) {
  try { const r = await fetch(src); const b = await r.blob(); return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); }); } catch { return src; }
}
async function inlineImgs(root) {
  await Promise.all([...root.querySelectorAll('img')].map(async im => { const s = im.getAttribute('src'); if (s && !s.startsWith('data:')) im.setAttribute('src', await dataUrl(s)); }));
}
function mount(html) {
  const box = document.getElementById('pdfbox') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'pdfbox' });
  box.innerHTML = `<style>${DOC_CSS}</style>${html}`; return box;
}
const loaded = root => Promise.all([...root.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));

/* Print through a hidden iframe: vector text, exact A4. */
export async function printHtml(html, title = '') {
  if (globalThis.KVET_NODL) return;                       // auditors: no printing / saving of documents
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.append(f); const d = /** @type {Document} */ (f.contentDocument), w = /** @type {Window} */ (f.contentWindow);
  const gf = (await hasSelfHosted()) ? '' : `<link rel="stylesheet" href="${GOOGLE_FONTS}">`;
  d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${gf}<style>@page{size:A4;margin:0}html,body{margin:0}${DOC_CSS}.cert{break-after:page}.cert:last-child{break-after:auto}.sheet.pg2{break-before:page}</style></head><body>${html}</body></html>`); d.close();
  await new Promise(r => setTimeout(r, 60)); await loaded(d.body);
  try { await Promise.race([Promise.all(FACES.map(([w]) => d.fonts.load(`${w} 16px Mulish`, 'AaƏə'))).then(() => d.fonts.ready), new Promise(r => setTimeout(r, 4000))]); } catch {}
  await new Promise(r => setTimeout(r, 150));
  w.focus(); w.print(); setTimeout(() => f.remove(), 60000);
}

/* HTML -> canvas through an SVG foreignObject (no external library). */
async function toCanvas(html, scale = 2) {
  const fonts = await inlineFonts(), box = mount(html), el = /** @type {HTMLElement} */ (box.querySelector('.doc')); if (fonts) box.querySelector('style')?.insertAdjacentHTML('beforeend', fonts); await loaded(box); await inlineImgs(box); if (fonts && document.fonts?.ready) await document.fonts.ready;
  const w = el.offsetWidth, h = el.offsetHeight;
  const xml = new XMLSerializer().serializeToString(box);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${xml.replace(/^<div[^>]*>/, '<div xmlns="http://www.w3.org/1999/xhtml">')}</foreignObject></svg>`;
  const img = new Image(); img.decoding = 'sync';
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('render')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  box.innerHTML = ''; return { canvas: c, w, h };
}
/* Minimal PDF with one JPEG per A4 page. */
function pdfFromJpegs(pages) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n'); const W = 595.28, H = 841.89, N = pages.length;
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${N} >>`);
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, ct = pg + 1, im = pg + 2, ph = W * p.h / p.w;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /I${i} ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    const cs = `q ${W} 0 0 ${Math.min(ph, H).toFixed(2)} 0 ${(H - Math.min(ph, H)).toFixed(2)} cm /I${i} Do Q`;
    obj(ct, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    offs[im] = len; push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`); push(p.bytes); push('\nendstream\nendobj\n');
  });
  const total = 3 + N * 3, xref = len; push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let o = 0; for (const b of parts) { out.set(b, o); o += b.length; } return new Blob([out], { type: 'application/pdf' });
}
const jpegBytes = c => new Promise(r => c.toBlob(async b => r(new Uint8Array(await b.arrayBuffer())), 'image/jpeg', 0.93));

/* Returns a PDF Blob; long documents are split into A4 pages. */
export async function htmlToPdf(html) {
  // several top-level documents (practical sheet page 1 + page 2, a batch of forms) start on new pages
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const docs = [...tpl.content.children].filter(e => e.classList?.contains('doc')), pages = [];
  for (const d of docs.length > 1 ? docs.map(e => e.outerHTML) : [html]) pages.push(...await docPages(d));
  return pdfFromJpegs(pages);
}
async function docPages(html) {
  const { canvas, w, h } = await toCanvas(html, /class="doc cert"/.test(html) ? 3 : 2), pageH = Math.round(w * 841.89 / 595.28), pages = [], scale = canvas.width / w;
  for (let y = 0; y < h || !pages.length; y += pageH) {
    if (pages.length && h - y < 8) break;            // a few pixels over A4 (borders, rounding) do not make an empty page
    const sh = Math.min(pageH, h - y), c = document.createElement('canvas'); c.width = canvas.width; c.height = Math.max(1, Math.round(sh * scale));
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, y * scale, canvas.width, sh * scale, 0, 0, c.width, c.height);
    pages.push({ bytes: await jpegBytes(c), pw: c.width, ph: c.height, w, h: sh });
  }
  return pages;
}
export const certFile = c => c.no.replace(/[^A-Za-z0-9]+/g, '-') + '.pdf';
