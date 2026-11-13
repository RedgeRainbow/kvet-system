import { deleteRecord, A, can, view, api, S, $, esc, t, toast, fail, empty, badge, matches, pageHead, bar, searchBox, tabs, confirmDlg, load, openModal, printHtml, download, info } from './lib.js';
import { certsHtml, certsZip } from '../cert.js';
import { signButtons } from './certview.js';
import { releaseFlow, showReleased } from './release.js';

export default async function ({ rerender }) {
  const el = view(); let data = (await api('/issue/queue', { kind: 'staff' })).list, tab = 'PASS', q = ''; const picked = new Set(), key = r => r.sid + '|' + r.tid;
  const grp = r => (r.outcome === 'PASS' ? 'PASS' : r.outcome === 'FAIL' || r.outcome === 'ABSENT' ? 'FAIL' : 'PENDING');
  function draw() { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const cnt = k => data.filter(r => grp(r) === k).length, rows = data.filter(r => grp(r) === tab && matches(q, r.az, r.en, r.att, r.blank, r.company));
    const sel = rows.filter(r => picked.has(key(r)));
    el.innerHTML = pageHead(t('navIssue'), (tab !== 'PENDING' && sel.length ? `<button class="btn ${tab === 'PASS' ? 'ok' : 'bad'}" id="some">✓ ${esc(t('releaseSel', sel.length))}</button>` : '') + (tab === 'PASS' && cnt('PASS') ? `<button class="btn ok ghost" id="all">✓ ${esc(t('releaseAll', cnt('PASS')))}</button>` : '')) + `<p class="mute" style="margin-top:-8px">${esc(t('issueIntro'))}</p>`
      + tabs([['PASS', t('readyToRelease'), cnt('PASS')], ['FAIL', t('willFail'), cnt('FAIL')], ['PENDING', t('waitingResults'), cnt('PENDING')]], tab) + bar(searchBox('q', q))
      + `<div class="tw"><table><thead><tr>${tab !== 'PENDING' ? `<th class="sel-col"><input type="checkbox" id="pa" aria-label="${esc(t('selectAll'))}" ${rows.length && sel.length === rows.length ? 'checked' : ''}></th>` : ''}<th>${esc(t('date'))}</th><th>${esc(t('trainee'))}</th><th>${esc(t('training'))}</th><th>${esc(t('company'))}</th><th>${esc(t('outcome'))}</th><th></th></tr></thead><tbody>${rows.map(r => `<tr>${tab !== 'PENDING' ? `<td class="sel-col"><input type="checkbox" data-pk="${esc(key(r))}" ${picked.has(key(r)) ? 'checked' : ''} aria-label="${esc(r.az || r.en)}"></td>` : ''}<td class="nowrap">${esc(S.fmtDate(r.date))}</td><td><b>${esc(r.foreign ? r.en : r.az)}</b><br><span class="mono xs mute">${esc(r.att)}</span></td><td>${esc(r.blank)}</td><td>${esc(r.company || t('private'))}</td>
        <td>${badge(grp(r), t('oc_' + r.outcome))}${r.reason ? `<br><span class="xs mute">${esc(t('failWhy_' + r.reason))}</span>` : ''}</td><td class="act"><a class="btn ghost sm" href="#/sessions/${esc(r.sid)}">${esc(t('review'))}</a> ${can('delete') ? `<button class="btn bad ghost sm" data-x="${esc(r.sid)}|${esc(r.tid)}" data-n="${esc(r.az || r.en)}" title="${esc(t('removeFromSession'))}">🗑</button> ` : ''}${grp(r) !== 'PENDING' ? `<button class="btn sm ${grp(r) === 'PASS' ? 'ok' : 'bad'}" data-s="${esc(r.sid)}" data-t="${esc(r.tid)}">${esc(t('release'))}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7">${empty('✅', t('queueEmpty'))}</td></tr>`}</tbody></table></div>`;
    $('#q').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); };
    $('#all')?.addEventListener('click', async () => { if (await confirmDlg(t('releaseAllConfirm', cnt('PASS')))) bulk(data.filter(x => grp(x) === 'PASS')); });
    $('#some')?.addEventListener('click', async () => { if (await confirmDlg(t(tab === 'PASS' ? 'releaseAllConfirm' : 'failAllConfirm', sel.length))) bulk(sel); });
    $('#pa')?.addEventListener('change', e => { rows.forEach(r => (e.target.checked ? picked.add(key(r)) : picked.delete(key(r)))); draw(); });
  }
  /* releases in blocks of 2 (one request each: a release with its signature is about 20 database calls, and the hosting plan limits
     them per request); then the new certificates can be printed or downloaded together */
  async function bulk(list) {
    let ok = 0, bad = 0; const certs = [];
    const PART = 2;
    for (let i = 0; i < list.length; i += PART) {
      toast(t('releasing', Math.min(i + PART, list.length), list.length));
      try { const r = (await api('/issue/bulk', { kind: 'staff', body: { items: list.slice(i, i + PART).map(x => ({ sid: x.sid, tid: x.tid })) } })).results; for (const x of r) { if (x.ok) { ok++; if (x.cert) certs.push(x.cert); } else bad++; } } catch (/** @type {any} */ e) { fail(e); bad += Math.min(PART, list.length - i); }
    }
    toast(t('releasedN', ok, bad), bad ? 'bad' : 'ok'); picked.clear(); await load(); data = (await api('/issue/queue', { kind: 'staff' })).list; draw(); window.__badges?.();
    if (certs.length) openModal({ title: t('certsIssuedN', certs.length), html: `<p>${certs.map(c => `<span class="mono">${esc(c.no)}</span> ${esc(c.snap?.names?.en || '')}`).join('<br>')}</p><div id="zp" class="mute sm"></div>`,
      buttons: [...signButtons(certs.map(c => c.no), r => { certs.splice(0, certs.length, ...r); toast(t('signed'), 'ok'); }), { label: t('printAll'), cls: 'ghost', fn: async () => { await printHtml(certsHtml(certs, A.assets, info()), 'certificates'); return false; } },
        { label: t('zipAll'), fn: async d => { try { download(await certsZip(certs, A.assets, info(), { onStep: (i, n) => ($('#zp', d).textContent = `${i} / ${n}`) }), 'certificates.zip'); } catch (/** @type {any} */ e) { fail(e); } return false; } }, { label: t('close'), cls: 'ghost', id: 'x' }] });
  }
  draw();
  el.onchange = e => { const c = e.target.closest('[data-pk]'); if (c) { c.checked ? picked.add(c.dataset.pk) : picked.delete(c.dataset.pk); draw(); } };
  el.onclick = async e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; picked.clear(); return draw(); }
    const rm = e.target.closest('button[data-x]');
    if (rm) { if (await deleteRecord('enrol', rm.dataset.x, { name: rm.dataset.n })) { data = (await api('/issue/queue', { kind: 'staff' })).list; draw(); } return; }
    const b = e.target.closest('button[data-s]'); if (!b) return;
    const D = await api('/session?id=' + encodeURIComponent(b.dataset.s), { kind: 'staff' }), enr = D.enrs.find(x => x.tid === b.dataset.t);
    const v = await releaseFlow(D.session, enr, b.dataset.t); if (!v) return; if (v.cert) showReleased(v.cert); rerender();
  };
}
