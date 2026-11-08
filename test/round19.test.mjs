/* Round 19b: system health, request counting, offline-safe exam hand-in (server side: late hand-ins cannot extend the time). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

test('system health: database and storage timings, last backup, errors, requests against the plan', async () => {
  const app = makeApp({ rand: () => 0 }), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  let h = (await call('GET', '/health', { token: sa })).json;
  assert.ok(h.db.ok && typeof h.db.ms === 'number'); assert.ok(h.r2.ok); assert.equal(h.backup, null); assert.equal(h.errors.day, 0);
  assert.equal(h.requests.limit, 100000, 'free plan by default'); assert.equal(h.requests.days.length, 7);
  const before = h.requests.days[6].n; for (let i = 0; i < 5; i++) await call('GET', '/state', { token: sa });
  h = (await call('GET', '/health', { token: sa })).json; assert.ok(h.requests.days[6].n >= before + 50, 'each request counted (x10 sampling, always taken here)');
  await call('POST', '/backup', { token: sa, body: {} });
  const q = app.store.query; app.store.query = async (col, sp) => { if (col === 'certs') throw new Error('boom'); return q.call(app.store, col, sp); };
  await call('GET', '/certs?counts=0', { token: sa }); app.store.query = q;
  h = (await call('GET', '/health', { token: sa })).json; assert.ok(h.backup.at); assert.equal(h.errors.day, 1);
  await call('POST', '/health/plan', { token: sa, body: { cfPlan: 'paid', dbPlan: 'pro' } });
  h = (await call('GET', '/health', { token: sa })).json; assert.equal(h.requests.limit, 0); assert.equal(h.dbPlan, 'pro');
  const ed = await app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('GET', '/health', { token: ed })).status, 403);
});

test('exam hand-in after the time limit: answers saved in time count, later ones do not; a short outage is covered', async () => {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} }); await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  const st = (await call('GET', '/state', { token: sa })).json, blank = st.blanks[0];
  const tr = (await call('POST', '/trainer/save', { token: sa, body: { name: 'R', surname: 'A', father: 'B', fin: 'TRN1234', phone: '+994551234567' } })).json;
  const Q = [{ kind: 'mc', text: 'Q1', options: ['a', 'b'], correct: 1 }, { kind: 'mc', text: 'Q2', options: ['a', 'b'], correct: 1 }];
  const ex = (await call('POST', '/test/save', { token: sa, body: { bid: blank.id, title: 'F', grading: 'rate', passRate: 50, timeLimit: 10, questions: Q } })).json.test;
  const mk = async i => { const p = (await call('POST', '/trainee/save', { token: sa, body: { name: 'N' + i, surname: 'S', father: 'F', fin: 'H10000' + i, phone: '+9945060000' + i } })).json; return p; };
  const a = await mk(1), b = await mk(2);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: st.today, examMode: 'bank', examId: ex.id, traineeIds: [a.trainee.id, b.trainee.id] } })).json.session;
  for (const p of [a, b]) await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: p.trainee.id } });
  await call('POST', '/session/exam', { token: sa, body: { sid: s.id, open: true } });
  const tok = async p => (await call('POST', '/login', { body: { role: 'trainee', login: p.trainee.login, password: p.creds.password } })).json.token;
  const ta = await tok(a), tb = await tok(b);
  const va = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: ta })).json, vb = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: tb })).json;
  const right = v => Object.fromEntries(v.questions.map(q => [q.id, q.options.find(o => o.text === 'b').id])), first = v => { const q = v.questions.find(x => x.text === 'Q1'); return { [q.id]: q.options.find(o => o.text === 'b').id }; };
  // both saved Q1 in time; then the network dropped and they answered Q2 on the phone
  await call('POST', '/portal/trainee/test/save', { token: ta, body: { sid: s.id, answers: first(va) } });
  await call('POST', '/portal/trainee/test/save', { token: tb, body: { sid: s.id, answers: first(vb) } });
  // A reconnects 1 minute after the time limit (within the grace): everything counts
  app.clock.t += 11 * 60e3;
  assert.equal((await call('POST', '/portal/trainee/test/submit', { token: ta, body: { sid: s.id, answers: right(va) } })).json.pct, 100);
  // B reconnects 20 minutes later: only what was saved in time counts
  app.clock.t += 20 * 60e3;
  const rb = (await call('POST', '/portal/trainee/test/submit', { token: tb, body: { sid: s.id, answers: right(vb) } })).json; assert.equal(rb.status, 'review', 'a late hand-in goes to the trainer');
  const e = (await call('GET', '/session?id=' + s.id, { token: sa })).json.enrs.find(x => x.tid === b.trainee.id);
  assert.equal(e.test.auto.score, 1, 'only Q1 (saved in time) counts'); assert.ok(e.test.lateHandIn > 1000);
});

test('bulk import: 300 rows in one request; a part sent twice never creates anyone twice', async () => {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123'); await call('POST', '/seed', { token: sa, body: {} });
  const rows = Array.from({ length: 300 }, (_, i) => ({ row: i + 2, name: 'Ad' + i, surname: 'Soyad', father: 'Ata oğlu' }));
  const r1 = (await call('POST', '/trainee/import', { token: sa, body: { rows, pk: 'part0001abcd' } })).json;
  assert.equal(r1.results.filter(r => r.status === 'created').length, 300);
  const r2 = (await call('POST', '/trainee/import', { token: sa, body: { rows, pk: 'part0001abcd' } })).json;
  assert.equal(r2.repeated, true); assert.ok(r2.results.every(r => r.pwLost && !r.password));
  assert.equal((await call('GET', '/trainees/find?size=1', { token: sa })).json.total, 300, 'nobody twice');
});
