/* Training / renewal requests sent by companies from their portal. */
import { ensurePeople, A, can, view, api, S, $, esc, t, toast, openModal, empty, badge, matches, pageHead, bar, searchBox, tabs, blank, trainee, paged, onPage } from './lib.js';

const ST = ['new', 'planned', 'done', 'rejected'];
const stBadge = s => badge({ new: 'PENDING', planned: 'info', done: 'PASS', rejected: 'FAIL' }[s] || '', t('rq_' + s));

export default async function ({ rerender }) {
  const el = view(); const R0 = await api('/requests', { kind: 'staff' }); let list = R0.list, q = '', tab = 'open';
  const cands = R0.candidates || [], byTr = R0.byTrainers || [], coName = id => A.companies.find(c => c.id === id)?.name || t('private');
  const cst = x => (x.status === 'approved' ? badge('PASS', t('candApproved')) : x.status === 'returned' ? badge('FAIL', t('candReturned')) : badge('PENDING', t('candPending')));
  const candTable = () => `<p class="hint">${esc(t('candReqHint'))}</p><div class="tw"><table class="sortable"><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('company'))}</th><th>${esc(t('fullName'))}</th><th>${esc(t('mobile'))}</th><th>${esc(t('status'))}</th></tr></thead><tbody>${cands.filter(x => matches(q, x.coName, S.fullAz(x.person), x.person.phone)).map(x => `<tr><td data-sort="${esc(x.at)}">${esc(S.fmtDateTime(x.at))}</td><td><b>${esc(x.coName)}</b></td><td>${esc(S.fullAz(x.person))}${x.person.fin ? `<br><span class="mono xs">${esc(x.person.fin)}</span>` : ''}</td><td>${esc(x.person.phone || '')}</td><td>${cst(x)}${x.review ? `<div class="xs mute">${esc(x.review.by)} · ${esc(S.fmtDateTime(x.review.at))}${x.review.note ? ' · ' + esc(x.review.note) : ''}</div>` : ''}${x.traineeId ? `<div class="xs"><a href="#/trainees/${esc(x.traineeId)}" class="mono">${esc(x.traineeId)}</a></div>` : ''}</td></tr>`).join('') || `<tr><td colspan="5">${empty('🧑‍🎓', t('candNone'))}</td></tr>`}</tbody></table></div>${cands.some(x => x.status === 'pending') && can('cand.approve') ? `<p><a class="btn" href="#/approvals">${esc(t('navApprovals'))} →</a></p>` : ''}`;
  const trTable = () => `<p class="hint">${esc(t('byTrainersHint'))}</p><div class="tw"><table class="sortable"><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('trainer'))}</th><th>${esc(t('fullName'))}</th><th>${esc(t('learnerNo'))}</th><th>${esc(t('company'))}</th></tr></thead><tbody>${byTr.filter(x => matches(q, x.name, x.by, x.att)).map(x => `<tr><td data-sort="${esc(x.at)}">${esc(S.fmtDateTime(x.at))}</td><td>${esc(x.by)}</td><td><b>${esc(x.name)}</b></td><td class="mono">${esc(x.att)}</td><td>${esc(x.co ? coName(x.co) : t('private'))}</td></tr>`).join('') || `<tr><td colspan="5">${empty('🧑‍🏫', t('none'))}</td></tr>`}</tbody></table></div>`;
  let P; const draw = () => { if (!el.isConnected) return;   // the person has moved to another page meanwhile
    onPage('requests', draw); const open = list.filter(x => x.status === 'new' || x.status === 'planned'), rows = (tab === 'open' ? open : list).filter(x => matches(q, x.coName, x.note, x.contact, blank(x.bid)?.name, ...(x.certs || [])));
    el.innerHTML = pageHead(t('navRequests')) + `<p class="mute" style="margin-top:-8px">${esc(t('requestsIntro'))}</p>` + tabs([['open', t('rqOpen'), open.length], ['all', t('rqAll'), list.length], ['cands', t('candRegs'), cands.filter(x => x.status === 'pending').length || cands.length], ['trainers', t('addedByTrainers'), byTr.length]], tab) + bar(searchBox('q', q))
      + (tab === 'cands' ? candTable() : tab === 'trainers' ? trTable() : `<div class="tw"><table class="cards"><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('company'))}</th><th>${esc(t('rqKind'))}</th><th>${esc(t('training'))}</th><th>${esc(t('rqPeople'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead><tbody>
      ${(P = paged('requests', rows, JSON.stringify([tab, q]))).rows.map(x => `<tr class="click" data-id="${esc(x.id)}"><td>${esc(S.fmtDateTime(x.at))}</td><td><b>${esc(x.coName)}</b>${x.contact ? `<br><span class="mute xs">${esc(x.contact)}</span>` : ''}</td><td>${esc(t('rk_' + x.kind))}</td>
        <td>${esc(blank(x.bid)?.name || '')}${x.certs?.length ? `<br><span class="mono xs">${esc(x.certs.join(', '))}</span>` : ''}</td><td>${x.people?.length || x.count || '—'}${x.date ? `<br><span class="mute xs">${esc(t('rqWhen'))}: ${esc(S.fmtDate(x.date))}</span>` : ''}</td><td>${stBadge(x.status)}</td><td class="act"><button class="btn ghost sm" data-o="${esc(x.id)}">${esc(t('open'))}</button></td></tr>`).join('')
        || `<tr><td colspan="7">${empty('📨', t('rqNone'))}</td></tr>`}</tbody></table></div>${P.html}`);
    $('#q').oninput = e => { q = e.target.value; const p = e.target.selectionStart; draw(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); };
  };
  draw();
  el.onclick = async e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; return draw(); }
    const r = e.target.closest('tr[data-id]'); if (!r) return;
    const x = list.find(k => k.id === r.dataset.id);
    await ensurePeople(x.people || []);
    const people = (x.people || []).map(id => trainee(id)).filter(Boolean);
    openModal({ title: `${x.coName} · ${t('rk_' + x.kind)}`, wide: true, html: `<p><b>${esc(t('date'))}:</b> ${esc(S.fmtDateTime(x.at))}${x.contact ? ` · <b>${esc(t('rqContact'))}:</b> ${esc(x.contact)}` : ''}</p>
      ${x.bid ? `<p><b>${esc(t('training'))}:</b> ${esc(blank(x.bid)?.name || '')}</p>` : ''}${x.date ? `<p><b>${esc(t('rqWhen'))}:</b> ${esc(S.fmtDate(x.date))}</p>` : ''}
      ${x.certs?.length ? `<p><b>${esc(t('navCerts'))}:</b> <span class="mono">${esc(x.certs.join(', '))}</span></p>` : ''}
      ${people.length ? `<p><b>${esc(t('rqPeople'))} (${people.length}):</b> ${people.map(p => `${esc(S.fullAz(p))} <span class="mono xs">${esc(p.att)}</span>`).join(', ')}</p>` : x.count ? `<p><b>${esc(t('rqPeople'))}:</b> ${x.count}</p>` : ''}
      ${x.note ? `<div class="banner" style="white-space:pre-wrap">${esc(x.note)}</div>` : ''}
      ${can('requests') ? `<div class="fg" style="margin-top:12px"><label>${esc(t('status'))}<select id="rs">${ST.map(s => `<option value="${s}" ${s === x.status ? 'selected' : ''}>${esc(t('rq_' + s))}</option>`).join('')}</select></label>
      <label class="full">${esc(t('rqReply'))}<textarea id="rr" maxlength="1000" placeholder="${esc(t('rqReplyHint'))}">${esc(x.reply || '')}</textarea></label></div>` : ''}`,
      buttons: [{ label: t('close'), cls: 'ghost', id: 'x' }, ...(can('requests') ? [{ label: t('save'), id: 'ok', fn: async d => {
        const r2 = await api('/request/update', { kind: 'staff', body: { id: x.id, status: $('#rs', d).value, reply: $('#rr', d).value } });
        Object.assign(x, r2.request); toast(t('saved'), 'ok'); draw(); return true; } }] : [])] });
  };
}
