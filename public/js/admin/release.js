/* Release flow: shows PASS or FAIL, suggests certificate number + expiry (editable), creates the certificate only on PASS. */
import { ensurePeople, A, api, S, $, esc, t, toast, openModal, blank, trainee, personName, load, outcomeOf, can } from './lib.js';
const LS = (() => { try { return localStorage; } catch { return {}; } })();
import { previewCert } from './certview.js';

/* sess = session object, enr = enrolment. Resolves {result, cert?} or null when cancelled. */
export async function releaseFlow(sess, enr, tid) {
  await ensurePeople([tid]);
  const x = trainee(tid), b = blank(sess.bid), o = outcomeOf(enr, sess);
  if (o.outcome.startsWith('PENDING')) { toast(t({ PENDING_PRACTICAL: 'needPracticalFirst', PENDING_FEEDBACK: 'needFeedback' }[o.outcome] || 'needExam'), 'bad'); return null; }
  const pass = o.outcome === 'PASS', end = S.sessionEnd(sess), q = () => api(`/issue/suggest?bid=${encodeURIComponent(sess.bid)}&end=${end}`, { kind: 'staff' });
  const sg = pass ? await q() : { no: '', expiry: '' };
  const html = `<div class="result ${pass ? 'PASS' : 'FAIL'}">${esc(t(pass ? 'resultPass' : 'resultFail'))}</div><p style="text-align:center"><b>${esc(personName(x))}</b> · ${esc(b?.name || '')}</p>
    ${pass ? `<div class="fg"><label class="req">${esc(t('certNumber'))}<input id="rn" value="${esc(sg.no)}" maxlength="40" style="text-transform:uppercase"><span class="hint">${esc(t('certNumberHint'))}</span></label>
      <label class="req">${esc(t('expiryDate'))}<input id="rx" type="date" value="${esc(sg.expiry)}" min="${esc(end)}"><span class="hint">${esc(t('expiryHint', b?.months))}</span></label>
      ${can('cert.sign') ? `<label class="full">${esc(t('signNow'))}<select id="rs"><option value="">${esc(t('signLater'))}</option><option value="esign" ${LS['kvet.signMode'] === 'esign' ? 'selected' : ''}>${esc(t('signCertE'))}</option>${A.me.sigImg ? `<option value="image" ${LS['kvet.signMode'] === 'image' ? 'selected' : ''}>${esc(t('signCertImg'))}</option>` : ''}</select><span class="hint">${esc(A.me.name ? t('signAs', A.me.name) : t('needName'))}</span></label>` : ''}</div><div class="err" id="re" role="alert"></div>`
      : `<div class="banner bad">${esc(t('failNoCert'))}${o.reason ? ' — ' + esc(t('failWhy_' + o.reason)) : ''}</div><div class="err" id="re" role="alert"></div>`}`;
  const m = openModal({ title: t('release'), html, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: pass ? t('releaseCert') : t('confirmFail'), cls: pass ? 'ok' : 'bad', id: 'go', fn: async d => {
    const sm = $('#rs', d)?.value || ''; try { LS['kvet.signMode'] = sm; } catch {}
    try { const r = await api('/issue', { kind: 'staff', body: { sid: sess.id, tid, ...(pass ? { no: $('#rn', d).value, expiry: $('#rx', d).value, sign: sm } : {}) } }); if (r.signError) toast(t(r.signError), 'bad'); d._v = r; return true; }
    catch (/** @type {any} */ er) {
      if (er.message === 'dupCert') { const n = await q(); $('#re', d).textContent = t('dupCert', n.no); $('#rn', d).value = n.no; return false; }
      $('#re', d).textContent = t(er.message) === er.message ? t('server') : t(er.message); return false; } } }] });
  const v = await m.promise; if (!v?.result) return null;
  await load();
  if (v.cert) { toast(t('certReleased', v.cert.no), 'ok'); } else toast(t('failRecorded'));
  return v;
}
export async function showReleased(cert) { const { certs } = await api('/certs?counts=0&nos=' + encodeURIComponent(cert.no), { kind: 'staff' }); previewCert(certs[0] || cert); }
