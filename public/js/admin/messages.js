/* Messages: one conversation per trainer, company or candidate with the training centre. Admins and the superadmin answer;
   everything is kept. The other side writes from the bell (🔔 -> Messages) in their portal. */
import { A, view, api, S, $, esc, t, toast, fail, openModal, confirmDlg, empty, pageHead, findTrainees, opts } from './lib.js';
import { editText } from '../bell.js';

const KIND_ICON = { trainer: '🎓', company: '🏢', trainee: '👤' };
export default async function ({ args = /** @type {any[]} */ ([]) }) {
  const el = view(); let list = [], cur = args[0] ? decodeURIComponent(args[0]) : '', q = '', timer = 0;
  el.innerHTML = pageHead(t('navMessages'), `<button class="btn" id="newM">＋ ${esc(t('newMessage'))}</button>`) + `<p class="mute" style="margin-top:-8px">${esc(t('messagesIntro'))}</p>
    <div class="mbox"><div class="card" style="padding:0"><div style="padding:8px"><input class="sr-in" id="mq" type="search" placeholder="${esc(t('search'))}" style="width:100%"></div><div class="thl" id="thl"></div></div>
    <div class="card conv" id="conv">${empty('💬', t('pickConversation'))}</div></div>`;
  const loadList = async () => { list = (await api('/msg/threads?q=' + encodeURIComponent(q), { kind: 'staff', quiet: true })).list; drawList(); };
  const drawList = () => { $('#thl').innerHTML = list.map(x => `<button class="th ${x.id === cur ? 'on' : ''}" data-th="${esc(x.id)}">${x.unreadStaff ? `<span class="bd PENDING n">${x.unreadStaff}</span>` : ''}${KIND_ICON[x.kind] || ''} <b>${esc(x.name)}</b>${x.att ? ` <span class="mute xs mono">${esc(x.att)}</span>` : ''}<br><span class="mute xs">${x.lastFrom === 'staff' ? '↪ ' : ''}${esc(x.last || '')}</span><br><span class="mute xs">${esc(S.fmtDateTime(x.lastAt))}</span></button>`).join('') || `<p class="mute sm" style="padding:10px">${esc(t('none'))}</p>`; };
  async function openTh(id) {
    cur = id; drawList(); if (location.hash !== '#/messages/' + encodeURIComponent(id)) history.replaceState(null, '', '#/messages/' + encodeURIComponent(id));
    const r = await api('/msg/thread?id=' + encodeURIComponent(id), { kind: 'staff' }), th = r.thread;
    $('#conv').innerHTML = `<div class="row" style="margin-bottom:8px"><b>${KIND_ICON[th.kind] || ''} ${esc(th.name)}</b>${th.att ? ` <span class="mute mono sm">${esc(th.att)}</span>` : ''}<span class="grow"></span><span class="mute xs">${esc(t('kind_' + th.kind))}</span><button class="btn bad ghost sm" id="mclr" style="margin-left:8px">🗑 ${esc(t('msgDeleteHistory'))}</button></div>
      <div class="chatlog" id="mlog">${log(r.list)}</div>
      <form id="msend" class="row" style="margin-top:8px;align-items:flex-end"><textarea id="mtxt" rows="2" maxlength="2000" style="flex:1" placeholder="${esc(t('msgPlaceholder'))}"></textarea><button class="btn" type="submit">${esc(t('sendMsg'))}</button></form>`;
    const lg = $('#mlog'); lg.scrollTop = lg.scrollHeight;
    $('#mclr').onclick = async () => { if (!await confirmDlg(t('msgDeleteHistoryConfirm', th.name), { danger: true })) return; try { await api('/msg/thread/delete', { kind: 'staff', body: { th: id } }); toast(t('deleted'), 'ok'); cur = ''; history.replaceState(null, '', '#/messages'); $('#conv').innerHTML = empty('💬', t('pickConversation')); await loadList(); } catch (/** @type {any} */ er) { fail(er); } };
    lg.onclick = async e => {
      const ed = e.target.closest('[data-medit]'), dl = e.target.closest('[data-mdel]'); if (!ed && !dl) return;
      try {
        if (dl) { if (!await confirmDlg(t('msgDeleteConfirm'), { danger: true })) return; await api('/msg/delete', { kind: 'staff', body: { th: id, id: dl.dataset.mdel } }); }
        else { const v = await editText(ed.closest('.msg').querySelector('.b').textContent); if (v === null) return; await api('/msg/edit', { kind: 'staff', body: { th: id, id: ed.dataset.medit, text: v } }); }
        await refresh(); await loadList();
      } catch (/** @type {any} */ er) { fail(er); }
    };
    $('#msend').onsubmit = async e => { e.preventDefault(); const v = $('#mtxt').value.trim(); if (!v) return; try { await api('/msg/send', { kind: 'staff', body: { th: id, text: v } }); $('#mtxt').value = ''; await refresh(); await loadList(); } catch (/** @type {any} */ er) { fail(er); } };
    $('#mtxt').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#msend').requestSubmit(); };
    const l = list.find(x => x.id === id); if (l) l.unreadStaff = 0; drawList();
  }
  const log = msgs => msgs.map(m => `<div class="msg ${m.from === 'staff' ? 'user' : 'assistant'}"><div class="b">${esc(m.text)}</div><div class="src">${esc(m.by || '')} · ${esc(S.fmtDateTime(m.at))}${m.editedAt ? ' · ' + esc(t('msgEdited')) : ''} ${m.mine ? `<button class="mact" data-medit="${esc(m.id)}" title="${esc(t('edit'))}">✏</button>` : ''}<button class="mact" data-mdel="${esc(m.id)}" title="${esc(t('delete'))}">🗑</button></div></div>`).join('') || `<p class="mute sm">${esc(t('msgEmpty'))}</p>`;
  const refresh = async () => { if (!cur || !$('#mlog')) return; const r = await api('/msg/thread?id=' + encodeURIComponent(cur), { kind: 'staff', quiet: true }), lg = $('#mlog'), end = lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 30; lg.innerHTML = log(r.list); if (end) lg.scrollTop = lg.scrollHeight; };
  $('#thl').onclick = e => { const b = e.target.closest('[data-th]'); if (b) openTh(b.dataset.th).catch(fail); };
  let tq = 0; $('#mq').oninput = e => { clearTimeout(tq); tq = setTimeout(() => { q = e.target.value; loadList().catch(() => {}); }, 250); };
  // a new conversation: pick a trainer, a company or a candidate
  $('#newM').onclick = () => {
    let found = [];
    const m = openModal({ title: t('newMessage'), html: `<div class="fg"><label>${esc(t('recipientKind'))}<select id="rk">${opts([['trainer', t('kind_trainer')], ['company', t('kind_company')], ['trainee', t('kind_trainee')]], 'trainer')}</select></label>
      <label>${esc(t('recipient'))}<input id="rq" type="search" placeholder="${esc(t('search'))}" autocomplete="off"></label></div><div class="pick" id="rl" style="max-height:260px"></div>`,
      onMount: d => {
        const draw = async () => {
          const k = $('#rk', d).value, v = $('#rq', d).value.trim(), f = S.foldText(v);
          if (k === 'trainer') found = A.trainers.filter(x => x.on !== false && S.foldText(S.fullAz(x, false)).includes(f)).map(x => ({ id: x.id, name: S.fullAz(x, false) }));
          else if (k === 'company') found = A.companies.filter(x => S.foldText(x.name).includes(f)).map(x => ({ id: x.id, name: x.name }));
          else found = v.length < 2 ? [] : (await findTrainees({ q: v, size: 20 })).list.map(x => ({ id: x.id, name: S.fullAz(x), att: x.att }));
          $('#rl', d).innerHTML = found.slice(0, 50).map(x => `<label style="cursor:pointer" data-pick="${esc(k + ':' + x.id)}">${KIND_ICON[k]} ${esc(x.name)} ${x.att ? `<span class="mute xs mono">${esc(x.att)}</span>` : ''}</label>`).join('') || `<span class="mute sm">${esc(k === 'trainee' && v.length < 2 ? t('typeToSearch') : t('none'))}</span>`;
        };
        let tm = 0; $('#rq', d).oninput = () => { clearTimeout(tm); tm = setTimeout(draw, 200); }; $('#rk', d).onchange = draw; draw();
        $('#rl', d).onclick = e => { const p = e.target.closest('[data-pick]'); if (!p) return; d.close(); openTh(p.dataset.pick).catch(fail); };
      }, buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }] });
  };
  await loadList(); if (cur) await openTh(cur).catch(() => {});
  clearInterval(timer); timer = setInterval(() => { if (!document.hidden && document.contains($('#thl'))) { loadList().catch(() => {}); refresh().catch(() => {}); } else if (!document.contains($('#thl'))) clearInterval(timer); }, 15000);
  return () => clearInterval(timer);
}
