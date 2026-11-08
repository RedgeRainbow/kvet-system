/* Admin portal state + shared helpers. */
import { api } from '../api.js';
import * as S from '../shared.js';
import { $, $$, esc, t, lang, toast, fail, busy, openModal, confirmDlg, download, csvCell, empty, badge, opts, norm, paged, pagerHtml, pageState, resetPage, onPage } from '../ui.js';
import { slipsHtml, printHtml, htmlToPdf } from '../cert.js';
import { writeXlsx } from '../xlsx.js';
import { personForm, bindPerson } from '../person.js';

/** the office panel's copy of what GET /state returned (shapes are the API's, not the stored records)
 * @type {Record<string, any>} */
export const A = { role: 'reader', me: {}, today: '', settings: {}, assets: {}, blanks: [], sheets: [], materials: [], companies: [], trainers: [], trainees: [], sessions: [], certs: null };
export const can = a => S.can(A.role, a);
export const info = () => ({ ...(A.settings.company || {}) });

/* Start-up data: settings, library, directories and the RECENT sessions (A.sessionsSince and later). Trainees and
   certificates are not held whole (they grow every year): pages search them on the server, and the people a page shows
   are kept in A.people (filled from server answers; ensurePeople() fetches the missing ones). */
export async function load() {
  const d = await api('/state', { kind: 'staff' });
  Object.assign(A, d); A.certs = null; return A;
}
A.people = new Map();
export const rememberPeople = list => { for (const x of list || []) if (x?.id) A.people.set(x.id, x); return list; };
export async function ensurePeople(ids) {
  const miss = [...new Set((ids || []).filter(id => id && !A.people.has(id)))];
  for (let i = 0; i < miss.length; i += 2000) rememberPeople((await api('/people', { kind: 'staff', body: { ids: miss.slice(i, i + 2000) } })).list);
}
/* certificates from the server: filters { st, bid, co, q, issued, exp, tid, sid, nos, page, size, all, counts } */
export const findCerts = (p = {}) => api('/certs?' + new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)])), { kind: 'staff' });
export const findTrainees = (p = {}) => api('/trainees/find?' + new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '' && v !== null)), { kind: 'staff' }).then(r => { rememberPeople(r.list); return r; });
/* The panel holds the recent sessions; older ones are fetched when a page needs them (a period, the calendar, "older"). */
const dayBefore = (d, n = 1) => new Date(Date.parse(d + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);
export async function ensureSessionsFrom(from) {
  if (!A.sessionsSince || !from || from >= A.sessionsSince) return false;
  const have = new Set(A.sessions.map(s => s.id));
  for (let to = dayBefore(A.sessionsSince); to >= from; ) {                     // a year per request
    const a = [from, dayBefore(to, 365)].sort().at(-1), r = await api(`/sessions/find?from=${a}&to=${to}`, { kind: 'staff' });
    for (const s of r.sessions) if (!have.has(s.id)) { A.sessions.push(s); have.add(s.id); }
    A.sessionsSince = a; to = dayBefore(a);
  }
  A.sessions.sort((x, y) => (x.date < y.date ? 1 : -1)); return true;
}
export const moreSessions = () => (A.counts?.sessions ?? 0) > A.sessions.length;
/* how many sessions use each template / sheet / presentation / test (library pages) */
export const loadUsage = async () => (A.usage = await api('/usage', { kind: 'staff' }));
export const by = (list, id) => list.find(x => x.id === id);
export const blank = id => by(A.blanks, id), sheet = id => by(A.sheets, id), trainee = id => A.people.get(id), trainer = id => by(A.trainers, id), company = id => by(A.companies, id), session = id => by(A.sessions, id);
export const coName = id => (id && company(id)?.name) || '';
export const nameAz = x => (x ? S.fullAz(x) : ''), nameEn = x => (x ? S.fullEn(x) : '');
export const personName = x => (x ? (x.foreign ? S.fullEn(x) : S.fullAz(x)) || `(${t('noName')})` : '—');
export const trainerName = id => { const x = trainer(id); return x ? S.fullAz(x, false) : '—'; };
export const statusBadge = s => badge(s, t('st_' + s));
export const stBadge = c => badge(c, t('cs_' + c));
/* PASS / FAIL / PENDING_* with the organisation's rules (feedback required or not) */
export const outcomeOf = (e, s) => S.computeOutcome(e, s, { fbRequired: A.settings.fbRequired !== false });
export const outcomeBadge = o => badge(o === 'PASS' ? 'PASS' : o === 'FAIL' || o === 'ABSENT' ? 'FAIL' : 'PENDING', t('oc_' + o));
export const pracBadge = p => (p ? badge(p.result === 'PASS' ? 'PASS' : p.result === 'FAIL' ? 'FAIL' : 'PENDING', t('pr_' + p.result)) : badge('', '—'));

export function matches(q, ...fields) { const n = norm(q).trim(); if (!n) return true; const hay = norm(fields.join(' ')); return n.split(/\s+/).every(w => hay.includes(w)); }

/* ---------------------------------------------------------- person fields */
export const personFields = (p = {}, o = {}) => personForm(p, { companies: A.companies, finView: can('fin.view'), ...o });
export { bindPerson };

/* --------------------------------------------------------- credentials UI */
/* One-time passwords: show, copy, print slips, export. list = [{name, login, password}] */
export function showCreds(list, { kind = 'trainee', title = t('credsTitle'), meta = {} } = {}) {
  const rows = list.map(c => `<tr><td>${esc(c.name)}</td><td class="mono">${esc(c.login)}</td><td class="mono b">${esc(c.password)}</td></tr>`).join('');
  return openModal({ title, wide: list.length > 3, html: `<div class="banner warn">${esc(t('credsOnce'))}</div><div class="tw"><table><thead><tr><th>${esc(t('name'))}</th><th>${esc(t('login'))}</th><th>${esc(t('password'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    buttons: [
      { label: t('copy'), cls: 'ghost', fn: async () => { await navigator.clipboard?.writeText(list.map(c => `${c.name}\t${c.login}\t${c.password}`).join('\n')); toast(t('copied'), 'ok'); return false; } },
      { label: t('downloadExcel'), cls: 'ghost', fn: async () => { download(await writeXlsx([{ name: 'Credentials', rows: [[t('name'), t('login'), t('password')], ...list.map(c => [c.name, c.login, c.password])], widths: [38, 22, 16], textCols: [1, 2] }]), 'credentials.xlsx'); return false; } },
      { label: t('printSlips'), cls: 'ghost', fn: async () => { await printHtml(slipsHtml(list, { info: info(), assets: A.assets, portal: kind, meta }), 'slips'); return false; } },
      { label: t('close'), id: 'ok' }] }).promise;
}

/* ------------------------------------------------------------- delete helper
   Asks the server what the delete would also remove (dry run), shows it in the confirm dialog, then deletes. Certificates are archived, never lost.
   Resolves true when something was deleted. */
export async function deleteRecord(kind, id, { name = '' } = {}) {
  let imp;
  try { imp = (await api('/delete', { kind: 'staff', body: { kind, id, dry: true } })).impact; } catch (/** @type {any} */ e) { toast(e.message === 'noRec' ? t('noRec') : t('server'), 'bad'); return false; }
  const line = (n, k) => (n ? `<li>${esc(t(k, n))}</li>` : '');
  const also = [line(imp.sessions - (kind === 'session' ? 1 : 0), 'delN_sessions'), line(imp.enrolments, 'delN_enrolments'), line(imp.trainees - (kind === 'trainee' ? 1 : 0), 'delN_trainees')].join('');
  const keep = [line(imp.certs, 'delN_certs'), line(imp.unlinkedSessions, 'delN_unlinkedSessions'), line(imp.unlinkedTrainees, 'delN_unlinkedTrainees'), line(imp.unlinkedCerts, 'delN_unlinkedCerts')].join('');
  const ok = await openModal({ title: t('deleteTitle'), html: `<p><b>${esc(name)}</b></p><p>${esc(t('deleteWarn'))}</p>${also ? `<p class="b sm" style="margin-bottom:2px">${esc(t('deleteAlso'))}</p><ul style="margin-top:0">${also}</ul>` : ''}${keep ? `<p class="b sm" style="margin-bottom:2px">${esc(t('deleteKept'))}</p><ul style="margin-top:0">${keep}</ul>` : ''}<p class="mute sm">${esc(t('deleteUndo'))}</p>`,
    buttons: [{ label: t('cancel'), cls: 'ghost', id: false }, { label: t('delete'), cls: 'bad', id: true }] }).promise;
  if (ok !== true) return false;
  try { await api('/delete', { kind: 'staff', body: { kind, id } }); await load(); toast(t('deleted'), 'ok'); return true; } catch (/** @type {any} */ e) { toast(t(e.message) === e.message ? t('server') : t(e.message), 'bad'); return false; }
}

/* ------------------------------------------------- batch select / delete
   List pages: a checkbox per row, one in the header (the rows shown), "select all that match the filters", then delete them
   together. sel is a Set of ids kept by the page; the bar is redrawn by the page after each change. */
export const selHead = () => `<th class="sel"><input type="checkbox" id="selAll" aria-label="${esc(t('selectShown'))}"></th>`;
export const selCell = (id, sel) => `<td class="sel"><input type="checkbox" data-sel="${esc(id)}" ${sel.has(id) ? 'checked' : ''} aria-label="${esc(t('select'))}"></td>`;
/** @param {any} [sel] @param {any} o1 */
export function batchBar(sel, { total = 0, canDelete = can('delete') } = {}) {
  if (!sel.size) return `<div id="bb"></div>`;
  return `<div id="bb" class="batchbar"><b>${esc(t('nSelected', sel.size))}</b>${total > sel.size ? `<button class="btn ghost sm" data-bb="all">☑ ${esc(t('selectAllMatching', total))}</button>` : ''}<button class="btn ghost sm" data-bb="none">✕ ${esc(t('clearSelection'))}</button><span class="grow"></span>${canDelete ? `<button class="btn bad sm" data-bb="del">🗑 ${esc(t('deleteSelected', sel.size))}</button>` : ''}</div>`;
}
/* rows(): ids shown now · allIds(): every id that matches the filters · del(ids) · redraw() after a change */
export function bindBatch(root, sel, { rows, allIds, del, redraw }) {
  const sync = () => { const r = rows(), a = $('#selAll', root); if (a) { a.checked = r.length > 0 && r.every(id => sel.has(id)); a.indeterminate = !a.checked && r.some(id => sel.has(id)); } };
  root.addEventListener('change', e => {
    const c = e.target.closest('[data-sel]'); if (c) { c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); sync(); return redraw(); }
    if (e.target.id === 'selAll') { const on = e.target.checked; for (const id of rows()) on ? sel.add(id) : sel.delete(id); $$('[data-sel]', root).forEach(i => { i.checked = on; }); return redraw(); }
  });
  root.addEventListener('click', async e => {
    const c = e.target.closest('td.sel'); if (c) e.stopPropagation();           // a row click opens the record; the checkbox cell does not
    const b = e.target.closest('[data-bb]'); if (!b) return;
    if (b.dataset.bb === 'none') { sel.clear(); $$('[data-sel]', root).forEach(i => { i.checked = false; }); sync(); return redraw(); }
    if (b.dataset.bb === 'all') { await busy(b, async () => { for (const id of await allIds()) sel.add(id); }); $$('[data-sel]', root).forEach(i => { i.checked = sel.has(i.dataset.sel); }); sync(); return redraw(); }
    if (b.dataset.bb === 'del') { if (await del([...sel])) sel.clear(); }
  }, true);
  return sync;
}
/* Delete many records of one kind: shows what goes with them (sessions, enrolments; certificates are archived), asks to type
   DELETE for more than 20, takes a backup first (server). Resolves true when deleted. */
export async function deleteMany(kind, ids) {
  if (!ids.length) return false;
  let imp; try { imp = (await api('/delete/many', { kind: 'staff', body: { kind, ids, dry: true } })).impact; } catch (/** @type {any} */ e) { fail(e); return false; }
  const line = (n, k) => (n ? `<li>${esc(t(k, n))}</li>` : '');
  const own = { trainee: 'trainees', trainer: 'trainers', company: 'companies', session: 'sessions' }[kind];
  const also = [line(kind === 'session' ? 0 : imp.sessions, 'delN_sessions'), line(imp.enrolments, 'delN_enrolments'), line(kind === 'trainee' ? 0 : imp.trainees, 'delN_trainees')].join('');
  const keep = [line(imp.certs, 'delN_certs'), line(imp.unlinkedSessions, 'delN_unlinkedSessions'), line(imp.unlinkedTrainees, 'delN_unlinkedTrainees'), line(imp.unlinkedCerts, 'delN_unlinkedCerts')].join('');
  const big = ids.length > 20;
  const ok = await openModal({ title: t('deleteTitle'), html: `<p><b>${esc(t('batchDeleteN', imp[own] ?? ids.length))}</b></p><p>${esc(t('deleteWarn'))}</p>${also ? `<p class="b sm" style="margin-bottom:2px">${esc(t('deleteAlso'))}</p><ul style="margin-top:0">${also}</ul>` : ''}${keep ? `<p class="b sm" style="margin-bottom:2px">${esc(t('deleteKept'))}</p><ul style="margin-top:0">${keep}</ul>` : ''}
    ${big ? `<p class="hint">${esc(t('batchBackupNote'))}</p><label>${esc(t('typeDelete'))}<input id="dt" autocomplete="off" placeholder="DELETE"></label>` : ''}<div class="err" id="de" role="alert"></div>`,
    buttons: [{ label: t('cancel'), cls: 'ghost', id: false }, { label: t('delete'), cls: 'bad', id: true, fn: d => { if (big && $('#dt', d).value.trim().toUpperCase() !== 'DELETE') { $('#de', d).textContent = t('typeDelete'); return false; } return true; } }] }).promise;
  if (ok !== true) return false;
  try { await api('/delete/many', { kind: 'staff', body: { kind, ids, confirm: 'DELETE' } }); await load(); toast(t('deletedN', ids.length), 'ok'); return true; } catch (/** @type {any} */ e) { toast(t(e.message) === e.message ? t('server') : t(e.message), 'bad'); return false; }
}
/* the filter panel: a "Filters" button that shows / hides a row of fields; n = filters in use */
export const filterToggle = (n, open) => `<button type="button" class="btn ghost sm ${n ? 'on' : ''}" id="fTog" aria-expanded="${open}">⚙ ${esc(t('filters'))}${n ? ` <span class="bd info">${n}</span>` : ''}</button>`;
export const inRange = (iso, from, to) => (!from || (iso || '').slice(0, 10) >= from) && (!to || ((iso || '').slice(0, 10) <= to && !!iso));

/* filter fields marked data-f="<key>" write into st and redraw; #fTog shows / hides the panel; #fx clears */
export function bindFilters(root, st, keys, count, redraw) {
  const tog = () => { const b = $('#fTog', root); b.outerHTML = filterToggle(count(), st.open); $('#fTog', root).onclick = () => { st.open = !st.open; $('#fp', root).classList.toggle('hide', !st.open); $('#fTog', root).setAttribute('aria-expanded', String(st.open)); }; };
  $$('[data-f]', root).forEach(i => { i.onchange = () => { st[i.dataset.f] = i.value; tog(); redraw(); }; });
  $('#fx', root).onclick = () => { for (const k of keys) st[k] = ''; $$('[data-f]', root).forEach(i => { i.value = ''; }); tog(); redraw(); };
  tog();
}

/* --------------------------------------------------------------- misc UI */
export const pageHead = (title, actions = '') => `<div class="page-h"><h1>${esc(title)}</h1>${actions}</div>`;
export const bar = (...x) => `<div class="bar">${x.join('')}</div>`;
export const searchBox = (id, val = '') => `<input class="sr-in" id="${id}" type="search" value="${esc(val)}" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}">`;
export const tabs = (list, cur, attr = 'data-tab') => `<div class="tabs" role="tablist">${list.map(([k, label, n]) => `<button class="tab ${k === cur ? 'on' : ''}" ${attr}="${esc(k)}" role="tab">${esc(label)}${n !== undefined ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
export const savedToast = () => toast(t('saved'), 'ok');
export const view = () => $('#view');
export function copyText(s) { navigator.clipboard?.writeText(s); toast(t('copied'), 'ok'); }
export { paged, pagerHtml, pageState, resetPage, onPage };
export { api, S, $, $$, esc, t, lang, toast, fail, busy, openModal, confirmDlg, download, csvCell, empty, badge, opts, norm, writeXlsx, printHtml, htmlToPdf };
