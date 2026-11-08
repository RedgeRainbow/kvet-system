/* Audit trail: who did what, when, from where, and what changed. Filters + paging + Excel export. */
import { view, api, S, $, esc, t, badge, empty, pageHead, download, writeXlsx, fail, pagerHtml, pageState, resetPage, onPage } from './lib.js';

const CATS = ['auth', 'people', 'training', 'cert', 'delete', 'system'];
const st = { from: '', to: '', user: '', cat: '', q: '' };
export default async function ({ args }) {
  const el = view(); if (args?.[0] && args[0].includes('=')) { Object.assign(st, S.parseFilter(args[0])); resetPage('audit'); }
  const qs = (lim, off) => '/audit?' + new URLSearchParams({ ...(st.from && { from: st.from }), ...(st.to && { to: st.to }), ...(st.user && { user: st.user }), ...(st.cat && { cat: st.cat }), ...(st.q && { q: st.q }), ...(st.entity && { entity: st.entity }), limit: lim, offset: off });
  async function draw(keepFocus) { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    const ps = pageState('audit');
    let d; try { d = await api(qs(ps.size, ps.page * ps.size), { kind: 'staff' }); } catch (/** @type {any} */ e) { fail(e); return; }
    el.innerHTML = pageHead(t('navAudit'), `<button class="btn ghost" id="xl">⬇ ${esc(t('exportExcel'))}</button>`) + `<p class="mute" style="margin-top:-8px">${esc(t('auditIntro'))}${d.recentOnly ? ' ' + esc(t('auditRecent')) : ''}</p>
      <div class="bar"><input class="sr-in" id="q" type="search" value="${esc(st.q)}" placeholder="${esc(t('search'))}"><label class="mute sm" style="margin:0">${esc(t('from'))} <input type="date" id="f" value="${esc(st.from)}" style="width:auto"></label><label class="mute sm" style="margin:0">${esc(t('to'))} <input type="date" id="z" value="${esc(st.to)}" style="width:auto"></label>
        <select id="u"><option value="">${esc(t('allUsers'))}</option>${d.users.map(u => `<option ${u === st.user ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select><button class="btn ghost sm" id="rs">✕ ${esc(t('clearFilter'))}</button></div>
      <div class="tabs"><button class="tab ${st.cat ? '' : 'on'}" data-c="">${esc(t('all'))}<span class="n">${Object.values(d.cats).reduce((a, b) => a + b, 0)}</span></button>${CATS.map(c => `<button class="tab ${st.cat === c ? 'on' : ''}" data-c="${c}">${esc(t('ac_' + c))}<span class="n">${d.cats[c] || 0}</span></button>`).join('')}</div>
      <div class="tw"><table><thead><tr><th>${esc(t('when'))}</th><th>${esc(t('user'))}</th><th>${esc(t('action'))}</th><th>${esc(t('details'))}</th></tr></thead><tbody>${d.list.map(a => `<tr><td class="nowrap">${esc(S.fmtDateTime(a.at))}${a.ip ? `<br><span class="mute xs mono">${esc(a.ip)}</span>` : ''}</td><td>${esc(a.by?.name || '')}<br><span class="mute xs">${esc(a.by?.role || '')}</span></td><td>${badge(/fail|locked/.test(a.action) ? 'FAIL' : /^(delete|purge|archive)/.test(a.action) ? 'bad' : 'info', a.action)}</td>
        <td class="sm">${a.entity?.label ? `<b>${esc(a.entity.label)}</b> ` : ''}${esc(a.detail)}${(a.changes || []).length ? `<ul class="chg">${a.changes.map(c => `<li><span class="mono xs">${esc(c.f)}</span>: ${c.from ? `<s>${esc(c.from)}</s> → ` : ''}<b>${esc(c.to)}</b></li>`).join('')}</ul>` : ''}</td></tr>`).join('') || `<tr><td colspan="4">${empty('🧾', t('none'))}</td></tr>`}</tbody></table></div>
      ${pagerHtml('audit', d.total)}`;
    const go = () => { resetPage('audit'); draw(); };
    let qT = 0; $('#q').oninput = e => { clearTimeout(qT); st.q = e.target.value; qT = setTimeout(() => { resetPage('audit'); draw(true); }, 350); };
    $('#f').onchange = e => { st.from = e.target.value; go(); }; $('#z').onchange = e => { st.to = e.target.value; go(); }; $('#u').onchange = e => { st.user = e.target.value; go(); };
    $('#rs').onclick = () => { Object.assign(st, { from: '', to: '', user: '', cat: '', q: '', entity: '' }); resetPage('audit'); draw(); };
    el.querySelectorAll('[data-c]').forEach(b => (b.onclick = () => { st.cat = b.dataset.c; go(); }));
    onPage('audit', () => draw());
    $('#xl').onclick = async () => { const all = await api(qs(500, 0), { kind: 'staff' }); download(await writeXlsx([{ name: 'Audit', rows: [[t('when'), t('user'), 'Role', 'IP', t('action'), t('details'), t('changes')], ...all.list.map(a => [S.fmtDateTime(a.at), a.by?.name || '', a.by?.role || '', a.ip || '', a.action, `${a.entity?.label || ''} ${a.detail || ''}`.trim(), (a.changes || []).map(c => `${c.f}: ${c.from} → ${c.to}`).join('; ')])], widths: [18, 28, 12, 16, 24, 60, 70], textCols: [0, 1, 2, 3, 4, 5, 6] }]), 'audit-trail.xlsx'); };
    if (keepFocus) { const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  await draw();
}
