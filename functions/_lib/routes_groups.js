/* Candidate groups: a saved list of candidates (e.g. "Caspian Drilling — riggers, November") that can be added to a session at once.
   A group only refers to candidates; deleting a group never touches the candidates or their sessions. */
import { str, need, uid, audit } from './core.js';

async function readGroup(c, b) {
  const name = str(b.name, 120); need(name, 'needName');
  const ids = [...new Set((b.traineeIds || []).map(x => str(x, 60)))].slice(0, 1000);
  for (const t of await Promise.all(ids.map(id => c.D.get('trainees', id)))) need(t, 'badInput');
  return { name, note: str(b.note, 500), traineeIds: ids };
}
/** @type {import('../../types/store').Routes} */
export const groupRoutes = {
  'GET /groups': { auth: 'staff', act: 'library', async fn(c) { return { list: (await c.D.all('groups')).map(r => r.data).sort((a, b) => a.name.localeCompare(b.name)) }; } },
  'POST /group/save': { auth: 'staff', act: 'session.save', async fn(c) {
    const b = await c.body(), f = await readGroup(c, b); let x;
    if (b.id) { x = await c.D.get('groups', str(b.id, 60)); need(x, 'noRec', 404); Object.assign(x, f, { updatedAt: new Date(c.now()).toISOString() }); }
    else x = { id: uid('g'), ...f, createdAt: new Date(c.now()).toISOString(), by: c.user.email };
    await c.D.put('groups', [{ id: x.id, data: x }]); await audit(c, b.id ? 'group.update' : 'group.create', `${x.name} (${x.traineeIds.length})`, { entity: { kind: 'group', id: x.id, label: x.name } });
    return { group: x };
  } },
  'POST /groups/delete': { auth: 'staff', act: 'session.save', async fn(c) {
    const b = await c.body(), ids = [...new Set((b.ids || []).map(x => str(x, 60)))].slice(0, 1000); need(ids.length, 'badInput');
    let n = 0; for (const id of ids) { const x = await c.D.get('groups', id); if (x) { await c.D.del('groups', id); n++; } }
    await audit(c, 'group.delete', `${n} group(s)`); return { ok: 1, n };
  } },
  'POST /group/delete': { auth: 'staff', act: 'session.save', async fn(c) {
    const b = await c.body(), x = await c.D.get('groups', str(b.id, 60)); need(x, 'noRec', 404);
    await c.D.del('groups', x.id); await audit(c, 'group.delete', x.name); return { ok: 1 };
  } },
};
