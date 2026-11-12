/* Messages: two kinds of conversation in one list.
   - Team: one-to-one with a colleague (every office user). "Clear conversation" clears it for me only; once both have
     cleared it, those messages are deleted.
   - Portals (admins, superadmin): one conversation per trainer, company or candidate with the training centre; they write
     from the bell (🔔 -> Messages) in their portal. "Delete conversation" removes it for everybody. */
import { A, view, api, S, $, esc, t, toast, fail, openModal, confirmDlg, empty, pageHead, findTrainees, opts, can } from './lib.js';
import { editText } from '../bell.js';

const KIND_ICON = { trainer: '🎓', company: '🏢', trainee: '👤', dm: '👥' };
const isDm = id => String(id).startsWith('dm:');
/* the two kinds behind one interface */
const PORTAL = {
  list: async q => (await api('/msg/threads?q=' + encodeURIComponent(q), { kind: 'staff', quiet: true })).list.map(x => ({ ...x, unread: x.unreadStaff || 0, mineLast: x.lastFrom === 'staff' })),
  open: async id => { const r = await api('/msg/thread?id=' + encodeURIComponent(id), { kind: 'staff', quiet: true }); return { th: r.thread, list: r.list.map(m => ({ ...m, right: m.from === 'staff' })) }; },
  send: (id, text) => api('/msg/send', { kind: 'staff', body: { th: id, text } }),
  edit: (id, mid, text) => api('/msg/edit', { kind: 'staff', body: { th: id, id: mid, text } }),
  del: (id, mid) => api('/msg/delete', { kind: 'staff', body: { th: id, id: mid } }),
  clear: id => api('/msg/thread/delete', { kind: 'staff', body: { th: id } }),
};
const TEAM = {
  list: async q => { const f = S.foldText(q); return (await api('/dm/threads', { kind: 'staff', quiet: true })).list.filter(x => !f || S.foldText(x.name).includes(f)); },
  open: async id => { const r = await api('/dm/thread?' + (isDm(id) ? 'id=' : 'to=') + encodeURIComponent(isDm(id) ? id : id.slice(4)), { kind: 'staff', quiet: true }); return { th: r.thread, list: r.list.map(m => ({ ...m, right: m.mine })) }; },
  send: (id, text) => api('/dm/send', { kind: 'staff', body: isDm(id) ? { th: id, text } : { to: id.slice(4), text } }),
  edit: (id, mid, text) => api('/dm/edit', { kind: 'staff', body: { th: id, id: mid, text } }),
  del: (id, mid) => api('/dm/delete', { kind: 'staff', body: { th: id, id: mid } }),
  clear: id => api('/dm/clear', { kind: 'staff', body: { th: id } }),
};
/* "new:<userId>" = a conversation with a colleague that has no messages yet */
const kindOf = id => (isDm(id) || String(id).startsWith('new:') ? TEAM : PORTAL);

export default async function ({ args = /** @type {any[]} */ ([]) }) {
  const el = view(), portals = can('messages');
  let list = /** @type {any[]} */ ([]), cur = args[0] ? decodeURIComponent(args[0]) : '', q = '', timer = 0;
  el.innerHTML = pageHead(t('navMessages'), `<button class="btn" id="newM">＋ ${esc(t('newMessage'))}</button>`) + `<p class="mute" style="margin-top:-8px">${esc(t(portals ? 'messagesIntro2' : 'messagesIntroTeam'))}</p>
    <div class="mbox"><div class="card" style="padding:0"><div style="padding:8px"><input class="sr-in" id="mq" type="search" placeholder="${esc(t('search'))}" style="width:100%"></div><div class="thl" id="thl"></div></div>
    <div class="card conv" id="conv">${empty('💬', t('pickConversation'))}</div></div>`;
  const loadList = async () => {
    const [a, b] = await Promise.all([TEAM.list(q), portals ? PORTAL.list(q) : []]);
    list = [...a, ...b].sort((x, y) => ((x.lastAt || '') < (y.lastAt || '') ? 1 : -1)); drawList();
  };
  const drawList = () => {
    if (!el.isConnected) return;
    $('#thl').innerHTML = list.map(x => `<button class="th ${x.id === cur ? 'on' : ''}" data-th="${esc(x.id)}">${x.unread ? `<span class="bd PENDING n">${x.unread}</span>` : ''}${KIND_ICON[x.kind] || ''} <b>${esc(x.name)}</b>${x.att ? ` <span class="mute xs mono">${esc(x.att)}</span>` : ''}<br><span class="mute xs">${x.mineLast ? '↪ ' : ''}${esc(x.last || '')}</span><br><span class="mute xs">${esc(x.lastAt ? S.fmtDateTime(x.lastAt) : '')}</span></button>`).join('') || `<p class="mute sm" style="padding:10px">${esc(t('none'))}</p>`;
  };
  const log = msgs => msgs.map(m => `<div class="msg ${m.right ? 'user' : 'assistant'}"><div class="b">${esc(m.text)}</div><div class="src">${esc(m.by || '')} · ${esc(S.fmtDateTime(m.at))}${m.editedAt ? ' · ' + esc(t('msgEdited')) : ''} ${m.mine ? `<button class="mact" data-medit="${esc(m.id)}" title="${esc(t('edit'))}">✏</button>` : ''}${m.mine || !isDm(cur) ? `<button class="mact" data-mdel="${esc(m.id)}" title="${esc(t('delete'))}">🗑</button>` : ''}</div></div>`).join('') || `<p class="mute sm">${esc(t('msgEmpty'))}</p>`;

  async function openTh(id) {
    const K = kindOf(id), r = await K.open(id), th = r.th;
    if (th.id && th.id !== id) id = th.id;                     // "new:<user>" becomes the real conversation once it exists
    cur = id; drawList(); if (location.hash !== '#/messages/' + encodeURIComponent(id)) history.replaceState(null, '', '#/messages/' + encodeURIComponent(id));
    const team = K === TEAM;
    $('#conv').innerHTML = `<div class="row" style="margin-bottom:8px"><b>${KIND_ICON[team ? 'dm' : th.kind] || ''} ${esc(th.name)}</b>${th.att ? ` <span class="mute mono sm">${esc(th.att)}</span>` : ''}<span class="grow"></span><span class="mute xs">${esc(team ? t('kind_colleague') : t('kind_' + th.kind))}</span>
       ${r.list.length ? `<button class="btn bad ghost sm" id="mclr" style="margin-left:8px">🗑 ${esc(t(team ? 'msgClearForMe' : 'msgDeleteHistory'))}</button>` : ''}</div>
      <div class="chatlog" id="mlog">${log(r.list)}</div>
      <form id="msend" class="row" style="margin-top:8px;align-items:flex-end"><textarea id="mtxt" rows="2" maxlength="2000" style="flex:1" placeholder="${esc(t('msgPlaceholder'))}"></textarea><button class="btn" type="submit">${esc(t('sendMsg'))}</button></form>`;
    const lg = $('#mlog'); lg.scrollTop = lg.scrollHeight;
    $('#mclr')?.addEventListener('click', async () => {
      if (!await confirmDlg(team ? t('msgClearForMeConfirm', th.name) : t('msgDeleteHistoryConfirm', th.name), { danger: true })) return;
      try { await K.clear(id); toast(t(team ? 'msgCleared' : 'deleted'), 'ok'); cur = ''; history.replaceState(null, '', '#/messages'); $('#conv').innerHTML = empty('💬', t('pickConversation')); await loadList(); } catch (/** @type {any} */ e) { fail(e); }
    });
    lg.onclick = async e => {
      const ed = e.target?.closest('[data-medit]'), dl = e.target?.closest('[data-mdel]'); if (!ed && !dl) return;
      try {
        if (dl) { if (!await confirmDlg(t('msgDeleteConfirm'), { danger: true })) return; await K.del(id, dl.dataset.mdel); }
        else { const v = await editText(ed.closest('.msg').querySelector('.b').textContent); if (v === null) return; await K.edit(id, ed.dataset.medit, v); }
        await refresh(); await loadList();
      } catch (/** @type {any} */ er) { fail(er); }
    };
    $('#msend').onsubmit = async e => {
      e.preventDefault(); const v = $('#mtxt').value.trim(); if (!v) return;
      try { const r2 = await K.send(id, v); $('#mtxt').value = ''; if (r2.thread?.id && r2.thread.id !== id) return openTh(r2.thread.id).then(loadList); await refresh(); await loadList(); } catch (/** @type {any} */ er) { fail(er); }
    };
    $('#mtxt').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#msend').requestSubmit(); };
    const l = list.find(x => x.id === id); if (l) l.unread = 0; drawList();
    document.dispatchEvent(new CustomEvent('kvet:wrote')); document.dispatchEvent(new CustomEvent('kvet:badges'));   // the bell and the menu recount unread messages
  }
  const refresh = async () => {
    if (!cur || !$('#mlog') || cur.startsWith('new:')) return;
    const r = await kindOf(cur).open(cur), lg = $('#mlog'), end = lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 30;
    lg.innerHTML = log(r.list); if (end) lg.scrollTop = lg.scrollHeight;
  };
  $('#thl').onclick = e => { const b = e.target?.closest('[data-th]'); if (b) openTh(b.dataset.th).catch(fail); };
  let tq = 0; $('#mq').oninput = e => { clearTimeout(tq); tq = setTimeout(() => { q = e.target.value; loadList().catch(() => {}); }, 250); };
  // a new conversation: a colleague, or (admins) a trainer, a company or a candidate
  $('#newM').onclick = () => {
    let found = /** @type {any[]} */ ([]), staff = /** @type {any[] | null} */ (null);
    const kinds = [['staff', t('kind_colleague')], ...(portals ? [['trainer', t('kind_trainer')], ['company', t('kind_company')], ['trainee', t('kind_trainee')]] : [])];
    openModal({ title: t('newMessage'), html: `<div class="fg"><label>${esc(t('recipientKind'))}<select id="rk">${opts(kinds, 'staff')}</select></label>
      <label>${esc(t('recipient'))}<input id="rq" type="search" placeholder="${esc(t('search'))}" autocomplete="off"></label></div><div class="pick" id="rl" style="max-height:260px"></div>`,
      onMount: d => {
        const draw = async () => {
          const k = $('#rk', d).value, v = $('#rq', d).value.trim(), f = S.foldText(v);
          if (k === 'staff') { staff ||= (await api('/dm/people', { kind: 'staff' })).list; found = (staff || []).filter(x => S.foldText(`${x.name} ${x.email}`).includes(f)).map(x => ({ id: 'new:' + x.id, name: x.name || x.email, sub: t('role_' + x.role) })); }
          else if (k === 'trainer') found = A.trainers.filter(x => x.on !== false && S.foldText(S.fullAz(x, false)).includes(f)).map(x => ({ id: 'trainer:' + x.id, name: S.fullAz(x, false) }));
          else if (k === 'company') found = A.companies.filter(x => S.foldText(x.name).includes(f)).map(x => ({ id: 'company:' + x.id, name: x.name }));
          else found = v.length < 2 ? [] : (await findTrainees({ q: v, size: 20 })).list.map(x => ({ id: 'trainee:' + x.id, name: S.fullAz(x), sub: x.att }));
          $('#rl', d).innerHTML = found.slice(0, 50).map(x => `<label style="cursor:pointer" data-pick="${esc(x.id)}">${KIND_ICON[k === 'staff' ? 'dm' : k]} ${esc(x.name)} ${x.sub ? `<span class="mute xs">${esc(x.sub)}</span>` : ''}</label>`).join('') || `<span class="mute sm">${esc(k === 'trainee' && v.length < 2 ? t('typeToSearch') : t('none'))}</span>`;
        };
        let tm = 0; $('#rq', d).oninput = () => { clearTimeout(tm); tm = setTimeout(draw, 200); }; $('#rk', d).onchange = draw; draw().catch(fail);
        $('#rl', d).onclick = e => { const p = e.target?.closest('[data-pick]'); if (!p) return; d.close(); openTh(p.dataset.pick).catch(fail); };
      }, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }] });
  };
  await loadList(); if (cur) await openTh(cur).catch(() => {});
  clearInterval(timer); timer = setInterval(() => { if (!el.isConnected) return clearInterval(timer); if (!document.hidden) { loadList().catch(() => {}); refresh().catch(() => {}); } }, 15000);
  return () => clearInterval(timer);
}
