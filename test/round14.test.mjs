/* Round 14: users & roles, approver signatures, multi-day attendance, optional FIN/phone, company candidates,
   question pictures, exam duration, exam integrity warnings, a new attempt per candidate, performance analysis. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
const Q = [
  { kind: 'mc', text: 'Who may give signals to the crane operator?', options: ['Anyone', 'The appointed signaller', 'The client'], correct: 1 },
  { kind: 'mc', text: 'Max wind speed?', options: ['20 m/s', '9.8 m/s'], correct: 1 },
  { kind: 'mc', text: 'Check slings before every lift?', options: ['Yes', 'No'], correct: 0 },
  { kind: 'mc', text: 'Stand under a suspended load?', options: ['Yes', 'Never'], correct: 1 },
];
async function setup() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Taleh Bakirov', title: 'Superadmin' } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Rəşad', surname: 'Əliyev', fin: 'TRN1234' }) })).json;
  const st = (await call('GET', '/state', { token: sa })).json;
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  return { app, call, sa, tr, tk, blank: st.blanks[0], sheet: st.sheets[0], today: st.today };
}
const login = async (call, r) => (await call('POST', '/login', { body: { role: 'trainee', login: r.trainee.login, password: r.creds.password } })).json.token;

test('users: an admin created in the panel can sign in; an existing sign-in account is linked; clear errors; the old reader role is an auditor', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  assert.equal((await call('POST', '/users', { token: sa, body: { email: 'Leyla.Admin@KVET.az', password: 'Admin12345', role: 'admin', name: 'Leyla' } })).status, 200);
  const tok = await app.staff('leyla.admin@kvet.az', 'Admin12345'); assert.ok(tok, 'the new admin signs in');
  assert.equal((await call('GET', '/state', { token: tok })).json.role, 'admin');
  assert.equal((await call('POST', '/users', { token: sa, body: { email: 'leyla.admin@kvet.az', password: 'Admin12345', role: 'admin' } })).json.error, 'userExists');
  // a sign-in account already in the auth service (e.g. left after deleting the staff record) is reused with the new password
  app.auth.addUser('old@kvet.az', 'whatever1');
  const r = (await call('POST', '/users', { token: sa, body: { email: 'old@kvet.az', password: 'NewPass123', role: 'editor', name: 'Old' } })).json; assert.equal(r.reused, true);
  assert.ok(await app.staff('old@kvet.az', 'NewPass123'));
  assert.equal((await call('POST', '/users', { token: sa, body: { email: 'x@kvet.az', password: 'Admin12345', role: 'auditor', expires: '2026-01-01' } })).json.error, 'badExpiry');
  assert.equal((await call('POST', '/users', { token: sa, body: { email: 'r@kvet.az', password: 'Admin12345', role: 'reader' } })).json.error, 'badInput', 'no reader role any more');
  const rd = await app.mkStaff('rd@kvet.az', 'reader'); assert.equal((await call('GET', '/state', { token: rd })).json.role, 'auditor');
  // a sign-in account without a staff record gets a precise reason
  app.auth.addUser('nobody@kvet.az', 'nobody123');
  assert.equal((await call('POST', '/staff/login', { body: { email: 'nobody@kvet.az', password: 'nobody123' } })).json.error, 'forbidden');
});

test('auditor: training section only, no library, dashboard or audit trail; approver reads trainings; certificates and documents signed only by superadmin / approver', async () => {
  const ctx = await setup(), { call, sa, app, tr, blank } = ctx;
  const au = await app.mkStaff('au@iosh.org', 'auditor'), ap = await app.mkStaff('ap@kvet.az', 'approver'), ad = await app.mkStaff('ad@kvet.az', 'admin');
  for (const p of ['/stats', '/tests', '/groups', '/ai', '/audit', '/users']) assert.equal((await call('GET', p, { token: au })).status, 403, p);
  for (const p of ['/certs', '/analytics']) assert.equal((await call('GET', p, { token: au })).status, 200, p);
  assert.equal((await call('GET', '/certs', { token: ap })).status, 200); assert.equal((await call('GET', '/stats', { token: ap })).status, 403);
  const t1 = (await call('POST', '/trainee/save', { token: sa, body: person() })).json;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: ctx.today, traineeIds: [t1.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t1.trainee.id } });
  // documents: attendance and the trainer's evaluation are signed only by the trainer (no countersignature, no stamp);
  // approvers countersign practical sheets / declarations / test sheets; admins and auditors sign nothing
  assert.equal((await call('POST', '/sign/doc', { token: ad, body: { sid: s.id, doc: 'att' } })).status, 403);
  assert.equal((await call('POST', '/sign/doc', { token: au, body: { sid: s.id, doc: 'att' } })).status, 403);
  assert.equal((await call('POST', '/sign/doc', { token: ap, body: { sid: s.id, doc: 'att' } })).json.error, 'badInput', 'no countersignature on the attendance sheet');
  assert.equal((await call('POST', '/sign/doc', { token: sa, body: { sid: s.id, doc: 'ev' } })).json.error, 'badInput');
  assert.equal((await call('POST', '/sign/att', { token: sa, body: { sid: s.id } })).status, 404, 'the office does not sign attendance');
  await call('POST', '/staff/profile', { token: ap, body: { name: 'Elvin Approver', title: 'Approver' } });
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal((await call('POST', '/staff/signature', { token: ap, raw: png })).status, 200, 'approvers upload their own signature image');
  const sa2 = await app.mkStaff('sa2@kvet.az', 'superadmin'); await call('POST', '/staff/profile', { token: sa2, body: { name: 'Second Boss' } });
  const ap2 = await app.mkStaff('ap2@kvet.az', 'approver');
  // certificates: the approver approves and signs in one step
  await call('POST', '/settings/save', { token: sa, body: { approvals: { certs: true } } });
  await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: t1.trainee.id, passed: true, score: 90 } });
  const c = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t1.trainee.id } })).json.cert;
  assert.equal((await call('POST', '/approval/decide', { token: ad, body: { kind: 'cert', id: c.no, approve: true, sign: 'esign' } })).status, 403, 'an admin may approve but not sign');
  const d = (await call('POST', '/approval/decide', { token: ap, body: { kind: 'cert', id: c.no, approve: true, sign: 'esign' } })).json.cert;
  assert.equal(d.approval.status, 'approved'); assert.equal(d.sign.name, 'Elvin Approver');
});

test('multi-day training: attendance per day; present on any day = attended; the sheet data carries the days', async () => {
  const ctx = await setup(), { call, sa, tk, tr, blank, app } = ctx;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json, b = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '2BBB222', name: 'Leyla' }) })).json;
  const d1 = ctx.today, d2 = new Date(Date.parse(d1) + 864e5).toISOString().slice(0, 10);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: d1, endDate: d2, traineeIds: [a.trainee.id, b.trainee.id] } })).json.session;
  const r1 = (await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [b.trainee.id], day: d1 } })).json;
  assert.deepEqual([r1.day, r1.present, r1.absent], [d1, 1, 1]);
  assert.equal((await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [], day: d2 } })).json.error, 'dayNotYet', 'a day that has not come yet cannot be marked');
  app.clock.t += 864e5;                                                         // next day
  assert.equal((await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [a.trainee.id], day: d2 } })).json.day, d2);
  const ea = await app.store.get('enr', `${s.id}|${a.trainee.id}`), eb = await app.store.get('enr', `${s.id}|${b.trainee.id}`);
  assert.ok(ea.days[d1].at && ea.days[d2].absent && ea.att, 'A: present day 1, absent day 2 -> attended');
  assert.ok(eb.days[d1].absent && eb.days[d2].at && eb.att && !eb.absent, 'B: absent day 1, present day 2 -> attended');
  const td = (await call('GET', '/portal/trainer/session?id=' + s.id, { token: tk })).json;
  assert.ok(td.trainees.every(r => r.days && Object.keys(r.days).length === 2));
});

test('ID/FIN and phone: optional for the office, compulsory for trainers and companies; asked at the first sign-in', async () => {
  const ctx = await setup(), { call, sa, tk } = ctx;
  const r = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Nigar', surname: 'Əliyeva' } })).json; assert.ok(r.trainee.id, 'no FIN, no phone');
  const tok = await login(call, r);
  const h = (await call('GET', '/portal/trainee/home', { token: tok })).json; assert.deepEqual(h.needProfile, { fin: true, phone: true, foreign: false, temp: true, linkPending: false, linkReturned: '' });
  assert.equal((await call('GET', '/portal/trainee/ai', { token: tok })).json.error, 'needProfile', 'nothing else opens before');
  assert.equal((await call('POST', '/portal/trainee/profile/complete', { token: tok, body: { fin: 'bad', phone: '+994501112233' } })).json.error, 'badId');
  assert.equal((await call('POST', '/portal/trainee/profile/complete', { token: tok, body: { fin: '1ABC234', phone: '+994501112233' } })).status, 200);
  
  const other = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Kamal', surname: 'Həsənov' } })).json, tok2 = await login(call, other);
  assert.equal((await call('POST', '/portal/trainee/profile/complete', { token: tok2, body: { fin: '1ABC234', phone: '+994501112244' } })).json.linkPending, true, 'a FIN belongs to one person: linking, not a second record');
  // trainers must give both
  assert.equal((await call('POST', '/portal/trainer/trainee/save', { token: tk, body: { name: 'Elçin', surname: 'Quliyev', fin: '5EEE555' } })).json.error, 'needPhone');
  assert.equal((await call('POST', '/portal/trainer/trainee/save', { token: tk, body: { name: 'Elçin', surname: 'Quliyev', phone: '+994501234500' } })).json.error, 'badId');
  const ok = (await call('POST', '/portal/trainer/trainee/save', { token: tk, body: { name: 'Elçin', surname: 'Quliyev', fin: '5EEE555', phone: '+994501234500' } })).json; assert.ok(ok.trainee.id);
  assert.ok((await call('GET', '/requests', { token: sa })).json.byTrainers.some(x => x.id === ok.trainee.id), 'shown to the office as added by a trainer');
});

test('company candidates: sent for the own company, confirmed by superadmin / admin / approver, then registered', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling' } })).json;
  const ctok = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/company/candidate', { token: ctok, body: { name: 'Rauf', surname: 'Məmmədov', fin: '7RRR777' } })).json.error, 'needPhone');
  const rq = (await call('POST', '/portal/company/candidate', { token: ctok, body: { name: 'Rauf', surname: 'Məmmədov', fin: '7RRR777', phone: '+994551112233', co: 'someone-else' } })).json.request;
  assert.equal(rq.status, 'pending'); assert.equal(rq.co, co.company.id, 'always the own company'); assert.equal(rq.person.fin, '•••••77', 'the company sees the FIN masked');
  assert.equal((await call('POST', '/portal/company/candidate', { token: ctok, body: { name: 'Rauf', surname: 'Məmmədov', fin: '7RRR777', phone: '+994551112233' } })).json.error, 'dupRequest');
  assert.equal((await call('GET', '/trainees/find?size=500', { token: sa })).json.list.some(x => x.fin === '7RRR777'), false, 'not registered before confirmation');
  const ed = await app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('POST', '/approval/decide', { token: ed, body: { kind: 'cand', id: rq.id, approve: true } })).status, 403);
  const ap = await app.mkStaff('ap@kvet.az', 'approver');
  const q = (await call('GET', '/approvals', { token: ap })).json; assert.equal(q.candidates.length, 1); assert.equal(q.candidates[0].person.fin, '•••••77', 'approvers do not see FIN');
  assert.equal((await call('GET', '/approvals', { token: sa })).json.candidates[0].person.fin, '7RRR777');
  const d = (await call('POST', '/approval/decide', { token: ap, body: { kind: 'cand', id: rq.id, approve: true } })).json;
  assert.ok(d.trainee.att && d.creds.password); assert.equal(d.request.status, 'approved');
  const t = (await call('GET', '/trainees/find?size=500', { token: sa })).json.list.find(x => x.id === d.trainee.id); assert.equal(t.co, co.company.id);
  assert.equal((await call('GET', '/portal/company/candidates', { token: ctok })).json.list[0].status, 'approved');
  assert.equal((await call('POST', '/portal/company/candidate', { token: ctok, body: { name: 'Rauf', surname: 'M', fin: '7RRR777', phone: '+994551112233' } })).json.error, 'finRegistered');
  const r2 = (await call('POST', '/portal/company/candidate', { token: ctok, body: { name: 'Səbinə', surname: 'Quliyeva', fin: '8SSS888', phone: '+994551112244' } })).json.request;
  assert.equal((await call('POST', '/approval/decide', { token: sa, body: { kind: 'cand', id: r2.id, approve: false } })).json.error, 'needNote');
  await call('POST', '/approval/decide', { token: sa, body: { kind: 'cand', id: r2.id, approve: false, note: 'FIN does not match the ID card' } });
  assert.equal((await call('GET', '/portal/company/candidates', { token: ctok })).json.list.find(x => x.id === r2.id).review.note, 'FIN does not match the ID card');
});

test('exam: question pictures, session exam duration, 3 warnings end the attempt, a new attempt per candidate with a warning after the key was seen', async () => {
  const ctx = await setup(), { call, sa, tk, tr, blank, app } = ctx;
  // a picture: only real images, stored by content
  assert.equal((await call('POST', '/test/image', { token: sa, raw: new TextEncoder().encode('<svg onload=alert(1)>' + 'x'.repeat(200)) })).json.error, 'badFile');
  const png = new Uint8Array(300); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const img = (await call('POST', '/test/image', { token: sa, raw: png })).json.img; assert.match(img, /^[a-f0-9]{16}\.png$/);
  assert.equal((await call('GET', '/qimg/' + img)).status, 200);
  const x = (await call('POST', '/test/save', { token: sa, body: { title: 'Signals', questions: Q.map((q, i) => (i === 0 ? { ...q, img } : q)), passRate: 75, timeLimit: 30 } })).json.test;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json, b = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '2BBB222', name: 'Leyla' }) })).json;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: ctx.today, examMode: 'bank', examId: x.id, examMinutes: 12, traineeIds: [a.trainee.id, b.trainee.id] } })).json.session;
  for (const p of [a, b]) await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: p.trainee.id } });
  await call('POST', '/session/exam', { token: sa, body: { sid: s.id, open: true } });
  const ta = await login(call, a), tb = await login(call, b);
  const v = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: ta })).json;
  assert.equal(v.timeLimit, 12, 'the session duration wins over the test limit'); assert.equal(v.maxWarns, 3);
  assert.equal(v.questions.find(q => q.text.startsWith('Who')).img, img);
  // integrity: three warnings end the attempt with what was answered
  const q0 = v.questions[0]; await call('POST', '/portal/trainee/test/save', { token: ta, body: { sid: s.id, answers: { [q0.id]: q0.options[0].id } } });
  assert.equal((await call('POST', '/portal/trainee/test/warn', { token: ta, body: { sid: s.id, kind: 'hidden' } })).json.warns, 1);
  assert.equal((await call('POST', '/portal/trainee/test/warn', { token: ta, body: { sid: s.id, kind: 'blur' } })).json.warns, 1, 'one leave = one warning');
  app.clock.t += 5000; assert.equal((await call('POST', '/portal/trainee/test/warn', { token: ta, body: { sid: s.id } })).json.warns, 2);
  app.clock.t += 5000; const w3 = (await call('POST', '/portal/trainee/test/warn', { token: ta, body: { sid: s.id } })).json;
  assert.equal(w3.done, true); assert.equal(w3.result.status, 'graded');
  const ea = await app.store.get('enr', `${s.id}|${a.trainee.id}`); assert.equal(ea.test.closedBy, 'warnings'); assert.equal(ea.test.warns.length, 3);
  // new attempt for one candidate: allowed; after the trainer opened answers with the key, only with explicit agreement
  const old = ea.test.qs.map(q => q.id + q.options.map(o => o.id).join()).join();
  assert.equal((await call('POST', '/portal/trainer/test/reset', { token: tk, body: { sid: s.id, tid: a.trainee.id } })).status, 200);
  assert.equal((await app.store.get('enr', `${s.id}|${a.trainee.id}`)).test, undefined);
  const v2 = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: ta })).json; assert.equal(v2.warns, 0, 'a fresh attempt');
  const fresh = (await app.store.get('enr', `${s.id}|${a.trainee.id}`)).test.qs.map(q => q.id + q.options.map(o => o.id).join()).join(); assert.notEqual(fresh, old, 'new random draw');
  const vb = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: tb })).json;
  await call('POST', '/portal/trainee/test/submit', { token: tb, body: { sid: s.id, answers: {} } });
  assert.equal((await call('GET', `/portal/trainer/test?sid=${s.id}&tid=${b.trainee.id}`, { token: tk })).status, 200);
  const k = (await call('POST', '/portal/trainer/test/reset', { token: tk, body: { sid: s.id, tid: b.trainee.id } })).json; assert.equal(k.error, 'keySeen'); assert.ok(k.by);
  assert.equal((await call('POST', '/portal/trainer/test/reset', { token: tk, body: { sid: s.id, tid: b.trainee.id, force: true } })).status, 200);
  assert.ok((await call('GET', '/audit?limit=50', { token: sa })).json.list.some(r => /after viewing the answer key/.test(r.detail || r.text || JSON.stringify(r))));
  assert.ok(vb);
});

test('performance analysis of trainers and trainees: admins only; the AI gets codes, not names', async () => {
  const ctx = await setup(), { call, sa, tk, tr, blank, app } = ctx;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '1AAA111' }) })).json;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: ctx.today, traineeIds: [a.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: a.trainee.id } });
  await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: a.trainee.id, behavior: 'good', punctuality: 'late', engagement: 3, comment: 'Needs to arrive on time' } });
  const ta = await login(call, a); await call('POST', '/portal/trainee/feedback', { token: ta, body: { sid: s.id, r: { g1: 5, g2: 8, g3: 8, g4: 8, g6: 7 }, cm: { g1: 'Too fast' } } });
  const au = await app.mkStaff('au@kvet.az', 'auditor'), ed = await app.mkStaff('ed@kvet.az', 'editor');
  for (const tok of [au, ed]) assert.equal((await call('GET', '/performance?kind=trainer', { token: tok })).status, 403);
  const T = (await call('GET', '/performance?kind=trainer', { token: sa })).json; assert.equal(T.rows[0].byTopic.g1, 5); assert.equal(T.rows[0].evalRate, 100);
  const P = (await call('GET', '/performance?kind=trainee', { token: sa })).json; assert.equal(P.rows[0].late, 1); assert.equal(P.rows[0].engagement, 3);
  const d = (await call('GET', `/performance/person?kind=trainee&id=${a.trainee.id}`, { token: sa })).json; assert.deepEqual(d.comments, ['Needs to arrive on time']);
  let seen = ''; ctx.app.env.__llm = async ({ messages }) => { seen = messages[0].content; return 'Strengths\n- Good engagement.'; };
  await call('POST', '/ai/settings', { token: sa, body: { on: true } });
  const o = (await call('POST', '/performance/summary', { token: sa, body: { kind: 'trainer', lang: 'en' } })).json;
  assert.equal(o.codes[0].code, 'T1'); assert.ok(o.codes[0].name.includes('Rəşad')); assert.ok(!seen.includes('Rəşad') && !seen.includes('Əliyev'), 'no names to the AI');
  await call('POST', '/performance/person/summary', { token: sa, body: { kind: 'trainee', id: a.trainee.id, lang: 'az' } });
  assert.ok(!seen.includes('Qocayev') && !seen.includes(a.trainee.att) && !seen.includes('1AAA111'));
});
