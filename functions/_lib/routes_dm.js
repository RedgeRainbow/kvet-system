/* Team messages: one-to-one conversations between office users (Admin -> Messages -> a colleague).
   Every staff role may use them (not the break-glass account). A conversation is "dm:<idA>|<idB>" (ids sorted) in
   "threads"; its messages are in "msgs" like the portal conversations.
   - unread per person; a "new message" event in the recipient's bell, removed when they read it
   - each person can clear the conversation for THEMSELVES; once both have cleared it, the cleared messages are deleted
   - deleting a user removes their conversations (forgetStaff) */
import { str, need, uid } from './core.js';
import { notify, doneNotes } from './routes_notify.js';

const now = c => new Date(c.now()).toISOString();
export const dmId = (a, b) => 'dm:' + [a, b].sort().join('|');
const members = th => [th.a, th.b];
const nameOf = s => (s?.name || s?.email || '').trim();
function me(c) { need(!c.user.emergency, 'forbidden', 403); return c.user.id; }

async function load(c, id) {
  const th = await c.D.get('threads', str(id, 200)); need(th && th.kind === 'dm' && members(th).includes(c.user.id), 'noRec', 404); return th;
}
async function open(c, other) {
  const mine = me(c); need(other && other !== mine, 'badInput');
  const [a, b] = await Promise.all([c.D.get('staff', mine), c.D.get('staff', other)]); need(b, 'noRec', 404);
  const id = dmId(mine, other), old = await c.D.get('threads', id);
  return old || { id, kind: 'dm', acc: '', a: [mine, other].sort()[0], b: [mine, other].sort()[1],
    names: { [mine]: nameOf(a) || c.user.email, [other]: nameOf(b) }, unread: {}, clr: {} };
}
const visible = (th, who) => (m) => m.at > (th.clr?.[who] || '');
const msgsOf = async (c, th) => (await c.D.query('msgs', { where: [['th', 'eq', th.id]], order: ['at', 'desc'], limit: 300 })).rows.map(r => r.data).reverse();
const out = (th, who) => { const other = th.a === who ? th.b : th.a; return { id: th.id, kind: 'dm', other, name: th.names?.[other] || '', unread: th.unread?.[who] || 0, last: (th.lastAt || '') > (th.clr?.[who] || '') ? th.last || '' : '', lastAt: th.lastAt || '' }; };

/* my conversations */
export async function myDms(c) {
  const who = c.user.id, [x, y] = await Promise.all([c.D.query('threads', { where: [['kind', 'eq', 'dm'], ['a', 'eq', who]], limit: 500 }), c.D.query('threads', { where: [['kind', 'eq', 'dm'], ['b', 'eq', who]], limit: 500 })]);
  return [...x.rows, ...y.rows].map(r => r.data);
}
export const dmUnread = async c => (c.user.emergency ? 0 : (await myDms(c)).reduce((s, th) => s + (th.unread?.[c.user.id] || 0), 0));

/* a user is deleted: their conversations go with them */
export async function forgetStaff(c, id) {
  const all = [...(await c.D.query('threads', { where: [['kind', 'eq', 'dm'], ['a', 'eq', id]], limit: 1000 })).rows, ...(await c.D.query('threads', { where: [['kind', 'eq', 'dm'], ['b', 'eq', id]], limit: 1000 })).rows];
  for (const r of all) {
    const ids = (await c.D.query('msgs', { where: [['th', 'eq', r.id]], limit: 5000, fields: ['th'] })).rows.map(m => m.id);
    if (ids.length) await c.D.delMany('msgs', ids);
    await doneNotes(c, 'dm:' + r.id + ':' + (r.data.a === id ? r.data.b : r.data.a));
  }
  if (all.length) await c.D.delMany('threads', all.map(r => r.id));
  const notes = (await c.D.query('notes', { where: [['to', 'eq', 'staff:u:' + id]], limit: 5000, fields: ['to'] })).rows.map(r => r.id);
  if (notes.length) await c.D.delMany('notes', notes);
  await c.D.del('nseen', 'staff:u:' + id);
  return all.length;
}

/** @type {import('../../types/store').Routes} */
export const dmRoutes = {
  /* colleagues I can write to */
  'GET /dm/people': { auth: 'staff', act: 'view', async fn(c) {
    const who = me(c);
    return { list: (await c.D.all('staff')).filter(r => r.id !== who && r.id !== 'emergency').map(r => ({ id: r.id, name: nameOf(r.data), email: r.data.email, role: r.data.role }))
      .sort((p, q) => p.name.localeCompare(q.name)) };
  } },
  'GET /dm/threads': { auth: 'staff', act: 'view', async fn(c) {
    const who = me(c);
    return { list: (await myDms(c)).filter(th => (th.lastAt || '') > (th.clr?.[who] || '')).map(th => out(th, who)).sort((p, q) => (p.lastAt < q.lastAt ? 1 : -1)) };
  } },
  'GET /dm/thread': { auth: 'staff', act: 'view', async fn(c) {
    const who = me(c), p = c.url.searchParams, id = str(p.get('id'), 200);
    const th = id ? await load(c, id) : await open(c, str(p.get('to'), 80));
    if (th.unread?.[who]) { th.unread[who] = 0; await c.D.put('threads', [{ id: th.id, data: th }]); }
    if (id) await doneNotes(c, 'dm:' + th.id + ':' + who);
    const list = th.lastAt ? (await msgsOf(c, th)).filter(visible(th, who)) : [];
    return { thread: out(th, who), list: list.map(m => ({ ...m, mine: m.from === who })) };
  } },
  'POST /dm/send': { auth: 'staff', act: 'view', async fn(c) {
    const who = me(c), b = await c.body(), text = str(b.text, 2000).trim(); need(text, 'badInput');
    // a conversation's first message may name it by its id ("dm:<a>|<b>") before it exists
    const pair = String(b.th || '').startsWith('dm:') ? str(b.th, 200).slice(3).split('|') : [];
    const to = b.to ? str(b.to, 80) : pair.length === 2 && pair.includes(who) ? pair.find(x => x !== who) || '' : '';
    const th = b.th && (await c.D.get('threads', str(b.th, 200))) ? await load(c, b.th) : await open(c, to), other = th.a === who ? th.b : th.a;
    const hour = new Date(c.now() - 36e5).toISOString();
    need((await msgsOf(c, th)).filter(m => m.from === who && m.at > hour).length < 60, 'tooMany', 429);
    const myName = th.names?.[who] || c.user.email;
    const m = { id: uid('g'), th: th.id, from: who, by: myName, text, at: now(c) };
    await c.D.put('msgs', [{ id: m.id, data: m }]);
    th.last = text.slice(0, 140); th.lastAt = m.at; th.lastFrom = who; th.unread = { ...(th.unread || {}), [other]: (th.unread?.[other] || 0) + 1, [who]: 0 };
    await c.D.put('threads', [{ id: th.id, data: th }]);
    await notify(c, 'staff:u:' + other, 'nDmFrom', [myName], '#/messages/' + encodeURIComponent(th.id), 'dm:' + th.id + ':' + other);
    return { message: { ...m, mine: true }, thread: out(th, who) };
  } },
  'POST /dm/edit': { auth: 'staff', act: 'view', async fn(c) {
    const who = me(c), b = await c.body(), th = await load(c, b.th), m = await c.D.get('msgs', str(b.id, 60));
    need(m && m.th === th.id, 'noRec', 404); need(m.from === who, 'forbidden', 403);
    m.text = str(b.text, 2000).trim(); need(m.text, 'badInput'); m.editedAt = now(c);
    await c.D.put('msgs', [{ id: m.id, data: m }]); return { message: { ...m, mine: true } };
  } },
  'POST /dm/delete': { auth: 'staff', act: 'view', async fn(c) {
    const who = me(c), b = await c.body(), th = await load(c, b.th), m = await c.D.get('msgs', str(b.id, 60));
    need(m && m.th === th.id, 'noRec', 404); need(m.from === who, 'forbidden', 403);
    await c.D.del('msgs', m.id); return { ok: 1 };
  } },
  /* clear the conversation for me; when both sides have cleared it, those messages are deleted */
  'POST /dm/clear': { auth: 'staff', act: 'view', async fn(c) {
    const who = me(c), b = await c.body(), th = await load(c, b.th);
    th.clr = { ...(th.clr || {}), [who]: now(c) }; th.unread = { ...(th.unread || {}), [who]: 0 };
    const both = th.clr[th.a] && th.clr[th.b] ? (th.clr[th.a] < th.clr[th.b] ? th.clr[th.a] : th.clr[th.b]) : '';
    let n = 0;
    if (both) {
      const ids = (await msgsOf(c, th)).filter(m => m.at <= both).map(m => m.id); n = ids.length;
      if (ids.length) await c.D.delMany('msgs', ids);
    }
    await c.D.put('threads', [{ id: th.id, data: th }]); await doneNotes(c, 'dm:' + th.id + ':' + who);
    return { ok: 1, deleted: n };
  } },
};
