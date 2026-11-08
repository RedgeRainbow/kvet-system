import { A, can, view, api, S, $, $$, esc, t, opts, toast, fail, busy, confirmDlg, openModal, empty, pageHead, tabs, download, load } from './lib.js';
import { tokenOf } from '../api.js';

export default async function ({ rerender }) {
  const el = view(); let tab = 'health'; const PK = ['sessions', 'certs', 'trainees', 'trainers', 'companies', 'blanks', 'sheets', 'materials', 'archive', 'snaps'];
  /* System health: green / amber / red per line, with what to do */
  const healthHtml = h => {
    const lvl = (v, ok, warn) => (v === null || v === undefined ? 'bad' : v <= ok ? 'ok' : v <= warn ? 'warn' : 'bad');
    const dot = l => `<span class="hdot ${l}" aria-label="${esc(t('lvl_' + l))}"></span>`;
    const ageH = h.backup ? (Date.parse(h.at) - Date.parse(h.backup.at)) / 36e5 : null, today = h.requests.days[h.requests.days.length - 1].n;
    const pct = h.requests.limit ? Math.round(today / h.requests.limit * 100) : null, max = Math.max(1, ...h.requests.days.map(d => d.n), h.requests.limit || 0);
    const mb = n => (n / 1048576).toFixed(n < 104857600 ? 1 : 0) + ' MB', dbPct = h.dbSize ? Math.round(h.dbSize / h.dbLimit * 100) : null;
    const rows = [
      [lvl(h.db.ms, 300, 1000), t('hDb'), h.db.ms === null ? t('hNoAnswer') : h.db.ms + ' ms', t('hDbHint')],
      [lvl(h.r2.ms, 400, 1500), t('hR2'), h.r2.ms === null ? t('hNoAnswer') : h.r2.ms + ' ms', t('hR2Hint')],
      [lvl(ageH, 26, 72), t('hBackup'), h.backup ? `${S.fmtDateTime(h.backup.at)} · ${mb(h.backup.size)} · ${t('hBackupsN', h.backup.count)}` : t('none'), t('hBackupHint')],
      [lvl(h.errors.day, 0, 9), t('hErrors'), t('hErrorsN', h.errors.day, h.errors.week), t('hErrorsHint')],
      [pct === null ? 'ok' : lvl(pct, 60, 85), t('hRequests'), `${today.toLocaleString()}${h.requests.limit ? ` / ${h.requests.limit.toLocaleString()} (${pct}%)` : ''}`, t(h.requests.limit ? 'hRequestsHintFree' : 'hRequestsHintPaid')],
      [dbPct === null ? 'warn' : lvl(dbPct, 70, 90), t('hDbSize'), h.dbSize ? `${mb(h.dbSize)} / ${mb(h.dbLimit)} (${dbPct}%)` : t('hDbSizeUnknown'), t('hDbSizeHint')],
      ...(h.schema ? [[!h.schema.tables || h.schema.problems.length ? 'warn' : 'ok', t('hSchema'), !h.schema.tables ? t('hSchemaOld') : h.schema.problems.length ? t('hSchemaBad', h.schema.problems.length >= 50 ? '50+' : h.schema.problems.length) : t('hSchemaOk', h.schema.tables.length), t('hSchemaHint')]] : []),
    ];
    const big = (h.schema?.tables || []).slice(0, 10);
    const worst = rows.some(r => r[0] === 'bad') ? 'bad' : rows.some(r => r[0] === 'warn') ? 'warn' : 'ok';
    return `<div class="card"><div class="ch"><h2>${dot(worst)} ${esc(t('health'))}</h2><span class="grow"></span><span class="mute xs">${esc(t('hChecked'))} ${esc(S.fmtDateTime(h.at))}</span> <button class="btn ghost sm" id="hRe">↻</button></div>
      <p class="mute sm">${esc(t('healthIntro'))}</p>
      <div class="tw"><table class="nofilter nosort"><tbody>${rows.map(r => `<tr><td style="width:28px">${dot(r[0])}</td><td><b>${esc(r[1])}</b><br><span class="mute xs">${esc(r[3])}</span></td><td class="nowrap"><b>${esc(r[2])}</b></td></tr>`).join('')}</tbody></table></div></div>
     <div class="card"><h3 style="margin-top:0">${esc(t('hRequests7'))}</h3>
      <div class="hbars" role="img" aria-label="${esc(t('hRequests7'))}">${h.requests.days.map(d => `<div class="hb"><span class="v">${d.n ? d.n.toLocaleString() : '0'}</span><div class="bar" style="height:${Math.round(d.n / max * 80)}%"></div><span class="d">${esc(d.d.slice(5))}</span></div>`).join('')}${h.requests.limit ? `<div class="hlim" style="bottom:${Math.round(20 + h.requests.limit / max * 0.8 * 180)}px"><span>${esc(t('hLimit'))} ${h.requests.limit.toLocaleString()}</span></div>` : ''}</div>
      <p class="hint">${esc(t('hRequestsNote'))}</p>
      <div class="fg" style="max-width:520px"><label>${esc(t('hCfPlan'))}<select data-plan="cfPlan" ${can('settings.save') ? '' : 'disabled'}>${opts([['free', 'Workers Free (100,000 / day)'], ['paid', 'Workers Paid']], h.requests.plan)}</select></label>
      <label>${esc(t('hDbPlan'))}<select data-plan="dbPlan" ${can('settings.save') ? '' : 'disabled'}>${opts([['free', 'Supabase Free (500 MB)'], ['pro', 'Supabase Pro (8 GB)']], h.dbPlan)}</select></label></div></div>
     ${big.length ? `<div class="card"><h3 style="margin-top:0">${esc(t('hTables'))}</h3><div class="tw"><table class="nofilter nosort"><tbody>${big.map(x => `<tr><td class="mono">rec_${esc(x.col)}</td><td class="num">${x.rows.toLocaleString()}</td><td class="num">${mb(x.bytes)}</td></tr>`).join('')}</tbody></table></div>
       ${h.schema.problems.length ? `<p class="hint">${esc(t('hSchemaRows'))}: ${h.schema.problems.slice(0, 12).map(p => `<span class="mono">${esc(p.col)}/${esc(p.id)}</span>`).join(', ')}</p>` : ''}</div>` : ''}`;
  };
  const errorsHtml = r => `<div class="card"><div class="ch"><h2>⚠ ${esc(t('errorLog'))}</h2><span class="grow"></span><input class="sr-in" id="erq" type="search" placeholder="${esc(t('errorRef'))}…">${r.list.length && can('settings.save') ? ` <button class="btn bad ghost sm" id="erc">${esc(t('clearLog'))}</button>` : ''}</div><p class="hint">${esc(t('errorLogHint'))}</p>
    <div class="tw"><table><tbody id="ert">${r.list.map(x => `<tr><td class="nowrap mono xs">${esc(S.fmtDateTime(x.at))}<br><b>${esc(x.ref)}</b></td><td class="mono xs">${esc(x.method)} ${esc(x.path)}<br><span class="mute">${esc(x.who || '')}</span></td><td class="xs"><b>${esc(x.msg)}</b>${x.body ? `<br><span class="mute">${esc(x.body)}</span>` : ''}<details><summary class="mute">stack</summary><pre class="xs" style="white-space:pre-wrap">${esc(x.stack)}</pre></details></td></tr>`).join('') || `<tr><td>${empty('✅', t('noErrors'))}</td></tr>`}</tbody></table></div></div>`;
  async function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const bk = (await api('/backups', { kind: 'staff' })).list;
    const er = tab === 'errors' ? await api('/errors', { kind: 'staff' }) : null, hl = tab === 'health' ? await api('/health', { kind: 'staff' }) : null;
    el.innerHTML = pageHead(t('navSystem')) + tabs([['health', '🩺 ' + t('health')], ['backups', t('backups')], ...(can('delete') ? [['purge', t('purgeTitle')]] : []), ...(can('audit.view') ? [['errors', '⚠ ' + t('errorLog')]] : [])], tab)
      + (tab === 'health' ? healthHtml(hl) : tab === 'errors' ? errorsHtml(er) : tab === 'backups' ? `<div class="card"><div class="ch"><h2>${esc(t('backups'))}</h2><span class="grow"></span>${can('backup.create') ? `<button class="btn" id="mk">＋ ${esc(t('createBackup'))}</button>` : ''}</div><p class="hint">${esc(t('backupHint'))}</p><p class="hint">${esc(t('backupHint2'))}</p>
        ${can('backup.restore') ? `<div class="row" style="margin:6px 0 10px"><button class="btn ghost sm" id="lrep">${esc(t('repairLogins'))}</button><span class="hint">${esc(t('repairLoginsHint'))}</span></div>` : ''}
        <div class="tw"><table><tbody>${bk.map(b => `<tr><td class="mono">${esc(b.key.replace('backups/', ''))}</td><td>${(b.size / 1024).toFixed(0)} KB</td><td class="act">${can('backup.download') ? `<button class="btn ghost sm" data-g="${esc(b.key)}" aria-label="${esc(t('download'))}" title="${esc(t('download'))}">⬇</button> ` : ''}${can('backup.restore') ? `<button class="btn ghost sm" data-r="${esc(b.key)}">${esc(t('restore'))}</button> ` : ''}${can('backup.delete') ? `<button class="btn bad ghost sm" data-d="${esc(b.key)}">🗑</button>` : ''}</td></tr>`).join('') || `<tr><td>${empty('💾', t('noBackups'))}</td></tr>`}</tbody></table></div></div>`
        : `<div class="card"><h2>${esc(t('purgeTitle'))}</h2><p class="hint">${esc(t('purgeIntro'))}</p><div class="fg"><div class="full pick" style="max-height:none">${PK.map(k => `<label><input type="checkbox" data-pk="${k}"> ${esc(t('pk_' + k))}</label>`).join('')}</div>
          <label>${esc(t('purgeBefore'))}<input type="date" id="pb" max="${esc(A.today)}"><span class="hint">${esc(t('purgeBeforeHint'))}</span></label></div><div id="pimp" class="banner" style="margin-top:12px">${esc(t('purgePick'))}</div><button class="btn bad" id="pgo" disabled>🗑 ${esc(t('purgeRun'))}</button></div>`);
    if (tab === 'purge') wirePurge();
    $('#hRe')?.addEventListener('click', draw);
    $$('[data-plan]').forEach(x => (x.onchange = async () => { await api('/health/plan', { kind: 'staff', body: { [x.dataset.plan]: x.value } }); draw(); }));
    $('#erq')?.addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); $$('#ert tr').forEach(tr => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); }); });
    $('#erc')?.addEventListener('click', async () => { if (await confirmDlg(t('clearLog') + '?', { danger: true })) { await api('/errors/clear', { kind: 'staff', body: {} }); draw(); } });
    $('#lrep')?.addEventListener('click', e => busy(e.target, async () => { const r = await api('/system/logins/repair', { kind: 'staff', body: {} }); toast(t('repairedN', r.count), 'ok'); }));
    $('#mk')?.addEventListener('click', async e => { await busy(e.target, async () => { await api('/backup', { kind: 'staff', body: {} }); toast(t('saved'), 'ok'); draw(); }); });
  }
  function wirePurge() {
    const kinds = () => [...el.querySelectorAll('[data-pk]')].filter(i => i.checked).map(i => i.dataset.pk), body = extra => ({ kinds: kinds(), before: $('#pb').value, ...extra });
    const upd = async () => {
      const go = $('#pgo'); go.disabled = true; if (!kinds().length) { $('#pimp').textContent = t('purgePick'); return; }
      try { const r = await api('/purge', { kind: 'staff', body: body({ dry: true }) }), i = r.impact;
        $('#pimp').innerHTML = `<b>${esc(t('purgeWill'))}</b><br>${['sessions', 'enrolments', 'trainees', 'trainers', 'companies', 'blanks', 'sheets', 'materials', 'archive', 'snaps'].filter(k => i[k]).map(k => `${esc(t('pk_' + k))}: <b>${i[k]}</b>`).join(' · ') || esc(t('none'))}${i.certs ? `<br>${esc(t('delN_certs', i.certs))}` : ''}`; go.disabled = !r.total && !i.certs; } catch (/** @type {any} */ e) { fail(e); }
    };
    el.onchange = upd;
    $('#pgo').onclick = async () => {
      const m = openModal({ title: t('purgeRun'), html: `<p>${esc(t('purgeConfirmText'))}</p><label>${esc(t('typeDelete'))}<input id="cf" autocomplete="off"></label><div class="err" id="ce" role="alert"></div>`, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('delete'), cls: 'bad', id: 'ok', fn: async d => { if ($('#cf', d).value !== 'DELETE') { $('#ce', d).textContent = t('typeDelete'); return false; } try { const r = await api('/purge', { kind: 'staff', body: body({ confirm: 'DELETE' }) }); toast(t('purgeDone'), 'ok'); d._v = r; return true; } catch (/** @type {any} */ e) { fail(e); return false; } } }] });
      if (await m.promise) { await load(); draw(); }
    };
  }
  await draw();
  el.onclick = async e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; return draw(); }
    const b = e.target.closest('button[data-g],button[data-r],button[data-d]'); if (!b) return;
    if (b.dataset.g) { const r = await fetch('/api/backup/get?key=' + encodeURIComponent(b.dataset.g), { headers: { authorization: 'Bearer ' + tokenOf('staff') } }); download(await r.blob(), b.dataset.g.split('/')[1]); }
    if (b.dataset.r && await confirmDlg(t('confirmRestore'), { danger: true })) { await busy(b, async () => { await api('/restore', { kind: 'staff', body: { key: b.dataset.r } }); toast(t('restored'), 'ok'); await load(); draw(); }); }
    if (b.dataset.d && await confirmDlg(t('deleteConfirm'), { danger: true })) { await api('/backup/delete', { kind: 'staff', body: { key: b.dataset.d } }); draw(); }
  };
}
