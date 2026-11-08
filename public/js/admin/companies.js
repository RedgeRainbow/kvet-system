import { fail, findTrainees, findCerts, deleteRecord, A, can, view, api, S, $, esc, t, openModal, confirmDlg, empty, badge, matches, showCreds, pageHead, bar, searchBox, load, savedToast, opts, selHead, selCell, batchBar, bindBatch, deleteMany, filterToggle, inRange, bindFilters, paged, onPage } from './lib.js';

const F = { q: '', on: '', from: '', to: '', cfrom: '', cto: '', sort: '', open: false }, SEL = new Set();
export default async function ({ rerender }) {
  const el = view(), st = F, canDel = can('delete');
  const nF = () => ['on', 'from', 'to', 'cfrom', 'cto'].filter(k => st[k]).length;
  const filtered = () => {
    const l = A.companies.filter(x => matches(st.q, x.name, x.contactPerson, x.contractNo, x.phone, x.taxId) && (!st.on || (st.on === 'on') === (x.on !== false)) && inRange(x.createdAt, st.from, st.to) && inRange(x.contractDate, st.cfrom, st.cto));
    return st.sort === 'name' ? l.sort((a, b) => a.name.localeCompare(b.name)) : st.sort === 'old' ? l.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')) : st.sort === 'contract' ? l.sort((a, b) => (b.contractDate || '').localeCompare(a.contractDate || '')) : l.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  };
  el.innerHTML = `<div id="pgw">${pageHead(t('navCompanies'), can('company.save') ? `<button class="btn" id="add">＋ ${esc(t('addCompany'))}</button>` : '')}${bar(searchBox('q', st.q), filterToggle(nF(), st.open), `<span class="mute sm" id="cnt"></span>`)}
    <div class="card filters ${st.open ? '' : 'hide'}" id="fp"><div class="fg f4">
      <label>${esc(t('status'))}<select data-f="on">${opts([['on', t('active')], ['off', t('disabled')]], st.on, t('allStatuses'))}</select></label>
      <label>${esc(t('sortBy'))}<select data-f="sort">${opts([['old', t('sortOldest')], ['name', t('sortName')], ['contract', t('sortContract')]], st.sort, t('sortNewest'))}</select></label>
      <label>${esc(t('registeredFrom'))}<input type="date" data-f="from" value="${esc(st.from)}"></label><label>${esc(t('registeredTo'))}<input type="date" data-f="to" value="${esc(st.to)}"></label>
      <label>${esc(t('contractFrom'))}<input type="date" data-f="cfrom" value="${esc(st.cfrom)}"></label><label>${esc(t('contractTo'))}<input type="date" data-f="cto" value="${esc(st.cto)}"></label>
      <div class="row" style="align-items:flex-end"><button type="button" class="btn ghost sm" id="fx">✕ ${esc(t('clearFilters'))}</button></div></div></div>
    <div id="bb"></div><div class="tw"><table><thead><tr>${canDel ? selHead() : ''}<th>${esc(t('company'))}</th><th>${esc(t('contactPerson'))}</th><th>${esc(t('contract'))}</th><th>${esc(t('mobile'))}</th><th>${esc(t('login'))}</th><th>${esc(t('registered'))}</th><th></th></tr></thead><tbody id="tb"></tbody></table></div><div id="pgr"></div></div>`;
  const bbar = () => { $('#bb').outerHTML = batchBar(SEL, { total: filtered().length }); };
  const draw = () => { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const list = filtered(), P = paged('companies', list, JSON.stringify({ ...st, open: 0 })); for (const id of SEL) if (!A.companies.some(x => x.id === id)) SEL.delete(id);
    $('#tb').innerHTML = P.rows.map(x => `<tr class="click" data-v="${esc(x.id)}">${canDel ? selCell(x.id, SEL) : ''}<td><b>${esc(x.name)}</b>${x.on === false ? ' ' + badge('bad', t('disabled')) : ''}</td><td>${esc(x.contactPerson || '')}</td><td>${esc(x.contractNo || '')}${x.contractDate ? `<br><span class="mute xs">${esc(S.fmtDate(x.contractDate))}</span>` : ''}</td><td>${esc(x.phone || '')}</td><td class="mono">${esc(x.login)}</td><td class="nowrap mute xs">${x.createdAt ? esc(S.fmtDateTime(x.createdAt)) : '—'}</td>
      <td class="act">${can('company.save') ? `<button class="btn ghost sm" data-e="${esc(x.id)}">${esc(t('edit'))}</button> ` : ''}${can('credentials.reset') ? `<button class="btn ghost sm" data-r="${esc(x.id)}" title="${esc(t('resetPassword'))}">🔑</button> ` : ''}${canDel ? `<button class="btn bad ghost sm" data-d="${esc(x.id)}">🗑</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="8">${empty('🏢', nF() || st.q ? t('noMatch') : t('noCompanies'))}</td></tr>`;
    $('#cnt').textContent = list.length + ' / ' + A.companies.length; $('#pgr').innerHTML = P.html; bbar(); sync();
  };
  onPage('companies', draw);
  const sync = canDel ? bindBatch($('#pgw'), SEL, { rows: () => paged('companies', filtered(), JSON.stringify({ ...st, open: 0 })).rows.map(x => x.id), allIds: async () => filtered().map(x => x.id), del: async ids => { if (await deleteMany('company', ids)) { SEL.clear(); rerender(); return true; } return false; }, redraw: bbar }) : () => {};
  bindFilters($('#pgw'), st, ['on', 'from', 'to', 'cfrom', 'cto', 'sort'], nF, draw);
  draw(); $('#q').oninput = e => { st.q = e.target.value; draw(); };
  const form = p => { p ||= {}; return openModal({ title: p.id ? t('editCompany') : t('addCompany'), wide: true, html: `<form id="cf" class="fg">
    <label class="req full">${esc(t('companyName'))}<input name="name" value="${esc(p.name)}" required maxlength="120"></label>
    <label>${esc(t('contactPerson'))}<input name="contactPerson" value="${esc(p.contactPerson)}" maxlength="120"></label><label>${esc(t('mobile'))}<input name="phone" value="${esc(p.phone)}" inputmode="tel"></label>
    <label>${esc(t('email'))}<input name="email" type="email" value="${esc(p.email)}"></label><label>${esc(t('taxId'))}<input name="taxId" value="${esc(p.taxId)}" maxlength="30"></label>
    <label>${esc(t('contractNo'))}<input name="contractNo" value="${esc(p.contractNo)}" maxlength="60"></label><label>${esc(t('contractDate'))}<input name="contractDate" type="date" value="${esc(p.contractDate)}"></label>
    <label class="full">${esc(t('address'))}<input name="address" value="${esc(p.address)}" maxlength="250"></label><label class="full">${esc(t('notes'))}<textarea name="notes" maxlength="1000">${esc(p.notes)}</textarea></label>
    <label class="chk full"><input type="checkbox" name="reqOptional" ${p.reqOptional ? 'checked' : ''}> ${esc(t('coReqOptional'))}</label><p class="hint" style="margin:-4px 0 0">${esc(t('coReqOptionalHint'))}</p>
    <label class="chk full"><input type="checkbox" name="on" ${p.on === false ? '' : 'checked'}> ${esc(t('active'))}</label></form><div class="err" id="pe" role="alert"></div>`,
    buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
      const f = $('#cf', d); if (!f.reportValidity()) return false; const body = { ...Object.fromEntries(new FormData(f)), on: f.on.checked, reqOptional: f.reqOptional.checked, id: p.id };
      try { const r = await api('/company/save', { kind: 'staff', body }); await load(); if (r.creds) { d._v = 'ok'; d.close(); await showCreds([{ name: r.company.name, login: r.creds.login, password: r.creds.password }], { kind: 'company', title: t('credsTitle') }); } else savedToast(); rerender(); return true; }
      catch (/** @type {any} */ e) { $('#pe', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false; } } }] }); };
  $('#add')?.addEventListener('click', () => form());
  async function detail(c) {
    let k, ppl; try { [{ counts: k }, ppl] = await Promise.all([findCerts({ co: c.id, size: 0 }), findTrainees({ co: c.id, size: 200 })]); } catch (/** @type {any} */ e) { return fail(e); }
    openModal({ title: c.name, wide: true, html: `<div class="grid g4" style="margin-bottom:12px">${[['total', 'cTotal', ''], ['ACTIVE', 'cs_ACTIVE', 'ok'], ['SOON', 'cs_SOON', 'warn'], ['EXPIRED', 'cs_EXPIRED', 'bad']].map(([a, b, c2]) => `<div class="stat ${c2}"><b>${k[a]}</b><span>${esc(t(b))}</span></div>`).join('')}</div>
      <p><b>${esc(t('contactPerson'))}:</b> ${esc(c.contactPerson || '—')} · ${esc(c.phone || '')} ${esc(c.email || '')}<br><b>${esc(t('contract'))}:</b> ${esc(c.contractNo || '—')} ${esc(S.fmtDate(c.contractDate))}<br><b>${esc(t('login'))}:</b> <span class="mono">${esc(c.login)}</span></p>
      <h3>${esc(t('navTrainees'))} (${ppl.total})</h3><p>${ppl.list.map(r => esc(S.fullAz(r))).join(', ') || esc(t('none'))}${ppl.total > ppl.list.length ? ` … <a href="#/trainees/co=${esc(c.id)}">${esc(t('showAll'))}</a>` : ''}</p>`, buttons: [{ label: t('close'), id: 'x' }] });
  }
  $('#tb').onclick = async e => {
    const b = e.target.closest('button');
    if (!b) { const r = e.target.closest('tr[data-v]'); if (r) detail(A.companies.find(x => x.id === r.dataset.v)); return; }
    if (b.dataset.e) form(A.companies.find(x => x.id === b.dataset.e));
    if (b.dataset.r) { if (!await confirmDlg(t('resetConfirm'))) return; const r = await api('/credentials/reset', { kind: 'staff', body: { kind: 'company', ids: [b.dataset.r] } }); showCreds(r.list.map(c => ({ name: c.name, login: c.login, password: c.password })), { kind: 'company' }); }
    if (b.dataset.d) { { const rec = { trainer: A.trainers, company: A.companies, blank: A.blanks, sheet: A.sheets, material: A.materials }['company']?.find(q => q.id === b.dataset.d); if (await deleteRecord('company', b.dataset.d, { name: rec?.name || rec?.title || (rec && S.fullAz(rec)) || '' })) rerender(); } }
  };
}
