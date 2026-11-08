import { A, esc, t, openModal, download, fail, S, api, can, toast } from './lib.js';
import { certHtml, DOC_CSS, printHtml, htmlToPdf, certFile } from '../cert.js';

export const scaled = (html, width = 560) => `<div style="width:${width}px;max-width:100%;overflow:hidden"><div style="width:794px;transform-origin:0 0;transform:scale(${width / 794});height:${Math.round(1123 * width / 794)}px"><style>${DOC_CSS}</style>${html}</div></div>`;
/* Preview + print/PDF (with and without signature). `extra` = more modal buttons. */
/* Signs certificates as the signed-in admin / superadmin. mode 'esign' | 'image'. Returns the updated certificates (or null). */
export async function signCerts(nos, mode) {
  try {
    const r = (await api('/cert/sign', { kind: 'staff', body: { nos, mode } })).results, ok = r.filter(x => x.ok);
    toast(t('certsSignedN', ok.length, r.length > ok.length ? ` · ${r.length - ok.length} ✗` : ''), r.length === ok.length ? 'ok' : 'bad');
    const { certs } = await api('/certs?counts=0&size=500&nos=' + encodeURIComponent(nos.join(',')), { kind: 'staff' }); return certs;
  } catch (/** @type {any} */ e) { toast(e.message === 'needName' ? t('needName') : e.message === 'needSigImage' ? t('needSigImage') : t('server'), 'bad'); return null; }
}
/* the two signing buttons (only for admin / superadmin) */
export const signButtons = (nos, after) => (can('cert.sign') ? [
  { label: '✍ ' + t('signCertE'), cls: 'ghost', fn: async d => { const r = await signCerts(nos, 'esign'); if (r) { d._v = 'signed'; d.close(); after?.(r); } return false; } },
  ...(A.me.sigImg ? [{ label: '✍ ' + t('signCertImg'), cls: 'ghost', fn: async d => { const r = await signCerts(nos, 'image'); if (r) { d._v = 'signed'; d.close(); after?.(r); } return false; } }] : []),
] : []);
export function previewCert(c, extra = []) {
  const w = Math.min(560, innerWidth - 80), info = A.settings.company;
  const pdf = (ns) => async (d, b) => { try { download(await htmlToPdf(certHtml(c, A.assets, info, { noSign: ns })), certFile(c).replace('.pdf', ns ? '-nosign.pdf' : '.pdf')); } catch (/** @type {any} */ e) { fail(e); } return false; };
  return openModal({ title: c.no, wide: true, html: `<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start"><div style="border:1px solid var(--line)">${scaled(certHtml(c, A.assets, info), w)}</div>
    <div class="col" style="min-width:200px"><p><b>${esc(c.snap.names.en)}</b><br>${esc(c.snap.names.az)}<br><span class="mono">${esc(c.att)}</span></p><p class="mute sm">${esc(S.fmtDate(c.start))} → ${esc(S.fmtDate(c.end))}<br>${esc(t('valid'))}: <b>${esc(S.fmtDate(c.expiry))}</b></p>${c.revoked ? `<div class="banner bad">${esc(t('cs_REVOKED'))}: ${esc(c.revoked.reason || '')}</div>` : ''}${(c.sign || c.esign) ? `<div class="banner ok sm">✔ ${esc(t('signedBy'))} <b>${esc((c.sign || c.esign).name)}</b> · ${esc(S.fmtDateTime((c.sign || c.esign).at))}<br>${esc(t((c.sign || {}).mode === 'image' ? 'signModeImg' : 'signModeE'))} · <span class="mono">${esc((c.sign || c.esign).code)}</span></div>` : `<div class="banner warn sm">${esc(t('certUnsigned'))}</div>`}</div></div>`,
    buttons: [...extra,
      ...(c.revoked ? [] : signButtons([c.no], r => previewCert(r[0], extra))),
      ...(can('cert.sign') && (c.sign || c.esign) ? [{ label: t('withdrawSign'), cls: 'bad ghost', fn: async d => { await api('/cert/unsign', { kind: 'staff', body: { no: c.no } }); const { certs } = await api('/certs', { kind: 'staff' }); A.certs = certs; d._v = 'signed'; d.close(); previewCert(certs.find(x => x.no === c.no), extra); return false; } }] : []),
      { label: '🖨 ' + t('print'), cls: 'ghost', fn: async () => { await printHtml(certHtml(c, A.assets, info), c.no); return false; } },
      { label: t('printNoSign'), cls: 'ghost', fn: async () => { await printHtml(certHtml(c, A.assets, info, { noSign: true }), c.no); return false; } },
      { label: '⬇ PDF', fn: pdf(false) }, { label: '⬇ PDF (' + t('noSign') + ')', cls: 'ghost', fn: pdf(true) }, { label: t('close'), cls: 'ghost', id: 'x' }] });
}
