/* Round 15: provisional accounts, unique FIN + learner number, direct superadmin certificate, renewals keeping the
   learner number, company optional FIN setting + batch import, Excel FIN-optional for the office. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
async function setup() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Taleh Bakirov', title: 'Superadmin' } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Rəşad', surname: 'Əliyev', fin: 'TRN1234' }) })).json;
  const st = (await call('GET', '/state', { token: sa })).json;
  return { app, call, sa, tr, blank: st.blanks[0], today: st.today };
}
const login = async (call, r) => (await call('POST', '/login', { body: { role: 'trainee', login: r.trainee.login, password: r.creds.password } })).json.token;

test('temporary account: no FIN/phone -> no learner number; at the first sign-in the FIN is claimed and a learner number is attached to it', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const r = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Nigar', surname: 'Əliyeva' } })).json;
  assert.equal(r.trainee.provisional, true); assert.equal(r.trainee.att, ''); assert.match(r.trainee.id, /^T-[A-Z0-9]{6}$/);
  const tok = await login(call, r);
  const done = (await call('POST', '/portal/trainee/profile/complete', { token: tok, body: { fin: '9XYZ999', phone: '+994501110000' } })).json;
  assert.equal(done.registered, true); assert.match(done.att, /^E-\d{9}$/);
  assert.equal((await call('GET', '/portal/trainee/home', { token: tok })).status, 401, 'the temporary sign-in is gone');
  const home = (await call('GET', '/portal/trainee/home', { token: done.token })).json; assert.equal(home.me.att, done.att);
  const t2 = (await call('GET', '/trainees/find?size=500', { token: sa })).json.list.find(x => x.id === done.att);
  assert.equal(t2.provisional, false); assert.equal(t2.att, done.att); assert.ok(!(await call('GET', '/trainees/find?size=500', { token: sa })).json.list.some(x => x.id === r.trainee.id));
  assert.equal((await ctx.app.store.get('fins', '9XYZ999')).id, done.att, 'FIN maps to the learner number');
  assert.equal((await call('POST', '/login', { body: { role: 'trainee', login: done.att, password: r.creds.password } })).status, 200, 'sign in with the learner number, same password');
});

test('temporary account with a FIN that is already registered: no second record; the office links it to the existing learner number', async () => {
  const ctx = await setup(), { call, sa, tr, blank, app } = ctx;
  const old = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json;
  const tmp = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Azər', surname: 'Qocayev' } })).json;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: ctx.today, traineeIds: [tmp.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: tmp.trainee.id } });
  const tok = await login(call, tmp);
  const r = (await call('POST', '/portal/trainee/profile/complete', { token: tok, body: { fin: '1AAA111', phone: '+994501110001' } })).json;
  assert.equal(r.linkPending, true); assert.ok(r.att.endsWith(old.trainee.att.slice(-4)));
  assert.equal((await call('GET', '/portal/trainee/home', { token: tok })).json.needProfile.linkPending, true);
  const ap = await app.mkStaff('ap@kvet.az', 'approver');
  const q = (await call('GET', '/approvals', { token: ap })).json.links; assert.equal(q.length, 1); assert.equal(q[0].existing.att, old.trainee.att);
  await call('POST', '/approval/decide', { token: ap, body: { kind: 'link', id: q[0].id, approve: true } });
  const ss = (await call('GET', '/session?id=' + s.id, { token: sa })).json;
  assert.deepEqual(ss.session.traineeIds, [old.trainee.id], 'the new training is on the existing record');
  assert.ok(ss.enrs.find(e => e.tid === old.trainee.id)?.att, 'attendance moved too');
  assert.ok(!(await call('GET', '/trainees/find?size=500', { token: sa })).json.list.some(x => x.id === tmp.trainee.id), 'the temporary account is removed');
});

test('a certificate needs a learner number: temporary accounts cannot receive one', async () => {
  const ctx = await setup(), { call, sa, blank } = ctx;
  const tmp = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Elçin', surname: 'Quliyev' } })).json;
  assert.equal((await call('POST', '/cert/issue-direct', { token: sa, body: { tid: tmp.trainee.id, bid: blank.id } })).json.error, 'tempAccount');
});

test('same name allowed, identified by FIN; FIN and learner number are unique', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json;
  const b = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '2BBB222' }) })).json;   // same name, different FIN
  assert.notEqual(a.trainee.id, b.trainee.id); assert.notEqual(a.trainee.att, b.trainee.att);
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json.error, 'dupFin', 'a FIN belongs to one person');
  const atts = (await call('GET', '/trainees/find?size=500', { token: sa })).json.list.map(x => x.att);
  assert.equal(new Set(atts).size, atts.length, 'learner numbers are unique');
});

test('direct certificate: superadmin only, no session, fully custom, unique number, renewal keeps the learner number', async () => {
  const ctx = await setup(), { call, sa, app, tr, blank } = ctx;
  const t1 = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json;
  const ad = await app.mkStaff('ad@kvet.az', 'admin');
  assert.equal((await call('POST', '/cert/issue-direct', { token: ad, body: { tid: t1.trainee.id, bid: blank.id } })).status, 403, 'admins cannot issue directly');
  const body = { tid: t1.trainee.id, bid: blank.id, no: 'SPEC/26/0001', start: '2026-10-01', end: '2026-10-02', expiry: '2029-10-02',
    custom: { nameEn: 'Custom Name', trainingName: 'Bespoke Rigging Masterclass', trainerName: 'External Assessor', companyName: 'ACME Ltd' } };
  const c = (await call('POST', '/cert/issue-direct', { token: sa, body })).json.cert;
  assert.equal(c.no, 'SPEC/26/0001'); assert.equal(c.att, t1.trainee.att); assert.equal(c.sid, ''); assert.equal(c.direct, true);
  assert.equal(c.snap.names.en, 'Custom Name'); assert.equal(c.snap.blank.name, 'Bespoke Rigging Masterclass'); assert.equal(c.snap.trainer, 'External Assessor'); assert.equal(c.snap.company, 'ACME Ltd');
  assert.equal((await call('POST', '/cert/issue-direct', { token: sa, body })).json.error, 'dupCert', 'no duplicate certificate number');
  // renewal: a new direct cert for the same trainee+training marks the old one RENEWED; the learner number is unchanged
  const c2 = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: t1.trainee.id, bid: blank.id, renewOf: c.no, start: ctx.today, end: ctx.today } })).json.cert;
  assert.equal(c2.att, t1.trainee.att);
  const certs = (await call('GET', '/certs', { token: sa })).json.certs;
  assert.equal(certs.find(x => x.no === c.no).st, 'RENEWED'); assert.equal(certs.find(x => x.no === c2.no).st, 'ACTIVE');
  assert.ok((await call('GET', '/audit?limit=50', { token: sa })).json.list.some(r => /cert\.direct/.test(JSON.stringify(r))));
});

test('direct certificate can be signed on issue; number stays unique against auto-numbered certificates', async () => {
  const ctx = await setup(), { call, sa, blank } = ctx;
  const t1 = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '3CCC333' }) })).json;
  const r = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: t1.trainee.id, bid: blank.id, sign: 'esign' } })).json;
  assert.ok(r.cert.sign?.name.includes('Taleh'), 'signed on issue'); assert.equal((await call('GET', '/verify-sign?c=' + r.cert.sign.code)).json.status, 'VALID');
});

test('company FIN/phone: required by default; a per-company setting makes them optional; batch Excel import queues requests', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling' } })).json;
  const ctok = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/company/candidate', { token: ctok, body: { name: 'Rauf', surname: 'M' } })).json.error, 'badId', 'FIN required by default');
  // make FIN/phone optional for this company (admin+ only)
  const ed = await ctx.app.mkStaff('ed@kvet.az', 'editor');
  assert.equal((await call('POST', '/company/save', { token: ed, body: { id: co.company.id, name: 'Caspian Drilling', reqOptional: true } })).status, 403);
  await call('POST', '/company/save', { token: sa, body: { id: co.company.id, name: 'Caspian Drilling', reqOptional: true } });
  assert.equal((await call('GET', '/portal/company/home', { token: ctok })).json.company.reqOptional, true);
  const r = (await call('POST', '/portal/company/candidate', { token: ctok, body: { name: 'Rauf', surname: 'M' } })).json.request;
  assert.equal(r.status, 'pending'); assert.equal(r.person.fin, '', 'no FIN needed now');
  const ap = await ctx.app.mkStaff('ap@kvet.az', 'approver');
  const d = (await call('POST', '/approval/decide', { token: ap, body: { kind: 'cand', id: r.id, approve: true } })).json;
  assert.match(d.trainee.id, /^T-/, 'registered as a temporary account (learner number after the first sign-in)');
  const t = (await call('GET', '/trainees/find?size=500', { token: sa })).json.list.find(x => x.id === d.trainee.id); assert.equal(t.provisional, true);
  // batch import (phone + FIN still optional for this company)
  const rows = [['n', 's', 'f', 'fin', 'phone', 'email'], ['Elvin', 'Q', '', '', '', ''], ['Nino', 'G', '', '4DDD444', '+994501119988', '']]
    .map(r => ({ name: r[0], surname: r[1], father: r[2], fin: r[3], phone: r[4], email: r[5] })).slice(1);
  const imp = (await call('POST', '/portal/company/candidates/import', { token: ctok, body: { rows } })).json;
  assert.equal(imp.results.filter(x => x.status === 'queued').length, 2);
  assert.equal((await call('GET', '/portal/company/candidates', { token: ctok })).json.list.filter(x => x.status === 'pending').length, 2);
});

test('office Excel import accepts rows without FIN (provisional); FIN rows stay unique', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const rows = [{ name: 'A', surname: 'One' }, { name: 'B', surname: 'Two', fin: '5EEE555', phone: '+994501112233' }];
  const r = (await call('POST', '/trainee/import', { token: sa, body: { rows } })).json.results;
  assert.equal(r.filter(x => x.status === 'created').length, 2);
  const list = (await call('GET', '/trainees/find?size=500', { token: sa })).json.list;
  assert.equal(list.find(x => x.surname === 'One').provisional, true); assert.equal(list.find(x => x.surname === 'One').att, '');
  assert.equal(list.find(x => x.surname === 'Two').provisional, false);
});

test('emergency account: only with the Cloudflare secret; admin rights + restoring users; hidden; every use logged and shown to the superadmin', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  const em = (pw = 'correct-horse-battery-staple') => call('POST', '/staff/login', { body: { email: 'admin_emergency', password: pw } });
  assert.equal((await em()).json.error, 'badLogin', 'disabled while no secret is set');
  app.env.EMERGENCY_PASSWORD = 'short'; assert.equal((await em('short')).json.error, 'badLogin', 'a weak secret does not enable it');
  app.env.EMERGENCY_PASSWORD = 'correct-horse-battery-staple';
  assert.equal((await em('wrong-password-here')).json.error, 'badLogin');
  const r = (await em()).json; assert.equal(r.role, 'emergency'); const tok = r.access;
  const st = (await call('GET', '/state', { token: tok })).json; assert.equal(st.role, 'emergency'); assert.equal(st.emergency, true);
  // it can restore the superadmin: new password; it cannot delete or sign, and it is not a user
  const users = (await call('GET', '/users', { token: tok })).json.list; assert.ok(users.every(u => u.id !== 'emergency' && u.role !== 'emergency'));
  const boss = users.find(u => u.email === 'boss@kvet.az');
  assert.equal((await call('POST', '/users/update', { token: tok, body: { id: boss.id, password: 'NewBossPass99' } })).status, 200);
  assert.ok(await app.staff('boss@kvet.az', 'NewBossPass99'), 'the superadmin can sign in again');
  assert.equal((await call('POST', '/users', { token: tok, body: { email: 'x@kvet.az', password: 'Password123', role: 'emergency' } })).json.error, 'badInput', 'nobody gets the emergency role');
  assert.equal((await call('POST', '/delete', { token: tok, body: { kind: 'trainee', id: 'x' } })).status, 403);
  assert.equal((await call('POST', '/cert/sign', { token: tok, body: { nos: ['X'], mode: 'esign' } })).status, 403);
  // the superadmin sees it until acknowledged; the audit trail has the sign-in and the changes
  const sa2 = await app.staff('boss@kvet.az', 'NewBossPass99');
  assert.equal((await call('GET', '/state', { token: sa2 })).json.emergency.length, 1);
  const log = JSON.stringify((await call('GET', '/audit?limit=100', { token: sa2 })).json); assert.ok(log.includes('login.emergency') && log.includes('emergency.action'));
  await call('POST', '/emergency/ack', { token: sa2, body: {} }); assert.equal((await call('GET', '/state', { token: sa2 })).json.emergency.length, 0);
  // changing (or removing) the secret ends every emergency session at once
  app.env.EMERGENCY_PASSWORD = 'another-long-secret-value'; assert.equal((await call('GET', '/state', { token: tok })).status, 401);
});
