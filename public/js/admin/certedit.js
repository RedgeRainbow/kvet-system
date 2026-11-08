/* Certificate texts: the label fields (template and single certificate), the company line choice, and the full editor of one
   issued certificate with a live preview. */
import { A, api, S, $, $$, esc, t, openModal, opts } from './lib.js';
import { certHtml, DOC_CSS } from '../cert.js';

const LKEYS = Object.keys(S.CERT_LABELS);

/* the fixed texts of a certificate: one AZ + EN pair each; empty = hidden line */
export function labelFields(labels = /** @type {any} */ ({}), ro = false) {
  return `<p class="hint full">${esc(t('labelsHint'))}</p>${LKEYS.map(k => { const v = { ...S.CERT_LABELS[k], ...(labels[k] || {}) };
    return `<label>${esc(t('lbl_' + k))} (AZ)<input data-l="${k}" data-g="az" value="${esc(v.az)}" maxlength="120" ${ro ? 'disabled' : ''}></label><label>${esc(t('lbl_' + k))} (EN)<input data-l="${k}" data-g="en" value="${esc(v.en)}" maxlength="120" ${ro ? 'disabled' : ''}></label>`; }).join('')}
   ${ro ? '' : `<div class="full"><button type="button" class="btn ghost sm" data-lreset>↺ ${esc(t('labelsDefault'))}</button></div>`}`;
}
export function readLabels(root) {
  const o = {}; $$('[data-l]', root).forEach(i => { (o[i.dataset.l] ||= { az: '', en: '' })[i.dataset.g] = i.value.trim(); });
  // only what differs from the defaults is stored
  return Object.fromEntries(Object.entries(o).filter(([k, v]) => v.az !== S.CERT_LABELS[k].az || v.en !== S.CERT_LABELS[k].en));
}
export function bindLabelReset(root, after) {
  root.addEventListener('click', e => { if (!e.target.closest('[data-lreset]')) return; $$('[data-l]', root).forEach(i => { i.value = S.CERT_LABELS[i.dataset.l][i.dataset.g]; }); after?.(); });
}

/* company line: the setting / the company's name / hidden / a text written here */
export function coFields({ mode = '', text = '', withDefault = true, names = /** @type {any} */ ({}) } = {}) {
  const o = [...(withDefault ? [['', t('coModeDefault')]] : []), ['show', t('coShow')], ['hide', t('coHide')], ['custom', t('coCustom')]];
  return `<label>${esc(t('coMode'))}<select ${names.mode ? `name="${names.mode}"` : ''} data-co-mode>${opts(o, mode)}</select></label>
   <label data-co-text${mode === 'custom' ? '' : ' class="hide"'}>${esc(t('coText'))}<input ${names.text ? `name="${names.text}"` : ''} data-co-txt value="${esc(text)}" maxlength="200" placeholder="${esc(t('coTextPh'))}"></label>`;
}
export function bindCo(root) {
  const sel = $('[data-co-mode]', root); if (!sel) return;
  const upd = () => $('[data-co-text]', root).classList.toggle('hide', sel.value !== 'custom');
  sel.addEventListener('change', upd); upd();
}

/* The full editor of an issued certificate: every text, the dates and the number, with a live preview.
   Saving changes only this certificate (its own copy); the template stays as it is. */
export function editCertDlg(c, { canRenumber = false } = {}) {
  const s = c.snap, b = s.blank || {}, mode = s.coMode || (s.showCo ? 'show' : 'hide');
  const I = (id, label, v, extra = '') => `<label>${esc(label)}<input id="${id}" value="${esc(v ?? '')}" ${extra}></label>`;
  const T = (id, label, v, rows = 2) => `<label class="full">${esc(label)}<textarea id="${id}" rows="${rows}">${esc(v ?? '')}</textarea></label>`;
  const html = `<div class="split"><div><div class="tabs" id="xt"><button type="button" class="tab on" data-s="1">${esc(t('secPerson'))}</button><button type="button" class="tab" data-s="2">${esc(t('secTexts'))}</button><button type="button" class="tab" data-s="3">${esc(t('secLabels'))}</button></div>
    <form id="xf" onsubmit="return false">
    <div data-sec="1" class="fg">
      ${I('en', t('certNumber'), c.no, canRenumber ? '' : 'disabled')}${I('xatt', t('learnerNo'), s.att || c.att, 'maxlength="40"')}
      ${I('ea', t('name') + ' (AZ)', s.names?.az, 'maxlength="160"')}${I('ee', t('name') + ' (EN)', s.names?.en, 'maxlength="160"')}
      ${coFields({ mode, text: s.coText || '', withDefault: false })}${I('ec', t('companyNameOnRecord'), s.company, 'maxlength="160"')}
      ${I('et', t('trainer'), s.trainer, 'maxlength="120"')}
      <label>${esc(t('certLang'))}<select id="xl">${opts([['both', t('certLangBoth')], ['en', t('certLangEn')]], s.lang === 'en' ? 'en' : 'both')}</select></label>
      <label>${esc(t('startDate'))}<input id="e1" type="date" value="${esc(c.start)}"></label><label>${esc(t('endDate'))}<input id="e2" type="date" value="${esc(c.end || c.start)}"></label><label>${esc(t('expiryDate'))}<input id="e3" type="date" value="${esc(c.expiry)}"></label>
    </div>
    <div data-sec="2" class="fg hide">
      ${I('xta', t('certTitle') + ' (AZ)', b.titleAz)}${I('xte', t('certTitle') + ' (EN)', b.titleEn)}
      ${I('xqa', t('certQual') + ' (AZ)', b.qualAz)}${I('xqe', t('certQual') + ' (EN)', b.qualEn)}
      ${T('xda', t('certDesc') + ' (AZ)', b.descAz)}${T('xde', t('certDesc') + ' (EN)', b.descEn)}
      ${T('xdt', t('certDetails'), s.details)}${I('xrg', t('certReg'), s.reg, 'maxlength="160" placeholder="ECITB reg: 934838"')}
      ${I('xpv', t('certProvider'), b.provider)}${I('xcr', t('credits'), b.credits, 'type="number" min="0" max="99"')}
      ${T('xfa', t('certFoot') + ' (AZ)', b.footAz)}${T('xfe', t('certFoot') + ' (EN)', b.footEn)}
    </div>
    <div data-sec="3" class="fg hide">${labelFields(b.labels || {})}</div></form>
    ${c.sign || c.esign ? `<div class="banner warn sm" style="margin-top:8px">${esc(t('editUnsigns'))}</div>` : ''}<div class="err" id="ex" role="alert"></div></div>
    <div class="pv"><div class="mute xs" style="margin-bottom:6px">${esc(t('livePreview'))}</div><div style="width:400px;height:${Math.round(1123 * 400 / 794)}px;overflow:hidden"><div class="pvbox" id="xpb" style="width:794px;transform:scale(${400 / 794})"></div></div></div></div>`;
  const read = d => {
    const v = id => $('#' + id, d).value;
    return { names: { az: v('ea').trim(), en: v('ee').trim() }, company: v('ec'), trainer: v('et'), att: v('xatt'), lang: v('xl'), coMode: $('[data-co-mode]', d).value, coText: $('[data-co-txt]', d).value,
      details: v('xdt'), reg: v('xrg'), start: v('e1'), end: v('e2'), expiry: v('e3'), newNo: v('en'),
      blank: { titleAz: v('xta'), titleEn: v('xte'), qualAz: v('xqa'), qualEn: v('xqe'), descAz: v('xda'), descEn: v('xde'), provider: v('xpv'), credits: Number(v('xcr')) || 0, footAz: v('xfa'), footEn: v('xfe'), labels: readLabels(d) } };
  };
  const m = openModal({ title: t('editCert') + ' ' + c.no, wide: true, html, onMount: d => {
    const prev = () => { const p = read(d); const x = { ...c, start: p.start, end: p.end, expiry: p.expiry, no: p.newNo || c.no, sign: null, esign: null,
      snap: { ...s, names: p.names, company: p.company, trainer: p.trainer, att: p.att, lang: p.lang, coMode: p.coMode, coText: p.coText, showCo: p.coMode === 'show', details: p.details, reg: p.reg, blank: { ...b, ...p.blank } } };
      $('#xpb', d).innerHTML = `<style>${DOC_CSS}</style>` + certHtml(x, A.assets, A.settings.company, { noSign: true }); };
    let tm = 0; const later = () => { clearTimeout(tm); tm = setTimeout(prev, 120); };
    d.addEventListener('input', later); d.addEventListener('change', later); bindCo(d); bindLabelReset(d, prev); prev();
    $('#xt', d).onclick = e => { const k = e.target.closest('[data-s]')?.dataset.s; if (!k) return; $$('#xt .tab', d).forEach(x => x.classList.toggle('on', x.dataset.s === k)); $$('[data-sec]', d).forEach(x => x.classList.toggle('hide', x.dataset.sec !== k)); };
  }, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
    try { const r = await api('/cert/update', { kind: 'staff', body: { no: c.no, patch: read(d) } }); m.saved = r.cert; return true; }
    catch (/** @type {any} */ e) { $('#ex', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] });
  return m;
}
