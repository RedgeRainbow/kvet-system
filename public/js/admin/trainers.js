import { deleteRecord, A, can, view, api, S, $, esc, t, openModal, confirmDlg, empty, badge, matches, personFields, bindPerson, showCreds, pageHead, bar, searchBox, load, savedToast, opts, selHead, selCell, batchBar, bindBatch, deleteMany, filterToggle, inRange, bindFilters, paged, onPage } from './lib.js';

const F = { q: '', on: '', from: '', to: '', sess: '', sort: '', open: false }, SEL = new Set();
export default async function ({ rerender }) {
  const el = view(), st = F, canDel = can('delete');
  const nF = () => ['on', 'from', 'to', 'sess'].filter(k => st[k]).length, nSess = id => A.sessions.filter(s => s.tid === id).length;
  const filtered = () => {
    const l = A.trainers.filter(x => matches(st.q, S.fullAz(x), S.fullEn(x), x.specialty, x.phone) && (!st.on || (st.on === 'on') === (x.on !== false)) && inRange(x.createdAt, st.from, st.to) && (!st.sess || (st.sess === 'yes') === nSess(x.id) > 0));
    return st.sort === 'name' ? l.sort((a, b) => S.fullAz(a).localeCompare(S.fullAz(b))) : st.sort === 'old' ? l.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')) : l.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  };
  el.innerHTML = `<div id="pgw">${pageHead(t('navTrainers'), can('trainer.save') ? `<button class="btn" id="add">＋ ${esc(t('addTrainer'))}</button>` : '')}${bar(searchBox('q', st.q), filterToggle(nF(), st.open), `<span class="mute sm" id="cnt"></span>`)}
    <div class="card filters ${st.open ? '' : 'hide'}" id="fp"><div class="fg f4">
      <label>${esc(t('status'))}<select data-f="on">${opts([['on', t('active')], ['off', t('disabled')]], st.on, t('allStatuses'))}</select></label>
      <label>${esc(t('navSessions'))}<select data-f="sess">${opts([['yes', t('withSessions')], ['no', t('withoutSessions')]], st.sess, t('all'))}</select></label>
      <label>${esc(t('registeredFrom'))}<input type="date" data-f="from" value="${esc(st.from)}"></label><label>${esc(t('registeredTo'))}<input type="date" data-f="to" value="${esc(st.to)}"></label>
      <label>${esc(t('sortBy'))}<select data-f="sort">${opts([['old', t('sortOldest')], ['name', t('sortName')]], st.sort, t('sortNewest'))}</select></label>
      <div class="row" style="align-items:flex-end"><button type="button" class="btn ghost sm" id="fx">✕ ${esc(t('clearFilters'))}</button></div></div></div>
    <div id="bb"></div><div class="tw"><table><thead><tr>${canDel ? selHead() : ''}<th>${esc(t('fullName'))}</th><th>${esc(t('specialty'))}</th><th>${esc(t('mobile'))}</th><th>${esc(t('login'))}</th><th>${esc(t('navSessions'))}</th><th>${esc(t('registered'))}</th><th></th></tr></thead><tbody id="tb"></tbody></table></div><div id="pgr"></div></div>`;
  const bbar = () => { $('#bb').outerHTML = batchBar(SEL, { total: filtered().length }); };
  const draw = () => { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const list = filtered(), P = paged('trainers', list, JSON.stringify({ ...st, open: 0 })); for (const id of SEL) if (!A.trainers.some(x => x.id === id)) SEL.delete(id);
    $('#tb').innerHTML = P.rows.map(x => `<tr>${canDel ? selCell(x.id, SEL) : ''}<td><b>${esc(S.fullAz(x))}</b>${x.on === false ? ' ' + badge('bad', t('disabled')) : ''}<br><span class="mute xs">${esc(S.fullEn(x))}</span></td><td>${esc(x.specialty || '')}</td><td>${esc(x.phone || '')}</td><td class="mono">${esc(x.login)}</td><td>${nSess(x.id)}</td><td class="nowrap mute xs">${x.createdAt ? esc(S.fmtDateTime(x.createdAt)) : '—'}</td>
      <td class="act">${can('trainer.save') ? `<button class="btn ghost sm" data-e="${esc(x.id)}">${esc(t('edit'))}</button> ` : ''}${can('credentials.reset') ? `<button class="btn ghost sm" data-r="${esc(x.id)}">🔑</button> ` : ''}${canDel ? `<button class="btn bad ghost sm" data-d="${esc(x.id)}">🗑</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="8">${empty('🎓', nF() || st.q ? t('noMatch') : t('noTrainers'))}</td></tr>`;
    $('#cnt').textContent = list.length + ' / ' + A.trainers.length; $('#pgr').innerHTML = P.html; bbar(); sync();
  };
  onPage('trainers', draw);
  const sync = canDel ? bindBatch($('#pgw'), SEL, { rows: () => paged('trainers', filtered(), JSON.stringify({ ...st, open: 0 })).rows.map(x => x.id), allIds: async () => filtered().map(x => x.id), del: async ids => { if (await deleteMany('trainer', ids)) { SEL.clear(); rerender(); return true; } return false; }, redraw: bbar }) : () => {};
  bindFilters($('#pgw'), st, ['on', 'from', 'to', 'sess', 'sort'], nF, draw);
  draw(); $('#q').oninput = e => { st.q = e.target.value; draw(); };
  const form = p => openModal({ title: p ? t('editTrainer') : t('addTrainer'), wide: true, html: `<form id="pf">${personFields(p || {}, { specialty: true, foreign: false })}</form><div class="err" id="pe" role="alert"></div>`, onMount: d => bindPerson($('#pf', d)),
    buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
      const f = $('#pf', d), body = { ...Object.fromEntries(new FormData(f)), on: f.on.checked, id: p?.id };
      try { const r = await api('/trainer/save', { kind: 'staff', body }); await load(); if (r.creds) { d._v = 'ok'; d.close(); await showCreds([{ name: S.fullAz(r.trainer), login: r.creds.login, password: r.creds.password }], { kind: 'trainer' }); } else savedToast(); rerender(); return true; }
      catch (/** @type {any} */ e) { $('#pe', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] });
  $('#add')?.addEventListener('click', () => form());
  $('#tb').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.e) form(A.trainers.find(x => x.id === b.dataset.e));
    if (b.dataset.r) { if (!await confirmDlg(t('resetConfirm'))) return; const r = await api('/credentials/reset', { kind: 'staff', body: { kind: 'trainer', ids: [b.dataset.r] } }); showCreds(r.list.map(c => ({ name: c.name, login: c.login, password: c.password })), { kind: 'trainer' }); }
    if (b.dataset.d) { { const rec = { trainer: A.trainers, company: A.companies, blank: A.blanks, sheet: A.sheets, material: A.materials }['trainer']?.find(q => q.id === b.dataset.d); if (await deleteRecord('trainer', b.dataset.d, { name: rec?.name || rec?.title || (rec && S.fullAz(rec)) || '' })) rerender(); } }
  };
}
