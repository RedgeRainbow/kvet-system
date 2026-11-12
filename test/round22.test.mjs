/* Round 22: editable learner numbers, numbering per year, notification panel controls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

async function setup() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  const st = (await call('GET', '/state', { token: sa })).json;
  const mk = async (fin, name = 'Aysel') => (await call('POST', '/trainee/save', { token: sa, body: { name, surname: 'Quliyeva', father: 'Elçin qızı', fin, phone: '+99450' + fin.replace(/\D/g, '').padEnd(7, '1').slice(0, 7), consent: true } })).json;
  return { app, call, sa, st, mk };
}

test('learner number: change it to an earlier year\'s number; the sign-in name follows; certificates on request', async () => {
  const { call, sa, st, mk } = await setup(), year = new Date().getUTCFullYear();
  const a = await mk('7AAA001'), b = await mk('7AAA002', 'Orxan');
  assert.match(a.trainee.att, new RegExp(`^E-${year}\\d{5}$`));
  const cert = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: a.trainee.id, bid: st.blanks[0].id, start: st.today, end: st.today } })).json.cert;
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Boss', title: 'Director' } });
  assert.equal((await call('POST', '/cert/sign', { token: sa, body: { nos: [cert.no], mode: 'esign' } })).json.results[0].ok, true);

  // checks: format, someone else's number
  assert.equal((await call('POST', '/trainee/att', { token: sa, body: { id: a.trainee.id, att: 'x' } })).json.error, 'badAttNo');
  assert.equal((await call('POST', '/trainee/att', { token: sa, body: { id: a.trainee.id, att: b.trainee.att } })).json.error, 'attTaken');

  const r = (await call('POST', '/trainee/att', { token: sa, body: { id: a.trainee.id, att: 'e-202300150', certs: true } })).json;
  assert.equal(r.trainee.att, 'E-202300150'); assert.equal(r.trainee.id, a.trainee.id, 'the record keeps its key');
  assert.equal(r.login, 'E-202300150'); assert.equal(r.certs, 1); assert.equal(r.unsigned, 1);
  // signs in with the new number and the same password; the old number is free again as a sign-in name
  assert.equal((await call('POST', '/login', { body: { role: 'trainee', login: 'E-202300150', password: a.creds.password } })).status, 200);
  assert.notEqual((await call('POST', '/login', { body: { role: 'trainee', login: a.trainee.att, password: a.creds.password } })).status, 200);
  const c2 = (await call('GET', '/trainee/history?id=' + a.trainee.id, { token: sa })).json.certs[0];
  assert.equal(c2.snap.att, 'E-202300150'); assert.ok(!c2.sign && !c2.esign, 'changed certificate must be signed again');
  // found by the old number as well; nobody else can take the new one
  const found = (await call('GET', '/trainees/find?q=' + encodeURIComponent(a.trainee.att), { token: sa })).json;
  assert.ok(JSON.stringify(found).includes('E-202300150'), 'search by the previous number');
  assert.equal((await call('POST', '/trainee/att', { token: sa, body: { id: b.trainee.id, att: 'E-202300150' } })).json.error, 'attTaken');
  // only admin and above
  const ed = await (async () => { await call('POST', '/users', { token: sa, body: { email: 'ed@kvet.az', password: 'Passw0rd!x', role: 'editor' } }); return (await call('POST', '/staff/login', { body: { email: 'ed@kvet.az', password: 'Passw0rd!x' } })).json.access; })();
  assert.equal((await call('POST', '/trainee/att', { token: ed, body: { id: b.trainee.id, att: 'E-202300151' } })).status, 403);
});

test('numbering: a number typed in by hand is skipped; deleted numbers are never given again; a new year starts at 00001', async () => {
  const { app, call, sa, mk } = await setup(), year = new Date().getUTCFullYear();
  const a = await mk('7BBB001'), n = Number(a.trainee.att.slice(-5));
  // the office gives someone the NEXT number by hand: the counter must skip it
  const b = await mk('7BBB002', 'Orxan');
  await call('POST', '/trainee/att', { token: sa, body: { id: b.trainee.id, att: `E-${year}${String(n + 2).padStart(5, '0')}` } });
  const c = await mk('7BBB003', 'Kamran'), d = await mk('7BBB004', 'Leyla');
  const nos = [c.trainee.att, d.trainee.att];
  assert.ok(!nos.includes(`E-${year}${String(n + 2).padStart(5, '0')}`), 'the hand-typed number is not given twice: ' + nos);
  // deleting a person does not make their number available again
  await call('POST', '/delete', { token: sa, body: { kind: 'trainee', id: d.trainee.id } });
  const e = await mk('7BBB005', 'Nigar');
  assert.ok(Number(e.trainee.att.slice(-5)) > Number(d.trainee.att.slice(-5)));
  // next year: numbering starts again at 00001
  app.clock.t = Date.parse(`${year + 1}-01-02T08:00:00Z`);
  const f = await mk('7BBB006', 'Səbinə');
  assert.equal(f.trainee.att, `E-${year + 1}00001`);
});

test('notifications: dismiss, clear all, remind tomorrow, mute a kind; handled work disappears for everybody', async () => {
  const { app, call, sa, st } = await setup();
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Bell Test LLC' } })).json;
  const ck = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  // two company requests -> two "new request" events and a to-do for the office
  const r1 = (await call('POST', '/portal/company/request', { token: ck, body: { kind: 'training', bid: st.blanks[0].id, note: 'one' } })).json.request;
  await call('POST', '/portal/company/request', { token: ck, body: { kind: 'training', bid: st.blanks[0].id, note: 'two' } });
  let f = (await call('GET', '/notify', { token: sa })).json;
  const rq = f.notes.filter(n => n.k === 'nRqNew'); assert.equal(rq.length, 2);
  const todo = f.todo.find(x => x.k === 'nRequests'); assert.equal(todo.n, 2); assert.ok(todo.key);

  // handling request 1 removes its event; the other stays
  await call('POST', '/request/update', { token: sa, body: { id: r1.id, status: 'planned' } });
  f = (await call('GET', '/notify', { token: sa })).json;
  assert.equal(f.notes.filter(n => n.k === 'nRqNew').length, 1);

  // remind me tomorrow: hidden today, back tomorrow (still not done), back at once if more work arrives
  await call('POST', '/notify/act', { token: sa, body: { op: 'later', key: f.todo.find(x => x.k === 'nRequests').key, n: 1 } });
  f = (await call('GET', '/notify', { token: sa })).json;
  assert.ok(!f.todo.some(x => x.k === 'nRequests')); assert.equal(f.later, 1);
  await call('POST', '/portal/company/request', { token: ck, body: { kind: 'training', bid: st.blanks[0].id, note: 'three' } });
  assert.ok((await call('GET', '/notify', { token: sa })).json.todo.some(x => x.k === 'nRequests' && x.n === 2), 'more work: shown again');
  await call('POST', '/notify/act', { token: sa, body: { op: 'later', key: (await call('GET', '/notify', { token: sa })).json.todo.find(x => x.k === 'nRequests').key, n: 2 } });
  app.clock.t += 864e5;
  assert.ok((await call('GET', '/notify', { token: sa })).json.todo.some(x => x.k === 'nRequests'), 'next day: back');

  // dismiss one event, then clear all
  f = (await call('GET', '/notify', { token: sa })).json;
  await call('POST', '/notify/act', { token: sa, body: { op: 'hide', id: f.notes[0].id } });
  assert.equal((await call('GET', '/notify', { token: sa })).json.notes.length, f.notes.length - 1);
  await call('POST', '/notify/act', { token: sa, body: { op: 'clear' } });
  assert.equal((await call('GET', '/notify', { token: sa })).json.notes.length, 0);
  // opening the panel keeps these choices
  await call('POST', '/notify/seen', { token: sa, body: {} });
  assert.equal((await call('GET', '/notify', { token: sa })).json.notes.length, 0);
  // another staff member still sees their own events
  await call('POST', '/users', { token: sa, body: { email: 'adm@kvet.az', password: 'Passw0rd!x', role: 'admin' } });
  const ak = (await call('POST', '/staff/login', { body: { email: 'adm@kvet.az', password: 'Passw0rd!x' } })).json.access;
  assert.ok((await call('GET', '/notify', { token: ak })).json.notes.some(n => n.k === 'nRqNew'));

  // the company mutes "request updated"; to-dos cannot be muted
  await call('POST', '/request/update', { token: sa, body: { id: r1.id, status: 'done' } });
  let cf = (await call('GET', '/portal/company/notify', { token: ck })).json;
  assert.ok(cf.notes.some(n => n.k === 'nRqUpdated'));
  await call('POST', '/portal/company/notify/act', { token: ck, body: { op: 'mute', k: 'nRqUpdated' } });
  cf = (await call('GET', '/portal/company/notify', { token: ck })).json;
  assert.ok(!cf.notes.some(n => n.k === 'nRqUpdated')); assert.deepEqual(cf.muted, ['nRqUpdated']);
  assert.equal((await call('POST', '/portal/company/notify/act', { token: ck, body: { op: 'mute', k: 'nRequests' } })).status, 400);
  await call('POST', '/portal/company/notify/act', { token: ck, body: { op: 'show' } });
  assert.ok((await call('GET', '/portal/company/notify', { token: ck })).json.notes.some(n => n.k === 'nRqUpdated'));
});
