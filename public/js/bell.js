/* The bell in the top bar of every portal: things to do, recent events and (portals) the conversation with the training centre.
   Polls GET …/notify every 45 s while the tab is visible; opening the panel marks the events as seen. */
import { api } from './api.js';
import { $, esc, t, toast, fail, openModal, confirmDlg } from './ui.js';
import { tr } from './i18n.js';
import { fmtDateTime } from './shared.js';

const base = kind => (kind === 'staff' ? '' : `/portal/${kind}`);
/** @type {any} */ let K = null;
/** @type {any} */ let data = null; let timer = 0, msgTimer = 0, open = false, tab = 'n';

export const bellButton = () => `<button class="btn ghost sm ic bell" id="bellBtn" type="button" aria-label="${esc(t('notifications'))}" title="${esc(t('notifications'))}">🔔<span class="bn" hidden></span></button>`;

const count = d => (d ? d.todo.length + d.unread + (d.msgs || 0) : 0);
function badge() {
  const b = $('#bellBtn .bn'); if (!b) return; const n = count(data);
  b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n); $('#bellBtn')?.classList.toggle('has', !!n);
}
async function poll() {
  if (!K || document.hidden) return;
  try { data = await api(base(K) + '/notify', { kind: K, quiet: true, noRedirect: true }); badge(); if (open && tab === 'n') draw(); } catch {}
}
export function startBell(kind) {
  K = kind; clearInterval(timer); timer = setInterval(poll, kind === 'staff' ? 45000 : 90000); poll();   // portals: every 90 s (hundreds of candidates at once)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  document.addEventListener('kvet:wrote', () => setTimeout(poll, 800));
}
/* an argument may itself be a dictionary key (e.g. a request status) */
const text = n => (n.n !== undefined ? t(n.k, String(n.n), ...(n.a || []).map(x => tr(String(x)))) : t(n.k, ...(n.a || []).map(x => tr(String(x)))));

function panel() {
  let p = $('#npanel'); if (p) return p;
  p = Object.assign(document.createElement('aside'), { id: 'npanel', className: 'npanel' }); p.setAttribute('aria-label', t('notifications'));
  document.body.append(p); return p;
}
function close() { open = false; clearInterval(msgTimer); $('#npanel')?.remove(); }
async function show() {
  open = true; const p = panel(); if (!data) await poll(); draw();
  if (data?.unread) { try { await api(base(K) + '/notify/seen', { kind: K, body: {}, quiet: true }); } catch {} }
}
function draw() {
  const p = $('#npanel'); if (!p || !data) return;
  const portalMsgs = K !== 'staff' && data.canMsg;
  p.innerHTML = `<div class="nh"><b>🔔 ${esc(t('notifications'))}</b><span class="grow"></span><button class="btn ghost sm ic" id="nClose" aria-label="${esc(t('close'))}">✕</button></div>
   ${portalMsgs ? `<div class="tabs" style="margin:0 12px"><button class="tab ${tab === 'n' ? 'on' : ''}" data-nt="n">${esc(t('notifications'))}${data.unread + data.todo.length ? `<span class="n">${data.unread + data.todo.length}</span>` : ''}</button><button class="tab ${tab === 'm' ? 'on' : ''}" data-nt="m">💬 ${esc(t('messages'))}${data.msgs ? `<span class="n">${data.msgs}</span>` : ''}</button></div>` : ''}
   <div class="nb" id="nBody">${tab === 'm' && portalMsgs ? `<div class="mute sm" style="padding:12px">…</div>` : notesHtml()}</div>`;
  if (tab === 'm' && portalMsgs) chat();
}
function notesHtml() {
  const d = data, todo = d.todo.map(x => `<button class="ni todo" data-link="${esc(x.link || '')}"><span class="ic">${esc(x.icon || '•')}</span><span>${esc(text(x))}</span></button>`).join('');
  const msgs = K === 'staff' && d.msgs ? `<button class="ni todo" data-link="#/messages"><span class="ic">💬</span><span>${esc(t('nMsgsUnread', d.msgs))}</span></button>` : '';
  const notes = d.notes.map(x => `<button class="ni ${x.unread ? 'new' : ''}" data-link="${esc(x.link || '')}"><span class="ic">${x.unread ? '●' : '○'}</span><span>${esc(text(x))}<br><span class="mute xs">${esc(fmtDateTime(x.at))}</span></span></button>`).join('');
  return `${todo || msgs ? `<div class="ns">${esc(t('toDo'))}</div>${msgs}${todo}` : ''}<div class="ns">${esc(t('recent'))}</div>${notes || `<p class="mute sm" style="padding:6px 14px">${esc(t('noNotifications'))}</p>`}`;
}
/* edit one message: resolves the new text, or null */
export const editText = text => new Promise(res => { const m = openModal({ title: t('msgEdit'), html: `<textarea id="metx" rows="4" maxlength="2000" style="width:100%">${esc(text)}</textarea>`,
  buttons: [{ label: t('cancel'), cls: 'ghost', id: 'x' }, { label: t('save'), id: 'ok', fn: d => { const v = $('#metx', d).value.trim(); if (!v) return false; res(v); return true; } }] }); m.promise.then(v => v !== 'ok' && res(null)); });
/* the conversation with the training centre (trainer / candidate / company portals) */
async function chat() {
  const body = $('#nBody'); if (!body) return;
  const load = async () => {
    const r = await api(base(K) + '/messages', { kind: K, quiet: true });
    const log = $('#nLog'); if (!log) return; const atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    log.innerHTML = r.list.map(m => `<div class="msg ${m.from === 'staff' ? 'assistant' : 'user'}" data-mid="${esc(m.id)}"><div class="b">${esc(m.text)}</div><div class="src">${m.from === 'staff' ? esc(t('trainingCentre')) + (m.by ? ' · ' + esc(m.by) : '') + ' · ' : ''}${esc(fmtDateTime(m.at))}${m.editedAt ? ' · ' + esc(t('msgEdited')) : ''}${m.from !== 'staff' ? ` <button class="mact" data-medit="${esc(m.id)}" title="${esc(t('edit'))}">✏</button><button class="mact" data-mdel="${esc(m.id)}" title="${esc(t('delete'))}">🗑</button>` : ''}</div></div>`).join('') || `<p class="mute sm">${esc(t('msgEmpty'))}</p>`;
    log.onclick = async e => {
      const ed = e.target.closest('[data-medit]'), dl = e.target.closest('[data-mdel]'); if (!ed && !dl) return; e.stopPropagation();
      const m = r.list.find(x => x.id === (ed || dl).dataset[ed ? 'medit' : 'mdel']);
      try {
        if (dl) { if (!await confirmDlg(t('msgDeleteConfirm'), { danger: true })) return; await api(base(K) + '/message/delete', { kind: K, body: { id: m.id } }); }
        else { const v = await editText(m.text); if (v === null) return; await api(base(K) + '/message/edit', { kind: K, body: { id: m.id, text: v } }); }
        await load();
      } catch (/** @type {any} */ er) { fail(er); }
    };
    if (atEnd) log.scrollTop = log.scrollHeight;
    if (data.msgs) { data.msgs = 0; badge(); }
  };
  body.innerHTML = `<p class="hint" style="margin:8px 12px">${esc(t('msgPortalHint'))}</p><div class="chatlog nlog" id="nLog"></div>
    <form class="nsend" id="nSend"><textarea id="nTxt" rows="2" maxlength="2000" placeholder="${esc(t('msgPlaceholder'))}"></textarea><button class="btn" type="submit">${esc(t('sendMsg'))}</button></form>`;
  $('#nSend').onsubmit = async e => {
    e.preventDefault(); const x = $('#nTxt'), v = x.value.trim(); if (!v) return;
    try { await api(base(K) + '/message', { kind: K, body: { text: v } }); x.value = ''; await load(); } catch (/** @type {any} */ er) { if (er.message === 'tooMany') toast(t('msgTooMany'), 'bad'); else fail(er); }
  };
  $('#nTxt').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#nSend').requestSubmit(); };
  try { await load(); const log = $('#nLog'); if (log) log.scrollTop = log.scrollHeight; } catch (/** @type {any} */ er) { fail(er); }
  clearInterval(msgTimer); msgTimer = setInterval(() => { if (open && tab === 'm' && !document.hidden) load().catch(() => {}); }, 15000);
}

document.addEventListener('click', e => {
  if (e.target?.closest('#bellBtn')) { e.preventDefault(); return open ? close() : show(); }
  if (!open) return;
  if (e.target?.closest('#nClose')) return close();
  const nt = e.target?.closest('[data-nt]'); if (nt) { tab = nt.dataset.nt; return draw(); }
  const ni = e.target?.closest('#npanel [data-link]');
  if (ni) {
    const l = ni.dataset.link;
    if (l === 'msg') { tab = 'm'; return draw(); }
    if (l.startsWith('#/')) { location.hash = l; close(); return; }
    if (l) document.dispatchEvent(new CustomEvent('kvet:goto', { detail: l }));
    close(); return;
  }
  if (!e.target?.closest('#npanel') && !e.target?.closest('dialog')) close();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && open && !document.querySelector('dialog[open]')) close(); });
/* open the conversation from elsewhere (e.g. a "Write to us" button) */
export const openMessages = () => { tab = 'm'; show(); };
