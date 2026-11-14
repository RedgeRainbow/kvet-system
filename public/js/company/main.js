import { mountPortal, topbar } from '../portal.js';
import { live } from '../live.js';
import { api } from '../api.js';
import * as S from '../shared.js';
import { $, $$, esc, t, fail, toast, openModal, badge, empty, busy, download, norm, confirmDlg, paged, onPage, showPdf, dataUrl } from '../ui.js';
import { certHtml, DOC_CSS, printHtml, htmlToPdf, certFile } from '../cert.js';
import { writeXlsx, readXlsx } from '../xlsx.js';
import { analyticsView } from '../analytics.js';
import { personForm, bindPerson } from '../person.js';
const scaled = (html, w) => `<div style="width:${w}px;max-width:100%;overflow:hidden"><div style="width:794px;transform-origin:0 0;transform:scale(${w / 794});height:${Math.round(1123 * w / 794)}px"><style>${DOC_CSS}</style>${html}</div></div>`;
import { icon } from '../icons.js';

const K = 'company';
/** @type {any} */ let gotoH = null;
const rqBadge = s => badge({ new: 'PENDING', planned: 'info', done: 'PASS', rejected: 'FAIL' }[s] || '', t('rq_' + s));

mountPortal({ kind: K, titleKey: 'portalCompany', bodyClass: 'company', async boot({ app, rerender }) {
  const H = await api('/portal/company/home', { kind: K }); let tab = 'ALL', q = '', view = 'certs', R = /** @type {any} */ (null), CR = /** @type {any} */ (null);
  const loadCands = async () => { CR = (await api('/portal/company/candidates', { kind: K })).list; };
  try { await loadCands(); } catch { CR = []; }
  const C = H.counters, name = x => (x.foreign ? S.fullEn(x) : S.fullAz(x));
  const certName = c => (c.snap.foreign ? c.snap.names?.en : c.snap.names?.az) || c.snap.names?.en || '';
  const loadReq = async () => { R = await api('/portal/company/requests', { kind: K }); };
  // the bell leads to the requests / candidate registrations
  document.removeEventListener('kvet:goto', gotoH); gotoH = async e => { if (!['requests', 'cands'].includes(e.detail)) return; view = e.detail; try { if (view === 'requests') await loadReq(); else await loadCands(); } catch {} draw(); }; document.addEventListener('kvet:goto', gotoH);
  const tile = (k, n, label, cls) => `<button class="stat ${cls} ${tab === k ? 'on' : ''}" data-tab="${k}"><b>${n}</b><span>${esc(label)}</span></button>`;

  /* Excel: one sheet with the staff, one with all valid certificates */
  async function exportXlsx() {
    const live = H.certs.filter(c => c.snap && c.st !== 'RENEWED');
    download(await writeXlsx([
      { name: 'Staff', rows: [[t('fullName'), t('learnerNo'), t('navCerts')], ...H.trainees.map(x => [name(x), x.att, x.certs])], widths: [40, 16, 12], textCols: [0, 1] },
      { name: 'Certificates', rows: [[t('certNo'), t('fullName'), t('learnerNo'), t('training'), t('start'), t('valid'), t('status')], ...live.map(c => [c.no, certName(c), c.att, c.snap.blank?.name || '', S.fmtDate(c.start), S.fmtDate(c.expiry), t('cs_' + c.st)])], widths: [16, 36, 16, 34, 12, 12, 14], textCols: [0, 1, 2, 3, 4, 5, 6] },
    ]), `${S.loginSlug(H.company.name) || 'company'}-training.xlsx`);
  }

  /* new request: a training for some people, or the renewal of certificates that expire */
  async function requestDlg(pre = {}) {
    if (!R) await loadReq();
    const soon = H.certs.filter(c => c.snap && (c.st === 'SOON' || c.st === 'EXPIRED')), sel = new Set(pre.certs || []), ppl = new Set(pre.people || []);
    let groups = []; try { groups = (await api('/portal/company/groups', { kind: K })).list; } catch {}
    const P = { q: '', f: '' };
    const m = openModal({ title: t('newRequest'), wide: true, html: `<form id="rf"><div class="fg">
      <label>${esc(t('rqKind'))}<select name="kind"><option value="renewal" ${pre.kind !== 'training' ? 'selected' : ''}>${esc(t('rk_renewal'))}</option><option value="training" ${pre.kind === 'training' ? 'selected' : ''}>${esc(t('rk_training'))}</option></select></label>
      <label>${esc(t('training'))}<select name="bid"><option value="">—</option>${R.blanks.map(b => `<option value="${esc(b.id)}" ${pre.bid === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label>${esc(t('rqWhen'))} <span class="mute">(${esc(t('optional'))})</span><input name="date" type="date" min="${esc(H.today)}"></label>
      <label>${esc(t('rqCount'))} <span class="mute">(${esc(t('optional'))})</span><input name="count" type="number" min="0" max="999"></label>
      <label class="full">${esc(t('rqContact'))}<input name="contact" maxlength="160" value="${esc([H.company.contactPerson, H.company.phone].filter(Boolean).join(', '))}"></label>
      ${soon.length ? `<div class="full"><div class="b sm" style="margin-bottom:4px">${esc(t('rqCertsSoon'))}</div><div class="pick" style="max-height:180px">${soon.map(c => `<label><input type="checkbox" data-c="${esc(c.no)}" ${sel.has(c.no) ? 'checked' : ''}> <span><b>${esc(certName(c))}</b> <span class="mute xs">${esc(c.snap.blank?.name || '')} · ${esc(S.fmtDate(c.expiry))}</span></span></label>`).join('')}</div></div>` : ''}
      <div class="full"><div class="row" style="margin-bottom:4px"><b class="sm">${esc(t('rqPeople'))}</b><span class="grow"></span><span class="bd info">${esc(t('selected'))}: <b id="pn">0</b></span></div>
        <div class="bar" style="margin-bottom:6px;flex-wrap:wrap"><input class="sr-in" id="pq" type="search" placeholder="${esc(t('searchNameNo'))}" style="min-width:160px">
          <select id="pf" aria-label="${esc(t('filter'))}"><option value="">${esc(t('pfAll'))}</option><option value="noCert">${esc(t('pfNoCert'))}</option><option value="soon">${esc(t('pfSoon'))}</option><option value="valid">${esc(t('pfValid'))}</option><option value="never">${esc(t('pfNever'))}</option><option value="sel">${esc(t('pfSelected'))}</option></select>
          <select id="pg" aria-label="${esc(t('groups'))}"></select>
          <button type="button" class="btn ghost sm" id="pall">☑ ${esc(t('addShown'))}</button><button type="button" class="btn ghost sm" id="pnone">☐ ${esc(t('clearAll'))}</button><button type="button" class="btn ghost sm" id="psave">💾 ${esc(t('saveAsGroup'))}</button></div>
        <p class="hint" id="ph" style="margin:0 0 4px"></p><div class="pick" id="pl" style="max-height:260px"></div></div>
      <label class="full">${esc(t('rqNote'))}<textarea name="note" maxlength="1000" placeholder="${esc(t('rqNoteHint'))}"></textarea></label></div><div class="err" id="re" role="alert"></div></form>`,
      onMount: d => {
        // candidates for the chosen training: those without its certificate, those whose certificate expires, …
        const bidOf = () => $('[name="bid"]', d).value, certsOf = (tid, bid) => H.certs.filter(c => c.tid === tid && (!bid || c.bid === bid));
        const stOf = x => { const cs = certsOf(x.id, bidOf()); if (!cs.length) return null; return cs.sort((a, b) => (a.expiry < b.expiry ? 1 : -1))[0]; };
        const shown = () => H.trainees.filter(x => {
          if (P.q && !norm([name(x), x.att, x.fin || ''].join(' ')).includes(norm(P.q).trim())) return false;
          const c = stOf(x);
          return !P.f || (P.f === 'noCert' ? !c || c.st === 'EXPIRED' : P.f === 'soon' ? c && (c.st === 'SOON' || c.st === 'EXPIRED') : P.f === 'valid' ? c && c.st === 'ACTIVE' : P.f === 'never' ? !x.certs : P.f === 'sel' ? ppl.has(x.id) : true);
        });
        const grpSel = () => { $('#pg', d).innerHTML = `<option value="">👥 ${esc(t('groups'))}${groups.length ? ` (${groups.length})` : ''}</option>${groups.map(g => `<option value="${esc(g.id)}">＋ ${esc(g.name)} (${g.ids.length})</option>`).join('')}${groups.length ? `<option value="-del">🗑 ${esc(t('deleteGroup'))}…</option>` : ''}`; };
        const draw = () => {
          const list = shown(), bid = bidOf();
          $('#pl', d).innerHTML = list.map(x => { const c = stOf(x);
            return `<label><input type="checkbox" data-p="${esc(x.id)}" ${ppl.has(x.id) ? 'checked' : ''}> <span>${esc(name(x))} <span class="mute xs mono">${esc(x.att)}</span>${c ? ` ${badge(c.st, (bid ? '' : esc(c.snap?.blank?.name || '') + ' · ') + t('cs_' + c.st) + ' ' + S.fmtDate(c.expiry))}` : bid ? ` <span class="mute xs">${esc(t('pfNoCertShort'))}</span>` : ''}</span></label>`; }).join('') || `<span class="mute sm">${esc(t('none'))}</span>`;
          $('#pn', d).textContent = ppl.size; $('#ph', d).textContent = t('shownOf', list.length, H.trainees.length);
        };
        $('#pq', d).oninput = e => { P.q = e.target.value; draw(); }; $('#pf', d).onchange = e => { P.f = e.target.value; draw(); }; $('[name="bid"]', d).addEventListener('change', draw);
        $('#pl', d).onchange = e => { const i = e.target.closest('[data-p]'); if (!i) return; i.checked ? ppl.add(i.dataset.p) : ppl.delete(i.dataset.p); $('#pn', d).textContent = ppl.size; };
        $('#pall', d).onclick = () => { shown().forEach(x => ppl.add(x.id)); draw(); }; $('#pnone', d).onclick = () => { ppl.clear(); draw(); };
        $('#pg', d).onchange = async e => {
          const v = e.target.value; e.target.value = '';
          if (v === '-del') { const g = await pickGroup(); if (g && await confirmDlg(t('deleteGroupConfirm', g.name), { danger: true })) { await api('/portal/company/group/delete', { kind: K, body: { id: g.id } }); groups = groups.filter(x => x.id !== g.id); grpSel(); toast(t('deleted'), 'ok'); } return; }
          const g = groups.find(x => x.id === v); if (g) { g.ids.forEach(id => ppl.add(id)); draw(); toast(t('groupAdded', g.name, g.ids.length), 'ok'); }
        };
        const pickGroup = () => new Promise(res => { const m2 = openModal({ title: t('deleteGroup'), html: `<select id="gx">${groups.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select>`, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('delete'), cls: 'bad', id: 'ok', fn: d2 => { res(groups.find(g => g.id === $('#gx', d2).value)); return true; } }] }); m2.promise.then(v => v !== 'ok' && res(null)); });
        $('#psave', d).onclick = async () => {
          if (!ppl.size) return toast(t('selectSomeone'), 'warn');
          const m2 = openModal({ title: t('saveAsGroup'), html: `<label class="req">${esc(t('groupName'))}<input id="gn" maxlength="120" list="gnl"><datalist id="gnl">${groups.map(g => `<option value="${esc(g.name)}">`).join('')}</datalist><span class="hint">${esc(t('groupSaveHint', ppl.size))}</span></label>`,
            buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d2 => { const n = $('#gn', d2).value.trim(); if (!n) return false; const same = groups.find(g => g.name === n);
              const r = await api('/portal/company/group/save', { kind: K, body: { id: same?.id, name: n, ids: [...ppl] } }); groups = [...groups.filter(g => g.id !== r.group.id), r.group].sort((a, b) => a.name.localeCompare(b.name)); grpSel(); toast(t('saved'), 'ok'); return true; } }] });
          await m2.promise;
        };
        grpSel(); draw();
      },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('sendRequest'), id: 'ok', fn: async d => {
        const f = $('#rf', d), o = Object.fromEntries(new FormData(f));
        const body = { ...o, certs: $$('[data-c]', d).filter(i => i.checked).map(i => i.dataset.c), people: [...ppl] };
        try { await api('/portal/company/request', { kind: K, body }); return true; } catch (/** @type {any} */ e) { $('#re', d).textContent = e.message === 'badInput' ? t('rqEmpty') : t('server'); return false; } } }] });
    if (await m.promise === 'ok') { toast(t('rqSent'), 'ok'); await loadReq(); view = 'requests'; draw(); }
  }

  /* one of the company's own candidates: results and the trainer's feedback per training */
  /* new candidates for this company: sent for confirmation; registered by the training centre after approval */
  const cst = x => (x.status === 'approved' ? badge('PASS', t('candApproved')) : x.status === 'returned' ? badge('FAIL', t('candReturned')) : badge('PENDING', t('candPending')));
  function candsView() {
    return `<div class="row" style="margin:6px 0 10px"><p class="mute sm" style="margin:0">${esc(t('candIntro'))}${H.company.reqOptional ? '' : ' ' + esc(t('candReqNote'))}</p><span class="grow"></span><button class="btn ghost" id="cimp">⬆ ${esc(t('importExcel'))}</button><button class="btn" id="ncand">＋ ${esc(t('newCandidate'))}</button></div>
      <div class="tw"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('fullName'))}</th><th>${esc(t('mobile'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead><tbody>${(CR || []).map(x => `<tr><td>${esc(S.fmtDateTime(x.at))}</td><td><b>${esc(S.fullAz(x.person))}</b><br><span class="mute xs mono">${esc(x.person.fin)}</span></td><td>${esc(x.person.phone || '')}</td>
        <td>${cst(x)}${x.status === 'returned' && x.review?.note ? `<div class="xs" style="margin-top:4px">${esc(x.review.note)}</div>` : ''}${x.traineeId ? `<div class="xs mono" style="margin-top:4px">${esc(x.traineeId)}</div>` : ''}</td>
        <td class="act">${x.status === 'pending' ? `<button class="btn ghost sm" data-cx="${esc(x.id)}">${esc(t('cancel'))}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="5">${empty('🧑‍🎓', t('candNone'))}</td></tr>`}</tbody></table></div>`;
  }
  function candDlg() {
    const m = openModal({ title: t('newCandidate'), wide: true, html: `<p class="hint">${esc(t('candFormHint'))}</p><form id="pf">${personForm({}, { company: false, foreign: true, finView: true, finRequired: !H.company.reqOptional, phoneRequired: !H.company.reqOptional, consent: true })}</form><div class="err" id="ce" role="alert"></div>`,
      onMount: d => bindPerson(d),
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('candSend'), id: 'ok', fn: async d => {
        const f = $('#pf', d); if (!f.reportValidity()) return false;
        const b = /** @type {any} */ (Object.fromEntries(new FormData(f))); b.foreign = !!f.foreign?.checked; b.consent = !!f.consent?.checked;
        try { await api('/portal/company/candidate', { kind: K, body: b }); await loadCands(); view = 'cands'; draw(); toast(t('candSent'), 'ok'); return true; }
        catch (/** @type {any} */ e) { $('#ce', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] });
    return m;
  }
  /* Excel batch import of candidates (same template as the training centre). FIN + phone follow the company's setting. */
  const CHEAD = () => [t('xName'), t('xSurname'), t('xFather'), t('xFin'), t('xMobile'), t('xEmail'), t('xForeign'), t('xNameEn'), t('xSurnameEn'), t('xFatherEn'), t('xConsent'), t('xNationality'), t('xCertLang')];
  async function candTemplate() {
    const rows = [CHEAD(), ['Azər', 'Qocayev', 'Məmməd oğlu', '1ABC234', '+994501234567', '', t('no'), '', '', '', t('yes'), '', ''],
      ['John', 'Smith', '', 'P-998877', '+447700900123', 'john@example.com', t('yes'), '', '', '', t('yes'), 'United Kingdom', 'EN']];
    download(await writeXlsx([{ name: 'Candidates', rows, widths: [16, 18, 18, 14, 18, 24, 12, 16, 18, 18, 12, 18, 10], textCols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, { name: 'Help', rows: [[t('xHelpTitle')], [H.company.reqOptional ? t('xHelpCoOptional') : t('xHelpCoRequired')], [t('xHelpUnique')], [t('candImportHint')]], widths: [110] }]), 'candidates-template.xlsx');
  }
  const cyes = v => /^(1|y|yes|true|x|bəli|beli|hə|he|ə)/i.test(String(v || '').trim());
  function candParse(rows) {
    const strict = !H.company.reqOptional, seen = new Set();
    return rows.slice(1).map((r, i) => ({ r, row: i + 2 })).filter(({ r }) => r.some(c => String(c).trim())).map(({ r, row }) => {
      /** @type {Record<string, any>} */
      const o = { row, name: S.cleanName(r[0]), surname: S.cleanName(r[1]), father: S.cleanName(r[2]), fin: S.normFin(r[3]), phone: S.normPhone(r[4]), email: String(r[5] || '').trim(), foreign: cyes(r[6]), nameEn: S.cleanName(r[7]), surnameEn: S.cleanName(r[8]), fatherEn: S.cleanName(r[9]), consent: cyes(r[10]), nationality: String(r[11] || '').trim(), certLang: /^en/i.test(String(r[12] || '').trim()) ? 'en' : 'both', docType: 'passport' };
      if (!o.foreign) { delete o.nationality; o.certLang = 'both'; o.docType = 'id'; }
      let err = '';
      if (!o.name || !o.surname) err = 'badName'; else if (strict && !o.fin) err = 'badId'; else if (o.fin && !S.goodFin(o.fin, o.foreign)) err = 'badId'; else if (strict && !o.phone) err = 'needPhone'; else if (o.phone && !S.goodPhone(o.phone)) err = 'badPhone'; else if (!S.goodEmail(o.email)) err = 'badEmail';
      else if (o.fin && seen.has(o.fin)) err = 'dupInFile';
      if (o.fin) seen.add(o.fin); o.status = err ? 'error' : 'new'; o.err = err; return o;
    });
  }
  function candImport() {
    let rows = [];
    const { dlg } = openModal({ title: t('importExcel'), wide: true, html: `<p class="mute">${esc(t('candImportHint'))}</p><div class="row" style="margin-bottom:12px"><button class="btn ghost" id="ctpl">⬇ ${esc(t('downloadTemplate'))}</button><input type="file" id="cxf" accept=".xlsx" style="max-width:340px"></div><div id="cprev"></div>`,
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('candSend'), id: 'go', fn: async d => {
        const todo = rows.filter(r => r.status === 'new'); if (!todo.length) return false;
        const res = []; try { for (let i = 0; i < todo.length; i += 100) res.push(...(await api('/portal/company/candidates/import', { kind: K, body: { rows: todo.slice(i, i + 100) } })).results); } catch (/** @type {any} */ e) { fail(e); return false; }
        await loadCands(); const ok = res.filter(r => r.status === 'queued');
        d._v = 'go'; d.close(); view = 'cands'; draw(); toast(t('candImported', ok.length), 'ok'); return true; } }] });
    $('#ctpl', dlg).onclick = candTemplate; const go = [...dlg.querySelectorAll('.mf button')].pop(); go.disabled = true;
    $('#cxf', dlg).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { rows = candParse(await readXlsx(await f.arrayBuffer())); } catch { $('#cprev', dlg).innerHTML = `<div class="banner bad">${esc(t('badFile'))}</div>`; return; }
      const n = rows.filter(r => r.status === 'new').length, bad = rows.filter(r => r.status === 'error').length; go.disabled = !n;
      $('#cprev', dlg).innerHTML = `<div class="row" style="margin-bottom:8px">${badge('PASS', t('xNew') + ': ' + n)} ${badge('FAIL', t('xErrors') + ': ' + bad)}</div><div class="tw" style="max-height:340px;overflow:auto"><table><thead><tr><th>#</th><th>${esc(t('fullName'))}</th><th>${esc(t('mobile'))}</th><th>${esc(t('status'))}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.row}</td><td>${esc(r.surname + ' ' + r.name)}</td><td>${esc(r.phone)}</td><td>${r.status === 'new' ? badge('PASS', t('xNew')) : badge('FAIL', t(r.err))}</td></tr>`).join('')}</tbody></table></div>`;
    };
  }

  async function personDlg(id) {
    let d; try { d = await api('/portal/company/person?id=' + encodeURIComponent(id), { kind: K }); } catch (/** @type {any} */ e) { return fail(e); }
    const res = v => (v === true ? badge('PASS', t('pass')) : v === false ? badge('FAIL', t('fail')) : '—');
    const stars = n => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));
    openModal({ title: (d.person.foreign ? d.person.en : d.person.az) + ' · ' + d.person.att, wide: true, html: d.sessions.length ? d.sessions.map(x => `<div class="card" style="box-shadow:none;margin:0 0 10px">
      <div class="row"><b>${esc(x.training)}</b><span class="grow"></span>${badge(x.outcome === 'PASS' ? 'PASS' : x.outcome === 'FAIL' || x.outcome === 'ABSENT' ? 'FAIL' : 'PENDING', t('oc_' + x.outcome))}</div>
      <div class="mute sm">${esc(S.fmtDate(x.date))}${x.endDate ? ' – ' + esc(S.fmtDate(x.endDate)) : ''} · ${esc(x.trainer)}${x.certNo ? ' · <span class="mono">' + esc(x.certNo) + '</span>' : ''}</div>
      <div class="grid g3" style="margin-top:8px"><div><span class="mute xs">${esc(t('attendance'))}</span><br>${x.attendance === 'present' ? badge('PASS', t('present')) : x.attendance === 'absent' ? badge('FAIL', t('absent')) : '—'}</div>
        <div><span class="mute xs">${esc(t('practical'))}</span><br>${x.practical ? badge(x.practical.result, t('pr_' + x.practical.result)) : '—'}</div>
        <div><span class="mute xs">${esc(t('exam'))}</span><br>${x.exam?.pending ? badge('PENDING', t('needsReview')) : x.exam ? res(x.exam.passed) + (x.exam.score != null ? ` <b>${esc(x.exam.score)}${/^\d+(\.\d+)?$/.test(String(x.exam.score)) ? '%' : ''}</b>` : '') : '—'}</div></div>
      <div style="margin-top:8px"><span class="mute xs">${esc(t('trainerFeedback'))}</span><br>${x.ev ? `${esc(t('behavior'))}: <b>${esc(t('beh_' + x.ev.behavior))}</b> · ${esc(t('punctuality'))}: <b>${esc(t('pun_' + x.ev.punctuality))}</b> · <span style="color:#b7791f">${stars(x.ev.engagement)}</span>${x.ev.comment ? `<div class="banner sm" style="margin-top:6px;white-space:pre-wrap">${esc(x.ev.comment)}</div>` : ''}` : `<span class="mute">—</span>`}</div></div>`).join('') : empty('📅', t('noSessions')),
      buttons: [{ label: t('close'), id: 'x' }] });
  }
  let PC, PP;                      // long lists: one page at a time (25 / 50 / 100)
  function draw() {
    onPage('co-certs', draw); onPage('co-people', draw);
    const list = H.certs.filter(c => c.snap && c.st !== 'RENEWED' && (tab === 'ALL' || c.st === tab) && (!q || norm([c.no, c.snap.names?.az, c.snap.names?.en, c.att].join(' ')).includes(norm(q))));
    const reqs = R?.list || [];
    app.innerHTML = `${topbar({ title: t('portalCompany'), sub: `<b>${esc(H.company.name)}</b>` })}<main style="max-width:1100px;margin:0 auto;padding:16px">
      <div class="grid g4" style="margin-bottom:16px">${tile('ALL', C.total, t('cnt_total'), '')}${tile('ACTIVE', C.ACTIVE, t('cnt_active'), 'ok')}${tile('SOON', C.SOON, t('cnt_soon'), 'warn')}${tile('EXPIRED', C.EXPIRED, t('cnt_expired'), 'bad')}</div>
      <div class="row" style="margin-bottom:10px"><button class="btn" id="nr">${icon('inbox', 16)} ${esc(t('newRequest'))}</button><button class="btn ghost" id="xl">${icon('download', 16)} ${esc(t('exportExcel'))}</button></div>
      <div class="tabs"><button class="tab ${view === 'certs' ? 'on' : ''}" data-view="certs">${esc(t('navCerts'))}<span class="n">${list.length}</span></button><button class="tab ${view === 'people' ? 'on' : ''}" data-view="people">${esc(t('navTrainees'))}<span class="n">${H.trainees.length}</span></button><button class="tab ${view === 'requests' ? 'on' : ''}" data-view="requests">${esc(t('navRequests'))}${R ? `<span class="n">${reqs.length}</span>` : ''}</button><button class="tab ${view === 'cands' ? 'on' : ''}" data-view="cands">${esc(t('candRegs'))}${CR?.some(x => x.status === 'pending') ? `<span class="n">${CR.filter(x => x.status === 'pending').length}</span>` : ''}</button><button class="tab ${view === 'analytics' ? 'on' : ''}" data-view="analytics">📊 ${esc(t('navAnalytics'))}</button></div>
      ${view !== 'requests' && view !== 'analytics' && view !== 'cands' ? `<div class="bar"><input class="sr-in" id="q" type="search" value="${esc(q)}" placeholder="${esc(t('search'))}"></div>` : ''}
      ${view === 'analytics' ? '<div id="anv"></div>' : view === 'cands' ? candsView() : view === 'certs' ? `<div class="tw"><table><thead><tr><th>${esc(t('certNo'))}</th><th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th><th>${esc(t('training'))}</th><th>${esc(t('valid'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead><tbody>
        ${(PC = paged('co-certs', list, JSON.stringify([tab, q]))).rows.map(c => `<tr><td class="mono">${esc(c.no)}</td><td><b>${esc(certName(c))}</b></td><td class="mono">${esc(c.att)}</td><td>${esc(c.snap.blank?.name || '')}</td><td class="nowrap">${esc(S.fmtDate(c.expiry))}</td><td>${badge(c.st, t('cs_' + c.st))}</td><td class="act nowrap"><button class="btn ghost sm" data-v="${esc(c.no)}" aria-label="${esc(t('view'))}">👁</button> <button class="btn ghost sm" data-pdf="${esc(c.no)}">⬇ PDF</button>${c.st === 'SOON' || c.st === 'EXPIRED' ? ` <button class="btn ghost sm" data-rn="${esc(c.no)}">${esc(t('requestRenewal'))}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7">${empty('📜', t('none'))}</td></tr>`}</tbody></table></div>${PC.html}`
      : view === 'people' ? `<div class="tw"><table><thead><tr><th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th><th>${esc(t('navCerts'))}</th><th></th></tr></thead><tbody>${(PP = paged('co-people', H.trainees.filter(x => !q || norm(name(x) + ' ' + x.att).includes(norm(q))), q)).rows.map(x => `<tr class="click" data-person="${esc(x.id)}"><td><b>${esc(name(x))}</b></td><td class="mono">${esc(x.att)}</td><td>${x.certs}</td><td class="act"><button class="btn ghost sm" data-person="${esc(x.id)}">${esc(t('results'))}</button></td></tr>`).join('') || `<tr><td colspan="3">${empty('🧑‍🎓', t('none'))}</td></tr>`}</tbody></table></div>${PP.html}`
      : `<div class="tw"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('rqKind'))}</th><th>${esc(t('training'))}</th><th>${esc(t('rqPeople'))}</th><th>${esc(t('status'))}</th><th>${esc(t('rqReply'))}</th></tr></thead><tbody>${reqs.map(x => `<tr><td>${esc(S.fmtDate(x.at))}</td><td>${esc(t('rk_' + x.kind))}</td><td>${esc(R.blanks.find(b => b.id === x.bid)?.name || '')}${x.certs?.length ? `<br><span class="mono xs">${esc(x.certs.join(', '))}</span>` : ''}</td><td>${x.people?.length || x.count || '—'}</td><td>${rqBadge(x.status)}</td><td class="sm">${esc(x.reply || '')}</td></tr>`).join('') || `<tr><td colspan="6">${empty('📨', t('rqNone'))}</td></tr>`}</tbody></table></div>`}</main>`;
    $('#q')?.addEventListener('input', e => { q = e.target.value; const p = e.target.selectionStart; draw(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); });
    $('#nr').onclick = () => requestDlg().catch(fail); $('#xl').onclick = e => busy(e.currentTarget, exportXlsx);
    $$('[data-tab]').forEach(b => (b.onclick = () => { tab = b.dataset.tab === tab ? 'ALL' : b.dataset.tab; view = 'certs'; draw(); }));
    $$('[data-view]').forEach(b => (b.onclick = async () => { view = b.dataset.view; if (view === 'requests' && !R) { try { await loadReq(); } catch (/** @type {any} */ e) { fail(e); } } draw(); }));
    $$('[data-rn]').forEach(b => (b.onclick = () => { const c = H.certs.find(x => x.no === b.dataset.rn); requestDlg({ kind: 'renewal', certs: [c.no], people: [c.tid], bid: c.bid }).catch(fail); }));
    $$('tr[data-person]').forEach(r => (r.onclick = () => personDlg(r.dataset.person)));
    $('#ncand')?.addEventListener('click', candDlg); $('#cimp')?.addEventListener('click', candImport); $$('[data-cx]').forEach(b => (b.onclick = async () => { if (!await confirmDlg(t('candCancelConfirm'))) return; try { await api('/portal/company/candidate/cancel', { kind: K, body: { id: b.dataset.cx } }); await loadCands(); draw(); } catch (/** @type {any} */ e) { fail(e); } }));
    if (view === 'analytics') analyticsView($('#anv'), { base: '/portal/company/analytics', kind: K, title: t('navAnalytics') });
    /* Settings -> certificates drawn on the server. On: this page shows the server's PDF and never receives the signature
       picture. Off (Workers Free plan): the page draws the certificate and asks for the picture with its sign-in. */
    $$('[data-v],[data-pdf]').forEach(b => (b.onclick = () => busy(b, async () => {
      const no = b.dataset.v || b.dataset.pdf, q = '?no=' + encodeURIComponent(no), name = no.replace(/[^A-Za-z0-9]+/g, '-') + '.pdf';
      try {
        if (H.certPdf) { const blob = await api('/portal/company/cert.pdf' + q, { kind: K, blob: true }); return b.dataset.pdf ? download(blob, name) : showPdf({ title: no, blob, name }); }
        const c = (await api('/portal/company/cert' + q, { kind: K })).cert;                                   // full certificate on demand
        const html = certHtml(c.sigPic ? { ...c, sigData: await dataUrl(await api('/portal/company/cert/sig' + q, { kind: K, blob: true })) } : c, H.assets, H.info);
        if (b.dataset.pdf) return download(await htmlToPdf(html), certFile(c));
        openModal({ title: c.no, wide: true, html: scaled(html, Math.min(640, innerWidth - 70)), buttons: [{ label: '🖨 ' + t('print'), cls: 'ghost', fn: async () => { await printHtml(html, c.no); return false; } }, { label: '⬇ PDF', fn: async () => { try { download(await htmlToPdf(html), certFile(c)); } catch (/** @type {any} */ e) { fail(e); } return false; } }, { label: t('close'), cls: 'ghost', id: 'x' }] });
      } catch (/** @type {any} */ e) { fail(e); }
    })));
  }
  draw();
  live({ kind: K, path: () => '/portal/company/rev', every: 20000, onChange: () => (view === 'analytics' ? null : rerender()) });
} });
