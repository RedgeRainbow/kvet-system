/* Candidate groups: saved lists of candidates that can be added to a session in one click. */
import { ensurePeople, findTrainees, A, can, view, api, S, $, esc, t, toast, fail, openModal, confirmDlg, empty, opts, matches, pageHead, bar, searchBox, load, savedToast, trainee, coName, personName, selHead, selCell, batchBar, bindBatch, filterToggle, inRange, bindFilters, paged, onPage } from './lib.js';

const F = { q: '', from: '', to: '', size: '', co: '', sort: '', open: false }, SEL = new Set();
export default async function ({ rerender }) {
  const el = view(), st = F, canDel = can('session.save');
  await ensurePeople((A.groups || []).flatMap(g => g.traineeIds));        // names of the members (one request)
  const nF = () => ['from', 'to', 'size', 'co'].filter(k => st[k]).length;
  const filtered = () => {
    const l = (A.groups || []).filter(g => matches(st.q, g.name, g.note, ...g.traineeIds.map(id => personName(trainee(id)))) && inRange(g.createdAt, st.from, st.to)
      && (!st.size || (st.size === 'empty' ? !g.traineeIds.length : st.size === 'small' ? g.traineeIds.length > 0 && g.traineeIds.length < 10 : g.traineeIds.length >= 10))
      && (!st.co || g.traineeIds.some(id => (trainee(id)?.co || '-') === st.co)));
    return st.sort === 'name' ? l.sort((a, b) => a.name.localeCompare(b.name)) : st.sort === 'old' ? l.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')) : st.sort === 'size' ? l.sort((a, b) => b.traineeIds.length - a.traineeIds.length) : l.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  };
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const list = filtered(), P = paged('groups', list, JSON.stringify({ ...st, open: 0 })); for (const id of SEL) if (!(A.groups || []).some(g => g.id === id)) SEL.delete(id);
    el.innerHTML = `<div id="pgw">` + pageHead(t('navGroups'), can('session.save') ? `<button class="btn" id="add">＋ ${esc(t('newGroup'))}</button>` : '') + `<p class="mute" style="margin-top:-8px">${esc(t('groupsIntro'))}</p>` + bar(searchBox('q', st.q), filterToggle(nF(), st.open), `<span class="mute sm">${list.length} / ${(A.groups || []).length}</span>`)
      + `<div class="card filters ${st.open ? '' : 'hide'}" id="fp"><div class="fg f4">
        <label>${esc(t('company'))}<select data-f="co">${opts([['-', t('private')], ...A.companies.map(c => [c.id, c.name])], st.co, t('allCompanies'))}</select></label>
        <label>${esc(t('groupSize'))}<select data-f="size">${opts([['empty', t('sizeEmpty')], ['small', t('sizeSmall')], ['big', t('sizeBig')]], st.size, t('all'))}</select></label>
        <label>${esc(t('createdFrom'))}<input type="date" data-f="from" value="${esc(st.from)}"></label><label>${esc(t('createdTo'))}<input type="date" data-f="to" value="${esc(st.to)}"></label>
        <label>${esc(t('sortBy'))}<select data-f="sort">${opts([['old', t('sortOldest')], ['name', t('sortName')], ['size', t('sortSize')]], st.sort, t('sortNewest'))}</select></label>
        <div class="row" style="align-items:flex-end"><button type="button" class="btn ghost sm" id="fx">✕ ${esc(t('clearFilters'))}</button></div></div></div>`
      + batchBar(SEL, { total: list.length, canDelete: canDel })
      + (list.length ? `<div class="tw"><table class="sortable"><thead><tr>${canDel ? selHead() : ''}<th>${esc(t('name'))}</th><th>${esc(t('trainees'))}</th><th>${esc(t('companies'))}</th><th>${esc(t('note'))}</th><th>${esc(t('created'))}</th><th></th></tr></thead><tbody>${P.rows.map(g => {
          const cos = [...new Set(g.traineeIds.map(id => coName(trainee(id)?.co) || t('private')))];
          return `<tr class="click" data-id="${esc(g.id)}">${canDel ? selCell(g.id, SEL) : ''}<td><b>${esc(g.name)}</b></td><td data-sort="${g.traineeIds.length}">${g.traineeIds.length}</td><td class="sm">${esc(cos.slice(0, 3).join(', '))}${cos.length > 3 ? ' …' : ''}</td><td class="sm mute">${esc(g.note || '')}</td><td class="nowrap mute xs" data-sort="${esc(g.createdAt || '')}">${g.createdAt ? esc(S.fmtDateTime(g.createdAt)) : '—'}</td><td class="act">${can('session.save') ? `<button class="btn bad ghost sm" data-del="${esc(g.id)}" aria-label="${esc(t('delete'))}">🗑</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>${P.html}`
        : `<div class="card">${empty('👥', (A.groups || []).length ? t('noMatch') : t('noGroups'))}</div>`) + `</div>`;
    $('#q').oninput = e => { st.q = e.target.value; const p = e.target.selectionStart; draw(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); };
    $('#add')?.addEventListener('click', () => editor(null));
    const bbar = () => { $('#bb').outerHTML = batchBar(SEL, { total: filtered().length, canDelete: canDel }); };
    onPage('groups', draw);
    if (canDel) bindBatch($('#pgw'), SEL, { rows: () => P.rows.map(g => g.id), allIds: async () => filtered().map(g => g.id), redraw: bbar,
      del: async ids => { if (!await confirmDlg(t('deleteGroupsConfirm', ids.length), { danger: true })) return false; try { await api('/groups/delete', { kind: 'staff', body: { ids } }); SEL.clear(); await load(); toast(t('deletedN', ids.length), 'ok'); draw(); return true; } catch (/** @type {any} */ er) { fail(er); return false; } } })();
    bindFilters($('#pgw'), st, ['from', 'to', 'size', 'co', 'sort'], nF, draw);
  }
  draw();
  el.onclick = async e => {
    const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); const g = A.groups.find(x => x.id === del.dataset.del); if (!await confirmDlg(t('deleteGroupConfirm', g.name), { danger: true })) return; try { await api('/group/delete', { kind: 'staff', body: { id: g.id } }); await load(); toast(t('deleted'), 'ok'); draw(); } catch (/** @type {any} */ er) { fail(er); } return; }
    const r = e.target.closest('tr[data-id]'); if (r) editor(A.groups.find(x => x.id === r.dataset.id));
  };

  function editor(g) {
    const sel = new Set(g?.traineeIds || []), ro = !can('session.save');
    openModal({ title: g ? g.name : t('newGroup'), wide: true, html: `<div class="fg"><label class="req">${esc(t('name'))}<input id="gn" value="${esc(g?.name || '')}" maxlength="120" ${ro ? 'disabled' : ''}></label><label>${esc(t('note'))}<input id="gt" value="${esc(g?.note || '')}" maxlength="500" ${ro ? 'disabled' : ''}></label></div>
      <div class="b sm mute" style="margin:8px 0 4px">${esc(t('trainees'))} — <span id="sc">0</span></div>
      ${ro ? '' : `<div class="bar" style="margin-bottom:6px"><input class="sr-in" id="pq" type="search" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}"><select id="pc" aria-label="${esc(t('company'))}">${opts([['-', t('private')], ...A.companies.map(c => [c.id, c.name])], '', t('allCompanies'))}</select><button type="button" class="btn ghost sm" id="pall">${esc(t('addShown'))}</button><button type="button" class="btn ghost sm" id="pnone">${esc(t('clearAll'))}</button></div>`}
      <div id="chips" style="margin-bottom:6px"></div>${ro ? '' : '<div class="pick" id="pl"></div>'}<div class="err" id="ge" role="alert"></div>`,
      onMount: d => {
        // candidates searched on the server, 150 at a time
        let found = [], seqP = 0, tmr = 0;
        const search = async () => { if (ro) return; const my = ++seqP; try { const r = await findTrainees({ q: $('#pq', d).value, co: $('#pc', d).value, on: 'on', size: 150 }); if (my === seqP) { found = r.list; paint(); } } catch (/** @type {any} */ e) { fail(e); } };
        const shown = () => found;
        const paint = () => {
          if (!ro) $('#pl', d).innerHTML = shown().map(x => `<label><input type="checkbox" data-t="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}> <span><b>${esc(personName(x))}</b> <span class="mute xs">${esc(x.att)} · ${esc(coName(x.co) || t('private'))}</span></span></label>`).join('') || `<p class="mute center">${esc(t('noTrainees'))}</p>`;
          $('#chips', d).innerHTML = [...sel].map(id => { const x = trainee(id); return x ? `<span class="chip">${esc(personName(x))}${ro ? '' : `<button type="button" data-x="${esc(id)}" aria-label="${esc(t('remove'))}">×</button>`}</span>` : ''; }).join(''); $('#sc', d).textContent = sel.size;
        };
        paint(); search();
        if (!ro) { $('#pq', d).oninput = () => { clearTimeout(tmr); tmr = setTimeout(search, 250); }; $('#pc', d).onchange = search; $('#pall', d).onclick = () => { shown().forEach(x => sel.add(x.id)); paint(); }; $('#pnone', d).onclick = () => { sel.clear(); paint(); };
          $('#pl', d).onchange = e => { const id = e.target.dataset.t; if (id) { e.target.checked ? sel.add(id) : sel.delete(id); paint(); } }; }
        $('#chips', d).onclick = e => { const x = e.target.closest('[data-x]'); if (x) { sel.delete(x.dataset.x); paint(); } };
      },
      buttons: ro ? [{ label: t('close'), id: 'x' }] : [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => {
        const name = $('#gn', d).value.trim(); if (!name) { $('#ge', d).textContent = t('needGroupName'); return false; }
        try { await api('/group/save', { kind: 'staff', body: { id: g?.id, name, note: $('#gt', d).value, traineeIds: [...sel] } }); await load(); savedToast(); draw(); return true; } catch (/** @type {any} */ er) { fail(er); return false; } } }] });
  }
}
