import { findCerts, findTrainees, ensurePeople, A, can, view, api, S, $, $$, esc, t, toast, fail, busy, openModal, confirmDlg, deleteRecord, empty, badge, pageHead, bar, searchBox, opts, stBadge, savedToast, download, writeXlsx, trainee, coName , pagerHtml, pageState, resetPage, onPage, paged } from './lib.js';
import { previewCert, signCerts } from './certview.js';
import { coFields, bindCo, editCertDlg } from './certedit.js';

export default async function ({ rerender, args }) {
  const el = view(), F = S.parseFilter(args?.[0]); let tab = F.st || 'all', q = '', bid = F.bid || '', arch = /** @type {any} */ (null);
  // searched, counted and paged on the server: years of certificates are never loaded whole
  let certs = [], total = 0, k = { total: 0, ACTIVE: 0, SOON: 0, EXPIRED: 0 }, seq = 0, tmr = 0, loaded = false;
  const params = extra => ({ st: ['ACTIVE', 'SOON', 'EXPIRED', 'REVOKED', 'RENEWED'].includes(tab) ? tab : '', unsigned: tab === 'UNSIGNED' ? 1 : '', bid, q, issued: F.issued, exp: F.exp, co: F.co, ...extra });
  // one page at a time from the server (25 / 50 / 100 per page); a new search or filter starts at page 1
  async function fetchList(keep = false) {
    if (!keep) resetPage('certs'); const ps = pageState('certs'), my = ++seq;
    try { const r = await findCerts(params({ page: ps.page, size: ps.size, counts: keep ? '0' : '1' })); if (my !== seq) return; certs = r.certs; total = r.total; if (r.counts) k = r.counts; loaded = true; }
    catch (/** @type {any} */ e) { if (my === seq) fail(e); return; }
    draw();
  }

  const filterOn = !!(F.issued || F.exp || F.co);
  const chips = () => [F.issued && t('fIssued', S.fmtDate(F.issued.split('..')[0]), S.fmtDate(F.issued.split('..')[1])), F.exp && t('fExpiring', F.exp), F.co && t('fCompany', F.co === '-' ? t('private') : coName(F.co))].filter(Boolean);
  let PA; async function drawArchive() {
    onPage('archive', drawArchive);
    arch = (await api('/archive', { kind: 'staff' })).list;
    el.innerHTML = pageHead(t('archive'), `<a class="btn ghost" href="#/certificates">← ${esc(t('navCerts'))}</a>${arch.length ? `<button class="btn bad ghost" id="emp">🗑 ${esc(t('emptyArchive'))}</button>` : ''}`) + `<p class="mute" style="margin-top:-8px">${esc(t('archiveIntro'))}</p>`
      + `<div class="tw"><table><thead><tr><th>${esc(t('certNumber'))}</th><th>${esc(t('fullName'))}</th><th>${esc(t('training'))}</th><th>${esc(t('archivedOn'))}</th><th>${esc(t('by'))}</th><th></th></tr></thead><tbody>${(PA = paged('archive', arch)).rows.map(a => `<tr><td class="mono nowrap">${esc(a.no)}</td><td><b>${esc(a.cert.snap.names.az || a.cert.snap.names.en)}</b><br><span class="mono xs mute">${esc(a.cert.att)}</span></td><td>${esc(a.cert.snap.blank.name)}</td><td class="nowrap">${esc(S.fmtDateTime(a.archivedAt))}</td><td class="sm">${esc(a.by || '')}<br><span class="mute xs">${esc(t('via_' + (a.via || 'delete')))}</span></td>
        <td class="act nowrap"><button class="btn ghost sm" data-rs="${esc(a.no)}">↩ ${esc(t('restore'))}</button> <button class="btn bad ghost sm" data-fd="${esc(a.no)}">🗑 ${esc(t('deleteForever'))}</button></td></tr>`).join('') || `<tr><td colspan="6">${empty('🗄', t('archiveEmpty'))}</td></tr>`}</tbody></table></div>${PA.html}`;
    $('#emp')?.addEventListener('click', async () => { if (!await confirmDlg(t('emptyArchiveConfirm', arch.length), { danger: true })) return; await api('/archive/delete', { kind: 'staff', body: { all: true } }); toast(t('deleted'), 'ok'); drawArchive(); });
    el.onclick = async e => {
      const rs = e.target.closest('[data-rs]'), fd = e.target.closest('[data-fd]');
      if (rs) await busy(rs, async () => { try { await api('/archive/restore', { kind: 'staff', body: { no: rs.dataset.rs } }); toast(t('restored'), 'ok'); A.certs = null; drawArchive(); } catch (/** @type {any} */ x) { toast(t(x.message) === x.message ? t('server') : t(x.message, ''), 'bad'); } });
      if (fd && await confirmDlg(t('deleteForeverConfirm', fd.dataset.fd), { danger: true })) { await api('/archive/delete', { kind: 'staff', body: { no: fd.dataset.fd } }); toast(t('deleted'), 'ok'); drawArchive(); }
    };
  }
  if (tab === 'ARCHIVE' && can('archive')) return drawArchive();
  /* certificates waiting for a signature (superadmin / approver): notice, the list of them, signing them all at once */
  const signBanner = () => {
    if (!can('cert.sign')) return '';
    if (tab === 'UNSIGNED') return `<div class="banner warn" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>✍ ${esc(t('certsToSign', total))}</b><span class="grow"></span>${total ? `<button class="btn sm" id="sgAll" data-m="esign">✍ ${esc(t('signAllShown', certs.length))}</button>${A.me.sigImg ? `<button class="btn ghost sm" id="sgAllI" data-m="image">🖊 ${esc(t('signAllImage'))}</button>` : ''}` : ''}<a class="btn ghost sm" href="#/certificates">✕</a></div>`;
    return A.unsignedCerts ? `<div class="banner warn" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>✍ ${esc(t('certsToSign', A.unsignedCerts))}</b><span class="grow"></span><a class="btn sm" href="#/certificates/st=UNSIGNED">${esc(t('showThem'))} →</a></div>` : '';
  };
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const rows = certs, focus = document.activeElement?.id === 'q' ? document.activeElement.selectionStart : null;
    el.innerHTML = pageHead(t('navCerts'), `${A.role === 'superadmin' ? `<button class="btn" id="dci">＋ ${esc(t('directCert'))}</button>` : ''}${can('archive') ? `<a class="btn ghost" href="#/certificates/st=ARCHIVE">🗄 ${esc(t('archive'))}</a>` : ''}${can('download') ? `<button class="btn ghost" id="xl">⬇ ${esc(t('exportExcel'))}</button>` : ''}`)
      + (filterOn ? `<div class="banner" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${esc(t('filter'))}:</b> ${chips().map(x => badge('info', x)).join(' ')}<span class="grow"></span><a class="btn ghost sm" href="#/certificates">✕ ${esc(t('clearFilter'))}</a></div>` : '')
      + `<div class="grid g4" style="margin-bottom:14px">${[['all', 'cTotal', k.total, ''], ['ACTIVE', 'cs_ACTIVE', k.ACTIVE, 'ok'], ['SOON', 'cs_SOON', k.SOON, 'warn'], ['EXPIRED', 'cs_EXPIRED', k.EXPIRED, 'bad']].map(([a, l, n, c]) => `<button class="stat ${c} ${tab === a ? 'on' : ''}" data-tab="${a}"><b>${n}</b><span>${esc(t(l))}</span></button>`).join('')}</div>`
      + bar(searchBox('q', q), `<select id="bl">${opts(A.blanks.map(b => [b.id, b.name]), bid, t('allTrainings'))}</select>`, `<button class="btn ghost sm ${tab === 'REVOKED' ? 'on' : ''}" data-tab="REVOKED">${esc(t('cs_REVOKED'))}</button><button class="btn ghost sm" data-tab="RENEWED">${esc(t('cs_RENEWED'))}</button>`, `<span class="mute sm">${total}</span>`)
      + `<div class="tw"><table><thead><tr><th>${esc(t('certNumber'))}</th><th>${esc(t('fullName'))}</th><th>${esc(t('training'))}</th><th>${esc(t('company'))}</th><th>${esc(t('trainingDate'))}</th><th>${esc(t('valid'))}</th><th>${esc(t('status'))}</th></tr></thead><tbody>${rows.map(c => `<tr class="click" data-no="${esc(c.no)}"><td class="mono nowrap">${esc(c.no)}</td><td><b>${esc(c.snap.names.az || c.snap.names.en)}</b><br><span class="mono xs mute">${esc(c.att)}</span></td><td>${esc(c.snap.blank.name)}</td><td>${esc(c.snap.company || t('private'))}</td><td class="nowrap">${esc(S.fmtDate(c.start))}</td><td class="nowrap">${esc(S.fmtDate(c.expiry))}</td><td>${stBadge(c.st)}</td></tr>`).join('') || `<tr><td colspan="7">${loaded ? empty('📜', t('noCerts')) : '<span class="spin"></span>'}</td></tr>`}</tbody></table></div>`
      + pagerHtml('certs', total);
    if (focus !== null) { const i = $('#q'); i.focus(); i.setSelectionRange(focus, focus); }
    $('#q').oninput = e => { q = e.target.value; clearTimeout(tmr); tmr = setTimeout(() => fetchList(), 250); };
    $('#bl').onchange = e => { bid = e.target.value; fetchList(); };
    onPage('certs', () => fetchList(true));
    $$('#sgAll,#sgAllI').forEach(b => (b.onclick = () => busy(b, async () => { if (!await confirmDlg(t('signAllConfirm', certs.length))) return; await signCerts(certs.map(c => c.no), b.dataset.m); window.__badges?.(); fetchList(); })));
    $('#dci')?.addEventListener('click', () => directIssue());
    if ($('#xl')) $('#xl').onclick = e => busy(e.currentTarget, async () => { let all; try { all = (await findCerts(params({ all: 1, counts: '0' }))).certs; } catch (/** @type {any} */ x) { return x.message === 'tooMany' ? toast(t('tooMany', x.data.n, x.data.max), 'bad') : fail(x); } const rows = all; download(await writeXlsx([{ name: 'Certificates', rows: [[t('certNumber'), t('learnerNo'), t('name') + ' (AZ)', t('name') + ' (EN)', t('company'), t('training'), t('trainingDate'), t('valid'), t('status')], ...rows.map(c => [c.no, c.att, c.snap.names.az, c.snap.names.en, c.snap.company, c.snap.blank.name, S.fmtDate(c.start), S.fmtDate(c.expiry), t('cs_' + c.st)])], widths: [16, 14, 28, 28, 30, 30, 12, 12, 12], textCols: [0, 1, 6, 7] }]), 'certificates.xlsx'); });
  }
  draw(); fetchList();
  el.onclick = e => { const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; return fetchList(); } const r = e.target.closest('tr[data-no]'); if (r) open(certs.find(c => c.no === r.dataset.no)); };
  function open(c) {
    const extra = [];
    if (can('cert.update')) extra.push({ label: t('edit'), cls: 'ghost', fn: async d => { d._v = 'edit'; d.close(); return false; } });
    if (can('cert.revoke')) extra.push(c.revoked ? { label: t('restoreCert'), cls: 'ghost', fn: async d => { await api('/cert/revoke', { kind: 'staff', body: { no: c.no, revoke: false } }); d._v = 'reload'; d.close(); return false; } } : { label: t('revokeCert'), cls: 'bad ghost', fn: async d => { d._v = 'revoke'; d.close(); return false; } });
    if (A.role === 'superadmin' && !c.revoked) extra.push({ label: '↻ ' + t('renewCert'), cls: 'ghost', fn: async d => { d._v = 'renew'; d.close(); return false; } });
    if (can('cert.delete')) extra.push({ label: '🗑', cls: 'bad ghost', fn: async d => { d._v = 'del'; d.close(); return false; } });
    previewCert(c, extra).promise.then(async v => {
      if (v === 'reload') { rerender(); }
      if (v === 'edit') editCert(c);
      if (v === 'renew') directIssue(c);
      if (v === 'revoke') { const m = openModal({ title: t('revokeCert'), html: `<label>${esc(t('reason'))}<input id="rr" maxlength="300"></label>`, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('revokeCert'), cls: 'bad', id: 'ok', fn: async d => { await api('/cert/revoke', { kind: 'staff', body: { no: c.no, revoke: true, reason: $('#rr', d).value } }); return true; } }] }); if (await m.promise === 'ok') rerender(); }
      if (v === 'del') { if (await deleteRecord('cert', c.no, { name: c.no + ' · ' + (c.snap.names.az || c.snap.names.en) })) rerender(); }
    });
  }
  /* Superadmin: a fully custom certificate without a training session, and the renewal of an expired one (same learner number). */
  async function directIssue(renew) {
    // the person is searched on the server as one types (learner number or name)
    if (renew) await ensurePeople([renew.tid]);
    let trs = []; const def = renew ? trainee(renew.tid) : null; if (def) trs = [def];
    const months = bid2 => (A.blanks.find(b => b.id === bid2)?.months) || 24;
    const today = A.today, bidDef = renew ? renew.bid : (A.blanks[0]?.id || '');
    const exp = (start, bid2) => { const d = new Date(Date.parse(start || today)); d.setMonth(d.getMonth() + months(bid2)); return d.toISOString().slice(0, 10); };
    const custom = renew ? renew.snap : null;
    const html = `${renew ? `<div class="banner sm">↻ ${esc(t('renewOfHint', renew.no))}</div>` : `<p class="hint">${esc(t('directCertHint'))}</p>`}
      <div class="fg"><label class="req full">${esc(t('trainee'))}<input id="dT" list="dTl" value="${def ? esc(def.att + ' — ' + S.fullAz(def)) : ''}" placeholder="${esc(t('searchByLearnerNo'))}" autocomplete="off"><datalist id="dTl"></datalist></label>
      <label class="req">${esc(t('training'))} (${esc(t('template'))})<select id="dB">${opts(A.blanks.map(b => [b.id, b.name]), bidDef)}</select></label>
      <label>${esc(t('certNumber'))} <span class="mute">(${esc(t('optional'))})</span><input id="dN" maxlength="40" placeholder="${esc(t('autoNumber'))}"></label>
      <label>${esc(t('startDate'))}<input id="d1" type="date" value="${esc(today)}"></label><label>${esc(t('endDate'))}<input id="d2" type="date" value="${esc(today)}"></label>
      <label class="req">${esc(t('expiryDate'))}<input id="d3" type="date" value="${esc(exp(today, bidDef))}"></label>
      <label>${esc(t('signNow'))}<select id="dS"><option value="">${esc(t('signLater'))}</option><option value="esign">${esc(t('signCertE'))}</option>${A.me.sigImg ? `<option value="image">${esc(t('signCertImg'))}</option>` : ''}</select></label></div>
      <details style="margin-top:6px"${renew ? ' open' : ''}><summary class="sm">${esc(t('customFields'))}</summary><div class="fg" style="margin-top:8px">
        <label>${esc(t('name'))} (AZ)<input id="cNa" value="${esc(custom?.names?.az || '')}" placeholder="${esc(t('fromTrainee'))}"></label><label>${esc(t('name'))} (EN)<input id="cNe" value="${esc(custom?.names?.en || '')}" placeholder="${esc(t('fromTrainee'))}"></label>
        <label>${esc(t('training'))}<input id="cTn" value="${esc(custom?.blank?.name || '')}" placeholder="${esc(t('fromTemplate'))}"></label><label>${esc(t('credits'))}<input id="cCr" value="${esc(custom?.blank?.credits || '')}" placeholder="${esc(t('fromTemplate'))}"></label>
        <label>${esc(t('trainer'))}<input id="cTr" value="${esc(custom?.trainer || '')}"></label><div></div>
        ${coFields({ mode: custom?.coMode || '', text: custom?.coText || '' })}
        <label class="full">${esc(t('certDetails'))}<textarea id="cDt" rows="2" placeholder="${esc(t('certDetailsPh'))}">${esc(custom?.details || '')}</textarea></label>
        <label class="full">${esc(t('certReg'))}<input id="cRg" maxlength="160" value="${esc(custom?.reg || '')}" placeholder="ECITB reg: 934838"></label>
        <label class="full">${esc(t('certTitle'))} (AZ)<input id="cTa" value="${esc(custom?.blank?.titleAz || '')}" placeholder="${esc(t('fromTemplate'))}"></label><label class="full">${esc(t('certTitle'))} (EN)<input id="cTe" value="${esc(custom?.blank?.titleEn || '')}" placeholder="${esc(t('fromTemplate'))}"></label>
        <label class="full">${esc(t('certQual'))} (AZ)<input id="cQa" value="${esc(custom?.blank?.qualAz || '')}" placeholder="${esc(t('fromTemplate'))}"></label><label class="full">${esc(t('certQual'))} (EN)<input id="cQe" value="${esc(custom?.blank?.qualEn || '')}" placeholder="${esc(t('fromTemplate'))}"></label>
        <label class="full">${esc(t('certDesc'))} (AZ)<textarea id="cDa" rows="2" placeholder="${esc(t('fromTemplate'))}">${esc(custom?.blank?.descAz || '')}</textarea></label><label class="full">${esc(t('certDesc'))} (EN)<textarea id="cDe" rows="2" placeholder="${esc(t('fromTemplate'))}">${esc(custom?.blank?.descEn || '')}</textarea></label>
        <label class="full">${esc(t('certFoot'))} (AZ)<input id="cFa" value="${esc(custom?.blank?.footAz || '')}" placeholder="${esc(t('fromTemplate'))}"></label><label class="full">${esc(t('certFoot'))} (EN)<input id="cFe" value="${esc(custom?.blank?.footEn || '')}" placeholder="${esc(t('fromTemplate'))}"></label>
        <label class="full">${esc(t('certProvider'))}<input id="cPv" value="${esc(custom?.blank?.provider || '')}" placeholder="${esc(t('fromTemplate'))}"></label>
      </div></details><div class="err" id="dE" role="alert"></div>`;
    const m = openModal({ title: renew ? t('renewCert') : t('directCert'), wide: true, html, onMount: d => {
      let tq = 0, tmr2 = 0; const opt = x => `<option value="${esc(x.att + ' — ' + S.fullAz(x))}">`;
      $('#dT', d).addEventListener('input', e => { clearTimeout(tmr2); const v = e.target.value.split('—')[0].trim(); if (v.length < 2) return; tmr2 = setTimeout(async () => { const my = ++tq; try { const r = await findTrainees({ q: v, size: 20 }); if (my !== tq) return; trs = [...new Map([...trs, ...r.list].map(x => [x.id, x])).values()]; $('#dTl', d).innerHTML = r.list.filter(x => x.att).map(opt).join(''); } catch {} }, 200); });
      const reExp = () => { $('#d3', d).value = exp($('#d1', d).value, $('#dB', d).value); };
      $('#dB', d).onchange = reExp; $('#d1', d).onchange = reExp; bindCo(d);
    }, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: renew ? t('renewCert') : t('issueCert'), id: 'ok', fn: async d => {
      const raw = $('#dT', d).value.trim(), att = raw.split('—')[0].trim(); let tr = trs.find(x => x.att === att) || trs.find(x => raw && S.fullAz(x) === raw && !x.temp);
      if (!tr && att) tr = (await findTrainees({ q: att, size: 5 })).list.find(x => x.att === att);   // typed without picking from the list
      if (!tr) { $('#dE', d).textContent = t('pickTrainee'); return false; }
      const body = { tid: tr.id, bid: $('#dB', d).value, no: $('#dN', d).value.trim(), start: $('#d1', d).value, end: $('#d2', d).value, expiry: $('#d3', d).value, sign: $('#dS', d).value, renewOf: renew?.no || '',
        custom: { nameAz: $('#cNa', d).value, nameEn: $('#cNe', d).value, trainingName: $('#cTn', d).value, credits: $('#cCr', d).value, trainerName: $('#cTr', d).value, coMode: $('[data-co-mode]', d).value, coText: $('[data-co-txt]', d).value, details: $('#cDt', d).value, reg: $('#cRg', d).value, titleAz: $('#cTa', d).value, titleEn: $('#cTe', d).value, qualAz: $('#cQa', d).value, qualEn: $('#cQe', d).value, descAz: $('#cDa', d).value, descEn: $('#cDe', d).value, footAz: $('#cFa', d).value, footEn: $('#cFe', d).value, provider: $('#cPv', d).value } };
      try { const r = await api('/cert/issue-direct', { kind: 'staff', body }); toast(t('certIssued', r.cert.no), 'ok'); A.certs = null; return true; }
      catch (/** @type {any} */ e) { $('#dE', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] });
    m.promise.then(v => { if (v === 'ok') rerender(); });
  }
  function editCert(c) {
    const m = editCertDlg(c, { canRenumber: can('cert.delete') });
    m.promise.then(v => { if (v === 'ok') { savedToast(); rerender(); } });
  }
}
