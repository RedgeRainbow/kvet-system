/* Round 23: messages between office users; clearing / deleting conversations; deleted accounts take their messages along. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

async function staffApp() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  const mk = async (email, role) => {
    await call('POST', '/users', { token: sa, body: { email, password: 'Passw0rd!x', role, name: email.split('@')[0] } });
    const id = (await call('GET', '/users', { token: sa })).json.list.find(x => x.email === email).id;
    return { id, tok: (await call('POST', '/staff/login', { body: { email, password: 'Passw0rd!x' } })).json.access };
  };
  const me = (await call('GET', '/state', { token: sa })).json.me;
  return { app, call, sa, saId: me.id, mk };
}

test('team messages: approver writes to the superadmin; unread, bell, read, edit, delete', async () => {
  const { call, sa, saId, mk } = await staffApp(), ap = await mk('apv@kvet.az', 'approver'), au = await mk('aud@kvet.az', 'auditor');
  const people = (await call('GET', '/dm/people', { token: ap.tok })).json.list;
  assert.ok(people.some(p => p.id === saId) && !people.some(p => p.id === ap.id), 'colleagues, not myself');
  const s1 = (await call('POST', '/dm/send', { token: ap.tok, body: { to: saId, text: 'Salam, sertifikatı yoxlaya bilərsiz?' } })).json;
  const th = s1.thread.id; assert.match(th, /^dm:/);
  // the superadmin sees it: list, unread, bell
  let l = (await call('GET', '/dm/threads', { token: sa })).json.list; assert.equal(l[0].unread, 1); assert.equal(l[0].name, 'apv');
  let bell = (await call('GET', '/notify', { token: sa })).json; assert.equal(bell.msgs, 1); assert.ok(bell.notes.some(n => n.k === 'nDmFrom'));
  // a third person cannot read it
  assert.equal((await call('GET', '/dm/thread?id=' + encodeURIComponent(th), { token: au.tok })).status, 404);
  // reading clears unread and the bell event
  const r = (await call('GET', '/dm/thread?id=' + encodeURIComponent(th), { token: sa })).json; assert.equal(r.list.length, 1); assert.equal(r.list[0].mine, false);
  bell = (await call('GET', '/notify', { token: sa })).json; assert.equal(bell.msgs, 0); assert.ok(!bell.notes.some(n => n.k === 'nDmFrom'));
  // answer; only the author edits or deletes a message
  const s2 = (await call('POST', '/dm/send', { token: sa, body: { th, text: 'Bəli' } })).json.message;
  assert.equal((await call('POST', '/dm/edit', { token: ap.tok, body: { th, id: s2.id, text: 'x' } })).status, 403);
  assert.equal((await call('POST', '/dm/delete', { token: ap.tok, body: { th, id: s2.id } })).status, 403);
  assert.equal((await call('POST', '/dm/edit', { token: sa, body: { th, id: s2.id, text: 'Bəli, yoxlayıram' } })).status, 200);
  assert.equal((await call('POST', '/dm/delete', { token: ap.tok, body: { th, id: s1.message.id } })).status, 200);
  assert.deepEqual((await call('GET', '/dm/thread?id=' + encodeURIComponent(th), { token: ap.tok })).json.list.map(m => m.text), ['Bəli, yoxlayıram']);
});

test('team messages: clearing is per person; when both clear, the messages are deleted; deleting a user removes them', async () => {
  const { app, call, sa, saId, mk } = await staffApp(), ad = await mk('adm@kvet.az', 'admin');
  const th = (await call('POST', '/dm/send', { token: ad.tok, body: { to: saId, text: 'one' } })).json.thread.id;
  await call('POST', '/dm/send', { token: sa, body: { th, text: 'two' } });
  await call('POST', '/dm/clear', { token: sa, body: { th } });
  assert.equal((await call('GET', '/dm/threads', { token: sa })).json.list.length, 0, 'gone from my list');
  assert.equal((await call('GET', '/dm/thread?id=' + encodeURIComponent(th), { token: ad.tok })).json.list.length, 2, 'still there for the colleague');
  app.clock.t += 1000;
  const r = (await call('POST', '/dm/clear', { token: ad.tok, body: { th } })).json; assert.equal(r.deleted, 2);
  // new messages after clearing show normally
  await call('POST', '/dm/send', { token: ad.tok, body: { th, text: 'three' } });
  assert.deepEqual((await call('GET', '/dm/thread?id=' + encodeURIComponent(th), { token: sa })).json.list.map(m => m.text), ['three']);
  // the user is deleted: the conversation and its events go too
  await call('POST', '/users/delete', { token: sa, body: { id: ad.id } });
  assert.equal((await call('GET', '/dm/threads', { token: sa })).json.list.length, 0);
  assert.equal((await app.store.query('msgs', { where: [['th', 'eq', th]] })).rows.length, 0);
  assert.ok(!(await call('GET', '/notify', { token: sa })).json.notes.some(n => n.k === 'nDmFrom'));
});

test('portal conversations: candidate clears their side; deleting the candidate removes the conversation (also old leftovers)', async () => {
  const { app, call, sa } = await staffApp();
  const mkT = async fin => (await call('POST', '/trainee/save', { token: sa, body: { name: 'Aysel', surname: 'Quliyeva', father: 'Elçin qızı', fin, phone: '+99450' + fin.slice(-7).replace(/\D/g, '7').padEnd(7, '7'), consent: true } })).json;
  const a = await mkT('7MSG001'), b = await mkT('7MSG002');
  const lg = async x => (await call('POST', '/login', { body: { role: 'trainee', login: x.creds.login, password: x.creds.password } })).json.token;
  const ta = await lg(a), tb = await lg(b);
  await call('POST', '/portal/trainee/message', { token: ta, body: { text: 'Sualım var' } });
  await call('POST', '/portal/trainee/message', { token: tb, body: { text: 'Mənim də' } });
  await call('POST', '/msg/send', { token: sa, body: { th: 'trainee:' + a.trainee.id, text: 'Buyurun' } });
  // the candidate clears their side: empty for them, the centre keeps it
  await call('POST', '/portal/trainee/messages/clear', { token: ta, body: {} });
  assert.equal((await call('GET', '/portal/trainee/messages', { token: ta })).json.list.length, 0);
  assert.equal((await call('GET', '/msg/thread?id=trainee:' + a.trainee.id, { token: sa })).json.list.length, 2);
  // deleting candidate A removes the conversation from Messages
  await call('POST', '/delete', { token: sa, body: { kind: 'trainee', id: a.trainee.id } });
  let l = (await call('GET', '/msg/threads', { token: sa })).json.list; assert.deepEqual(l.map(x => x.id), ['trainee:' + b.trainee.id]);
  assert.equal((await app.store.query('msgs', { where: [['th', 'eq', 'trainee:' + a.trainee.id]] })).rows.length, 0);
  // leftovers from before this fix (account removed, conversation kept) disappear on the next look
  await app.store.del('trainees', b.trainee.id);
  l = (await call('GET', '/msg/threads', { token: sa })).json.list; assert.equal(l.length, 0);
  assert.equal(await app.store.get('threads', 'trainee:' + b.trainee.id), undefined);
});
