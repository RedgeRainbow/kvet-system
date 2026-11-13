/* v3.35 (audit, phase 3): sign-out the server knows about, "choose your own password" (optional), the session form
   merging its candidate list, four eyes on certificate approval, stronger password hashing when configured. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

const mkPerson = i => ({ name: 'Ad' + i, surname: 'Soyad' + i, fin: 'A' + String(100000 + i), phone: '+9945012' + String(10000 + i) });
async function base() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} }); await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Boss Bossov', title: 'Director' } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Taleh', surname: 'Bekirov', fin: 'TRN1234', phone: '+994502223344' } })).json;
  const blanks = (await call('GET', '/state', { token: sa })).json.blanks, bid = (blanks.find(b => !b.defaultSheetId) || blanks[0]).id;
  const login = (role, cr) => call('POST', '/login', { body: { role, login: cr.login, password: cr.password } });
  return { app, call, sa, tr, bid, login };
}

test('sign-out ends the session on the server: portal tokens and staff tokens stop working', async () => {
  const { app, call, sa, login } = await base();
  const p = (await call('POST', '/trainee/save', { token: sa, body: mkPerson(1) })).json;
  const a = (await login('trainee', p.creds)).json.token, b = (await login('trainee', p.creds)).json.token;
  assert.equal((await call('GET', '/portal/trainee/home', { token: a })).status, 200);
  assert.equal((await call('POST', '/portal/trainee/logout', { token: a, body: {} })).status, 200);
  assert.equal((await call('GET', '/portal/trainee/home', { token: a })).status, 401, 'the token left in the browser is worthless');
  assert.equal((await call('GET', '/portal/trainee/home', { token: b })).status, 401, 'the other device too');
  assert.equal((await call('GET', '/portal/trainee/home', { token: (await login('trainee', p.creds)).json.token })).status, 200, 'signing in again works');
  // staff
  const s1 = (await call('POST', '/staff/login', { body: { email: 'boss@kvet.az', password: 'bosspass123' } })).json;
  assert.equal((await call('GET', '/state', { token: s1.access })).status, 200);
  assert.equal((await call('POST', '/staff/logout', { token: s1.access, body: {} })).status, 200);
  assert.equal((await call('GET', '/state', { token: s1.access })).status, 401, 'the access token is refused before it expires');
  assert.equal((await call('POST', '/staff/refresh', { body: { refresh: s1.refresh } })).status, 401, 'and cannot be renewed');
  assert.equal((await call('GET', '/state', { token: sa })).status, 200, 'another session of the same person goes on');
  assert.ok((await app.store.all('audit')).filter(x => x.data.action === 'logout').length >= 2);
});

test('"choose your own password": off by default; when on, a generated password only opens that step', async () => {
  const { call, sa, login } = await base();
  const p = (await call('POST', '/trainee/save', { token: sa, body: mkPerson(1) })).json;
  let r = (await login('trainee', p.creds)).json; assert.equal(r.mustPw, undefined);
  assert.equal((await call('GET', '/portal/trainee/home', { token: r.token })).status, 200, 'setting off: as before');
  assert.equal((await call('POST', '/settings/save', { token: sa, body: { forcePw: true } })).json.settings.forcePw, true);
  r = (await login('trainee', p.creds)).json; assert.equal(r.mustPw, true);
  const gate = await call('GET', '/portal/trainee/home', { token: r.token }); assert.equal(gate.status, 403); assert.equal(gate.json.error, 'needPassword');
  assert.equal((await call('POST', '/portal/trainee/password', { token: r.token, body: { current: p.creds.password, next: p.creds.password } })).json.error, 'samePassword');
  const ch = await call('POST', '/portal/trainee/password', { token: r.token, body: { current: p.creds.password, next: 'MyOwnPass77' } }); assert.equal(ch.status, 200);
  assert.equal((await call('GET', '/portal/trainee/home', { token: ch.json.token })).status, 200);
  assert.equal((await call('GET', '/portal/trainee/home', { token: r.token })).status, 401, 'the old token is gone');
  r = (await login('trainee', { login: p.creds.login, password: 'MyOwnPass77' })).json; assert.equal(r.mustPw, undefined, 'asked once');
  // the office resets the password: a generated one again
  const again = (await call('POST', '/credentials/reset', { token: sa, body: { kind: 'trainee', ids: [p.trainee.id] } })).json;
  const cr = (again.list || again.creds || [again])[0];
  r = (await login('trainee', { login: p.creds.login, password: cr.password })).json; assert.equal(r.mustPw, true);
});

test('the session form changes the candidate list, it does not replace it', async () => {
  const { call, sa, tr, bid, login } = await base();
  const [A, B, C] = await Promise.all([1, 2, 3].map(async i => (await call('POST', '/trainee/save', { token: sa, body: mkPerson(i) })).json.trainee.id));
  const form = { bid, tid: tr.trainer.id, date: '2026-10-29' };
  const s = (await call('POST', '/session/save', { token: sa, body: { ...form, traineeIds: [A] } })).json.session;
  const tk = (await login('trainer', tr.creds)).json.token;
  // the office has the form open (it shows A); meanwhile the trainer adds B
  assert.equal((await call('POST', '/portal/trainer/session/trainees', { token: tk, body: { sid: s.id, add: [B] } })).status, 200);
  let r = await call('POST', '/session/save', { token: sa, body: { ...form, id: s.id, notes: 'x', traineeIds: [A, C], baseIds: [A] } });
  assert.deepEqual(r.json.session.traineeIds, [A, B, C], 'B stays, C is added');
  r = await call('POST', '/session/save', { token: sa, body: { ...form, id: s.id, traineeIds: [B, C], baseIds: [A, B, C] } });
  assert.deepEqual(r.json.session.traineeIds, [B, C], 'removing in the form still removes');
  r = await call('POST', '/session/save', { token: sa, body: { ...form, id: s.id, traineeIds: [C] } });
  assert.deepEqual(r.json.session.traineeIds, [C], 'without baseIds (an older browser tab): the list as sent, as before');
});

test('four eyes: the admin who released a certificate cannot approve it; another admin (or a superadmin) can', async () => {
  const { app, call, sa, tr, bid } = await base();
  for (const e of ['anar@kvet.az', 'leyla@kvet.az']) assert.equal((await call('POST', '/users', { token: sa, body: { email: e, password: 'adminpass123', role: 'admin', name: e } })).status, 200);
  const anar = (await call('POST', '/staff/login', { body: { email: 'anar@kvet.az', password: 'adminpass123' } })).json.access, leyla = (await call('POST', '/staff/login', { body: { email: 'leyla@kvet.az', password: 'adminpass123' } })).json.access;
  await call('POST', '/settings/save', { token: sa, body: { approvals: { certs: true } } });
  const ids = []; for (const i of [1, 2]) ids.push((await call('POST', '/trainee/save', { token: sa, body: mkPerson(i) })).json.trainee.id);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid, tid: tr.trainer.id, date: '2026-10-29', traineeIds: ids } })).json.session;
  await call('POST', '/enr/attendance', { token: sa, body: { sid: s.id, absent: [] } });
  const nos = []; for (const tid of ids) { await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid, passed: true } }); const r = await call('POST', '/issue', { token: anar, body: { sid: s.id, tid } }); assert.equal(r.status, 200); nos.push(r.json.cert.no); }
  const own = await call('POST', '/approval/decide', { token: anar, body: { kind: 'cert', id: nos[0], approve: true } });
  assert.equal(own.status, 409); assert.equal(own.json.error, 'ownRelease');
  assert.equal((await app.store.get('certs', nos[0])).approval.status, 'pending');
  assert.equal((await call('POST', '/approval/decide', { token: anar, body: { kind: 'cert', id: nos[1], approve: false, note: 'wrong name' } })).status, 200, 'returning one\'s own release is allowed');
  assert.equal((await call('POST', '/approval/decide', { token: leyla, body: { kind: 'cert', id: nos[0], approve: true } })).status, 200);
});

test('PBKDF2_ROUNDS: accounts are re-hashed at their next sign-in; without the variable nothing changes', async () => {
  const { app, call, sa, login } = await base();
  const p = (await call('POST', '/trainee/save', { token: sa, body: mkPerson(1) })).json;
  assert.equal((await login('trainee', p.creds)).status, 200); assert.equal((await app.store.get('trainees', p.trainee.id)).it, undefined);
  app.env.PBKDF2_ROUNDS = '250000';
  const before = (await app.store.get('trainees', p.trainee.id)).hash;
  assert.equal((await login('trainee', p.creds)).status, 200);
  const acc = await app.store.get('trainees', p.trainee.id); assert.equal(acc.it, 250000); assert.notEqual(acc.hash, before);
  assert.equal((await login('trainee', p.creds)).status, 200, 'and still signs in');
  assert.equal((await login('trainee', { ...p.creds, password: 'Wrong1234' })).status, 401);
  const tok = (await login('trainee', p.creds)).json.token;
  assert.equal((await call('POST', '/portal/trainee/password', { token: tok, body: { current: p.creds.password, next: 'MyOwnPass77' } })).status, 200);
  assert.equal((await app.store.get('trainees', p.trainee.id)).it, 250000);
  app.env.PBKDF2_ROUNDS = '5';                                        // nonsense is ignored, never weaker than 100,000
  assert.equal((await login('trainee', { login: p.creds.login, password: 'MyOwnPass77' })).status, 200);
});

test('a company cannot test ID/FINs without end; an auditor sees no staff e-mail addresses', async () => {
  const { app, call, sa } = await base();
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Drill LLC' } })).json;
  const ck = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  const rows = n => Array.from({ length: n }, (_, i) => ({ name: 'N' + i, surname: 'S' + i, fin: 'Q' + String(100000 + i), phone: '+9945055' + String(10000 + i) }));
  for (let k = 0; k < 3; k++) assert.equal((await call('POST', '/portal/company/candidates/import', { token: ck, body: { rows: rows(100), consent: true } })).status, 200);
  const over = await call('POST', '/portal/company/candidate', { token: ck, body: { ...mkPerson(7), consent: true } });
  assert.equal(over.status, 429); assert.equal(over.json.error, 'finLimit');
  app.clock.t += 864e5;                                                  // the next day
  assert.notEqual((await call('POST', '/portal/company/candidate', { token: ck, body: { ...mkPerson(7), consent: true } })).status, 429);
  const au = await app.mkStaff('audit@firm.az', 'auditor');
  const ppl = (await call('GET', '/dm/people', { token: au })).json.list; assert.ok(ppl.length >= 1); assert.ok(ppl.every(p => p.name && !('email' in p)));
  assert.ok((await call('GET', '/dm/people', { token: sa })).json.list.every(p => 'email' in p));
});

test('portals receive only the signature images their own certificates carry', async () => {
  const { call, sa, tr, bid, login } = await base();
  const a = (await call('POST', '/trainee/save', { token: sa, body: mkPerson(1) })).json, b = (await call('POST', '/trainee/save', { token: sa, body: mkPerson(2) })).json;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid, tid: tr.trainer.id, date: '2026-10-29', traineeIds: [a.trainee.id] } })).json.session;
  await call('POST', '/enr/attendance', { token: sa, body: { sid: s.id, absent: [] } }); await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: a.trainee.id, passed: true } });
  const cert = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: a.trainee.id } })).json.cert;
  const withCert = (await call('GET', '/portal/trainee/home', { token: (await login('trainee', a.creds)).json.token })).json;
  const none = (await call('GET', '/portal/trainee/home', { token: (await login('trainee', b.creds)).json.token })).json;
  assert.equal(none.assets.stamp, ''); assert.deepEqual(none.assets.sigs, []); assert.equal(none.assets.sig, null);
  assert.ok(withCert.assets.sigs.every(x => x.id === cert.sigId)); assert.equal(withCert.certs.length, 1);
});
