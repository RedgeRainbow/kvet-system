import { ensureSessionsFrom, moreSessions, ensurePeople, rememberPeople, findTrainees, deleteRecord, outcomeOf, A, can, view, api, S, $, $$, esc, t, lang, toast, fail, busy, openModal, confirmDlg, empty, badge, opts, matches, pageHead, bar, searchBox, load, savedToast, tabs, blank, sheet, trainee, trainer, coName, personName, trainerName, statusBadge, outcomeBadge, pracBadge, showCreds, printHtml, htmlToPdf, download, info, paged, onPage } from './lib.js';
import { attendanceHtml, practicalHtml, slipsHtml, certsHtml, certsZip } from '../cert.js';
import { icon } from '../icons.js';
import { practicalForm } from '../practical.js';
import { previewCert, signButtons } from './certview.js';
import { coFields, bindCo } from './certedit.js';
import { releaseFlow, showReleased } from './release.js';
import { previewDoc, reviewTest, tbtDlg, sessionZip, zipName, rollCallDlg, sessionDocList, withAppr, dayStrip } from '../sessiondocs.js';
import { dohHtml, testSheetHtml } from '../forms.js';

export default async function ({ args, rerender, go }) {
  if (args[0] && !args[0].includes('=')) return detail(args[0], rerender, go);
  return list(rerender, go, S.parseFilter(args[0]));
}

/* ================================================================= list */
function list(rerender, go, F = {}) {
  const el = view(), st = { tab: F.st || 'all', q: '' };
  const rows = () => A.sessions.filter(s => (st.tab === 'all' || s.status === st.tab) && (!F.bid || s.bid === F.bid) && (!F.from || (s.date >= F.from && s.date <= F.to)) && matches(st.q, blank(s.bid)?.name, trainerName(s.tid), s.date, s.location));
  /** @type {any} */ let clashes = null;
  async function drawCal() {
    CALV.ym ||= A.today.slice(0, 7);
    if (!clashes) try { clashes = (await api('/session/clashes', { kind: 'staff' })).clashes; } catch { clashes = {}; }
    const [y, m] = CALV.ym.split('-').map(Number), L = MN[lang] ? lang : 'az';
    el.innerHTML = pageHead(t('navSessions'), `${viewSeg()}${can('session.save') ? `<button class="btn" id="add">＋ ${esc(t('newSession'))}</button>` : ''}`)
      + `<div class="bar"><button class="btn ghost sm" id="pm" aria-label="${esc(t('prevMonth'))}">‹</button><b style="min-width:150px;text-align:center">${esc(MN[L][m - 1])} ${y}</b><button class="btn ghost sm" id="nm" aria-label="${esc(t('nextMonth'))}">›</button><button class="btn ghost sm" id="tm">${esc(t('today'))}</button><span class="grow"></span>${Object.keys(clashes).length ? `<span class="bd FAIL">⚠ ${esc(t('clashesN', Object.keys(clashes).length))}</span>` : ''}</div>`
      + calendarHtml(CALV.ym, A.sessions.filter(s => !F.bid || s.bid === F.bid), clashes, lang);
    const shift = k => { let yy = y, mm = m + k; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } CALV.ym = `${yy}-${String(mm).padStart(2, '0')}`; drawCal(); };
    if (moreSessions() && `${CALV.ym}-01` < A.sessionsSince) { await ensureSessionsFrom(`${CALV.ym}-01`); return drawCal(); }   // an older month: fetch it
    $('#pm').onclick = () => shift(-1); $('#nm').onclick = () => shift(1); $('#tm').onclick = () => { CALV.ym = A.today.slice(0, 7); drawCal(); };
    $('#add')?.addEventListener('click', () => sessionForm(null, rerender));
  }
  const viewSeg = () => `<div class="seg" role="group" aria-label="${esc(t('view'))}"><button data-vm="list" class="${CALV.mode === 'list' ? 'on' : ''}">${esc(t('listView'))}</button><button data-vm="cal" class="${CALV.mode === 'cal' ? 'on' : ''}">${icon('calendar', 15)} ${esc(t('calendarView'))}</button></div>`;
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    if (CALV.mode === 'cal') return drawCal();
    const cnt = k => (k === 'all' ? A.sessions.length : A.sessions.filter(s => s.status === k).length);
    let P; onPage('sessions', draw);
    el.innerHTML = (F.bid || F.from ? `<div class="banner" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${esc(t('filter'))}:</b> ${F.bid ? badge('info', blank(F.bid)?.name || '') : ''} ${F.from ? badge('info', S.fmtDate(F.from) + ' – ' + S.fmtDate(F.to)) : ''}<span class="grow"></span><a class="btn ghost sm" href="#/sessions">✕ ${esc(t('clearFilter'))}</a></div>` : '') + pageHead(t('navSessions'), viewSeg() + (can('session.save') ? `<button class="btn" id="add">＋ ${esc(t('newSession'))}</button>` : ''))
      + tabs([['all', t('all'), cnt('all')], ...['ongoing', 'upcoming', 'review', 'completed', 'cancelled'].map(k => [k, t('st_' + k), cnt(k)])], st.tab) + bar(searchBox('q', st.q))
      + `<div class="tw"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('training'))}</th><th>${esc(t('trainer'))}</th><th>${esc(t('progress'))}</th><th>${esc(t('status'))}</th>${can('delete') ? '<th></th>' : ''}</tr></thead><tbody>${(P = paged('sessions', rows(), JSON.stringify([st.tab, st.q, F]))).rows.map(s => `<tr class="click" data-id="${esc(s.id)}"><td class="nowrap"><b>${esc(S.fmtDate(s.date))}</b>${s.endDate ? '<br><span class="mute xs">→ ' + esc(S.fmtDate(s.endDate)) + '</span>' : ''}${s.time ? ' <span class="mute xs">' + esc(s.time) + '</span>' : ''}</td><td>${esc(blank(s.bid)?.name || '—')}${s.sheetId ? ' <span title="' + esc(t('hasPractical')) + '">📋</span>' : ''}</td><td>${esc(trainerName(s.tid))}</td>
        <td><span class="sm">${esc(t('progressLine', s.stats.confirmed, s.stats.total, s.stats.finalized))}</span></td><td>${statusBadge(s.status)}</td>${can('delete') ? `<td class="act"><button class="btn bad ghost sm" data-del="${esc(s.id)}" title="${esc(t('delete'))}">🗑</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="6">${empty('📅', t('noSessions'))}</td></tr>`}</tbody></table></div>${P.html}`;
    // the list holds recent sessions; older ones a year at a time
    if (moreSessions()) { el.insertAdjacentHTML('beforeend', `<p class="center"><button class="btn ghost" id="older">${esc(t('olderSessionsBefore', S.fmtDate(A.sessionsSince)))}</button></p>`); $('#older').onclick = e => busy(e.currentTarget, async () => { await ensureSessionsFrom(dayMinus(A.sessionsSince, 365)); draw(); }); }
    $('#q').oninput = e => { st.q = e.target.value; const p = e.target.selectionStart; draw(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); };
    $('#add')?.addEventListener('click', () => sessionForm(null, rerender));
  }
  const dayMinus = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);
  if (F.from && F.from < (A.sessionsSince || '')) ensureSessionsFrom(F.from).then(draw).catch(fail);   // a period from a dashboard link
  draw();
  el.onclick = async e => { const vm = e.target.closest('[data-vm]'); if (vm) { CALV.mode = vm.dataset.vm; return draw(); } const dl = e.target.closest('[data-del]'); if (dl && !$('#del')) { const s = A.sessions.find(k => k.id === dl.dataset.del) || {}; if (await deleteRecord('session', dl.dataset.del, { name: `${blank(s.bid)?.name || ''} · ${S.fmtDate(s.date)}` })) rerender(); return; } const tb = e.target.closest('[data-tab]'); if (tb) { st.tab = tb.dataset.tab; draw(); return; } const r = e.target.closest('tr[data-id]'); if (r) go('sessions/' + r.dataset.id); };
}

/* trainer / room booked twice at overlapping dates: shown after saving, and as red entries in the calendar */
export function clashToast(ws) {
  const txt = ws.map(w => { const o = A.sessions.find(x => x.id === w.id); return t(w.kind === 'trainer' ? 'clashTrainer' : 'clashRoom', S.fmtDate(w.date), blank(o?.bid)?.name || ''); }).join(' · ');
  toast('⚠ ' + txt, 'bad');
}

/* ============================================================ calendar */
const MN = { ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], az: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
const DN = { ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], az: ['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.', 'B.'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
function calendarHtml(ym, list, clashes, lng) {
  const [y, m] = ym.split('-').map(Number), first = new Date(Date.UTC(y, m - 1, 1)), start = new Date(first); start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const L = MN[lng] ? lng : 'az', cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); const iso = d.toISOString().slice(0, 10), out = d.getUTCMonth() !== m - 1;
    if (i >= 35 && out) break;
    const evs = list.filter(s => s.date <= iso && iso <= (s.endDate || s.date));
    cells.push(`<div class="d ${out ? 'out' : ''} ${iso === A.today ? 'today' : ''} ${evs.length ? '' : 'empty'}"><div class="n">${d.getUTCDate()} <span class="only-m">${esc(DN[L][(d.getUTCDay() + 6) % 7])}</span></div>${evs.map(s => `<a class="ev ${s.status} ${clashes[s.id] ? 'clash' : ''}" href="#/sessions/${esc(s.id)}" title="${esc(`${blank(s.bid)?.name || ''} · ${trainerName(s.tid)} · ${s.location || ''}${clashes[s.id] ? ' · ⚠ ' + t('clash') : ''}`)}">${clashes[s.id] ? '⚠ ' : ''}${esc(s.time || '')} ${esc(blank(s.bid)?.name || '')}<br><span class="mute">${esc(trainerName(s.tid))}${s.location ? ' · ' + esc(s.location) : ''}</span></a>`).join('')}</div>`);
  }
  return `<div class="cal">${DN[L].map(x => `<div class="dh">${esc(x)}</div>`).join('')}${cells.join('')}</div>`;
}
const CALV = { mode: 'list', ym: '' };

/* The session's certificate lines changed: also update the certificates already issued from it? */
async function certLinesDlg(id, n, after) {
  const v = await openModal({ title: t('certLinesUpdate'), html: `<p>${esc(t('certLinesUpdateText', n))}</p><p class="hint">${esc(t('certLinesSignHint'))}</p>`,
    buttons: [{ label: t('notNow'), cls: 'ghost', id: 'x' }, { label: t('certLinesWithdraw'), cls: 'ghost', id: 'w' }, { label: t('certLinesKeep'), id: 'k' }] }).promise;
  if (v !== 'k' && v !== 'w') return;
  try { const r = await api('/session/cert-lines', { kind: 'staff', body: { id, withdraw: v === 'w' } }); toast(t('certLinesDone', r.updated), 'ok'); await after?.(); } catch (/** @type {any} */ e) { fail(e); }
}

/* ================================================================= form */
export async function sessionForm(s, rerender) {
  await ensurePeople(s?.traineeIds || []);         // names for the chips of an existing session
  const p = s || { date: A.today, materials: [], traineeIds: [] }, sel = new Set(p.traineeIds || []), mats = new Set(p.materials || []);
  const html = `<form id="sf"><div class="fg">
    <label class="req">${esc(t('training'))}<select name="bid" required>${opts(A.blanks.map(b => [b.id, b.name]), p.bid, t('select'))}</select></label>
    <label class="req">${esc(t('trainer'))}<select name="tid" required>${opts(A.trainers.filter(x => x.on !== false || x.id === p.tid).map(x => [x.id, S.fullAz(x, false)]), p.tid, t('select'))}</select></label>
    <label class="req">${esc(t('date'))}<input type="date" name="date" value="${esc(p.date)}" required></label><label>${esc(t('endDate'))} <span class="mute">(${esc(t('optional'))})</span><input type="date" name="endDate" value="${esc(p.endDate)}"><span class="hint" data-days></span></label>
    <label>${esc(t('time'))}<input type="time" name="time" value="${esc(p.time)}"></label><label>${esc(t('location'))}<input name="location" value="${esc(p.location)}" maxlength="160"></label>
    <label>${esc(t('practicalSheet'))} <span class="mute">(${esc(t('optional'))})</span><select name="sheetId">${opts(A.sheets.map(x => [x.id, x.name]), p.sheetId, t('noPractical'))}</select></label>
    <label>${esc(t('examKind'))}<select name="examMode">${opts([['', t('examNone')], ['link', t('examExternal')], ['bank', t('examBank')]], p.examMode ?? (p.examLink ? 'link' : ''))}</select></label>
    <label data-em="link">${esc(t('examLink'))}<input name="examLink" type="url" value="${esc(p.examLink)}" placeholder="https://"></label>
    <label data-em="bank">${esc(t('examFromBank'))}<select name="examId"></select><span class="hint" data-em-hint></span></label>
    <label data-em="bank">${esc(t('questionsPerCandidate'))}<input name="examCount" type="number" min="0" max="1000" value="${esc(p.examCount || '')}" placeholder="${esc(t('allQuestions'))}"><span class="hint" data-pool></span></label>
    <label data-em="bank">${esc(t('examMinutes'))}<input name="examMinutes" type="number" min="0" max="600" value="${esc(p.examMinutes || '')}" placeholder="${esc(t('examMinutesPh'))}"><span class="hint">${esc(t('examMinutesHint'))}</span></label>
    <div class="full"><div class="b sm mute" style="margin-bottom:4px">${esc(t('materials'))}</div>${A.materials.length ? `<div class="pick" style="max-height:130px">${A.materials.filter(m => S.usable(m) || mats.has(m.id)).map(m => `<label><input type="checkbox" data-m="${esc(m.id)}" ${mats.has(m.id) ? 'checked' : ''}> ${esc(m.title)} <span class="mute xs">${m.slides || ''} ${m.slides ? esc(t('slides')) : ''}</span></label>`).join('')}</div>` : `<p class="mute sm">${esc(t('noMaterialsHint'))}</p>`}</div>
    <div class="full" style="margin-top:10px"><div class="b sm mute" style="margin-bottom:4px">${esc(t('trainees'))} — <span id="sc">0</span></div>
      <div class="bar" style="margin-bottom:6px"><input class="sr-in" id="pq" type="search" placeholder="${esc(t('search'))}"><select id="pc">${opts([['-', t('private')], ...A.companies.map(c => [c.id, c.name])], '', t('allCompanies'))}</select><button type="button" class="btn ghost sm" id="pall">${esc(t('addShown'))}</button><button type="button" class="btn ghost sm" id="pnone">${esc(t('clearAll'))}</button>${(A.groups || []).length ? `<select id="pg" aria-label="${esc(t('addGroup'))}" style="width:auto">${opts(A.groups.map(g => [g.id, `${g.name} (${g.traineeIds.length})`]), '', '＋ ' + t('addGroup'))}</select>` : ''}</div>
      <div id="chips" style="margin-bottom:6px"></div><div class="pick" id="pl"></div></div>
    <details class="full" style="margin-top:8px"${p.certDetails || p.certReg || p.coMode ? ' open' : ''}><summary class="sm b">${esc(t('certLines'))}</summary><p class="hint">${esc(t('certLinesHint'))}</p><div class="fg">
      <label class="full">${esc(t('certDetails'))}<textarea name="certDetails" rows="2" maxlength="600" placeholder="${esc(t('certDetailsPh'))}">${esc(p.certDetails || '')}</textarea><span class="hint">${esc(t('certDetailsHint'))}</span></label>
      <label class="full">${esc(t('certReg'))}<input name="certReg" maxlength="160" value="${esc(p.certReg || '')}" placeholder="ECITB reg: 934838"><span class="hint">${esc(t('certRegHint'))}</span></label>
      ${coFields({ mode: p.coMode || '', text: p.coText || '', names: { mode: 'coMode', text: 'coText' } })}</div></details>
    <label class="full">${esc(t('notes'))}<textarea name="notes" maxlength="600">${esc(p.notes)}</textarea></label></div><div class="err" id="se" role="alert"></div></form>`;
  openModal({ title: s ? t('editSession') : t('newSession'), wide: true, html, onMount: d => {
    const f = $('#sf', d), pl = $('#pl', d); bindCo(f);
    // candidates are searched on the server (name, learner number; ID/FIN for those allowed), 150 at a time
    let found = [], more = 0, seqP = 0, tmr = 0;
    const search = async () => { const my = ++seqP; try { const r = await findTrainees({ q: $('#pq', d).value, co: $('#pc', d).value, on: 'on', size: 150 }); if (my !== seqP) return; found = r.list; more = Math.max(0, r.total - r.list.length); draw(); } catch (/** @type {any} */ e) { fail(e); } };
    const shown = () => found;
    const draw = () => {
      const list = shown();
      pl.innerHTML = list.map(x => `<label><input type="checkbox" data-t="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}> <span><b>${esc(personName(x))}</b> <span class="mute xs">${esc(x.att)} · ${esc(coName(x.co) || t('private'))}</span></span></label>`).join('') + (more ? `<p class="mute xs center">${esc(t('narrowSearch', more))}</p>` : '') || `<p class="mute center">${esc(t('noTrainees'))}</p>`;
      $('#chips', d).innerHTML = [...sel].map(id => { const x = trainee(id); return x ? `<span class="chip">${esc(personName(x))}<button type="button" data-x="${esc(id)}" aria-label="${esc(t('remove'))}">×</button></span>` : ''; }).join(''); $('#sc', d).textContent = sel.size;
    };
    draw(); search(); $('#pq', d).oninput = () => { clearTimeout(tmr); tmr = setTimeout(search, 250); }; $('#pc', d).onchange = search;
    $('#pall', d).onclick = () => { shown().forEach(x => sel.add(x.id)); draw(); };
    $('#pg', d)?.addEventListener('change', async e => { const g = A.groups.find(x => x.id === e.target.value); if (g) { await ensurePeople(g.traineeIds); g.traineeIds.forEach(id => { if (trainee(id)?.on !== false) sel.add(id); }); toast(t('groupAdded', g.name, g.traineeIds.length), 'ok'); } e.target.value = ''; draw(); }); $('#pnone', d).onclick = () => { sel.clear(); draw(); };
    pl.onchange = e => { const id = e.target.dataset.t; if (id) { e.target.checked ? sel.add(id) : sel.delete(id); draw(); } };
    $('#chips', d).onclick = e => { const x = e.target.closest('[data-x]'); if (x) { sel.delete(x.dataset.x); draw(); } };
    d.addEventListener('change', e => { const m = e.target.dataset.m; if (m) e.target.checked ? mats.add(m) : mats.delete(m); });
    // exam: tests of the chosen training first, then the others
    const tests = () => { const own = (A.tests || []).filter(x => x.bid === f.bid.value), rest = (A.tests || []).filter(x => x.bid !== f.bid.value), cur = f.examId.value || p.examId || '';
      f.examId.innerHTML = `<option value="">${esc(t('select'))}</option>` + (own.length ? `<optgroup label="${esc(blank(f.bid.value)?.name || '')}">${own.map(x => `<option value="${esc(x.id)}" ${S.usable(x) ? '' : 'disabled'}>${esc(x.title)} (${x.questions.length})${x.draft ? ' — ' + esc(t('draft')) : !S.usable(x) ? ' — ' + esc(t('awaitingApproval')) : ''}</option>`).join('')}</optgroup>` : '') + (rest.length ? `<optgroup label="${esc(own.length ? t('otherTests') : t('navTests'))}">${rest.map(x => `<option value="${esc(x.id)}" ${S.usable(x) ? '' : 'disabled'}>${esc(x.title)} (${x.questions.length})${x.draft ? ' — ' + esc(t('draft')) : !S.usable(x) ? ' — ' + esc(t('awaitingApproval')) : ''}</option>`).join('')}</optgroup>` : '');
      f.examId.value = cur; const ready = own.filter(S.usable); if (!f.examId.value && ready.length === 1) f.examId.value = ready[0].id;
      $('[data-em-hint]', d).innerHTML = !(A.tests || []).length ? `${esc(t('noTestsYet'))} <a href="#/tests">${esc(t('navTests'))} →</a>` : ''; };
    const pool = () => { const x = (A.tests || []).find(k => k.id === f.examId.value), n = x?.questions.length || 0; $('[data-pool]', d).textContent = x ? t('poolHint', n) : ''; f.examCount.max = n || 1000; };
    f.examId.addEventListener('change', pool); setTimeout(pool);
    const em = () => { $$('[data-em]', d).forEach(x => x.classList.toggle('hide', x.dataset.em !== f.examMode.value)); f.examLink.required = f.examMode.value === 'link'; f.examId.required = f.examMode.value === 'bank'; };
    tests(); em(); f.examMode.onchange = em;
    // several credits = several days: the end date follows the start date (it can still be changed by hand)
    let autoEnd = !p.endDate;
    const days = () => { const b = blank(f.bid.value), cr = +b?.credits || 0;
      if (autoEnd && cr > 1 && S.isDate(f.date.value)) f.endDate.value = new Date(Date.parse(f.date.value) + (cr - 1) * 864e5).toISOString().slice(0, 10);
      const n = S.isDate(f.date.value) ? S.sessionDays({ date: f.date.value, endDate: f.endDate.value >= f.date.value ? f.endDate.value : '' }).length : 1;
      $('[data-days]', d).textContent = n > 1 ? t('daysHint', n) + (cr > 1 ? ' · ' + t('creditsDays', cr) : '') : ''; };
    f.date.addEventListener('change', days); f.endDate.addEventListener('change', () => { autoEnd = !f.endDate.value; days(); }); days();
    f.bid.onchange = () => { const b = blank(f.bid.value); if (b?.defaultSheetId && !f.sheetId.value) f.sheetId.value = b.defaultSheetId; tests(); days(); };
  }, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
    const f = $('#sf', d); if (!f.reportValidity()) return false;
    try { const r = await api('/session/save', { kind: 'staff', body: { ...Object.fromEntries(new FormData(f)), id: s?.id, materials: [...mats], traineeIds: [...sel], ...(s?.id ? { baseIds: s.traineeIds || [] } : {}) } }); await load(); savedToast(); if (r.warnings?.length) clashToast(r.warnings); if (r.certsBehind && can('cert.update')) setTimeout(() => certLinesDlg(r.session.id, r.certsBehind, rerender), 50); if (!s) { A.slipsFor = r.session.id; location.hash = '#/sessions/' + r.session.id; } else rerender(); return true; }
    catch (/** @type {any} */ e) { $('#se', d).textContent = e.message === 'hasData' ? t('hasDataTrainee') : e.message === 'poolTooSmall' ? t('poolTooSmall', e.data?.k, e.data?.n) : t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] });
}

/* =============================================================== detail */
async function detail(id, rerender, go) {
  const el = view(); let D;
  const fetchIt = async () => { D = await api('/session?id=' + encodeURIComponent(id), { kind: 'staff' }); rememberPeople(D.people); };   // the participants come with the session
  await fetchIt();
  const enrOf = tid => D.enrs.find(e => e.tid === tid) || { sid: id, tid };
  const certOf = e => D.certs.find(c => c.no === e.final?.certNo);
  const refresh = async () => { await load(); await fetchIt(); draw(); };
  const attRows = () => D.session.traineeIds.map(tid => { const x = trainee(tid), e = enrOf(tid); return { az: x?.foreign ? '' : S.fullAz(x), en: S.fullEn(x), att: x?.att, company: coName(x?.co), attAt: e.att, by: e.attBy, days: e.days }; });
  const attDoc = sign => attendanceHtml({ session: D.session, blank: blank(D.session.bid), trainer: trainerName(D.session.tid), rows: attRows(), info: info(), assets: A.assets, sign, esign: D.signs?.att, esignDays: D.signs?.attDays || {} });

  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const s = D.session, b = blank(s.bid), sh = sheet(s.sheetId), st = s.stats;
    el.innerHTML = `<p class="sm"><a href="#/sessions">← ${esc(t('navSessions'))}</a></p>
     <div class="page-h"><h1>${esc(b?.name || '')} <span style="font-weight:400">· ${esc(S.fmtDate(s.date))}${s.endDate ? ' → ' + esc(S.fmtDate(s.endDate)) : ''}</span></h1>${statusBadge(s.status)}<span class="grow"></span>
       <button class="btn" id="docs">${icon('zip', 16)} ${esc(t('sessionDocs'))}</button>${can('attendance.confirm') && !s.cancelled && !s.closed && A.today >= s.date ? `<button class="btn ok" id="roll">✔ ${esc(t('rollCall'))}</button>` : ''}<button class="btn ghost" id="att">📄 ${esc(t('attSheet'))}</button>${sh ? `<button class="btn ghost" id="tbt">🦺 ${esc(t('toolboxTalk'))}${s.tbt ? (D.signs?.tbt ? ' ✔' : ' •') : ''}</button>` : ''}${can('credentials.reset') ? `<button class="btn ghost" id="slips">🔑 ${esc(t('loginSlips'))}</button>` : ''}${can('exam.save') ? `<button class="btn ghost" id="csv">${icon('upload', 16)} ${esc(t('examCsv'))}</button>` : ''}${D.certs.some(c => !c.revoked) ? `<button class="btn ghost" id="allc">${icon('award', 16)} ${esc(t('sessionCerts', D.certs.filter(c => !c.revoked).length))}</button>` : ''}${can('session.save') ? `<button class="btn ghost" id="edit">${esc(t('edit'))}</button>${S.multiDay(D.session) && can('session.save') && !D.session.cancelled && !D.session.closed ? `<button class="btn ghost" id="docsSw" title="${esc(t('finalDayDocsHint', S.fmtDate(S.finalDay(D.session))))}">${D.session.docsOpen ? '■ ' + esc(t('closeFinalDocs')) : '▶ ' + esc(t('openFinalDocs'))}</button>` : ''}` : ''}</div>
     <div class="card"><div class="grid g4"><div><span class="mute xs">${esc(t('trainer'))}</span><br><b>${esc(trainerName(s.tid))}</b></div><div><span class="mute xs">${esc(t('location'))}</span><br>${esc(s.location || '—')} ${esc(s.time || '')}</div><div><span class="mute xs">${esc(t('practicalSheet'))}</span><br>${sh ? '📋 ' + esc(sh.name) : esc(t('noPractical'))}</div><div><span class="mute xs">${esc(t('examKind'))}</span><br>${examCell(s)}${s.examMode === 'bank' ? examCtl(s) : ''}</div></div>
       ${(s.materials || []).length ? `<p class="sm" style="margin:10px 0 0">🖥 ${s.materials.map(m => esc(A.materials.find(x => x.id === m)?.title || '')).join(' · ')}</p>` : ''}
       ${s.notes ? `<p class="sm mute" style="margin:6px 0 0">${esc(s.notes)}</p>` : ''}</div>
     <div class="grid g4" style="margin-bottom:16px">${[[t('trainees'), st.total, ''], [t('confirmed'), st.confirmed + ' / ' + st.total, st.confirmed === st.total ? 'ok' : ''], [t('feedbackDone'), st.feedback, ''], [t('released'), st.finalized + ' / ' + st.total, st.finalized === st.total && st.total ? 'ok' : '']].map(([a, v, c]) => `<div class="stat ${c}"><b>${v}</b><span>${esc(a)}</span></div>`).join('')}</div>
     <div class="tw"><table><thead><tr><th>${esc(t('trainee'))}</th><th>${esc(t('attendance'))}</th><th>${esc(t('feedback'))}</th><th>${esc(t('trainerEval'))}</th>${sh ? `<th title="${esc(t('dohTitle'))}">${esc(t('dohShort'))}</th><th>${esc(t('practical'))}</th>` : ''}<th>${esc(t('exam'))}</th><th>${esc(t('outcome'))}</th><th></th></tr></thead><tbody>
     ${s.traineeIds.map(tid => { const x = trainee(tid), e = enrOf(tid), o = outcomeOf(e, s), c = certOf(e); return `<tr class="click" data-t="${esc(tid)}"><td style="min-width:190px"><b>${esc(personName(x))}</b><br><span class="mute xs mono">${esc(x?.att)} · ${esc(coName(x?.co) || t('private'))}</span></td>
       <td>${e.absent && !e.att ? badge('FAIL', t('absent')) : e.att ? `<span class="sm">${esc(S.fmtDateTime(e.att))}</span>${e.attBy && e.attBy !== 'self' ? '<br>' + badge('', t('by' + e.attBy)) : ''}` : badge('PENDING', t('waiting'))}${dayStrip(s, e.days)}</td><td>${e.fb ? badge('PASS', '✓') : '<span class="mute">—</span>'}</td>
       <td>${e.ev ? `<span class="sm">${esc(t('beh_' + e.ev.behavior))} · ${'★'.repeat(e.ev.engagement)}</span>` : '<span class="mute">—</span>'}</td>${sh ? `<td>${dohBadge(e.doh)}</td><td>${pracBadge(e.prac)}</td>` : ''}
       <td>${e.exam ? badge(e.exam.passed ? 'PASS' : 'FAIL', t(e.exam.passed ? 'pass' : 'fail')) + (e.exam.score != null ? ` <span class="xs">${e.exam.score}${e.exam.test ? '%' : ''}</span>` : '') : e.test?.status === 'review' ? badge('PENDING', '✎ ' + t('needsReview')) : e.test && !e.test.at ? `<span class="mute xs">${esc(t('testStarted'))}</span>` : '<span class="mute">—</span>'}</td>
       <td>${e.final ? badge(e.final.outcome, t('rel_' + e.final.outcome)) + (c ? `<br><span class="mono xs">${esc(c.no)}</span>` : '') : outcomeBadge(o.outcome)}</td><td class="act"><button class="btn ghost sm" data-t="${esc(tid)}">${esc(t('review'))}</button></td></tr>`; }).join('') || `<tr><td colspan="8">${empty('🧑‍🎓', t('noTrainees'))}</td></tr>`}</tbody></table></div>
     <div class="row" style="margin-top:14px">${can('session.save') ? (s.closed ? `<button class="btn ghost" id="reopen">${esc(t('reopenSession'))}</button>` : `<button class="btn ghost" id="close">${esc(t('closeSession'))}</button>`) + (s.cancelled ? `<button class="btn ghost" id="uncancel">${esc(t('restoreSession'))}</button>` : `<button class="btn bad ghost" id="cancel">${esc(t('cancelSession'))}</button>`) : ''}${can('delete') ? `<button class="btn bad ghost" id="del">🗑 ${esc(t('delete'))}</button>` : ''}</div>`;
    $('#docsSw')?.addEventListener('click', e => busy(e.currentTarget, async () => { try { await api('/session/docs', { kind: 'staff', body: { sid: id, open: !D.session.docsOpen } }); await fetchIt(); draw(); } catch (/** @type {any} */ x) { fail(x); } }));
    $('#edit')?.addEventListener('click', () => sessionForm(D.session, async () => { await load(); await fetchIt(); draw(); }));
    $('#att').onclick = async () => {
      const { scaled } = await import('./certview.js'); let sign = true;
      // the attendance sheet is signed by the trainer only (trainer portal); the office views / prints it
      openModal({ title: t('attSheet'), wide: true, html: `<p class="hint">${esc(t('attTrainerSigns'))}</p><div id="attp" style="overflow:auto"></div>`,
        onMount: d => { $('#attp', d).innerHTML = scaled(attDoc(sign), Math.min(700, innerWidth - 90)).replace(/height:\d+px/, 'min-height:300px'); },
        buttons: [{ label: '🖨 ' + t('print'), cls: 'ghost', fn: async () => { await printHtml(attDoc(sign), t('attSheet')); return false; } }, { label: '⬇ PDF', fn: async () => { try { download(await htmlToPdf(attDoc(sign)), `attendance-${D.session.date}.pdf`); } catch (/** @type {any} */ e) { fail(e); } return false; } }, { label: t('close'), cls: 'ghost', id: 'x' }] });
    };
    $('#exOn')?.addEventListener('click', () => examSwitch(true)); $('#exOff')?.addEventListener('click', () => examSwitch(false));
    $('#roll')?.addEventListener('click', () => rollCallDlg({ days: S.sessionDays(D.session), today: A.today, rows: people().map(p => ({ id: p.id, name: p.az || p.en, att: p.att, absent: !!p.enr.absent, days: p.enr.days || {}, locked: !!(p.enr.fb || p.enr.ev || p.enr.prac || p.enr.exam || p.enr.test || p.enr.final || p.enr.doh) })), save: async (absent, day) => { const r = await api('/enr/attendance', { kind: 'staff', body: { sid: id, absent, day } }); await refresh(); return r; } }));
    $('#docs').onclick = docsZip; $('#tbt')?.addEventListener('click', tbt);
    $('#slips')?.addEventListener('click', slips);
    if (A.slipsFor === id) { A.slipsFor = null; if (can('credentials.reset') && D.session.traineeIds.length) setTimeout(async () => { if (await confirmDlg(t('slipsNow', D.session.traineeIds.length))) slips(); }, 50); } $('#csv')?.addEventListener('click', csvDlg); $('#allc')?.addEventListener('click', allCerts); $('#close')?.addEventListener('click', () => status({ closed: true })); $('#reopen')?.addEventListener('click', () => status({ closed: false }));
    $('#cancel')?.addEventListener('click', async () => { if (await confirmDlg(t('cancelSessionConfirm'), { danger: true })) status({ cancelled: true }); }); $('#uncancel')?.addEventListener('click', () => status({ cancelled: false }));
    $('#del')?.addEventListener('click', async () => { if (await deleteRecord('session', id, { name: `${blank(D.session.bid)?.name || ''} · ${S.fmtDate(D.session.date)}` })) go('sessions'); });
  }
  /* ---------- exam / declaration / toolbox talk / documents ---------- */
  /* the exam is started / ended in the classroom (trainer or staff); until then nobody sees a question */
  function examCtl(s) {
    const st = s.exam?.open ? 'open' : s.exam?.closedAt ? 'closed' : 'wait', n = D.enrs.filter(e => e.test).length, done = D.enrs.filter(e => e.test?.at).length;
    const b = st === 'open' ? badge('PASS', '● ' + t('examRunning')) : st === 'closed' ? badge('', t('examEnded')) : badge('PENDING', t('examNotStartedShort'));
    return `<div style="margin-top:6px">${b} ${st !== 'wait' ? `<span class="xs mute">${esc(t('examProgress', n, done))}</span>` : ''}${s.examCount ? `<br><span class="xs mute">${esc(t('perCandidateN', s.examCount))}</span>` : ''}
      ${can('exam.save') && !s.cancelled ? `<div class="row" style="margin-top:6px">${st === 'open' ? `<button class="btn bad sm" id="exOff">■ ${esc(t('endExam'))}</button>` : `<button class="btn ok sm" id="exOn">▶ ${esc(st === 'closed' ? t('reopenExam') : t('startExam2'))}</button>`}</div>` : ''}</div>`;
  }
  async function examSwitch(open) {
    if (!open && !await confirmDlg(t('endExamConfirm'), { danger: true })) return;
    try { await api('/session/exam', { kind: 'staff', body: { sid: id, open } }); toast(open ? t('examStartedToast') : t('examEndedToast'), 'ok'); await refresh(); } catch (/** @type {any} */ e) { fail(e); }
  }
  function examCell(s) {
    if (s.examMode === 'bank') { const x = (A.tests || []).find(k => k.id === s.examId); return x ? `📝 <a href="#/tests">${esc(x.title)}</a>` : '—'; }
    return s.examLink ? `<a href="${esc(s.examLink)}" target="_blank" rel="noopener">${esc(t('examExternal'))} ↗</a>` : '—';
  }
  const people = () => D.session.traineeIds.map(tid => { const x = trainee(tid); return x && { id: tid, az: x.foreign ? S.fullEn(x) : S.fullAz(x), en: S.fullEn(x), foreign: !!x.foreign, att: x.att, company: coName(x.co), enr: enrOf(tid) }; }).filter(Boolean);
  const docBase = () => ({ session: D.session, blank: blank(D.session.bid), trainer: trainerName(D.session.tid), info: info(), assets: A.assets });
  /* every document of the session: view, approval countersignature (approver / superadmin), ZIP of all */
  function docsZip() {
    const list = people(), s = D.session, sh = sheet(s.sheetId), x = (A.tests || []).find(k => k.id === s.examId);
    const DD = () => ({ ...docBase(), sheet: sh, signs: D.signs, examLabel: s.examMode === 'bank' ? (x?.title || t('examBank')) : s.examMode === 'link' ? t('examExternal') : '', people: people() });
    const mine = !!A.me.sigImg, signer = can('doc.sign');
    const row = j => `<tr><td><b>${esc(j.name)}</b>${j.person ? `<br><span class="mute xs">${esc(j.person)}</span>` : ''}</td>
      <td>${j.doc ? (j.appr ? `<span class="sm" style="color:var(--ok)">✔ ${esc(j.appr.name)}<br><span class="xs mute">${esc(S.fmtDateTime(j.appr.at))} · ${j.appr.mode === 'image' ? '🖊 ' + esc(t('sigImage')) : esc(t('esignShort'))}</span></span>` : `<span class="mute sm">${esc(t('notApprovedYet'))}</span>`) : '<span class="mute xs">—</span>'}</td>
      <td class="act nowrap"><button class="btn ghost sm" data-dv="${esc(j.key)}">👁 ${esc(t('view'))}</button>${signer && j.doc ? (j.appr ? ` <button class="btn bad ghost sm" data-dw="${esc(j.key)}">${esc(t('withdrawSign'))}</button>` : ` <button class="btn sm" data-ds="${esc(j.key)}" data-m="esign">✍ ${esc(t('signE'))}</button>${mine ? ` <button class="btn ghost sm" data-ds="${esc(j.key)}" data-m="image">🖊 ${esc(t('signImg'))}</button>` : ''}`) : ''}</td></tr>`;
    const body = () => { const jobs = sessionDocList(DD()); return `<p class="mute sm">${esc(t('sessionDocsHint2'))}</p>${signer && !mine ? `<p class="hint">${esc(t('sigImageHint'))}</p>` : ''}
      <div class="tw"><table><thead><tr><th>${esc(t('document'))}</th><th>${esc(t('approvalSign'))}</th><th></th></tr></thead><tbody>${jobs.map(row).join('')}</tbody></table></div><div id="zp" class="mute sm"></div>`; };
    openModal({ title: t('sessionDocs'), wide: true, html: `<div id="dl">${body()}</div>`, onMount: d => {
      d.addEventListener('click', async e => {
        const v = e.target.closest('[data-dv]'), sg = e.target.closest('[data-ds]'), w = e.target.closest('[data-dw]');
        const job = k => sessionDocList(DD()).find(j => j.key === k);
        if (v) { const j = job(v.dataset.dv); return previewDoc({ title: j.name + (j.person ? ' · ' + j.person : ''), file: j.file.split('/').pop().replace(/\.pdf$/, ''), html: j.html() }); }
        if (sg || w) { const j = job((sg || w).dataset[sg ? 'ds' : 'dw']);
          try { const r = await api(sg ? '/sign/doc' : '/sign/doc/withdraw', { kind: 'staff', body: { sid: id, doc: j.doc, tid: j.tid, mode: sg?.dataset.m } }); D.signs = r.signs; $('#dl', d).innerHTML = body(); toast(sg ? t('signed') : t('saved'), 'ok'); }
          catch (/** @type {any} */ er) { toast(t(er.message) === er.message ? t('server') : t(er.message), 'bad'); } }
      }); },
      buttons: [{ label: t('close'), cls: 'ghost', id: 'x' }, { label: '⬇ ' + t('downloadZip'), id: 'ok', fn: async (d, b) => {
        b.disabled = true;
        try { const z = await sessionZip(DD(), (i, n, f) => ($('#zp', d).textContent = `${i} / ${n} · ${f}`)); download(z, zipName(s, blank(s.bid))); }
        catch (/** @type {any} */ e) { fail(e); } b.disabled = false; $('#zp', d).textContent = ''; return false; } }] });
  }
  function tbt() {
    const s = D.session;
    tbtDlg({ ...docBase(), tbt: s.tbt || {}, rows: people().map(p => ({ id: p.id, name: p.az || p.en, company: p.company, attAt: p.enr.att })), sign: D.signs?.tbt, canEdit: can('session.save') && !s.cancelled,
      save: async b => { await api('/session/tbt', { kind: 'staff', body: { sid: id, ...b } }); await refresh(); toast(t('saved'), 'ok'); } });
  }
  const dohBadge = d => (!d ? '<span class="mute">—</span>' : d.paper ? badge('', '📄 ' + t('dohPaper')) : S.dohYes(d) ? badge('PENDING', '⚠ ' + t('dohYes')) : badge('PASS', '✓'));
  function dohView(tid) {
    const p = people().find(k => k.id === tid), e = p.enr;
    previewDoc({ title: t('dohTitle') + ' · ' + (p.az || p.en), file: `health-${p.att}`, html: withAppr(dohHtml({ ...docBase(), person: p, company: p.company, doh: e.doh, sign: D.signs?.doh?.[tid] }), D.signs?.appr?.doh?.[tid]) });
  }
  function testView(tid) {
    const p = people().find(k => k.id === tid), e = p.enr, x = e.test, ok = can('test.review') && !e.final;
    reviewTest({ test: x, name: `${p.az || p.en} · ${p.att}`, canGrade: ok, save: async b => { await api('/test/grade', { kind: 'staff', body: { sid: id, tid, ...b } }); await refresh(); toast(t('saved'), 'ok'); },
      extraButtons: [{ label: '🖨', cls: 'ghost', fn: async () => { await printHtml(testSheetHtml({ ...docBase(), person: p, company: p.company, test: x, sign: D.signs?.test?.[tid] }), x.title); return false; } }] });
  }

  /* every certificate of this session: one print job, or a ZIP with one PDF each */
  function allCerts() {
    const list = D.certs.filter(c => !c.revoked), info_ = info();
    openModal({ title: t('sessionCerts', list.length), html: `<p>${list.map(c => `<span class="mono">${esc(c.no)}</span> ${esc(c.snap?.names?.en || '')}`).join('<br>')}</p><label class="chk"><input type="checkbox" id="ns"> ${esc(t('noSign'))}</label><div id="zp" class="mute sm"></div>`,
      buttons: [...(list.some(c => !c.sign && !c.esign) ? signButtons(list.filter(c => !c.sign && !c.esign).map(c => c.no), async () => { await fetchIt(); draw(); allCerts(); }) : []), ...(!can('download') ? [] : [{ label: t('printAll'), cls: 'ghost', fn: async d => { await printHtml(certsHtml(list, A.assets, info_, { noSign: $('#ns', d).checked }), D.session.date); return false; } },
        { label: t('zipAll'), fn: async (d, b) => { try { const z = await certsZip(list, A.assets, info_, { noSign: $('#ns', d).checked, onStep: (i, n) => ($('#zp', d).textContent = `${i} / ${n}`) }); download(z, `certificates-${D.session.date}.zip`); } catch (/** @type {any} */ e) { fail(e); } $('#zp', d).textContent = ''; return false; } }]),
        { label: t('close'), cls: 'ghost', id: 'x' }] });
  }
  /* exam results from a CSV / spreadsheet export: learner number, score, optional PASS/FAIL */
  function csvDlg() {
    const parse = txt => {
      const lines = String(txt).replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean); if (!lines.length) return [];
      const sep = [';', '\t', ','].find(c => lines[0].includes(c)) || ',', cells = l => l.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
      let head = cells(lines[0]).map(x => x.toLowerCase()), rows = lines.slice(1), ia = head.findIndex(h => /learner|att|nömr|nomr|number|e-20/.test(h)), is = head.findIndex(h => /score|bal|xal|point|result %/.test(h)), ir = head.findIndex(h => /^(result|nəticə|netice|pass)/.test(h));
      if (ia < 0) { rows = lines; ia = 0; is = 1; ir = 2; }   // no header row: number; score; result
      return rows.map((l, i) => { const c = cells(l); return { row: i + 2, att: c[ia] || '', score: is >= 0 ? c[is] : '', result: ir >= 0 ? c[ir] || '' : '' }; }).filter(r => /^E-\d+/i.test(r.att));
    };
    let rows = [];
    openModal({ title: t('examCsv'), wide: true, html: `<p class="hint">${esc(t('examCsvHint'))}</p><input type="file" id="cf" accept=".csv,.txt,text/csv"><label>${esc(t('orPaste'))}<textarea id="ct" rows="5" placeholder="E-202600001;85&#10;E-202600002;62"></textarea></label>
      <label style="max-width:200px">${esc(t('passMark'))}<input id="pm" type="number" min="0" max="1000" value="70"></label><div id="cp" class="mute sm"></div><div id="cr"></div>`,
      onMount: d => {
        const upd = () => { rows = parse($('#ct', d).value); $('#cp', d).textContent = t('csvRows', rows.length); };
        $('#ct', d).oninput = upd; $('#cf', d).onchange = async e => { const f = e.target.files[0]; if (f) { $('#ct', d).value = await f.text(); upd(); } };
      },
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('importResults'), id: 'ok', fn: async d => {
        if (!rows.length) { toast(t('csvNone'), 'bad'); return false; }
        const r = (await api('/enr/exam/bulk', { kind: 'staff', body: { sid: id, passMark: +$('#pm', d).value, rows } })).results;
        $('#cr', d).innerHTML = `<div class="tw" style="margin-top:10px"><table><thead><tr><th>${esc(t('learnerNo'))}</th><th>${esc(t('name'))}</th><th>${esc(t('result'))}</th></tr></thead><tbody>${r.map(x => `<tr><td class="mono">${esc(x.att)}</td><td>${esc(x.name || '')}</td><td>${x.ok ? badge(x.passed ? 'PASS' : 'FAIL', `${t(x.passed ? 'pass' : 'fail')}${x.score != null ? ' · ' + x.score : ''}`) : badge('PENDING', t(x.error) === x.error ? x.error : t(x.error))}</td></tr>`).join('')}</tbody></table></div>`;
        toast(t('csvDone', r.filter(x => x.ok).length, r.length), 'ok'); await refresh(); rows = []; return false; } }] });
  }
  const status = async o => { await api('/session/close', { kind: 'staff', body: { id, ...o } }); await refresh(); };
  async function slips() {
    const ids = D.session.traineeIds.filter(tid => !enrOf(tid).att); if (!can('credentials.reset')) return toast(t('noAccess'), 'bad');
    const { dlg } = openModal({ title: t('loginSlips'), html: `<p class="mute">${esc(t('slipsHint'))}</p><p class="hint">${esc(t('slipsSheetHint'))}</p><div class="bar" style="margin-bottom:6px"><button type="button" class="btn ghost sm" data-all="1">☑ ${esc(t('selectAll'))}</button><button type="button" class="btn ghost sm" data-all="0">☐ ${esc(t('clearAll'))}</button></div><div class="pick">${D.session.traineeIds.map(tid => `<label><input type="checkbox" data-s="${esc(tid)}" ${ids.includes(tid) ? 'checked' : ''}> ${esc(personName(trainee(tid)))} <span class="mute xs">${esc(trainee(tid)?.att)}</span></label>`).join('')}</div>`,
      onMount: d => d.addEventListener('click', e => { const b = e.target.closest('[data-all]'); if (b) $$('[data-s]', d).forEach(i => { i.checked = b.dataset.all === '1'; }); }),
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('generate'), id: 'ok', fn: async d => {
        const sel = $$('[data-s]', d).filter(i => i.checked).map(i => i.dataset.s); if (!sel.length) return false;
        if (!await confirmDlg(t('resetConfirm'))) return false;
        const r = await api('/credentials/reset', { kind: 'staff', body: { kind: 'trainee', ids: sel } }); d._v = 'ok'; d.close();
        const list = r.list.map(c => ({ name: c.name, login: c.login, password: c.password })), meta = { training: blank(D.session.bid)?.name || '', date: S.fmtDate(D.session.date) + (D.session.endDate ? ' – ' + S.fmtDate(D.session.endDate) : '') };
        await printHtml(slipsHtml(list, { info: info(), assets: A.assets, meta }), t('loginSlips'));       // straight to the cut sheet
        await showCreds(list, { title: t('loginSlips'), meta }); return true; } }] });
  }

  /* -------- review one trainee -------- */
  function review(tid) {
    const s = D.session, x = trainee(tid), e = enrOf(tid), sh = sheet(s.sheetId), o = outcomeOf(e, s), locked = !!e.final, edit = can('exam.save');
    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    const fb = e.fb ? `<div class="grid g2">${S.FB_GROUPS.map(g => `<div><b>${esc(t(g))}</b>: <span class="b">${e.fb.r[g]}/10</span>${e.fb.cm[g] ? `<br><span class="mute sm">${esc(e.fb.cm[g])}</span>` : ''}</div>`).join('')}</div>` : `<span class="mute">${esc(t('noFeedbackYet'))}</span>`;
    const html = `<div class="grid g2"><div class="card" style="box-shadow:none"><h3>1. ${esc(t('attendance'))}</h3>${e.att ? `<p>✔ ${esc(S.fmtDateTime(e.att))} ${e.attBy && e.attBy !== 'self' ? badge('', t('by' + e.attBy)) : badge('', t('byself'))}</p>` : `<p>${badge('PENDING', t('waiting'))}</p>`}
        ${edit && !locked ? (e.att ? (!e.fb && !e.ev && !e.prac && !e.exam ? `<button class="btn ghost sm" data-a="unconfirm">${esc(t('undoConfirm'))}</button>` : '') : `<button class="btn sm" data-a="confirm">${esc(t('confirmManually'))}</button>`) : ''}</div>
      <div class="card" style="box-shadow:none"><h3>3. ${esc(t('trainerEval'))}</h3>${e.ev ? `<p>${esc(t('behavior'))}: <b>${esc(t('beh_' + e.ev.behavior))}</b><br>${esc(t('punctuality'))}: <b>${esc(t('pun_' + e.ev.punctuality))}</b><br>${esc(t('engagement'))}: <span style="color:#f59e0b">${stars(e.ev.engagement)}</span>${e.ev.comment ? `<br><span class="mute sm">${esc(e.ev.comment)}</span>` : ''}</p>` : `<span class="mute">${esc(t('noEvalYet'))}</span>`}</div></div>
      <div class="card" style="box-shadow:none"><h3>2. ${esc(t('feedback'))}</h3>${fb}</div>
      ${sh ? `<div class="card" style="box-shadow:none"><div class="ch"><h3>🩺 ${esc(t('dohTitle'))}</h3><span class="grow"></span>${dohBadge(e.doh)}</div>
        ${e.doh ? (e.doh.paper ? `<p class="sm">${esc(t('dohPaperNote'))}: ${esc(S.fmtDateTime(e.doh.at))} · ${esc(e.doh.by || '')}</p>` : `<p class="sm">${esc(t('dohFilledAt', S.fmtDateTime(e.doh.at)))}${S.dohYes(e.doh) ? ` · <b style="color:var(--bad)">${esc(t('dohYesHint'))}</b>` : ''}</p>`) : `<p class="sm mute">${esc(t('dohMissing'))}</p>`}
        <div class="row">${e.doh && !e.doh.paper ? `<button class="btn ghost sm" data-a="doh">👁 ${esc(t('view'))}</button>` : ''}${!e.doh && can('practical.save') && !locked ? `<button class="btn ghost sm" data-a="dohPaper">📄 ${esc(t('dohMarkPaper'))}</button>` : ''}${e.doh?.paper && can('practical.save') && !locked && !e.prac ? `<button class="btn ghost sm" data-a="dohUnpaper">${esc(t('undo'))}</button>` : ''}${e.doh && !e.doh.paper && can('test.review') && !locked ? `<button class="btn ghost sm" data-a="dohReset">↺ ${esc(t('dohReset'))}</button>` : ''}</div></div>` : ''}
      ${sh ? `<div class="card" style="box-shadow:none"><div class="ch"><h3>4. ${esc(t('practical'))}: ${esc(sh.name)}</h3><span class="grow"></span>${pracBadge(e.prac)}</div>${e.prac ? `<p class="sm">${esc(t('total'))}: <b>${e.prac.total}${e.prac.max ? ' / ' + (sh.mode === 'penalty' ? sh.rule.maxPenalty : e.prac.max) : ''}</b> · ${esc(e.prac.examiner || '')} · ${esc(S.fmtDateTime(e.prac.at))}</p>` : ''}
        ${(() => { const sg = D.signs?.prac?.[tid] || {}; return sg.examiner || sg.candidate ? `<p class="xs" style="color:var(--ok)">${sg.examiner ? `✔ ${esc(t('signedBy'))} ${esc(sg.examiner.name)} · ${esc(S.fmtDateTime(sg.examiner.at))} · <span class="mono">${esc(sg.examiner.code)}</span>` : ''}${sg.candidate ? `<br>✔ ${esc(t('candSigned'))} · ${esc(S.fmtDateTime(sg.candidate.at))}` : ''}</p>` : ''; })()}
        ${!e.doh && !e.prac ? `<p class="xs" style="color:var(--bad)">${esc(t('needDohFirst'))}</p>` : ''}<div class="row">${edit && !locked && e.att && e.doh ? `<button class="btn ghost sm" data-a="prac">${esc(e.prac ? t('editSheet') : t('fillSheet'))}</button>` : ''}${e.prac ? `<button class="btn ghost sm" data-a="pracPrint">🖨 ${esc(t('print'))}</button>` : ''}</div></div>` : ''}
      <div class="card" style="box-shadow:none"><h3>${sh ? 5 : 4}. ${esc(t('examResult'))}</h3>
        ${o.reason === 'practical' ? `<div class="banner bad">${esc(t('practicalAutoFail'))}</div>` : o.outcome === 'ABSENT' ? `<div class="banner warn">${esc(t('absentNote'))}</div>` : o.outcome === 'PENDING_PRACTICAL' ? `<div class="banner warn">${esc(t('needPracticalFirst'))}</div>` : `
        <div class="row"><label class="chk"><input type="radio" name="ex" value="1" ${e.exam?.passed === true ? 'checked' : ''} ${!edit || locked ? 'disabled' : ''}> ${esc(t('pass'))}</label><label class="chk"><input type="radio" name="ex" value="0" ${e.exam?.passed === false ? 'checked' : ''} ${!edit || locked ? 'disabled' : ''}> ${esc(t('fail'))}</label>
        <label style="margin:0;width:110px">${esc(t('score'))}<input id="xs" type="number" min="0" max="1000" value="${e.exam?.score ?? ''}" ${!edit || locked ? 'disabled' : ''}></label><label style="margin:0;flex:1;min-width:160px">${esc(t('note'))}<input id="xn" maxlength="500" value="${esc(e.exam?.note)}" ${!edit || locked ? 'disabled' : ''}></label></div>
        ${edit && !locked ? `<button class="btn sm" data-a="exam" style="margin-top:8px">${esc(t('saveResult'))}</button>` : ''}`}
        ${e.test ? `<div class="banner sm" style="margin-top:10px">📝 <b>${esc(e.test.title || t('test'))}</b> · ${e.test.at ? (e.test.status === 'graded' ? `${badge(e.test.passed ? 'PASS' : 'FAIL', t(e.test.passed ? 'pass' : 'fail'))} ${e.test.pct}% · ${esc(e.test.gradedBy === 'auto' ? t('gradedAuto') : t('reviewedBy', e.test.gradedBy))}` : badge('PENDING', t('needsReview'))) : esc(t('testStartedAt', S.fmtDateTime(e.test.startedAt)))}
          <div class="row" style="margin-top:6px">${e.test.at ? `<button class="btn ${e.test.status === 'review' && can('test.review') ? '' : 'ghost'} sm" data-a="test">${esc(e.test.status === 'review' && can('test.review') ? '✎ ' + t('reviewTest') : '👁 ' + t('viewAnswers'))}</button>` : ''}${can('test.review') && !locked ? `<button class="btn ghost sm" data-a="testReset">↺ ${esc(t('testReset'))}</button>` : ''}</div></div>` : D.session.examMode === 'bank' ? `<p class="mute xs" style="margin-bottom:0">📝 ${esc(t('testNotTaken'))}</p>` : ''}
        ${D.session.examLink ? `<p class="mute xs" style="margin-bottom:0">${esc(t('examLink'))}: <a href="${esc(D.session.examLink)}" target="_blank" rel="noopener">${esc(D.session.examLink)}</a></p>` : ''}</div>
      <div class="banner ${e.final ? (e.final.outcome === 'PASS' ? 'ok' : 'bad') : ''}"><b>${esc(t('outcome'))}:</b> ${e.final ? badge(e.final.outcome, t('rel_' + e.final.outcome)) + (e.final.certNo ? ` <span class="mono">${esc(e.final.certNo)}</span>` : '') : outcomeBadge(o.outcome)}</div>`;
    /** @type {any[]} */
    const buttons = [{ label: t('close'), cls: 'ghost', id: 'x' }];
    if (can('delete')) buttons.unshift({ label: '🗑 ' + t('removeFromSession'), cls: 'bad ghost', fn: async d => { d._v = 'del'; d.close(); return false; } });
    if (certOf(e)) buttons.unshift({ label: '📜 ' + t('viewCert'), fn: async () => { previewCert(certOf(e)); return false; } });
    if (can('issue') && !e.final) buttons.unshift({ label: t('release'), cls: o.outcome.startsWith('PENDING') ? 'ghost' : 'ok', id: 'rel' });
    if (can('issue') && e.final && !e.final.certNo) buttons.unshift({ label: t('reopen'), cls: 'ghost', fn: async d => { await api('/enr/reopen', { kind: 'staff', body: { sid: id, tid } }); d._v = 'reload'; d.close(); return false; } });
    const m = openModal({ title: personName(x), wide: true, html, buttons, onMount: d => d.addEventListener('click', async ev => {
      const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
      const run = async fn => { try { await fn(); d._v = 'reload'; d.close(); } catch (/** @type {any} */ er) { toast(t(er.message) === er.message ? t('server') : t(er.message), 'bad'); } };
      if (a === 'confirm' || a === 'unconfirm') run(() => api('/enr/confirm', { kind: 'staff', body: { sid: id, tid, undo: a === 'unconfirm' } }));
      if (a === 'exam') { const v = d.querySelector('[name=ex]:checked'); if (!v) return toast(t('chooseResult'), 'bad'); run(() => api('/enr/exam', { kind: 'staff', body: { sid: id, tid, passed: v.value === '1', score: d.querySelector('#xs').value === '' ? null : Number(d.querySelector('#xs').value), note: d.querySelector('#xn').value } })); }
      if (a === 'prac') { d._v = 'prac'; d.close(); }
      if (a === 'doh') dohView(tid);
      if (a === 'test') { d._v = 'x'; d.close(); testView(tid); }
      if (a === 'dohPaper' || a === 'dohUnpaper') run(() => api('/enr/doh/paper', { kind: 'staff', body: { sid: id, tid, on: a === 'dohPaper' } }));
      if (a === 'dohReset' && await confirmDlg(t('dohResetConfirm'), { danger: true })) run(() => api('/enr/doh/reset', { kind: 'staff', body: { sid: id, tid } }));
      if (a === 'testReset' && await confirmDlg(t('testResetConfirm'), { danger: true })) run(() => api('/test/reset', { kind: 'staff', body: { sid: id, tid } }));
      if (a === 'pracPrint') printHtml(practicalHtml({ sheet: sh, prac: e.prac, candidate: { az: S.fullAz(x), en: S.fullEn(x), att: x.att }, session: s, blank: blank(s.bid), info: info(), assets: A.assets, company: coName(x.co), exam: e.exam, signs: D.signs?.prac?.[tid] || {} }), sh.name);
    }) });
    m.promise.then(async v => { if (v === 'reload') { await refresh(); review(tid); } else if (v === 'rel') releaseDlg(tid); else if (v === 'prac') pracDlg(tid); else if (v === 'del') { if (await deleteRecord('enrol', id + '|' + tid, { name: personName(x) })) { await refresh(); } } });
  }
  function pracDlg(tid) {
    const s = D.session, sh = sheet(s.sheetId), e = enrOf(tid), x = trainee(tid), pf = practicalForm(sheet(s.sheetId), e.prac, { candidate: personName(x), att: x.att, examiner: e.prac?.examiner || A.me.email, auto: { candidate: personName(x), company: coName(x.co), date: S.fmtDate(s.date), learnerNo: x.att, training: blank(s.bid)?.name || '', location: s.location || '' } });
    let ctl; const m = openModal({ title: sh.name, wide: true, html: pf.html, onMount: d => (ctl = pf.bind(d)), buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('saveSheet'), id: 'ok', fn: async d => { const body = ctl.collect(); await api('/enr/practical', { kind: 'staff', body: { sid: id, tid, data: body } }); return true; } }] });
    m.promise.then(async v => { if (v === 'ok') await refresh(); review(tid); });
  }

  async function releaseDlg(tid) {
    const v = await releaseFlow(D.session, enrOf(tid), tid);
    if (!v) return review(tid);
    await refresh(); if (v.cert) showReleased(v.cert);
  }

  draw();
  el.onclick = e => { const r = e.target.closest('tr[data-t],button[data-t]'); if (r && el.contains(r) && e.target.closest('tbody')) review(r.dataset.t); };
}
