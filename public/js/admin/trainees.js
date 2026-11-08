import { findTrainees, deleteRecord, A, can, view, api, S, $, $$, esc, t, toast, fail, busy, openModal, confirmDlg, download, empty, badge, opts, personFields, bindPerson, showCreds, pageHead, bar, searchBox, load, coName, personName, stBadge, writeXlsx, savedToast, selHead, selCell, batchBar, bindBatch, deleteMany, filterToggle , pagerHtml, pageState, resetPage, onPage } from './lib.js';
import { readXlsx } from '../xlsx.js';

// filters stay while moving between pages; the selection is kept until it is used or cleared
const F = { q: '', co: '', on: '', type: '', from: '', to: '', sort: '', open: false }, SEL = new Set();
export default async function ({ rerender, args }) {
  const st = F; if (args?.[0]) { st.co = S.parseFilter(args[0]).co || ''; st.open = true; }
  const el = view();
  const head = () => pageHead(t('navTrainees'), `${can('trainee.import') ? `<button class="btn ghost" id="imp">⬆ ${esc(t('importExcel'))}</button>` : ''}${can('trainee.save') ? `<button class="btn" id="add">＋ ${esc(t('addTrainee'))}</button>` : ''}`);
  // the list is searched and paged on the server (thousands of people over the years); rows are kept for the dialogs
  let list = [], total = 0, seq = 0, timer = 0;
  const canDel = can('delete'), COLS = canDel ? 8 : 7;
  const row = x => `<tr class="click" data-id="${esc(x.id)}">${canDel ? selCell(x.id, SEL) : ''}<td><b>${esc(personName(x))}</b>${x.foreign ? ` ${badge('info', t('foreign'))}` : ''}<br><span class="mute xs">${esc(S.fullEn(x))}</span></td><td class="mono">${x.att ? esc(x.att) : `<span class="mute" title="${esc(t('tempAccount'))}">${esc(x.login || x.id)}</span>`}</td><td>${esc(coName(x.co) || t('private'))}</td><td>${esc(x.phone || '')}</td><td class="nowrap mute xs">${x.createdAt ? esc(S.fmtDateTime(x.createdAt)) : '—'}</td><td>${x.on === false ? badge('bad', t('disabled')) : x.temp ? badge('PENDING', t('tempAccount')) : x.provisional ? badge('PENDING', t('provisional')) : ''}</td>
      <td class="act">${can('trainee.save') ? `<button class="btn ghost sm" data-edit="${esc(x.id)}">${esc(t('edit'))}</button>` : ''}${canDel ? ` <button class="btn bad ghost sm" data-del="${esc(x.id)}" title="${esc(t('delete'))}">🗑</button>` : ''}</td></tr>`;
  const params = () => ({ q: st.q, co: st.co, on: st.on, type: st.type, from: st.from, to: st.to, sort: st.sort });
  // one page at a time from the server (Trainees: 25 / 50 / 100 per page)
  async function fetchPage(keep = false) {
    if (!keep) resetPage('trainees'); const ps = pageState('trainees'), my = ++seq;
    try {
      const r = await findTrainees({ ...params(), page: ps.page, size: ps.size });
      if (my !== seq) return;                                  // a newer search was started meanwhile
      list = r.list; total = r.total;
    } catch (/** @type {any} */ e) { if (my === seq) fail(e); return; }
    draw();
  }
  const nFilters = () => ['co', 'on', 'type', 'from', 'to'].filter(k => st[k]).length;
  const bbar = () => { $('#bb').outerHTML = batchBar(SEL, { total }); };
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    $('#tbody').innerHTML = list.map(row).join('') || `<tr><td colspan="${COLS}">${empty('🧑‍🎓', st.q || nFilters() ? t('noMatch') : t('noTrainees'))}</td></tr>`;
    $('#pgr').innerHTML = pagerHtml('trainees', total); $('#cnt').textContent = total.toLocaleString();
    bbar(); syncSel();
  }
  el.innerHTML = `<div id="pgw">` + head() + bar(searchBox('q', st.q), filterToggle(nFilters(), st.open), `<span class="mute sm" id="cnt"></span>`)
    + `<div class="card filters ${st.open ? '' : 'hide'}" id="fp"><div class="fg f4">
      <label>${esc(t('company'))}<select id="co">${opts([['-', t('private')], ...A.companies.map(c => [c.id, c.name])], st.co, t('allCompanies'))}</select></label>
      <label>${esc(t('status'))}<select id="on">${opts([['on', t('active')], ['off', t('disabled')]], st.on, t('allStatuses'))}</select></label>
      <label>${esc(t('personType'))}<select id="ty">${opts([['local', t('typeLocal')], ['foreign', t('foreign')], ['temp', t('tempAccount')]], st.type, t('all'))}</select></label>
      <label>${esc(t('sortBy'))}<select id="so">${opts([['new', t('sortNewest')], ['old', t('sortOldest')], ['name', t('sortName')]], st.sort, t('sortLearnerNo'))}</select></label>
      <label>${esc(t('registeredFrom'))}<input type="date" id="f1" value="${esc(st.from)}"></label><label>${esc(t('registeredTo'))}<input type="date" id="f2" value="${esc(st.to)}"></label>
      <div class="row" style="align-items:flex-end"><button type="button" class="btn ghost sm" id="fx">✕ ${esc(t('clearFilters'))}</button></div></div></div>`
    + `<p class="hint" style="margin:-4px 0 8px">${esc(t('traineeSearchHint'))}</p>${batchBar(SEL, { total })}<div class="tw"><table><thead><tr>${canDel ? selHead() : ''}<th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th><th>${esc(t('company'))}</th><th>${esc(t('mobile'))}</th><th>${esc(t('registered'))}</th><th></th><th></th></tr></thead><tbody id="tbody"><tr><td colspan="${COLS}"><span class="spin"></span></td></tr></tbody></table></div><div id="pgr"></div></div>`;
  const syncSel = canDel ? bindBatch($('#pgw'), SEL, { rows: () => list.map(x => x.id), allIds: async () => (await api('/trainees/find?' + new URLSearchParams(Object.entries({ ...params(), ids: 1 }).filter(([, v]) => v).map(([k, v]) => [k, String(v)])), { kind: 'staff' })).ids, del: async ids => { if (await deleteMany('trainee', ids)) { SEL.clear(); rerender(); return true; } return false; }, redraw: bbar }) : () => {};
  fetchPage();
  $('#q').oninput = e => { st.q = e.target.value; clearTimeout(timer); timer = setTimeout(() => fetchPage(), 250); };     // search as you type, without a request per key
  const re = () => { $('#fTog').outerHTML = filterToggle(nFilters(), true); bindTog(); fetchPage(); };
  const bindTog = () => { $('#fTog').onclick = () => { st.open = !st.open; $('#fp').classList.toggle('hide', !st.open); }; }; bindTog();
  for (const [id, k] of [['co', 'co'], ['on', 'on'], ['ty', 'type'], ['so', 'sort'], ['f1', 'from'], ['f2', 'to']]) $('#' + id).onchange = e => { st[k] = e.target.value; re(); };
  $('#fx').onclick = () => { Object.assign(st, { co: '', on: '', type: '', from: '', to: '', sort: '' }); ['co', 'on', 'ty', 'so', 'f1', 'f2'].forEach(i => { $('#' + i).value = ''; }); re(); };
  onPage('trainees', () => fetchPage(true));
  $('#add')?.addEventListener('click', () => form());
  $('#imp')?.addEventListener('click', () => importDlg());
  const pick = id => list.find(x => x.id === id);
  $('#tbody').onclick = async e => { const dl = e.target.closest('[data-del]'); if (dl) { e.stopPropagation(); const x = pick(dl.dataset.del); if (x && await deleteRecord('trainee', x.id, { name: personName(x) })) rerender(); return; } const b = e.target.closest('[data-edit]'); if (b) { e.stopPropagation(); return form(pick(b.dataset.edit)); } const r = e.target.closest('tr[data-id]'); if (r) detail(pick(r.dataset.id)); };
  async function form(p) {
    const { dlg, promise } = openModal({ title: p ? t('editTrainee') : t('addTrainee'), wide: true, html: `<form id="pf">${personFields(p || {}, { finRequired: false, company: true, consent: true })}</form><div class="err" id="pe" role="alert"></div>`, onMount: d => bindPerson($('#pf', d)),
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: async d => save(d, p) }] });
    return promise;
  }
  async function save(d, p) {
    const o = Object.fromEntries([...new FormData($('#pf', d))]); const f = $('#pf', d);
    const body = { ...o, foreign: f.foreign.checked, on: f.on.checked, consent: !!f.consent?.checked, id: p?.id }; $('#pe', d).textContent = '';
    try {
      // no ID/FIN and somebody with the very same name exists: the office confirms that this is another person
      let r; try { r = await api('/trainee/save', { kind: 'staff', body }); }
      catch (/** @type {any} */ x) { if (x.message !== 'sameName') throw x;
        const list = (x.data?.people || []).map(q => `<li><b>${esc(q.name)}</b> · <span class="mono">${esc(q.att || q.login)}</span>${q.temp ? ' ' + badge('PENDING', t('tempAccount')) : ''}${q.createdAt ? ` <span class="mute xs">${esc(S.fmtDate(q.createdAt.slice(0, 10)))}</span>` : ''}</li>`).join('');
        if (!await confirmDlg(`${t('sameNameWarn')}<ul style="margin:8px 0 0 18px">${list}</ul>`, { title: '⚠ ' + t('sameNameTitle'), ok: t('sameNameProceed'), html: true })) return false;
        r = await api('/trainee/save', { kind: 'staff', body: { ...body, sameNameOk: true } }); }
      await load(); if (r.creds) { d._v = 'ok'; d.close(); await showCreds([{ name: S.fullAz(r.trainee), login: r.creds.login, password: r.creds.password }]); } else savedToast();
      rerender(); return true;
    } catch (/** @type {any} */ e) {
      if (e.message === 'dupFin') { $('#pe', d).innerHTML = `${esc(t('dupFin'))}${e.data?.existing ? `: <b>${esc(e.data.existing.name)}</b> (${esc(e.data.existing.att)})` : ''}`; return false; }
      $('#pe', d).textContent = t(e.message) === e.message ? t('server') : t(e.message); return false;
    }
  }

  async function detail(x) {
    let sess = [], certs = []; try { ({ sessions: sess, certs } = await api('/trainee/history?id=' + encodeURIComponent(x.id), { kind: 'staff' })); } catch (/** @type {any} */ e) { return fail(e); }
    openModal({ title: personName(x), wide: true, html: `<div class="grid g2"><div><p><b>${esc(t('learnerNo'))}:</b> <span class="mono">${esc(x.att || '—')}</span>${x.provisional ? ' ' + badge('PENDING', t('provisional')) : ''}${x.temp ? `<br><span class="hint">${esc(t('tempAccount'))} · ${esc(t('login'))}: <span class="mono">${esc(x.login || x.id)}</span></span>` : ''}<br><b>${esc(t('company'))}:</b> ${esc(coName(x.co) || t('private'))}<br><b>${esc(t('mobile'))}:</b> ${esc(x.phone || '—')}<br><b>${esc(t('email'))}:</b> ${esc(x.email || '—')}<br><b>${esc(t('login'))}:</b> <span class="mono">${esc(x.login)}</span>${x.fin ? `<br><b>${esc(t('finLabel'))}:</b> <span class="mono">${esc(x.fin)}</span> 🔒` : ''}</p>
      <p class="mute">${esc(S.fullAz(x))}<br>${esc(S.fullEn(x))}</p></div><div><h3>${esc(t('certificates'))}</h3>${certs.map(c => `<p style="margin:6px 0"><span class="mono">${esc(c.no)}</span> ${esc(c.snap.blank.name)} ${stBadge(c.st)}<br><span class="mute xs">${esc(S.fmtDate(c.start))} → ${esc(S.fmtDate(c.expiry))}</span></p>`).join('') || `<p class="mute">${esc(t('none'))}</p>`}</div></div>
      <h3 style="margin-top:12px">${esc(t('navSessions'))}</h3>${sess.map(s => `<p style="margin:4px 0"><a href="#/sessions/${esc(s.id)}">${esc(S.fmtDate(s.date))} · ${esc(A.blanks.find(b => b.id === s.bid)?.name || '')}</a></p>`).join('') || `<p class="mute">${esc(t('none'))}</p>`}`,
      buttons: [...(can('credentials.reset') ? [{ label: t('resetPassword'), cls: 'ghost', fn: async d => { if (!await confirmDlg(t('resetConfirm'))) return false; const r = await api('/credentials/reset', { kind: 'staff', body: { kind: 'trainee', ids: [x.id] } }); d.close(); showCreds(r.list.map(c => ({ name: c.name, login: c.login, password: c.password }))); return false; } }] : []),
        ...(can('delete') ? [{ label: t('delete'), cls: 'bad ghost', fn: async d => { if (await deleteRecord('trainee', x.id, { name: personName(x) })) { d.close(); rerender(); } return false; } }] : []),
        { label: t('close'), id: 'x' }] });
  }

  /* ------------------------------------------------------- Excel import */
  const HEAD = () => [t('xName'), t('xSurname'), t('xFather'), t('xFin'), t('xMobile'), t('xEmail'), t('xCompany'), t('xForeign'), t('xNameEn'), t('xSurnameEn'), t('xFatherEn'), t('xConsent'), t('xNationality'), t('xCertLang')];
  async function template() {
    const rows = [HEAD(), ['Azər', 'Qocayev', 'Məmməd oğlu', '1ABC234', '+994501234567', '', A.companies[0]?.name || '', t('no'), '', '', '', t('yes'), '', ''],
      ['John', 'Smith', '', 'P-998877', '+447700900123', 'john@example.com', '', t('yes'), '', '', '', t('yes'), 'United Kingdom', 'EN']];
    const help = [[t('xHelpTitle')], [t('xHelp1')], [t('xHelp2')], [t('xHelp3')], [t('xHelp4')], [t('xHelp5')], [t('xHelpTemp')], [t('xHelpUnique')]];
    download(await writeXlsx([{ name: 'Trainees', rows, widths: [16, 18, 18, 14, 18, 24, 34, 12, 16, 18, 18, 12, 18, 10], textCols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }, { name: 'Companies', rows: [[t('xCompany')], ...A.companies.map(c => [c.name])], widths: [50], textCols: [0] }, { name: 'Help', rows: help, widths: [110] }]), 'trainees-template.xlsx');
  }
  const yes = v => /^(1|y|yes|true|x|bəli|beli|hə|he|ə)/i.test(String(v || '').trim());
  function parse(rows, known) {
    const seen = new Set(), finMap = new Map(Object.entries(known || {}));
    return rows.slice(1).map((r, i) => ({ r, row: i + 2 })).filter(({ r }) => r.some(c => String(c).trim())).map(({ r, row }) => {
      /** @type {Record<string, any>} */
      const o = { row, name: S.cleanName(r[0]), surname: S.cleanName(r[1]), father: S.cleanName(r[2]), fin: S.normFin(r[3]), phone: S.normPhone(r[4]), email: String(r[5] || '').trim(), company: String(r[6] || '').trim(), foreign: yes(r[7]), nameEn: S.cleanName(r[8]), surnameEn: S.cleanName(r[9]), fatherEn: S.cleanName(r[10]), consent: yes(r[11]), nationality: String(r[12] || '').trim(), certLang: /^en/i.test(String(r[13] || '').trim()) ? 'en' : 'both', docType: 'passport' };
      if (!o.foreign) { delete o.nationality; o.certLang = 'both'; o.docType = 'id'; }
      let err = '';
      if (!o.name || !o.surname) err = 'badName'; else if (o.fin && !S.goodFin(o.fin, o.foreign)) err = 'badId'; else if (o.phone && !S.goodPhone(o.phone)) err = 'badPhone'; else if (!S.goodEmail(o.email)) err = 'badEmail'; else if (A.settings.privacy?.consentRequired && !o.consent) err = 'needConsent';
      else if (o.company && !S.isPrivateCompany(o.company, 'x') && !A.companies.some(c => c.name.trim().toLowerCase() === o.company.toLowerCase())) err = 'badCompany';
      else if (o.fin && seen.has(o.fin)) err = 'dupInFile';
      if (o.fin) seen.add(o.fin); o.status = err ? 'error' : (o.fin && finMap.has(o.fin)) ? 'exists' : 'new'; o.err = err; o.ex = o.fin ? finMap.get(o.fin) : null; return o;
    });
  }
  function importDlg() {
    let rows = [];
    const { dlg } = openModal({ title: t('importExcel'), wide: true, html: `<p class="mute">${esc(t('importHint'))}</p><div class="row" style="margin-bottom:12px"><button class="btn ghost" id="tpl">⬇ ${esc(t('downloadTemplate'))}</button><input type="file" id="xf" accept=".xlsx" style="max-width:340px"></div><div id="prev"></div>`,
      buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('importNow'), id: 'go', fn: async d => {
        const todo = rows.filter(r => r.status === 'new'); if (!todo.length) return false;
        // 25 rows per request (each new account's password is hashed: CPU per request stays small), with progress; a failed part is tried once more. What was created is always shown (passwords!),
        // rows that could not be sent are reported and can be imported again.
        // Parts of 100 rows (one request each, one database write per part). If the hosting plan cuts a part off (its CPU
        // limit: every new account's password is hashed), the same part is sent again in halves - 50, 25, 10 - with the
        // same part key, so rows already created are never created twice.
        const res = [], go = $$('.mf button', d).pop(); let failed = 0, lastErr = /** @type {any} */ (null), size = 100, i = 0;
        const key = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        while (i < todo.length) {
          if (go) go.textContent = t('importProgress', Math.min(i + size, todo.length), todo.length);
          const part = todo.slice(i, i + size), pk = key(); let ok = false;
          for (let k = 0; k < 2 && !ok; k++) { try { res.push(...(await api('/trainee/import', { kind: 'staff', body: { rows: part, pk } })).results); ok = true; lastErr = null; } catch (/** @type {any} */ e) { lastErr = e; if (e.status && e.status < 500 && !e.data?.host) break; } }
          if (!ok && size > 10 && (lastErr?.status >= 500 || lastErr?.data?.host || lastErr?.message === 'offline')) {
            // the part may have been written before the answer was lost: ask for it once more by its key, then go smaller
            try { const again = await api('/trainee/import', { kind: 'staff', body: { rows: part, pk } }); res.push(...again.results); i += part.length; continue; } catch {}
            size = size > 50 ? 50 : size > 25 ? 25 : 10; continue;
          }
          if (!ok) failed += part.length;
          i += part.length;
        }
        if (failed && !res.length) { fail(lastErr); return false; }
        if (failed) toast(t('importPartFailed', failed), 'bad');
        await load(); const ok = res.filter(r => r.status === 'created'), bad = res.filter(r => r.status !== 'created');
        d._v = 'go'; d.close(); toast(t('importDone', ok.length, bad.length), bad.length ? '' : 'ok');
        const same = ok.filter(r => r.sameName); if (same.length) toast(t('importSameName', same.length, same.map(r => r.name).slice(0, 5).join(', ')), '');
        const lost = ok.filter(r => r.pwLost); if (lost.length) toast(t('importPwLost', lost.length), 'bad');
        if (ok.length) await showCreds(ok.map(r => ({ name: r.name, login: r.login, password: r.password || '— ' + t('resetPassword') })), { title: t('credsTitle') }); rerender(); return true; } }] });
    $('#tpl', dlg).onclick = template; const go = [...dlg.querySelectorAll('.mf button')].pop(); go.disabled = true;
    $('#xf', dlg).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const raw = await readXlsx(await f.arrayBuffer()), fins = raw.slice(1).map(r => S.normFin(r[3])).filter(Boolean);   // which ID/FINs exist: asked from the server
        const known = fins.length ? (await api('/fins/check', { kind: 'staff', body: { fins } })).found : {}; rows = parse(raw, known); } catch { $('#prev', dlg).innerHTML = `<div class="banner bad">${esc(t('badFile'))}</div>`; return; }
      const c = k => rows.filter(r => r.status === k).length; go.disabled = !c('new');
      $('#prev', dlg).innerHTML = `<div class="row" style="margin-bottom:8px">${badge('PASS', t('xNew') + ': ' + c('new'))} ${badge('PENDING', t('xExists') + ': ' + c('exists'))} ${badge('FAIL', t('xErrors') + ': ' + c('error'))}</div><div class="tw" style="max-height:340px;overflow:auto"><table><thead><tr><th>#</th><th>${esc(t('fullName'))}</th><th>${esc(t('company'))}</th><th>${esc(t('mobile'))}</th><th>${esc(t('status'))}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.row}</td><td>${esc(r.surname + ' ' + r.name)}</td><td>${esc(r.company || t('private'))}</td><td>${esc(r.phone)}</td><td>${r.status === 'new' ? badge('PASS', t('xNew')) : r.status === 'exists' ? badge('PENDING', t('xExists') + (r.ex ? ' · ' + r.ex.att : '')) : badge('FAIL', t(r.err))}</td></tr>`).join('')}</tbody></table></div>`;
    };
  }
}
