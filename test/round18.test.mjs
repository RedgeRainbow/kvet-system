/* Round 18: who signs what (no admin signatures; attendance / evaluation by the trainer; training evaluation and toolbox by the
   candidates), multi-day trainings (attendance signed per day, final-day documents opened by the trainer), confidential test
   questions, easy candidate passwords, staff password change, same-name warning. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
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

test('candidate passwords are easy to type (three letters + five random digits); trainers keep random ones', async () => {
  const { call, sa } = await setup();
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json;
  assert.match(a.creds.password, /^[A-HJ-NP-Z][a-hj-km-np-z][A-HJ-NP-Z]\d{5}$/);
  const r = (await call('POST', '/credentials/reset', { token: sa, body: { kind: 'trainee', ids: [a.trainee.id] } })).json.list[0];
  assert.match(r.password, /^[A-Z][a-z][A-Z]\d{5}$/); assert.ok(await login(call, { trainee: a.trainee, creds: { password: r.password } }));
  const tr = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Elçin', fin: 'TRN9999' }) })).json;
  assert.doesNotMatch(tr.creds.password, /^[A-Z][a-z][A-Z]\d{5}$/);
});

test('staff change their own password (current password checked); the old one stops working', async () => {
  const { call, sa, app } = await setup();
  assert.equal((await call('POST', '/staff/password', { token: sa, body: { current: 'wrong', next: 'NewPass2026' } })).json.error, 'badPassword');
  assert.equal((await call('POST', '/staff/password', { token: sa, body: { current: 'bosspass123', next: 'short' } })).json.error, 'weakPassword');
  assert.equal((await call('POST', '/staff/password', { token: sa, body: { current: 'bosspass123', next: 'NewPass2026' } })).status, 200);
  assert.ok(await app.staff('boss@kvet.az', 'NewPass2026')); assert.ok(!(await app.staff('boss@kvet.az', 'bosspass123')));
});

test('no ID/FIN: the office is warned about the same name, surname and father\'s name, and may go ahead', async () => {
  const { call, sa } = await setup();
  const first = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '', phone: '' }) })).json;
  assert.ok(first.trainee.id.startsWith('T-'));
  const w = (await call('POST', '/trainee/save', { token: sa, body: person({ name: 'AZƏR', surname: 'qocayev', fin: '', phone: '' }) })).json;
  assert.equal(w.error, 'sameName'); assert.equal(w.people[0].id, first.trainee.id);
  const ok = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '', phone: '', sameNameOk: true }) })).json;
  assert.ok(ok.trainee.id && ok.trainee.id !== first.trainee.id, 'a second, different person');
  // with an ID/FIN the person is identified by it: no name warning
  assert.ok((await call('POST', '/trainee/save', { token: sa, body: person({ fin: '7ZZZ777' }) })).json.trainee);
  const other = (await call('POST', '/trainee/save', { token: sa, body: person({ father: 'Əli oğlu', fin: '', phone: '' }) })).json;
  assert.ok(other.trainee, 'another father\'s name is another name');
});

test('signing: admins sign nothing; attendance and evaluation by the trainer; the training evaluation by the candidate', async () => {
  const { call, sa, tk, tr, blank, app, today } = await setup();
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json, ta = await login(call, a);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: today, traineeIds: [a.trainee.id] } })).json.session;
  const ad = await app.mkStaff('ad@kvet.az', 'admin'); await call('POST', '/staff/profile', { token: ad, body: { name: 'Admin Person' } });
  await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: s.id, tid: a.trainee.id } });
  assert.equal((await call('POST', '/sign/att', { token: ad, body: { sid: s.id } })).status, 404, 'no office signature on attendance');
  assert.equal((await call('POST', '/sign/doc', { token: ad, body: { sid: s.id, doc: 'att' } })).status, 403);
  const att = (await call('POST', '/portal/trainer/sign/att', { token: tk, body: { sid: s.id } })).json.sign; assert.ok(att.code);
  // trainer's evaluation: signed once everyone present is evaluated
  assert.equal((await call('POST', '/portal/trainer/sign/doc', { token: tk, body: { sid: s.id, doc: 'ev' } })).json.error, 'evIncomplete');
  await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: a.trainee.id, behavior: 'good', punctuality: 'ontime', engagement: 4 } });
  const ev = (await call('POST', '/portal/trainer/sign/doc', { token: tk, body: { sid: s.id, doc: 'ev' } })).json.sign; assert.ok(ev.code);
  // training evaluation: the candidate's own signature, given with the evaluation
  const fb = (await call('POST', '/portal/trainee/feedback', { token: ta, body: { sid: s.id, r: { g1: 9, g2: 9, g3: 9, g4: 9, g5: 9, g6: 9 }, cm: {} } })).json;
  assert.ok(fb.sign.code); assert.match(fb.sign.title, /Participant/);
  const sg = (await call('GET', '/session?id=' + s.id, { token: sa })).json.signs;
  assert.equal(sg.att.code, att.code); assert.equal(sg.ev.code, ev.code); assert.equal(sg.fb[a.trainee.id].code, fb.sign.code);
  assert.equal((await call('GET', '/verify-sign?c=' + fb.sign.code)).json.status, 'VALID');
  // a changed evaluation withdraws the trainer's signature on the evaluation sheet
  await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: a.trainee.id, behavior: 'excellent', punctuality: 'ontime', engagement: 5 } });
  assert.equal((await call('GET', '/session?id=' + s.id, { token: sa })).json.signs.ev, null);
  // exam results: the trainer signs once every result is confirmed
  assert.equal((await call('POST', '/portal/trainer/sign/doc', { token: tk, body: { sid: s.id, doc: 'exam' } })).json.error, 'examNotConfirmed');
  await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: a.trainee.id, passed: true, score: 90 } });
  assert.ok((await call('POST', '/portal/trainer/sign/doc', { token: tk, body: { sid: s.id, doc: 'exam' } })).json.sign.code);
  await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: a.trainee.id, passed: true, score: 95 } });
  assert.equal((await call('GET', '/session?id=' + s.id, { token: sa })).json.signs.exam, null, 'a changed result withdraws the signature');
});

test('multi-day training: attendance signed per day; final-day documents open only when the trainer opens them on the final day', async () => {
  const { call, sa, tk, tr, blank, today } = await setup();          // today = 2026-10-29
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json, ta = await login(call, a);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-28', endDate: today, traineeIds: [a.trainee.id] } })).json.session;
  for (const day of ['2026-10-28', today]) await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [], day } });
  const d1 = (await call('POST', '/portal/trainer/sign/att', { token: tk, body: { sid: s.id, day: '2026-10-28' } })).json, d2 = (await call('POST', '/portal/trainer/sign/att', { token: tk, body: { sid: s.id, day: today } })).json;
  let sg = (await call('GET', '/session?id=' + s.id, { token: sa })).json.signs;
  assert.equal(sg.attDays['2026-10-28'].code, d1.sign.code); assert.equal(sg.attDays[today].code, d2.sign.code);
  // a change on day 2 withdraws only day 2's signature
  await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [a.trainee.id], day: today } });
  sg = (await call('GET', '/session?id=' + s.id, { token: sa })).json.signs; assert.ok(sg.attDays['2026-10-28']); assert.equal(sg.attDays[today], undefined);
  await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [], day: today } });
  // final-day documents
  const fbBody = { sid: s.id, r: { g1: 8, g2: 8, g3: 8, g4: 8, g5: 8, g6: 8 }, cm: {} };
  assert.equal((await call('POST', '/portal/trainee/feedback', { token: ta, body: fbBody })).json.error, 'docsNotOpen');
  assert.equal((await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: a.trainee.id, behavior: 'good', punctuality: 'ontime', engagement: 4 } })).json.error, 'docsNotOpen');
  let home = (await call('GET', '/portal/trainee/home', { token: ta })).json.sessions[0]; assert.equal(home.multi, true); assert.equal(home.fbOpen, false);
  const todo = (await call('GET', '/portal/trainer/session?id=' + s.id, { token: tk })).json.todo; assert.ok(todo.some(x => x.doc === 'docsOpen'));
  assert.equal((await call('POST', '/portal/trainer/docs', { token: tk, body: { sid: s.id, open: true } })).status, 200);
  assert.equal((await call('POST', '/portal/trainee/feedback', { token: ta, body: fbBody })).status, 200);
  assert.equal((await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: a.trainee.id, behavior: 'good', punctuality: 'ontime', engagement: 4 } })).status, 200);
  // a session whose final day has not come: the trainer cannot open them yet
  const s2 = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: today, endDate: '2026-10-30', traineeIds: [a.trainee.id] } })).json.session;
  const r = (await call('POST', '/portal/trainer/docs', { token: tk, body: { sid: s2.id, open: true } })).json; assert.equal(r.error, 'notFinalDay'); assert.equal(r.day, '2026-10-30');
  assert.equal((await call('POST', '/session/docs', { token: sa, body: { sid: s2.id, open: true } })).status, 200, 'the office can open them');
});

test('test questions stay confidential: no review for candidates', async () => {
  const { call, sa } = await setup();
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json, ta = await login(call, a);
  assert.equal((await call('GET', '/portal/trainee/test/review?sid=x', { token: ta })).status, 404);
  assert.equal((await call('POST', '/portal/trainee/test/explain', { token: ta, body: {} })).status, 404);
});

test('certificate texts: session lines, company line choices, template labels, every text editable afterwards', async () => {
  const { call, sa, tr, blank, today } = await setup();
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling' } })).json.company;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ co: co.id }) })).json;
  // template: fixed texts (labels); an empty one hides its line
  const b = (await call('GET', '/state', { token: sa })).json.blanks.find(x => x.id === blank.id);
  await call('POST', '/blank/save', { token: sa, body: { ...b, labels: { end: { az: '', en: '' }, learner: { az: 'Nömrə', en: 'Number' }, bogus: { az: 'x' } } } });
  const b2 = (await call('GET', '/state', { token: sa })).json.blanks.find(x => x.id === blank.id);
  assert.deepEqual(Object.keys(b2.labels).sort(), ['end', 'learner']);
  // session: details under the training name, the registration line, a custom company line
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: today, traineeIds: [a.trainee.id], certDetails: 'Truck: HELI', certReg: 'ECITB reg: 934838', coMode: 'custom', coText: 'SOCAR / Branch' } })).json.session;
  assert.equal(s.certReg, 'ECITB reg: 934838'); assert.equal(s.coMode, 'custom');
  await call('POST', '/enr/attend', { token: sa, body: { sid: s.id, tid: a.trainee.id, present: true } });
  // direct issue carries the same lines
  const d = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: a.trainee.id, bid: blank.id, start: today, end: today, custom: { details: 'Crane: 50t', reg: 'REG 1', coMode: 'hide' } } })).json.cert;
  assert.equal(d.snap.details, 'Crane: 50t'); assert.equal(d.snap.reg, 'REG 1'); assert.equal(d.snap.coMode, 'hide'); assert.equal(d.snap.blank.labels.learner.en, 'Number');
  // edit every text of the certificate (its own copy; the template is not changed)
  const u = (await call('POST', '/cert/update', { token: sa, body: { no: d.no, patch: { coMode: 'custom', coText: 'Holding', details: 'Crane: 80t', reg: 'REG 2', att: 'X-1',
    blank: { titleEn: 'NEW TITLE', qualEn: 'Rigger', credits: 3, labels: { valid: { az: 'Qüvvədədir', en: 'Valid until' } } } } } })).json.cert;
  assert.equal(u.snap.coText, 'Holding'); assert.equal(u.snap.details, 'Crane: 80t'); assert.equal(u.snap.blank.titleEn, 'NEW TITLE'); assert.equal(u.snap.blank.credits, 3);
  assert.equal(u.snap.blank.labels.valid.en, 'Valid until'); assert.equal(u.snap.att, 'X-1');
  assert.equal((await call('GET', '/state', { token: sa })).json.blanks.find(x => x.id === blank.id).titleEn, b.titleEn, 'template unchanged');
  // shared helper: what the company line prints
  const S = await import('../public/js/shared.js');
  assert.equal(S.certCompanyLine({ coMode: 'custom', coText: 'X' }), 'X'); assert.equal(S.certCompanyLine({ coMode: 'hide', company: 'Y' }), '');
  assert.equal(S.certCompanyLine({ showCo: true, company: 'Y' }), 'Y', 'older certificates keep their setting');
});

test('unsigned certificates are listed for the signers', async () => {
  const { call, sa, blank, today } = await setup();
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json;
  const c = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: a.trainee.id, bid: blank.id, start: today, end: today } })).json.cert;
  const u = (await call('GET', '/certs?unsigned=1&counts=0', { token: sa })).json; assert.deepEqual(u.certs.map(x => x.no), [c.no]);
  await call('POST', '/cert/sign', { token: sa, body: { nos: [c.no], mode: 'esign' } });
  assert.equal((await call('GET', '/certs?unsigned=1&counts=0', { token: sa })).json.certs.length, 0);
});

test('library documents: admin uploads, trainers download, editors and approvers have no access', async () => {
  const { app, call, sa, tk } = await setup();
  const bytes = new TextEncoder().encode('%PDF-1.4 test document').buffer;
  const up = (await call('POST', '/libdoc/upload?name=' + encodeURIComponent('Procedure A.pdf') + '&category=HSE', { token: sa, raw: bytes })).json.doc;
  assert.equal(up.title, 'Procedure A'); assert.equal(up.category, 'HSE');
  assert.equal((await call('POST', '/libdoc/upload?name=virus.exe', { token: sa, raw: bytes })).json.error, 'badFile');
  const ad = await app.mkStaff('ad@kvet.az', 'admin'), ed = await app.mkStaff('ed@kvet.az', 'editor'), ap = await app.mkStaff('ap@kvet.az', 'approver');
  assert.equal((await call('GET', '/libdocs', { token: ad })).json.list.length, 1);
  for (const tok of [ed, ap]) assert.equal((await call('GET', '/libdocs', { token: tok })).status, 403);
  assert.equal((await call('GET', '/portal/trainer/libdocs', { token: tk })).json.list[0].id, up.id);
  const f = await call('GET', '/portal/trainer/libdoc?id=' + up.id, { token: tk }); assert.equal(f.status, 200); assert.match(f.res.headers.get('content-disposition'), /Procedure%20A\.pdf/);
  assert.equal((await call('POST', '/libdoc/delete', { token: tk, body: { id: up.id } })).status, 401, 'trainers only read');
  await call('POST', '/libdoc/delete', { token: ad, body: { id: up.id } }); assert.equal((await call('GET', '/libdocs', { token: sa })).json.list.length, 0);
});

test('company groups: only the company\'s own candidates, only its own groups', async () => {
  const { call, sa } = await setup();
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling' } })).json, co2 = (await call('POST', '/company/save', { token: sa, body: { name: 'Other LLC' } })).json;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ co: co.company.id }) })).json.trainee, b = (await call('POST', '/trainee/save', { token: sa, body: person({ fin: '2BBB222', phone: '+994501111111', co: co2.company.id }) })).json.trainee;
  const lg = async x => (await call('POST', '/login', { body: { role: 'company', login: x.creds.login, password: x.creds.password } })).json.token, k1 = await lg(co), k2 = await lg(co2);
  const g = (await call('POST', '/portal/company/group/save', { token: k1, body: { name: 'Riggers', ids: [a.id, b.id] } })).json.group;
  assert.deepEqual(g.ids, [a.id], 'another company\'s candidate is dropped');
  assert.equal((await call('GET', '/portal/company/groups', { token: k1 })).json.list.length, 1); assert.equal((await call('GET', '/portal/company/groups', { token: k2 })).json.list.length, 0);
  assert.equal((await call('POST', '/portal/company/group/delete', { token: k2, body: { id: g.id } })).status, 404);
  assert.equal((await call('POST', '/portal/company/group/delete', { token: k1, body: { id: g.id } })).status, 200);
});

test('notifications: to-do counts and events per portal; opening the panel marks them seen', async () => {
  const { app, call, sa, tk, tr, blank, today } = await setup();
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling' } })).json;
  const ck = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ co: co.company.id }) })).json, ta = await login(call, a);
  // a session: the trainer and the candidate are told
  await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: today, traineeIds: [a.trainee.id] } });
  assert.equal((await call('GET', '/portal/trainer/notify', { token: tk })).json.notes[0].k, 'nSessionNew');
  let n = (await call('GET', '/portal/trainee/notify', { token: ta })).json; assert.equal(n.notes[0].k, 'nSessionAdded'); assert.equal(n.unread, 1);
  await call('POST', '/portal/trainee/notify/seen', { token: ta, body: {} }); app.clock.t += 1000;
  assert.equal((await call('GET', '/portal/trainee/notify', { token: ta })).json.unread, 0);
  // a company request: staff who handle requests see it, and a to-do count
  await call('POST', '/portal/company/request', { token: ck, body: { kind: 'training', bid: blank.id } });
  const s = (await call('GET', '/notify', { token: sa })).json;
  assert.ok(s.notes.some(x => x.k === 'nRqNew')); assert.ok(s.todo.some(x => x.k === 'nRequests' && x.n === 1));
  const ap = await app.mkStaff('ap@kvet.az', 'approver'); assert.ok(!(await call('GET', '/notify', { token: ap })).json.notes.some(x => x.k === 'nRqNew'), 'only those who handle requests');
  // a signed certificate: the holder and the company are told; the signer's to-do goes down
  const c = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: a.trainee.id, bid: blank.id, start: today, end: today } })).json.cert;
  assert.ok((await call('GET', '/notify', { token: sa })).json.todo.some(x => x.k === 'nCertsToSign'));
  await call('POST', '/cert/sign', { token: sa, body: { nos: [c.no], mode: 'esign' } });
  assert.ok((await call('GET', '/portal/trainee/notify', { token: ta })).json.notes.some(x => x.k === 'nCertReady'));
  assert.ok((await call('GET', '/portal/company/notify', { token: ck })).json.notes.some(x => x.k === 'nCoCertReady'));
  assert.ok(!(await call('GET', '/notify', { token: sa })).json.todo.some(x => x.k === 'nCertsToSign'));
});

test('messages: portal accounts write to the training centre; admins answer; editors cannot read them', async () => {
  const { app, call, sa, tk, tr } = await setup();
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json, ta = await login(call, a);
  await call('POST', '/portal/trainee/message', { token: ta, body: { text: 'When is my exam?' } });
  await call('POST', '/portal/trainer/message', { token: tk, body: { text: 'Projector broken' } });
  assert.equal((await call('GET', '/notify', { token: sa })).json.msgs, 2);
  const th = (await call('GET', '/msg/threads', { token: sa })).json.list; assert.equal(th.length, 2);
  const one = th.find(x => x.kind === 'trainee'); assert.equal(one.unreadStaff, 1);
  const r = (await call('GET', '/msg/thread?id=' + one.id, { token: sa })).json; assert.equal(r.list[0].text, 'When is my exam?');
  await call('POST', '/msg/send', { token: sa, body: { th: one.id, text: 'Tomorrow at 10:00' } });
  const h = (await call('GET', '/portal/trainee/notify', { token: ta })).json; assert.equal(h.msgs, 1); assert.ok(h.notes.some(x => x.k === 'nMsgFromCentre'));
  const m = (await call('GET', '/portal/trainee/messages', { token: ta })).json.list; assert.deepEqual(m.map(x => x.from), ['acc', 'staff']); assert.equal(m[1].by, 'Taleh Bakirov'); assert.ok(!JSON.stringify(m).includes('@'), 'no staff e-mail in the portal');
  assert.equal((await call('GET', '/portal/trainee/notify', { token: ta })).json.msgs, 0, 'read');
  // a new conversation started by the office
  await call('POST', '/msg/send', { token: sa, body: { th: 'trainer:' + tr.trainer.id, text: 'Room changed' } });
  assert.equal((await call('GET', '/portal/trainer/messages', { token: tk })).json.list.length, 2);
  const ed = await app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('GET', '/msg/threads', { token: ed })).status, 403);
  assert.equal((await call('POST', '/portal/trainee/message', { token: ta, body: { text: '' } })).json.error, 'badInput');
  for (let i = 0; i < 29; i++) await call('POST', '/portal/trainee/message', { token: ta, body: { text: 'x' + i } });
  assert.equal((await call('POST', '/portal/trainee/message', { token: ta, body: { text: 'flood' } })).status, 429);
});

test('people lists: filters by registration date / type, all ids that match, batch delete with backup', async () => {
  const { app, call, sa, tr, blank, today } = await setup();
  const ids = [];
  for (let i = 0; i < 25; i++) { if (i === 22) app.clock.t += 3 * 864e5; ids.push((await call('POST', '/trainee/save', { token: sa, body: person({ name: 'Nam' + i, fin: 'G' + String(100000 + i), phone: '+99455' + (1000000 + i), foreign: i === 24 }) })).json.trainee.id); }
  const f = q => call('GET', '/trainees/find?' + q, { token: sa }).then(r => r.json);
  const later = new Date(app.clock.t).toISOString().slice(0, 10);
  assert.equal((await f('from=' + later)).total, 3, 'registered on the later day'); assert.equal((await f('to=' + today)).total, 22);
  assert.equal((await f('type=foreign')).total, 1); assert.equal((await f('type=local')).total, 24);
  assert.equal((await f('sort=old&size=1')).list[0].id, ids[0]); assert.equal((await f('sort=new&size=1')).list[0].id, ids[24]);
  const all = (await f('ids=1&to=' + today)).ids; assert.equal(all.length, 22);
  // one of them has a certificate: it is archived, never lost
  await call('POST', '/cert/issue-direct', { token: sa, body: { tid: ids[0], bid: blank.id, start: today, end: today } });
  const dry = (await call('POST', '/delete/many', { token: sa, body: { kind: 'trainee', ids: all, dry: true } })).json;
  assert.equal(dry.impact.trainees, 22); assert.equal(dry.impact.certs, 1);
  assert.equal((await call('POST', '/delete/many', { token: sa, body: { kind: 'trainee', ids: all } })).json.error, 'badInput', 'needs the DELETE confirmation');
  const ed = await app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('POST', '/delete/many', { token: ed, body: { kind: 'trainee', ids: all, confirm: 'DELETE' } })).status, 403);
  const r = (await call('POST', '/delete/many', { token: sa, body: { kind: 'trainee', ids: all, confirm: 'DELETE' } })).json;
  assert.ok(r.ok && r.backup, 'more than 20: a backup first'); assert.equal((await f('')).total, 3);
  // trainers and groups
  const t2 = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Elçin', fin: 'TRN9999', phone: '+994507777777' }) })).json.trainer;
  assert.equal((await call('POST', '/delete/many', { token: sa, body: { kind: 'trainer', ids: [t2.id, tr.trainer.id], confirm: 'DELETE' } })).json.impact.trainers, 2);
  const g1 = (await call('POST', '/group/save', { token: sa, body: { name: 'A', traineeIds: [ids[23]] } })).json.group, g2 = (await call('POST', '/group/save', { token: sa, body: { name: 'B', traineeIds: [] } })).json.group;
  assert.equal((await call('POST', '/groups/delete', { token: sa, body: { ids: [g1.id, g2.id] } })).json.n, 2);
});

test('messages: own messages are edited and deleted; staff delete any message or the whole conversation', async () => {
  const { app, call, sa } = await setup();
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json, ta = await login(call, a);
  const m1 = (await call('POST', '/portal/trainee/message', { token: ta, body: { text: 'Helo' } })).json.message;
  const th = 'trainee:' + a.trainee.id, s1 = (await call('POST', '/msg/send', { token: sa, body: { th, text: 'Hi' } })).json.message;
  assert.equal((await call('POST', '/portal/trainee/message/edit', { token: ta, body: { id: m1.id, text: 'Hello' } })).json.message.text, 'Hello');
  assert.equal((await call('POST', '/portal/trainee/message/edit', { token: ta, body: { id: s1.id, text: 'x' } })).status, 403, 'not the centre\'s message');
  const ad = await app.mkStaff('ad@kvet.az', 'admin');
  assert.equal((await call('POST', '/msg/edit', { token: ad, body: { th, id: s1.id, text: 'y' } })).status, 403, 'another staff member\'s answer');
  assert.equal((await call('POST', '/msg/edit', { token: sa, body: { th, id: s1.id, text: 'Hi there' } })).json.message.editedAt.length > 0, true);
  await call('POST', '/portal/trainee/message/delete', { token: ta, body: { id: m1.id } });
  let l = (await call('GET', '/msg/thread?id=' + th, { token: sa })).json; assert.deepEqual(l.list.map(x => x.text), ['Hi there']); assert.equal(l.list[0].mine, true);
  assert.equal((await call('GET', '/msg/threads', { token: sa })).json.list[0].last, 'Hi there');
  await call('POST', '/portal/trainee/message', { token: ta, body: { text: 'again' } });
  assert.equal((await call('POST', '/msg/thread/delete', { token: ad, body: { th } })).json.n, 2);
  assert.equal((await call('GET', '/msg/threads', { token: sa })).json.list.length, 0); assert.equal((await call('GET', '/portal/trainee/messages', { token: ta })).json.list.length, 0);
});

test('import without ID/FIN: 300 people in a few database calls per part, same names reported', async () => {
  const { call, sa } = await setup();
  const rows = Array.from({ length: 300 }, (_, i) => ({ row: i + 2, name: 'Ad' + (i % 150), surname: 'Soyad', father: 'Ata oğlu' }));
  let made = [];
  for (let i = 0; i < rows.length; i += 50) made.push(...(await call('POST', '/trainee/import', { token: sa, body: { rows: rows.slice(i, i + 50) } })).json.results);
  assert.equal(made.filter(r => r.status === 'created').length, 300); assert.ok(made.every(r => /^[A-Z][a-z][A-Z]\d{5}$/.test(r.password)));
  assert.equal(new Set(made.map(r => r.login)).size, 300); assert.ok(made.slice(150).every(r => r.sameName >= 1), 'the second Ad0… is reported');
});

test('session certificate lines edited later: issued certificates follow on request, signatures kept or withdrawn', async () => {
  const { app, call, sa, tr, blank, today } = await setup();
  const a = (await call('POST', '/trainee/save', { token: sa, body: person() })).json;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: today, traineeIds: [a.trainee.id], certReg: 'REG 1' } })).json.session;
  const c = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: a.trainee.id, bid: blank.id, start: today, end: today, custom: { reg: 'REG 1' } } })).json.cert;
  const x = await app.store.get('certs', c.no); x.sid = s.id; await app.store.put('certs', [{ id: c.no, data: x }]);       // as if released from the session
  await call('POST', '/cert/sign', { token: sa, body: { nos: [c.no], mode: 'esign' } });
  const body = { ...s, traineeIds: [a.trainee.id], certReg: 'ECITB reg: 934838', certDetails: 'Make: HELI', coMode: 'custom', coText: 'SOCAR' };
  assert.equal((await call('POST', '/session/save', { token: sa, body })).json.certsBehind, 1);
  assert.equal((await call('POST', '/session/cert-lines', { token: sa, body: { id: s.id } })).json.updated, 1);
  let y = (await call('GET', '/certs?nos=' + encodeURIComponent(c.no) + '&counts=0', { token: sa })).json.certs[0];
  assert.equal(y.snap.reg, 'ECITB reg: 934838'); assert.equal(y.snap.details, 'Make: HELI'); assert.equal(y.snap.coText, 'SOCAR'); assert.ok(y.sign, 'signature kept');
  assert.equal((await call('POST', '/session/save', { token: sa, body })).json.certsBehind, 0, 'nothing left to update');
  await call('POST', '/session/save', { token: sa, body: { ...body, certReg: 'REG 3' } });
  await call('POST', '/session/cert-lines', { token: sa, body: { id: s.id, withdraw: true } });
  y = (await call('GET', '/certs?nos=' + encodeURIComponent(c.no) + '&counts=0', { token: sa })).json.certs[0]; assert.equal(y.snap.reg, 'REG 3'); assert.ok(!y.sign, 'signature withdrawn');
});
