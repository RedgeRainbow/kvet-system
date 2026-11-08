import { mountPortal, topbar } from '../portal.js';
import { api, tokenOf } from '../api.js';
import * as S from '../shared.js';
import { $, $$, esc, t, toast, fail, openModal, badge, empty, opts, busy, confirmDlg, paged, onPage } from '../ui.js';
import { practicalForm } from '../practical.js';
import { personForm, bindPerson } from '../person.js';
import { openViewer } from '../viewer.js';
import { attendanceHtml, practicalHtml, printHtml, slipsHtml } from '../cert.js';
import { previewDoc, reviewTest, tbtDlg, rollCallDlg, dayStrip } from '../sessiondocs.js';
import { dohHtml } from '../forms.js';
import { live } from '../live.js';
import { analyticsView } from '../analytics.js';
import { testEditor } from '../testeditor.js';

const K = 'trainer';
const P = x => (x.foreign ? S.fullEn(x) : S.fullAz(x));
/** @type {any} */ let H = null;
/** @type {any} */ let D = null; let cur = '', tab = 'ongoing';
const stBadge = s => badge(s, t('st_' + s));
const grp = s => (s.status === 'completed' || s.status === 'cancelled' ? 'done' : s.date > H.today ? 'upcoming' : 'ongoing');

let allOld = false;   // the home lists the last 12 months; "older sessions" loads the full history
mountPortal({ kind: K, titleKey: 'portalTrainer', bodyClass: 'trainer', async boot({ app, rerender }) {
  H = await api('/portal/trainer/home' + (allOld ? '?all=1' : ''), { kind: K });
  app.innerHTML = `${topbar({ title: t('portalTrainer'), menu: true, sub: `<b>${esc(H.me[document.documentElement.lang === 'az' ? 'az' : 'en'])}</b>${H.me.specialty ? '<br>' + esc(H.me.specialty) : ''}` })}
   <div class="shell"><nav class="nav" id="nav" aria-label="${esc(t('mySessions'))}"></nav><main id="view"></main></div>`;
  $('#menuBtn').onclick = () => $('#nav').classList.toggle('open');
  let PS; const side = () => {
    onPage('tr-sessions', side);
    /** @type {Record<string, any[]>} */
    const g = { ongoing: [], upcoming: [], done: [] }; H.sessions.forEach(s => g[grp(s)].push(s));
    const tabs = [['ongoing', t('tr_ongoing')], ['upcoming', t('tr_upcoming')], ['done', t('tr_done')]];
    $('#nav').innerHTML = `<div class="tabs" style="margin-bottom:8px">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${esc(l)}<span class="n">${g[k].length}</span></button>`).join('')}</div>`
      + (H.sessions.some(x => x.todo) ? `<div class="banner warn sm" style="margin-bottom:8px">✍ ${esc(t('trainerToSign', H.sessions.reduce((n, x) => n + (x.todo || 0), 0)))}</div>` : '')
      + `<a href="#/analytics" class="${cur === 'analytics' ? 'on' : ''}" style="display:block">📊 <b>${esc(t('navAnalytics'))}</b></a>`
      + `<a href="#/bank" class="${cur === 'bank' ? 'on' : ''}" style="display:block">📝 <b>${esc(t('myBanks'))}</b></a>`
      + `<a href="#/docs" class="${cur === 'docs' ? 'on' : ''}" style="display:block;margin-bottom:8px">📁 <b>${esc(t('navDocs'))}</b></a>`
      + ((PS = paged('tr-sessions', g[tab], tab)).rows.map(s => `<a href="#/${esc(s.id)}" class="${s.id === cur ? 'on' : ''}" style="display:block"><b>${esc(s.blank?.name || '')}</b><div class="mute xs">${esc(S.fmtDate(s.date))}${s.time ? ' · ' + esc(s.time) : ''} · ${s.stats.confirmed}/${s.stats.total}${s.todo ? ` <span class="bd PENDING" title="${esc(t('toSignTitle'))}">✍ ${s.todo}</span>` : ''}</div></a>`).join('') || `<div class="mute sm" style="padding:12px">${esc(t('noSessions'))}</div>`) + PS.html
      + (tab === 'done' && H.older ? `<p class="center"><button class="btn ghost sm" id="olderS">${esc(t('olderSessions', H.older))}</button></p>` : '');
  };
  $('#nav').onclick = async e => { if (e.target.closest('#olderS')) { allOld = true; H = await api('/portal/trainer/home?all=1', { kind: K }); return side(); } const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; side(); } else if (e.target.closest('a')) $('#nav').classList.remove('open'); };
  const route = async () => {
    cur = location.hash.replace(/^#\//, '');
    if (cur === 'bank') { side(); return drawBank(); }
    if (cur === 'docs') { side(); return drawDocs(); }
    if (cur === 'analytics') { side(); $('#view').innerHTML = ''; return analyticsView($('#view'), { base: '/portal/trainer/analytics', kind: K, title: t('navAnalytics') }); }
    if (!cur) { const f = H.sessions.find(s => grp(s) === 'ongoing') || H.sessions[0]; if (f) { tab = grp(f); cur = f.id; history.replaceState(null, '', '#/' + cur); } }
    else { const f = H.sessions.find(s => s.id === cur); if (f) tab = grp(f); }
    side();
    if (!cur) return ($('#view').innerHTML = `<div class="card">${empty('📅', t('noSessions'))}</div>`);
    $('#view').innerHTML = `<div class="load"><span class="spin"></span></div>`;
    try { D = await api('/portal/trainer/session?id=' + encodeURIComponent(cur), { kind: K }); drawSession(); } catch (/** @type {any} */ e) { fail(e); $('#view').innerHTML = `<div class="card">${empty('⚠️', t('server'))}</div>`; }
  };
  /* a new attempt for one candidate (new random questions). If the trainer has already opened answers with the key in this
     session, the server asks for an explicit agreement first. */
  async function newAttempt(r) {
    if (!await confirmDlg(t('newAttemptConfirm', P(r)), { danger: true })) return;
    const go = force => api('/portal/trainer/test/reset', { kind: K, body: { sid: cur, tid: r.id, force } });
    try { await go(false); }
    catch (/** @type {any} */ x) {
      if (x.message !== 'keySeen') return fail(x);
      if (!await confirmDlg(t('keySeenWarn', x.data?.by || '', S.fmtDateTime(x.data?.at)), { danger: true, ok: t('keySeenProceed'), title: '⚠ ' + t('keySeenTitle') })) return;
      try { await go(true); } catch (/** @type {any} */ y) { return fail(y); }
    }
    toast(t('newAttemptDone', P(r)), 'ok'); await refresh();
  }
  window.onhashchange = route; await route();
  // live updates: trainees' declarations, tests and the office's changes appear without reloading the page
  live({ kind: K, path: () => '/portal/trainer/rev' + (cur ? '?sid=' + encodeURIComponent(cur) : ''), every: 8000, onChange: async () => { const y = scrollY; if (cur === 'analytics') return; if (cur === 'bank') await drawBank(); else if (cur) await refresh(); else await route(); scrollTo(0, y); } });

  /* ---- the trainer's own question banks: written here, published after the approver's decision ---- */
  /* Additional documents of the training centre (read only) */
  async function drawDocs() {
    const v = $('#view'); v.innerHTML = `<div class="skel"></div>`;
    const list = (await api('/portal/trainer/libdocs', { kind: K })).list;
    const ic = e => ({ pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗', ppt: '📙', pptx: '📙', png: '🖼', jpg: '🖼', jpeg: '🖼', zip: '🗜' }[e] || '📄');
    v.innerHTML = `<div id="tdocs"><h2 style="margin-top:0">📁 ${esc(t('navDocs'))}</h2><p class="mute sm">${esc(t('docsTrainerIntro'))}</p>
      <div class="tw"><table><tbody>${list.map(d => `<tr><td>${ic(d.ext)} <b>${esc(d.title)}</b><br><span class="mute xs">${esc(d.category ? d.category + ' · ' : '')}${esc(d.fileName)}</span></td><td class="act"><button class="btn sm" data-dl="${esc(d.id)}">⬇ ${esc(t('download'))}</button></td></tr>`).join('') || `<tr><td>${empty('📁', t('none'))}</td></tr>`}</tbody></table></div></div>`;
    $('#tdocs').onclick = async e => { const b = e.target.closest('[data-dl]'); if (!b) return; const d = list.find(x => x.id === b.dataset.dl);
      try { const r = await fetch('/api/portal/trainer/libdoc?id=' + encodeURIComponent(d.id), { headers: { authorization: 'Bearer ' + tokenOf(K) } }); if (!r.ok) throw new Error('server');
        const a = document.createElement('a'), u = URL.createObjectURL(await r.blob()); a.href = u; a.download = d.fileName; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (/** @type {any} */ er) { fail(er); } };
  }
  async function drawBank() {
    let B; try { B = await api('/portal/trainer/tests', { kind: K }); } catch (/** @type {any} */ e) { return fail(e); }
    const st = x => x.proposal ? (x.proposal.returned ? badge('FAIL', '↩ ' + t('changeReturned')) : badge('info', t('changeAwaiting'))) : { draft: badge('', t('draft')), pending: badge('PENDING', t('awaitingApproval')), returned: badge('FAIL', '↩ ' + t('apReturnedShort')), active: badge('PASS', t('approved')) }[x.status || 'active'];
    $('#view').innerHTML = `<div class="page-h"><h1 style="margin:0">📝 ${esc(t('myBanks'))}</h1><span class="grow"></span><button class="btn" id="nb">＋ ${esc(t('newTest'))}</button></div><p class="mute">${esc(t('myBanksHint'))}</p>
      ${B.list.length ? `<div class="grid g2">${B.list.map(x => { const note = x.proposal?.returned?.note || (x.status === 'returned' ? x.review?.note : ''); return `<div class="card"><div class="row"><b>${esc(x.title)}</b><span class="grow"></span>${st(x)}</div>
        <div class="mute sm">${esc(t('nQuestions', (x.proposal || x).questions.length))}${x.review ? ' · ' + esc(S.fmtDateTime(x.review.at)) : ''}</div>${note ? `<div class="banner bad sm" style="margin-top:8px;white-space:pre-wrap"><b>${esc(t('approverNote'))}:</b> ${esc(note)}</div>` : ''}
        <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-eb="${esc(x.id)}">✎ ${esc(t('edit'))}</button>${(x.status || 'active') !== 'active' ? `<button class="btn bad ghost sm" data-db="${esc(x.id)}" aria-label="${esc(t('delete'))}">🗑</button>` : ''}</div></div>`; }).join('')}</div>` : `<div class="card">${empty('📝', t('noTests'))}</div>`}`;
    const open = x => testEditor({ src: x ? { ...x, ...(x.proposal || {}), id: x.id } : null, blanks: B.blanks, mode: 'trainer', save: body => api('/portal/trainer/test/save', { kind: K, body }), onSaved: drawBank });
    $('#nb').onclick = () => open(null);
    $('#view').querySelectorAll('[data-eb]').forEach(b => (b.onclick = () => open(B.list.find(x => x.id === b.dataset.eb))));
    $('#view').querySelectorAll('[data-db]').forEach(b => (b.onclick = async () => { if (!await confirmDlg(t('deleteTestConfirm', B.list.find(x => x.id === b.dataset.db).title), { danger: true })) return; try { await api('/portal/trainer/test/delete', { kind: K, body: { id: b.dataset.db } }); drawBank(); } catch (/** @type {any} */ e) { fail(e); } }));
  }
  async function refresh() { [D, H] = await Promise.all([api('/portal/trainer/session?id=' + encodeURIComponent(cur), { kind: K }), api('/portal/trainer/home' + (allOld ? '?all=1' : ''), { kind: K })]); side(); drawSession(); }   // both at once

  /* multi-day trainings: the final-day documents open when the trainer opens them on the final day */
  const dayIdx = d => S.sessionDays(D.session).indexOf(d) + 1;
  function finalDayCard() {
    if (!D.multi || D.session.cancelled) return '';
    if (D.docsReady) return `<div class="banner sm" style="margin-bottom:12px;border-color:var(--ok)">✔ ${esc(t('docsOpenNow'))}</div>`;
    const canOpen = D.today >= D.finalDay && !D.session.closed;
    return `<div class="banner warn" style="margin-bottom:12px"><b>📅 ${esc(t('finalDayDocs'))}</b><div class="sm">${esc(t('finalDayDocsHint', S.fmtDate(D.finalDay)))}</div>${canOpen ? `<div style="margin-top:8px"><button class="btn" id="docsOpen">▶ ${esc(t('openFinalDocs'))}</button></div>` : ''}</div>`;
  }
  /* what is still to be signed in this session (the server lists it) */
  function todoCard() {
    const items = (D.todo || []).filter(x => x.doc !== 'docsOpen'); if (!items.length) return '';
    const nm = tid => { const r = D.trainees.find(k => k.id === tid); return r ? P(r) : ''; };
    const label = x => (x.doc === 'att' ? (x.day ? t('signAttDay', dayIdx(x.day), S.fmtDate(x.day)) : t('signAttSheet')) : x.doc === 'ev' ? t('signEvalSheet') : x.doc === 'tbt' ? t('signTbt', x.acks, x.of) : x.doc === 'prac' ? t('signPrac', nm(x.tid)) : t('signExamResults'));
    return `<div class="card" style="border-left:4px solid var(--warn)"><h2>✍ ${esc(t('toSignTitle'))} <span class="bd PENDING">${items.length}</span></h2><div class="row" style="flex-wrap:wrap;gap:8px">${items.map(x => `<button class="btn ghost sm" data-todo="${esc(x.doc)}" data-day="${esc(x.day || '')}" data-tid="${esc(x.tid || '')}">✍ ${esc(label(x))}</button>`).join('')}</div></div>`;
  }
  function drawSession() {
    const s = D.session, started = D.today >= s.date && !s.cancelled, rows = D.trainees, sh = D.sheet, open = !s.closed && !s.cancelled;
    const pill = r => (r.absent ? badge('FAIL', t('absent')) : !r.attAt ? badge('PENDING', t('notConfirmed')) : badge('PASS', t('present'))) + dayStrip(D.session, r.days);
    $('#view').innerHTML = `<div class="page-h"><div><h1 style="margin:0">${esc(D.blank?.name || '')}</h1><div class="mute">${esc(S.fmtDate(s.date))}${s.endDate ? ' – ' + esc(S.fmtDate(s.endDate)) : ''}${s.time ? ' · ' + esc(s.time) : ''}${s.location ? ' · ' + esc(s.location) : ''} ${stBadge(s.status)}</div></div>
      <span class="grow"></span>${!s.closed && !s.cancelled ? `<button class="btn" id="addc">＋ ${esc(t('addCandidates'))}</button>` : ''}${started && open ? `<button class="btn ok" id="confall">✔ ${esc(t('rollCall'))}</button>` : ''}${D.test && !s.cancelled ? (s.exam?.open ? `<button class="btn bad" id="exOff">■ ${esc(t('endExam'))}</button>` : `<button class="btn ok" id="exOn">▶ ${esc(s.exam?.closedAt ? t('reopenExam') : t('startExam2'))}</button>`) : ''}<button class="btn ghost" id="att">🧾 ${esc(t('attSheet'))}</button>${sh ? `<button class="btn ghost" id="tbt">🦺 ${esc(t('toolboxTalk'))}${s.tbt ? (D.signs?.tbt ? ' ✔' : ' •') : ''}</button>` : ''}</div>
      <div class="grid g4" style="margin-bottom:14px"><div class="stat"><b>${s.stats.total}</b><span>${esc(t('trainees'))}</span></div><div class="stat"><b>${s.stats.confirmed}</b><span>${esc(t('confirmed'))}</span></div><div class="stat"><b>${s.stats.evaluated}</b><span>${esc(t('evaluated'))}</span></div>${sh ? `<div class="stat"><b>${s.stats.practical}</b><span>${esc(t('practicalDone'))}</span></div>` : ''}</div>
      ${finalDayCard()}${todoCard()}
      ${D.materials.length ? `<div class="card"><h2>🖥 ${esc(t('materials'))}</h2>${started ? '' : `<p class="hint">${esc(t('matLocked'))}</p>`}<div class="row">${D.materials.map(m => `<button class="btn" data-mat="${esc(m.id)}" data-title="${esc(m.title)}" ${started ? '' : 'disabled'}>▶ ${esc(m.title)}${m.slides ? ` <span class="mute xs">(${m.slides})</span>` : ''}</button>`).join('')}</div></div>` : ''}
      <div class="tw"><table><thead><tr><th>#</th><th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th><th>${esc(t('company'))}</th><th>${esc(t('attendance'))}</th><th>${esc(t('evaluation'))}</th>${sh ? `<th title="${esc(t('dohTitle'))}">${esc(t('dohShort'))}</th><th>${esc(t('practical'))}</th>` : ''}${D.test ? `<th>${esc(t('test'))}</th>` : ''}<th class="hide-m"></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(P(r))}</b><div class="only-m row" style="margin-top:6px">${!r.attAt && started && !s.closed ? `<button class="btn ghost sm" data-c="${esc(r.id)}">✔ ${esc(t('markPresent'))}</button> ` : ''}${r.attAt && !r.final && open ? `<button class="btn ghost sm" data-e="${esc(r.id)}">★ ${esc(r.ev ? t('editEval') : t('giveEval'))}</button> ` : ''}${sh && r.attAt && !r.final && open ? (r.doh ? `<button class="btn sm" data-p="${esc(r.id)}">📋 ${esc(t('practicalSheet'))}</button>` : `<button class="btn ghost sm" data-dp="${esc(r.id)}" title="${esc(t('dohMarkPaperHint'))}">📄 ${esc(t('dohMarkPaper'))}</button>`) : ''}${D.test && r.test?.status === 'review' ? ` <button class="btn sm" data-tr="${esc(r.id)}">✎ ${esc(t('reviewTest'))}</button>` : ''}${sh && r.prac && r.prac.result !== 'INCOMPLETE' && open ? (D.signs?.prac?.[r.id]?.examiner ? ` <span class="xs" style="color:var(--ok)" title="${esc(t('signedBy'))} ${esc(D.signs.prac[r.id].examiner.name)}">✔ ${esc(t('signed'))}</span>` : ` <button class="btn ghost sm" data-ps="${esc(r.id)}">✍ ${esc(t('signPracticalT'))}</button>`) : ''}</div></td><td class="mono">${esc(r.att)}</td><td>${r.company ? esc(r.company) : `<span class="mute">${esc(t('private'))}</span>`}</td>
        <td>${pill(r)}${r.attAt ? `<div class="mute xs">${esc(S.fmtDateTime(r.attAt))}</div>` : ''}</td>
        <td>${r.ev ? badge('PASS', '★ ' + r.ev.engagement + '/5') : badge('', '—')}</td>
        ${sh ? `<td>${!r.doh ? badge('', '—') : r.doh.paper ? badge('', '📄 ' + t('dohPaper')) : `<button class="btn ghost sm" data-dv="${esc(r.id)}">${S.dohYes(r.doh) ? '⚠ ' + esc(t('dohYes')) : '✓'} 👁</button>`}</td><td>${r.prac ? badge(r.prac.result === 'PASS' ? 'PASS' : r.prac.result === 'FAIL' ? 'FAIL' : 'PENDING', t('pr_' + r.prac.result)) : badge('', '—')}</td>` : ''}
        ${D.test ? `<td class="nowrap">${!r.test ? badge('', '—') : `<button class="btn ghost sm" data-tr="${esc(r.id)}">${r.test.status === 'graded' ? badge(r.test.passed ? 'PASS' : 'FAIL', r.test.pct + '%') : badge('PENDING', '✎ ' + t('needsReview'))}</button>`}${r.test?.warns ? ` <span class="bd ${r.test.closedBy === 'warnings' ? 'FAIL' : 'PENDING'}" title="${esc(t('examWarnsTitle'))}">⚠ ${r.test.warns}</span>` : ''}${(r.test || r.testStarted) && !r.final && open ? ` <button class="btn ghost sm" data-trs="${esc(r.id)}" title="${esc(t('newAttemptHint'))}">↻ ${esc(t('newAttempt'))}</button>` : ''}</td>` : ''}
        <td class="act nowrap hide-m">${open && !r.hasData && !r.final ? `<button class="btn ghost sm" data-rm="${esc(r.id)}" title="${esc(t('removeFromSession'))}" aria-label="${esc(t('removeFromSession'))}">✕</button> ` : ''}${!r.attAt && started && !s.closed ? `<button class="btn ghost sm" data-c="${esc(r.id)}">✔ ${esc(t('markPresent'))}</button> ` : ''}${r.attAt && !r.final && open ? `<button class="btn ghost sm" data-e="${esc(r.id)}">★ ${esc(r.ev ? t('editEval') : t('giveEval'))}</button> ` : ''}${sh && r.attAt && !r.final && open ? (r.doh ? `<button class="btn sm" data-p="${esc(r.id)}">📋 ${esc(t('practicalSheet'))}</button>` : `<button class="btn ghost sm" data-dp="${esc(r.id)}" title="${esc(t('dohMarkPaperHint'))}">📄 ${esc(t('dohMarkPaper'))}</button>`) : ''}${D.test && r.test?.status === 'review' ? ` <button class="btn sm" data-tr="${esc(r.id)}">✎ ${esc(t('reviewTest'))}</button>` : ''}${sh && r.prac && r.prac.result !== 'INCOMPLETE' && open ? (D.signs?.prac?.[r.id]?.examiner ? ` <span class="xs" style="color:var(--ok)" title="${esc(t('signedBy'))} ${esc(D.signs.prac[r.id].examiner.name)}">✔ ${esc(t('signed'))}</span>` : ` <button class="btn ghost sm" data-ps="${esc(r.id)}">✍ ${esc(t('signPracticalT'))}</button>`) : ''}</td></tr>`).join('') || `<tr><td colspan="8">${empty('🧑‍🎓', t('none'))}</td></tr>`}</tbody></table></div>`;
  }
  $('#view').onclick = async e => {
    const mat = e.target.closest('[data-mat]'), c = e.target.closest('[data-c]'), ev = e.target.closest('[data-e]'), p = e.target.closest('[data-p]');
    // final-day documents of a multi-day training wait until the trainer opens them on the final day
    if (D.multi && !D.docsReady && (ev || p || e.target.closest('[data-dp],#exOn') || (e.target.closest('#tbt') && !D.session.tbt))) return toast(t('docsNotOpenHint', S.fmtDate(D.finalDay)), 'bad');
    if (e.target.closest('#docsOpen')) { if (!await confirmDlg(t('openFinalDocsConfirm'))) return; try { await api('/portal/trainer/docs', { kind: K, body: { sid: cur, open: true } }); toast(t('docsOpenNow'), 'ok'); await refresh(); } catch (/** @type {any} */ x) { fail(x); } return; }
    const td = e.target.closest('[data-todo]');
    if (td) return busy(td, async () => { const k = td.dataset.todo; try {
      if (k === 'att') await api('/portal/trainer/sign/att', { kind: K, body: { sid: cur, day: td.dataset.day } });
      else if (k === 'tbt') await api('/portal/trainer/sign/tbt', { kind: K, body: { sid: cur } });
      else if (k === 'prac') await api('/portal/trainer/sign/prac', { kind: K, body: { sid: cur, tid: td.dataset.tid } });
      else await api('/portal/trainer/sign/doc', { kind: K, body: { sid: cur, doc: k } });
      toast(t('signed'), 'ok'); await refresh(); } catch (/** @type {any} */ x) { fail(x); } });
    if (e.target.closest('#addc')) return candidatesDlg();
    const ex = e.target.closest('#exOn,#exOff');
    if (ex) { const open = ex.id === 'exOn'; if (!open && !await confirmDlg(t('endExamConfirm'), { danger: true })) return; return busy(ex, async () => { try { await api('/portal/trainer/exam', { kind: K, body: { sid: cur, open } }); toast(open ? t('examStartedToast') : t('examEndedToast'), 'ok'); await refresh(); } catch (/** @type {any} */ x) { fail(x); } }); }
    if (e.target.closest('#confall')) return rollCallDlg({ days: S.sessionDays(D.session), today: H.today, rows: D.trainees.map(r => ({ id: r.id, name: P(r), att: r.att, absent: !!r.absent, days: r.days || {}, locked: r.hasData })), save: async (absent, day) => { const res = await api('/portal/trainer/attendance', { kind: K, body: { sid: cur, absent, day } }); await refresh(); return res; } });
    const rm = e.target.closest('[data-rm]');
    if (rm) { const r = D.trainees.find(k => k.id === rm.dataset.rm); if (!await confirmDlg(t('removeFromSessionConfirm', P(r)))) return; try { await api('/portal/trainer/session/trainees', { kind: K, body: { sid: cur, remove: [r.id] } }); toast(t('removedFromSession'), 'ok'); await refresh(); } catch (/** @type {any} */ x) { toast(x.message === 'hasData' ? t('hasDataTrainee') : t('server'), 'bad'); } return; }
    const ps = e.target.closest('[data-ps]'); if (ps) return busy(ps, async () => { try { await api('/portal/trainer/sign/prac', { kind: K, body: { sid: cur, tid: ps.dataset.ps } }); toast(t('signed'), 'ok'); await refresh(); } catch (/** @type {any} */ x) { fail(x); } });
    if (e.target.closest('#att')) {
      const doc = () => attendanceHtml({ esign: D.signs?.att, esignDays: D.signs?.attDays || {}, session: D.session, blank: D.blank, trainer: D.trainer.en, rows: D.trainees.map(r => ({ az: r.foreign ? '' : S.fullAz(r), en: S.fullEn(r), att: r.att, company: r.company, attAt: r.attAt, by: r.attBy, days: r.days })), info: D.info, assets: D.assets });
      const line = sg => (sg ? `✔ ${esc(t('signedBy'))} <b>${esc(sg.name)}</b> · ${esc(S.fmtDateTime(sg.at))} · <span class="mono">${esc(sg.code)}</span>` : `<span class="mute">${esc(t('attNotSigned'))}</span>`);
      // multi-day: the attendance of every day is signed separately (only days that have come and were marked)
      const days = D.multi ? S.sessionDays(D.session) : [];
      const body = D.multi ? `<div class="tw"><table><tbody>${days.map((d, i) => { const sg = D.signs?.attDays?.[d], marked = D.trainees.some(r => r.days?.[d]);
          return `<tr><td><b>${esc(t('dayN', i + 1))}</b> · ${esc(S.fmtDate(d))}</td><td class="sm">${line(sg)}</td><td class="act">${!D.session.cancelled && d <= D.today && marked ? `<button class="btn ghost sm" data-sd="${esc(d)}">✍ ${esc(sg ? t('signAgain') : t('signElectronically'))}</button>` : d > D.today ? `<span class="mute xs">${esc(t('dayNotYetShort'))}</span>` : !marked ? `<span class="mute xs">${esc(t('dayNotMarked'))}</span>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<p>${line(D.signs?.att)}</p>`;
      openModal({ title: t('attSheet'), wide: D.multi, html: `${body}<p class="hint">${esc(t(D.multi ? 'attSignDayHint' : 'attSignHint'))}</p>`,
        onMount: d => d.addEventListener('click', ev2 => { const b = ev2.target.closest('[data-sd]'); if (b) busy(b, async () => { try { await api('/portal/trainer/sign/att', { kind: K, body: { sid: cur, day: b.dataset.sd } }); toast(t('signed'), 'ok'); d.close(); await refresh(); } catch (/** @type {any} */ x) { fail(x); } }); }),
        buttons: [...(!D.multi && !D.session.cancelled ? [{ label: '✍ ' + (D.signs?.att ? t('signAgain') : t('signElectronically')), id: 'sign' }] : []), { label: '🖨 ' + t('print'), cls: 'ghost', fn: async () => { await printHtml(doc(), t('attSheet')); return false; } }, { label: t('close'), cls: 'ghost', id: 'x' }] }).promise.then(async v => {
          if (v !== 'sign') return; try { await api('/portal/trainer/sign/att', { kind: K, body: { sid: cur } }); toast(t('signed'), 'ok'); await refresh(); } catch (/** @type {any} */ x) { fail(x); } });
      return;
    }
    if (e.target.closest('#tbt')) return tbtDlg({ session: D.session, blank: D.blank, tbt: D.session.tbt || {}, rows: D.trainees.map(r => ({ id: r.id, name: P(r), company: r.company, attAt: r.attAt, ack: r.tbtAck })), trainer: D.trainer.az, info: D.info, assets: D.assets, sign: D.signs?.tbt,
      canEdit: !D.session.cancelled && !D.session.closed, save: async b => { await api('/portal/trainer/tbt', { kind: K, body: { sid: cur, ...b } }); toast(t('tbtOpened'), 'ok'); await refresh(); },
      onSign: async () => { await api('/portal/trainer/sign/tbt', { kind: K, body: { sid: cur } }); toast(t('signed'), 'ok'); await refresh(); } });
    const dp = e.target.closest('[data-dp]'); if (dp) { if (!await confirmDlg(t('dohPaperConfirm'))) return; return busy(dp, async () => { try { await api('/portal/trainer/doh/paper', { kind: K, body: { sid: cur, tid: dp.dataset.dp } }); await refresh(); } catch (/** @type {any} */ x) { fail(x); } }); }
    const dv = e.target.closest('[data-dv]'); if (dv) { const r = D.trainees.find(k => k.id === dv.dataset.dv); return previewDoc({ title: t('dohTitle') + ' · ' + P(r), file: 'health-' + r.att, html: dohHtml({ session: D.session, blank: D.blank, person: { az: P(r), en: S.fullEn(r), att: r.att }, company: r.company, doh: r.doh, info: D.info, assets: D.assets, sign: D.signs?.doh?.[r.id] }) }); }
    const trs = e.target.closest('[data-trs]'); if (trs) return newAttempt(D.trainees.find(k => k.id === trs.dataset.trs));
    const trv = e.target.closest('[data-tr]'); if (trv) { const r = D.trainees.find(k => k.id === trv.dataset.tr); let full; try { full = (await api(`/portal/trainer/test?sid=${encodeURIComponent(cur)}&tid=${encodeURIComponent(r.id)}`, { kind: K })).test; } catch (/** @type {any} */ x) { return fail(x); } return reviewTest({ test: full, name: `${P(r)} · ${r.att}`, canGrade: !r.final && !D.session.cancelled, save: async b => { await api('/portal/trainer/test/grade', { kind: K, body: { sid: cur, tid: r.id, ...b } }); toast(t('saved'), 'ok'); await refresh(); } }); }
    if (mat) return openViewer({ title: mat.dataset.title, watermark: `${D.trainer.en} · ${D.session.id.slice(-4)}`, load: async () => { const r = await fetch(`/api/portal/trainer/material?sid=${encodeURIComponent(cur)}&id=${encodeURIComponent(mat.dataset.mat)}`, { headers: { authorization: 'Bearer ' + tokenOf(K) } }); if (!r.ok) throw new Error('server'); return r.arrayBuffer(); } }).catch(fail);
    if (c) { await busy(c, async () => { try { await api('/portal/trainer/confirm', { kind: K, body: { sid: cur, tid: c.dataset.c } }); await refresh(); } catch (/** @type {any} */ x) { fail(x); } }); return; }
    if (ev) return evalDlg(D.trainees.find(r => r.id === ev.dataset.e));
    if (p) return pracDlg(D.trainees.find(r => r.id === p.dataset.p));
  };

  function evalDlg(r) {
    const ev = r.ev || {}; let eng = ev.engagement || 0;
    const m = openModal({ title: P(r), html: `<div class="fg"><label class="req">${esc(t('behavior'))}<select id="eb">${opts(S.BEHAVIOR.map(k => [k, t('beh_' + k)]), ev.behavior || '', '—')}</select></label>
      <label class="req">${esc(t('punctuality'))}<select id="ep">${opts(S.PUNCTUALITY.map(k => [k, t('pun_' + k)]), ev.punctuality || '', '—')}</select></label>
      <div class="full"><div class="b sm" style="margin-bottom:6px">${esc(t('engagement'))} *</div><div class="stars" id="es">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" class="${n <= eng ? 'on' : ''}" aria-label="${n}">★ ${n}</button>`).join('')}</div></div>
      <label class="full">${esc(t('comment'))}<textarea id="ec" rows="3" maxlength="2000">${esc(ev.comment || '')}</textarea></label></div><div class="err" id="ee" role="alert"></div>`,
      onMount: d => { $('#es', d).onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; eng = +b.dataset.n; $$('#es button', d).forEach(x => x.classList.toggle('on', +x.dataset.n <= eng)); }; },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
        const body = { sid: cur, tid: r.id, behavior: $('#eb', d).value, punctuality: $('#ep', d).value, engagement: eng, comment: $('#ec', d).value };
        if (!body.behavior || !body.punctuality || !eng) { $('#ee', d).textContent = t('fillAll'); return false; }
        try { await api('/portal/trainer/evaluate', { kind: K, body }); return true; } catch (/** @type {any} */ x) { $('#ee', d).textContent = t('server'); return false; } } }] });
    m.promise.then(v => v === 'ok' && refresh());
  }
  /* ---- add candidates to this session: pick existing ones or register a new one (ID/FIN is write-only) ---- */
  async function candidatesDlg() {
    let C; try { C = await api('/portal/trainer/candidates', { kind: K }); } catch (/** @type {any} */ e) { return fail(e); }
    const have = new Set(D.trainees.map(x => x.id)), sel = new Set(); const nm = x => (x.foreign ? S.fullEn(x) : S.fullAz(x));
    const m = openModal({ title: t('addCandidates'), wide: true, html: `<div class="bar" style="margin-bottom:6px"><input class="sr-in" id="cq" type="search" placeholder="${esc(t('search'))}"><select id="cc"><option value="">${esc(t('allCompanies'))}</option><option value="-">${esc(t('private'))}</option>${C.companies.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button type="button" class="btn ghost sm" id="cn">＋ ${esc(t('newCandidate'))}</button></div>
      <div class="bar" style="margin-bottom:6px"><input id="la" placeholder="E-2026xxxxx" maxlength="11" style="max-width:180px;text-transform:uppercase" aria-label="${esc(t('learnerNo'))}"><button type="button" class="btn ghost sm" id="lb">${esc(t('findByNo'))}</button><span class="hint">${esc(t('findByNoHint'))}</span></div><div class="b sm mute" style="margin-bottom:4px">${esc(t('selected'))}: <span id="cs">0</span></div><div class="pick" id="cl"></div>`,
      onMount: d => {
        const paint = () => { const q = S.slug($('#cq', d).value), co = $('#cc', d).value; const list = C.list.filter(x => !have.has(x.id) && (!co || (co === '-' ? !x.co : x.co === co)) && (!q || S.slug(nm(x) + x.att).includes(q))).slice(0, 150);
          $('#cl', d).innerHTML = list.map(x => `<label><input type="checkbox" data-id="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}> <span><b>${esc(nm(x))}</b> <span class="mute xs">${esc(x.att)} · ${esc(x.company || t('private'))}</span></span></label>`).join('') || `<p class="mute center">${esc(t('noTrainees'))}</p>`; $('#cs', d).textContent = sel.size; };
        paint(); $('#cq', d).oninput = paint; $('#cc', d).onchange = paint; $('#cl', d).onchange = e => { const id = e.target.dataset.id; if (id) { e.target.checked ? sel.add(id) : sel.delete(id); $('#cs', d).textContent = sel.size; } };
        $('#cn', d).onclick = () => { d._v = 'new'; d.close(); };
        $('#lb', d).onclick = async () => {
          const v = $('#la', d).value.trim().toUpperCase(); if (!v) return;
          try { const p = (await api('/portal/trainer/lookup?att=' + encodeURIComponent(v), { kind: K })).person; if (!C.list.some(x => x.id === p.id)) C.list.unshift(p); if (!have.has(p.id)) sel.add(p.id); $('#la', d).value = ''; paint(); }
          catch (/** @type {any} */ x) { toast(x.message === 'noRec' ? t('noRec') : t('badLearnerNo'), 'bad'); }
        };
      },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('addSelected'), id: 'ok', fn: async () => { if (!sel.size) return false; try { await api('/portal/trainer/session/trainees', { kind: K, body: { sid: cur, add: [...sel] } }); return true; } catch (/** @type {any} */ x) { fail(x); return false; } } }] });
    const v = await m.promise; if (v === 'ok') { toast(t('saved'), 'ok'); await refresh(); } else if (v === 'new') newCandidate(C.companies);
  }
  function newCandidate(companies) {
    /** @type {any} */ let res = null;
    const m = openModal({ title: t('newCandidate'), wide: true, html: `<form id="pf">${personForm({}, { companies, company: true, specialty: false, foreign: true, phoneRequired: true, finView: true, consent: true })}</form><p class="hint">${esc(t('newCandHint'))}</p><div class="err" id="pe" role="alert"></div>`, onMount: d => { bindPerson($('#pf', d)); $('#pf', d).on.closest('label').remove(); },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
        const f = $('#pf', d); if (!f.reportValidity()) return false; const o = Object.fromEntries(new FormData(f));
        try { res = await api('/portal/trainer/trainee/save', { kind: K, body: { ...o, foreign: f.foreign.checked, consent: !!f.consent?.checked, sid: cur } }); return true; }
        catch (/** @type {any} */ e) { $('#pe', d).innerHTML = e.message === 'dupFin' ? esc(t('dupFinTrainer')) : esc(t(e.message) === e.message ? t('server') : t(e.message)); return false; } } }] });
    m.promise.then(async v => {
      if (v !== 'ok' || !res) return; await refresh();
      const row = { name: P(res.trainee), login: res.creds.login, password: res.creds.password };
      openModal({ title: t('credsTitle'), html: `<div class="banner warn">${esc(t('credsOnce'))}</div><p><b>${esc(row.name)}</b><br>${esc(t('login'))}: <span class="mono b">${esc(row.login)}</span><br>${esc(t('password'))}: <span class="mono b">${esc(row.password)}</span></p>`,
        buttons: [{ label: t('printSlips'), cls: 'ghost', fn: async () => { await printHtml(slipsHtml([row], { info: D.info, assets: D.assets, portal: 'trainee' }), 'slip'); return false; } }, { label: t('close'), id: 'ok' }] });
    });
  }
  function pracDlg(r) {
    const sh = D.sheet, pf = practicalForm(sh, r.prac, { candidate: P(r), att: r.att, examiner: r.prac?.examiner || D.trainer.az, auto: { candidate: P(r), company: r.company || '', date: S.fmtDate(D.session.date), learnerNo: r.att, training: D.blank?.name || '', location: D.session.location || '' } }); let ctl;
    const m = openModal({ title: sh.name, wide: true, html: pf.html, onMount: d => (ctl = pf.bind(d)), buttons: [{ label: '🖨', cls: 'ghost', id: 'pr', fn: async () => { const data = ctl.collect(), res = ctl.result(); printHtml(practicalHtml({ signs: D.signs?.prac?.[r.id] || {}, sheet: sh, prac: { ...data, ...res }, candidate: { az: S.fullAz(r), en: S.fullEn(r), att: r.att }, session: D.session, blank: D.blank, info: D.info, assets: D.assets, company: r.company || '' }), sh.name); return false; } },
      { label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('saveSheet'), id: 'ok', fn: async () => { try { await api('/portal/trainer/practical', { kind: K, body: { sid: cur, tid: r.id, data: ctl.collect() } }); return true; } catch (/** @type {any} */ x) { fail(x); return false; } } }] });
    m.promise.then(v => v === 'ok' && refresh());
  }
} });
