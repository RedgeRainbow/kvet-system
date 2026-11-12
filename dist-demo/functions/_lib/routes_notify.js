/* Notifications and messages.

   Notifications (the bell in every portal):
   - "to do": counted live when asked (certificates to sign, approvals, new requests, documents to sign, …);
   - events: short records in the "notes" collection, addressed to
       staff:*            every staff member         staff:a:<action>  staff who may do <action> (e.g. staff:a:requests)
       staff:u:<userId>   one staff member           trainer:<id> · trainee:<id> · company:<id>
     A note is unread while it is newer than the moment the person last opened the panel ("nseen" collection).
   Each person decides what their panel shows (their "nseen" record): an event can be dismissed (hid), all events cleared
   (clr = everything up to that moment), and one KIND of event muted for good (mute). A to-do cannot be dismissed while
   the work is open: "later" hides it until the next day (snz), and it comes back sooner if more of the same work arrives.
   A to-do disappears by itself once the work is done; events tied to work (a new request, a candidate to approve,
   a message) carry a ref and are removed for everybody when that work is handled.
   Messages: one conversation per portal account (trainer / company / candidate) with the training centre. Staff who may handle
   messages (admin, superadmin) answer from Admin -> Messages; every message is kept (collection "msgs", thread summary "threads"). */
import { S, str, need, uid, audit, sessionsOf, enrOf, enrsOfSession, getSettings } from './core.js';
import { sessionSigns } from './signs.js';
import { trainerTodo } from './routes_portal.js';
import { dmUnread } from './routes_dm.js';

const NOTE_ACTS = ['requests', 'approve', 'cand.approve', 'cert.sign', 'messages', 'issue'];
const KEEP = 40;                                   // notes shown in the panel
const now = c => new Date(c.now()).toISOString();

/* who a person is, as a notes address list + their own key */
function addrOf(c) {
  if (c.user?.kind === 'staff' || (c.user && !c.me)) {
    const r = c.user.role; return { me: 'staff:u:' + c.user.id, to: ['staff:*', 'staff:u:' + c.user.id, ...NOTE_ACTS.filter(a => S.can(r, a)).map(a => 'staff:a:' + a)] };
  }
  const k = c.user.kind + ':' + c.me.id; return { me: k, to: [k] };
}
/* a note for one or more addresses: k = dictionary key, a = its arguments, link = where it leads in that portal (#/…) */
export async function notify(c, to, k, a = /** @type {any[]} */ ([]), link = '', ref = '') {
  const list = [...new Set([].concat(to).filter(Boolean))]; if (!list.length) return;
  const at = now(c); try { await c.D.put('notes', list.map(t => ({ id: uid('n'), data: { to: t, k, a: a.map(x => String(x ?? '').slice(0, 160)), link, at, ...(ref ? { ref } : {}) } }))); } catch {}
}
/* the work behind these events is done: remove them from every panel */
export async function doneNotes(c, ref) {
  try { const ids = (await c.D.query('notes', { where: [['ref', 'eq', ref]], limit: 500, fields: ['ref'] })).rows.map(r => r.id); if (ids.length) await c.D.delMany('notes', ids); } catch {}
}
/* trainer / company / candidate accounts are deleted: their conversation, events and panel settings go with them.
   keys: "trainee:<id>", "trainer:<id>", "company:<id>" */
export async function forgetAccounts(c, keys) {
  keys = [...new Set(keys)]; if (!keys.length) return;
  for (let i = 0; i < keys.length; i += 200) {
    const part = keys.slice(i, i + 200);
    const msgs = (await c.D.query('msgs', { where: [['th', 'in', part]], limit: 20000, fields: ['th'] })).rows.map(r => r.id);
    const notes = (await c.D.query('notes', { where: [['to', 'in', part]], limit: 20000, fields: ['to'] })).rows.map(r => r.id);
    if (msgs.length) await c.D.delMany('msgs', msgs);
    if (notes.length) await c.D.delMany('notes', notes);
    for (const k of part) await doneNotes(c, 'msg:s:' + k);
    await c.D.delMany('threads', part); await c.D.delMany('nseen', part);
  }
}
/* kinds of events a person may mute (to-dos and messages to answer cannot be muted) */
export const MUTABLE = ['nCertReady', 'nCoCertReady', 'nSessionNew', 'nSessionAdded', 'nDocsOpen', 'nTbtOpen', 'nRqUpdated', 'nCandOk', 'nCandRet'];
const todoKey = x => x.k + '|' + (x.link || '') + '|' + (x.a || []).join('|');

/* live "to do" counts */
async function todoStaff(c) {
  const r = c.user.role, out = [], q = (col, where) => c.D.query(col, { where, limit: 0, count: true }).then(x => x.total || 0);
  if (S.can(r, 'cert.sign')) { const n = await q('certs', [['sign', 'null', true], ['esign', 'null', true], ['revoked', 'null', true], ['approval.status', 'nn', 'pending'], ['approval.status', 'nn', 'returned']]); if (n) out.push({ k: 'nCertsToSign', n, link: S.can(r, 'approve') ? '#/approvals' : '#/certificates/st=UNSIGNED', icon: '✍' }); }
  if (S.can(r, 'approve')) {
    const [a, b, d] = await Promise.all([q('tests', [['approval.status', 'eq', 'pending']]).catch(() => 0), q('materials', [['status', 'eq', 'pending']]), q('certs', [['approval.status', 'eq', 'pending']])]);
    const cands = S.can(r, 'cand.approve') ? await q('candreq', [['status', 'eq', 'pending']]).catch(() => 0) : 0;
    if (a + b + d + cands) out.push({ k: 'nApprovals', n: a + b + d + cands, link: '#/approvals', icon: '✅' });
  }
  if (S.can(r, 'requests')) { const n = await q('requests', [['status', 'eq', 'new']]); if (n) out.push({ k: 'nRequests', n, link: '#/requests', icon: '📨' }); }
  return out;
}
async function todoTrainer(c) {
  const today = c.today(), ss = (await c.D.query('sessions', { where: [['tid', 'eq', c.me.id]] })).rows.map(r => r.data)
    .filter(s => !s.cancelled && !s.closed && today >= s.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  const out = [];
  for (const s of ss) {
    const [sg, enrs] = await Promise.all([sessionSigns(c, s.id), enrsOfSession(c.D, s)]); const n = trainerTodo(s, enrs, sg, today).length;
    if (n) out.push({ k: 'nTrainerTodo', n, a: [S.fmtDate(s.date)], link: '#/' + s.id, icon: '✍' });
  }
  return out;
}
async function todoTrainee(c) {
  const today = c.today(), out = [];
  for (const s of await sessionsOf(c.D, c.me.id)) {
    if (s.cancelled || s.closed || today < s.date || today > S.sessionEnd(s)) continue;
    const e = await enrOf(c.D, s.id, c.me.id); if (!e.att || e.final) continue;
    const ready = S.docsReady(s); let n = 0;
    if (ready && s.sheetId && !e.doh) n++;
    if (ready && !e.fb) n++;
    if (ready && s.tbt?.open && !e.tbtAck) n++;
    if (n) out.push({ k: 'nTraineeTodo', n, link: '', icon: '✍' });
    else if (S.multiDay(s) && !ready) out.push({ k: 'nWaitFinalDay', n: 0, a: [S.fmtDate(S.finalDay(s))], link: '', icon: '⏳' });
  }
  return out;
}
async function todoCompany(c) {
  const st = await getSettings(c.D), soon = st.soonDays ?? S.SOON_DAYS, lim = new Date(Date.parse(c.today()) + soon * 864e5).toISOString().slice(0, 10), out = [];
  const n = (await c.D.query('certs', { where: [['co', 'eq', c.me.id], ['revoked', 'null', true], ['renewed', 'null', true], ['expiry', 'lte', lim]], limit: 0, count: true })).total || 0;
  if (n) out.push({ k: 'nCoExpiring', n, link: '', icon: '⏰' });
  const ret = (await c.D.byField('candreq', 'co', c.me.id)).filter(r => r.data.status === 'returned' && !r.data.seenReturn).length;
  if (ret) out.push({ k: 'nCoReturned', n: ret, link: '', icon: '↩' });
  return out;
}
const TODO = { staff: todoStaff, trainer: todoTrainer, trainee: todoTrainee, company: todoCompany };

async function feed(c, kind) {
  const ad = addrOf(c), [all, seen, allTodo, th] = await Promise.all([
    c.D.query('notes', { where: [['to', 'in', ad.to]], order: ['at', 'desc'], limit: KEEP * 3 }).then(r => r.rows.map(x => ({ id: x.id, ...x.data }))),
    c.D.get('nseen', ad.me), TODO[kind](c).catch(() => []),
    kind === 'staff' ? Promise.all([S.can(c.user.role, 'messages') ? c.D.query('threads', { where: [['unreadStaff', 'gt', 0]], limit: 0, count: true }).then(r => r.total || 0) : 0, dmUnread(c).catch(() => 0)]).then(([p, d]) => p + d)
      : c.D.get('threads', ad.me).then(t => t?.unreadAcc || 0)]);
  const since = seen?.at || '', hid = new Set(seen?.hid || []), clr = seen?.clr || '', mute = new Set(seen?.mute || []), snz = seen?.snz || {}, today = c.today();
  const notes = all.filter(n => !hid.has(n.id) && n.at > clr && !mute.has(n.k)).slice(0, KEEP);
  // a to-do put off until tomorrow stays hidden today, unless more of that work has come in since
  const later = (/** @type {any[]} */ (allTodo)).filter(x => { const z = snz[todoKey(x)]; return z && z.d >= today && (x.n || 0) <= (z.n || 0); });
  const todo = allTodo.filter(x => !later.includes(x)).map(x => ({ ...x, key: todoKey(x) }));
  return { todo, later: later.length, muted: [...mute], mutable: MUTABLE, notes: notes.map(({ to, ...n }) => ({ ...n, unread: n.at > since })),
    unread: notes.filter(n => n.at > since).length, msgs: th, canMsg: kind !== 'staff' || !c.user.emergency };
}
/* the person's panel settings are kept with their "seen" moment */
async function panelOf(c) { const ad = addrOf(c); return { ad, p: (await c.D.get('nseen', ad.me)) || { at: '' } }; }
async function markSeen(c) { const { ad, p } = await panelOf(c); await c.D.put('nseen', [{ id: ad.me, data: { ...p, at: now(c) } }]); return { ok: 1 }; }
/* { op: 'hide', id } dismiss one event · 'clear' every event so far · 'later', key, n a to-do until tomorrow
   · 'mute', k / 'unmute', k one kind of event · 'unmuteAll' · 'show' brings back everything hidden or put off */
async function panelAct(c) {
  const b = await c.body(), { ad, p } = await panelOf(c), op = str(b.op, 12);
  if (op === 'hide') p.hid = [...new Set([str(b.id, 40), ...(p.hid || [])])].filter(Boolean).slice(0, 300);
  else if (op === 'clear') { p.clr = now(c); p.hid = []; }
  else if (op === 'later') { const key = str(b.key, 300); need(key, 'badInput'); p.snz = { ...Object.fromEntries(Object.entries(p.snz || {}).filter(([, z]) => z.d >= c.today())), [key]: { d: c.today(), n: Number(b.n) || 0 } }; }
  else if (op === 'mute') { const k = str(b.k, 40); need(MUTABLE.includes(k), 'badInput'); p.mute = [...new Set([...(p.mute || []), k])]; }
  else if (op === 'unmute') p.mute = (p.mute || []).filter(k => k !== str(b.k, 40));
  else if (op === 'show') { p.hid = []; p.clr = ''; p.snz = {}; p.mute = []; }
  else need(false, 'badInput');
  await c.D.put('nseen', [{ id: ad.me, data: p }]); return { ok: 1 };
}

/* ---------------------------------------------------------------- messages */
const TH_KINDS = ['trainer', 'trainee', 'company'];
const nameOfAcc = (kind, x) => (kind === 'company' ? x.name : S.fullAz(x) || S.fullEn(x));
async function post(c, th, from, text) {
  const t = str(text, 2000).trim(); need(t, 'badInput');
  // staff answer under their profile name (never their e-mail address: it is not shown in the portals)
  const by = from === 'staff' ? ((await c.D.get('staff', c.user.id))?.name || '') : th.name;
  const m = { id: uid('g'), th: th.id, from, by, ...(from === 'staff' ? { uid: c.user.id } : {}), text: t, at: now(c) };
  await c.D.put('msgs', [{ id: m.id, data: m }]);
  Object.assign(th, { last: t.slice(0, 140), lastAt: m.at, lastFrom: from });
  if (from === 'staff') th.unreadAcc = (th.unreadAcc || 0) + 1; else th.unreadStaff = (th.unreadStaff || 0) + 1;
  await c.D.put('threads', [{ id: th.id, data: th }]);
  return m;
}
/* after an edit or a delete: the conversation's last line follows the messages that remain */
async function relast(c, th) {
  const l = await msgsOf(c, th.id), m = l[l.length - 1];
  Object.assign(th, m ? { last: m.text.slice(0, 140), lastAt: m.at, lastFrom: m.from } : { last: '', lastAt: th.lastAt || now(c), lastFrom: '' });
  await c.D.put('threads', [{ id: th.id, data: th }]);
}
async function editMsg(c, th, id, text, mine) {
  const m = await c.D.get('msgs', str(id, 60)); need(m && m.th === th.id, 'noRec', 404); need(mine(m), 'forbidden', 403);
  m.text = str(text, 2000).trim(); need(m.text, 'badInput'); m.editedAt = now(c);
  await c.D.put('msgs', [{ id: m.id, data: m }]); await relast(c, th); return m;
}
async function delMsg(c, th, id, mine) {
  const m = await c.D.get('msgs', str(id, 60)); need(m && m.th === th.id, 'noRec', 404); need(mine(m), 'forbidden', 403);
  await c.D.del('msgs', m.id); await relast(c, th); return { ok: 1 };
}
const msgsOf = async (c, id) => (await c.D.query('msgs', { where: [['th', 'eq', id]], order: ['at', 'desc'], limit: 200 })).rows.map(r => r.data).reverse();
async function threadFor(c, kind, id) {
  need(TH_KINDS.includes(kind), 'badInput'); const acc = await c.D.get(kind === 'company' ? 'companies' : kind + 's', str(id, 60)); need(acc, 'noRec', 404);
  const tid = kind + ':' + acc.id; return (await c.D.get('threads', tid)) || { id: tid, kind, acc: acc.id, name: nameOfAcc(kind, acc), att: acc.att || '', unreadStaff: 0, unreadAcc: 0 };
}
const portal = kind => ({
  [`GET /portal/${kind}/notify`]: { auth: kind, async fn(c) { return feed(c, kind); } },
  [`POST /portal/${kind}/notify/seen`]: { auth: kind, async fn(c) { return markSeen(c); } },
  [`POST /portal/${kind}/notify/act`]: { auth: kind, async fn(c) { return panelAct(c); } },
  /* clear the conversation on my side (the training centre keeps its copy of what was said) */
  [`POST /portal/${kind}/messages/clear`]: { auth: kind, async fn(c) {
    const th = await threadFor(c, kind, c.me.id); if (!th.lastAt) return { ok: 1 };
    th.clrAcc = now(c); th.unreadAcc = 0; await c.D.put('threads', [{ id: th.id, data: th }]); await doneNotes(c, 'msg:p:' + th.id); return { ok: 1 };
  } },
  [`GET /portal/${kind}/messages`]: { auth: kind, async fn(c) {
    const th = await threadFor(c, kind, c.me.id), list = (await msgsOf(c, th.id)).filter(m => m.at > (th.clrAcc || ''));
    if (th.unreadAcc) { th.unreadAcc = 0; await c.D.put('threads', [{ id: th.id, data: th }]); await doneNotes(c, 'msg:p:' + th.id); }
    return { list: list.map(({ by, uid: _u, ...m }) => ({ ...m, by: m.from === 'staff' ? by : '' })) };
  } },
  // own messages only
  [`POST /portal/${kind}/message/edit`]: { auth: kind, async fn(c) { const b = await c.body(); return { message: await editMsg(c, await threadFor(c, kind, c.me.id), b.id, b.text, m => m.from === 'acc') }; } },
  [`POST /portal/${kind}/message/delete`]: { auth: kind, async fn(c) { const b = await c.body(); return delMsg(c, await threadFor(c, kind, c.me.id), b.id, m => m.from === 'acc'); } },
  [`POST /portal/${kind}/message`]: { auth: kind, async fn(c) {
    const b = await c.body(), th = await threadFor(c, kind, c.me.id);
    // a simple brake against floods: at most 30 messages an hour from one account
    const hour = new Date(c.now() - 36e5).toISOString(), recent = (await msgsOf(c, th.id)).filter(m => m.from !== 'staff' && m.at > hour).length;
    need(recent < 30, 'tooMany', 429);
    const m = await post(c, th, 'acc', b.text);
    await notify(c, 'staff:a:messages', 'nMsgFrom', [th.name], '#/messages/' + encodeURIComponent(th.id), 'msg:s:' + th.id);
    return { message: m };
  } },
});

/** @type {import('../../types/store').Routes} */
export const notifyRoutes = {
  'GET /notify': { auth: 'staff', act: 'view', async fn(c) { return feed(c, 'staff'); } },
  'POST /notify/seen': { auth: 'staff', act: 'view', async fn(c) { return markSeen(c); } },
  'POST /notify/act': { auth: 'staff', act: 'view', async fn(c) { return panelAct(c); } },
  ...portal('trainer'), ...portal('trainee'), ...portal('company'),
  /* staff side of the conversations */
  'GET /msg/threads': { auth: 'staff', act: 'messages', async fn(c) {
    const q = S.foldText(str(c.url.searchParams.get('q'), 80)).trim();
    const all = (await c.D.query('threads', { order: ['lastAt', 'desc'], limit: 300 })).rows.map(r => r.data).filter(t => TH_KINDS.includes(t.kind));
    const exists = new Set();
    await Promise.all(TH_KINDS.map(async k => { const ids = all.filter(t => t.kind === k).map(t => t.acc); if (ids.length) for (const r of await c.D.getMany(k === 'company' ? 'companies' : k + 's', ids)) exists.add(k + ':' + r.id); }));
    const gone = all.filter(t => !exists.has(t.id)); if (gone.length) await forgetAccounts(c, gone.map(t => t.id));
    const rows = all.filter(t => exists.has(t.id));
    return { list: q ? rows.filter(t => S.foldText(`${t.name} ${t.att || ''}`).includes(q)) : rows };
  } },
  'GET /msg/thread': { auth: 'staff', act: 'messages', async fn(c) {
    const p = c.url.searchParams, [kind, id] = str(p.get('id'), 80).split(':'), th = await threadFor(c, kind, id);
    if (th.unreadStaff) { th.unreadStaff = 0; await c.D.put('threads', [{ id: th.id, data: th }]); }
    await doneNotes(c, 'msg:s:' + th.id);                    // read: the "new message" events go away
    return { thread: th, list: (await msgsOf(c, th.id)).map(m => ({ ...m, mine: m.from === 'staff' && m.uid === c.user.id })) };
  } },
  // staff edit their own answers; they may delete any message, or the whole conversation (kept in the audit trail)
  'POST /msg/edit': { auth: 'staff', act: 'messages', async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(':'); return { message: await editMsg(c, await threadFor(c, kind, id), b.id, b.text, m => m.from === 'staff' && m.uid === c.user.id) };
  } },
  'POST /msg/delete': { auth: 'staff', act: 'messages', async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(':'), th = await threadFor(c, kind, id);
    const r = await delMsg(c, th, b.id, () => true); await audit(c, 'message.delete', th.name); return r;
  } },
  'POST /msg/thread/delete': { auth: 'staff', act: 'messages', async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(':'), th = await threadFor(c, kind, id), ids = (await c.D.query('msgs', { where: [['th', 'eq', th.id]], limit: 5000, fields: ['th'] })).rows.map(r => r.id);
    if (ids.length) await c.D.delMany('msgs', ids); await c.D.del('threads', th.id);
    await audit(c, 'message.history.delete', `${th.name} · ${ids.length}`); return { ok: 1, n: ids.length };
  } },
  'POST /msg/send': { auth: 'staff', act: 'messages', async fn(c) {
    const b = await c.body(), [kind, id] = str(b.th, 80).split(':'), th = await threadFor(c, kind, id);
    const m = await post(c, th, 'staff', b.text); th.unreadStaff = 0; await c.D.put('threads', [{ id: th.id, data: th }]);
    await doneNotes(c, 'msg:s:' + th.id);                    // answered
    await notify(c, th.id, 'nMsgFromCentre', [], 'msg', 'msg:p:' + th.id);
    await audit(c, 'message.send', th.name); return { message: m, thread: th };
  } },
};
