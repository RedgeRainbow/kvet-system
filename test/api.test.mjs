import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import * as S from '../public/js/shared.js';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });

async function setup() {
  const app = makeApp(), { call } = app;
  const sa = await app.staff('boss@kvet.az', 'bosspass123');
  assert.ok(sa, 'bootstrap superadmin can sign in');
  await call('POST', '/seed', { token: sa, body: {} });
  await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });   // most tests skip the feedback step (tested separately)
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'BP Exploration (Caspian Sea) Ltd', contactPerson: 'Leyla', contractNo: 'C-1', contractDate: '2026-01-01', phone: '+994551112233' } })).json;
  const tr = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Təleh', surname: 'Bəkirov', father: 'Mehman oğlu', fin: 'TRN1234', phone: '+994502223344', specialty: 'PA' } })).json;
  return { app, call, sa, co, tr };
}
async function mkTrainee(call, sa, o) { const r = await call('POST', '/trainee/save', { token: sa, body: person(o) }); assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json; }

test('company/trainer/trainee creation produces credentials, transliteration and a unique learner number', async () => {
  const { call, sa, co, tr } = await setup();
  assert.ok(co.creds.login && co.creds.password.length >= 8);
  assert.match(tr.creds.login, /^trainer_taleh/);
  assert.equal(tr.trainer.nameEn, 'Taleh');
  const a = await mkTrainee(call, sa, { co: co.company.id });
  assert.match(a.trainee.att, /^E-2026\d{5}$/); assert.equal(a.trainee.nameEn, 'Azar'); assert.equal(a.trainee.surnameEn, 'Gojayev'); assert.equal(a.trainee.fatherEn, 'Mammad oghlu');
  assert.equal(a.creds.login, a.trainee.att);
  const dup = await call('POST', '/trainee/save', { token: sa, body: person({ name: 'Başqa' }) });
  assert.equal(dup.status, 409); assert.equal(dup.json.error, 'dupFin'); assert.equal(dup.json.existing.att, a.trainee.att);
  const b = await mkTrainee(call, sa, { fin: '2ABC234', name: 'Vüqar' });
  assert.notEqual(b.trainee.att, a.trainee.att);
  const bad = await call('POST', '/trainee/save', { token: sa, body: person({ fin: '12' }) }); assert.equal(bad.json.error, 'badId');
  const f = await mkTrainee(call, sa, { name: 'John', surname: 'Smith', father: '', fin: 'P-998877', foreign: true }); assert.equal(f.trainee.nameEn, 'John');
});

test('FIN is hidden from editors/readers and from every portal', async () => {
  const { app, call, sa } = await setup();
  const t = await mkTrainee(call, sa);
  const ed = await app.mkStaff('ed@kvet.az', 'editor'), rd = await app.mkStaff('rd@kvet.az', 'reader'), ad = await app.mkStaff('ad@kvet.az', 'admin');
  for (const [tok, expect] of [[sa, true], [ad, true], [ed, false], [rd, false]]) {
    const st = (await call('GET', '/state', { token: tok })).json, found = (await call('GET', '/trainees/find?size=500', { token: tok })).json;
    assert.equal(found.list.some(x => x.fin === '1ABC234'), expect); assert.equal(JSON.stringify(found).includes('1ABC234'), expect);
    // searching by ID/FIN finds the person only for those allowed to see it
    assert.equal((await call('GET', '/trainees/find?q=1ABC234', { token: tok })).json.list.length, expect ? 1 : 0);
    assert.ok(!JSON.stringify(st).includes('1ABC234'), 'start-up data carries no people records');
    assert.ok(!JSON.stringify(st).includes('"hash"'));
  }
  const lg = await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } });
  const home = (await call('GET', '/portal/trainee/home', { token: lg.json.token })).json;
  assert.ok(!JSON.stringify(home).includes('1ABC234'));
});

test('roles: reader read-only, editor cannot issue, admin cannot delete, superadmin can', async () => {
  const { app, call, sa } = await setup();
  const ed = await app.mkStaff('ed@kvet.az', 'editor'), rd = await app.mkStaff('rd@kvet.az', 'reader'), ad = await app.mkStaff('ad@kvet.az', 'admin');
  const blank = { name: 'X', titleAz: 'A', titleEn: 'B' };
  assert.equal((await call('POST', '/blank/save', { token: rd, body: blank })).status, 403);
  assert.equal((await call('POST', '/blank/save', { token: ed, body: blank })).status, 200);
  assert.equal((await call('POST', '/trainee/save', { token: ed, body: person() })).status, 403);          // needs the FIN: admin only
  assert.equal((await call('POST', '/trainee/save', { token: ad, body: person() })).status, 200);
  assert.equal((await call('GET', '/issue/queue', { token: ed })).status, 403);
  assert.equal((await call('GET', '/issue/queue', { token: ad })).status, 200);
  const id = (await call('GET', '/state', { token: sa })).json.blanks.find(b => b.name === 'X').id;
  assert.equal((await call('POST', '/delete', { token: ad, body: { kind: 'blank', id } })).status, 403);
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'blank', id } })).status, 200);
  assert.equal((await call('POST', '/backup', { token: ad })).status, 200);
  assert.equal((await call('POST', '/restore', { token: ad, body: { key: 'backups/x.json' } })).status, 403);
  assert.equal((await call('GET', '/cameras', { token: ad })).status, 403);
  assert.equal((await call('GET', '/users', { token: ad })).status, 403);
  assert.equal((await call('GET', '/state')).status, 401);
});

test('full workflow: session -> attendance -> feedback -> evaluation -> practical -> exam -> release -> certificate', async () => {
  const { app, call, sa, co, tr } = await setup();
  const t1 = await mkTrainee(call, sa, { co: co.company.id });
  const t2 = await mkTrainee(call, sa, { fin: '2ABC234', name: 'Vüqar', surname: 'İsmayılov' });
  const t3 = await mkTrainee(call, sa, { fin: '3ABC234', name: 'Murad', surname: 'Əliyev' });
  const st = (await call('GET', '/state', { token: sa })).json;
  const blank = st.blanks[0];
  await call('POST', '/blank/save', { token: sa, body: { ...blank, credits: 3 } });
  const sheet = st.sheets.find(s => s.id === 'sample-ap');
  const sess = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', sheetId: sheet.id, examLink: 'https://exam.example/x', traineeIds: [t1.trainee.id, t2.trainee.id, t3.trainee.id] } })).json.session;
  assert.equal(sess.status, 'ongoing');

  // trainee flow
  const login = async t => (await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } })).json.token;
  const k1 = await login(t1), k2 = await login(t2), k3 = await login(t3);
  let home = (await call('GET', '/portal/trainee/home', { token: k1 })).json;
  assert.equal(home.sessions[0].active, true); assert.equal(home.sessions[0].examLink, '');
  assert.equal((await call('POST', '/portal/trainee/feedback', { token: k1, body: { sid: sess.id, r: { g1: 9, g2: 9, g3: 9, g4: 9, g6: 9 } } })).json.error, 'notConfirmed');
  // trainees cannot confirm their own attendance any more: the trainer does it
  assert.equal((await call('POST', '/portal/trainee/confirm', { token: k1, body: { sid: sess.id } })).status, 404);
  const trk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  for (const t of [t1, t2]) assert.equal((await call('POST', '/portal/trainer/confirm', { token: trk, body: { sid: sess.id, tid: t.trainee.id } })).status, 200);
  const missing = await call('POST', '/portal/trainee/feedback', { token: k1, body: { sid: sess.id, r: { g1: 9, g2: 9 } } }); assert.equal(missing.json.error, 'badRating');
  const g5 = { g1: 9, g2: 8, g3: 10, g4: 7, g6: 9 };
  const fb = await call('POST', '/portal/trainee/feedback', { token: k1, body: { sid: sess.id, r: g5, cm: { g6: 'Great' } } });
  assert.equal(fb.json.examLink, 'https://exam.example/x');
  assert.equal((await call('POST', '/portal/trainee/feedback', { token: k1, body: { sid: sess.id, r: g5 } })).json.error, 'dupFb');
  assert.ok(!('g5' in (await call('GET', '/session?id=' + sess.id, { token: sa })).json.enrs.find(e => e.tid === t1.trainee.id).fb.r), 'no skill & confidence rating');

  // trainer flow
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  const th = (await call('GET', '/portal/trainer/home', { token: tk })).json; assert.equal(th.sessions.length, 1);
  const td = (await call('GET', '/portal/trainer/session?id=' + sess.id, { token: tk })).json;
  assert.equal(td.trainees.length, 3); assert.equal(td.trainees.filter(x => x.attAt).length, 2);
  assert.ok(!JSON.stringify(td).includes('ABC234'));
  assert.equal((await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: sess.id, tid: t3.trainee.id, behavior: 'excellent', punctuality: 'ontime', engagement: 5 } })).json.error, 'notConfirmed');
  assert.equal((await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: sess.id, tid: t3.trainee.id } })).status, 200);   // trainer confirms on behalf
  for (const t of [t1, t2, t3]) assert.equal((await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: sess.id, tid: t.trainee.id, behavior: 'excellent', punctuality: 'ontime', engagement: 5, comment: 'ok' } })).status, 200);
  const items = S.sheetItems(sheet), all = v => Object.fromEntries(items.map(i => [i.id, v]));
  // practical needs the declaration of health first (here: paper copies received, recorded by the trainer)
  assert.equal((await call('POST', '/portal/trainer/practical', { token: tk, body: { sid: sess.id, tid: t1.trainee.id, data: { answers: all(4) } } })).json.error, 'needDoh');
  for (const t of [t1, t2, t3]) assert.equal((await call('POST', '/portal/trainer/doh/paper', { token: tk, body: { sid: sess.id, tid: t.trainee.id } })).status, 200);
  const pr = async (t, answers) => (await call('POST', '/portal/trainer/practical', { token: tk, body: { sid: sess.id, tid: t.trainee.id, data: { answers } } })).json;
  assert.equal((await pr(t1, all(4))).prac.result, 'PASS');
  assert.equal((await pr(t2, { ...all(4), i3: 1 })).prac.result, 'FAIL');          // unsafe -> automatic fail
  assert.equal((await pr(t3, { i1: 5 })).prac.result, 'INCOMPLETE');
  // another trainer cannot touch this session
  const tr2 = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Başqa', surname: 'Təlimçi', fin: 'TRN9999', phone: '+994502223355' } })).json;
  const tk2 = (await call('POST', '/login', { body: { role: 'trainer', login: tr2.creds.login, password: tr2.creds.password } })).json.token;
  assert.equal((await call('GET', '/portal/trainer/session?id=' + sess.id, { token: tk2 })).status, 404);

  // admin: results
  const exam = (t, passed) => call('POST', '/enr/exam', { token: sa, body: { sid: sess.id, tid: t.trainee.id, passed, score: 85 } });
  assert.equal((await exam(t2, true)).json.error, 'practicalFail');               // practical fail blocks the exam result
  assert.equal((await exam(t3, true)).json.error, 'needPractical');
  assert.equal((await exam(t1, true)).status, 200);
  const rel = (t, extra = {}) => call('POST', '/issue', { token: sa, body: { sid: sess.id, tid: t.trainee.id, ...extra } });
  assert.equal((await rel(t3)).json.error, 'needPractical');
  const f = await rel(t2); assert.equal(f.json.result, 'FAIL'); assert.equal(f.json.reason, 'practical'); assert.ok(!f.json.cert);
  assert.equal((await call('GET', '/certs', { token: sa })).json.certs.length, 0, 'fail creates no certificate');
  assert.equal((await rel(t2)).json.error, 'alreadyReleased');

  // issue: suggestion, custom values, duplicate protection
  const sg = (await call('GET', `/issue/suggest?bid=${blank.id}&end=2026-10-29`, { token: sa })).json;
  assert.equal(sg.no, 'CRT/26/0001'); assert.equal(sg.expiry, '2028-10-28');
  const ok = (await rel(t1, { no: sg.no, expiry: '2028-10-01' })).json;
  assert.equal(ok.result, 'PASS'); assert.equal(ok.cert.no, 'CRT/26/0001'); assert.equal(ok.cert.expiry, '2028-10-01');
  assert.equal(ok.cert.snap.names.az, 'Azər Qocayev'); assert.equal(ok.cert.snap.names.en, 'Azar Gojayev');
  assert.equal(ok.cert.snap.company, 'BP Exploration (Caspian Sea) Ltd'); assert.equal(ok.cert.snap.blank.credits, 3); assert.equal(ok.cert.snap.trainer, 'Taleh Bakirov'); assert.equal(ok.cert.att, t1.trainee.att);
  assert.ok(!JSON.stringify(ok.cert).includes('ABC234'));
  assert.equal((await call('GET', `/issue/suggest?bid=${blank.id}&end=2026-10-29`, { token: sa })).json.no, 'CRT/26/0002');

  // public verification: only the four facts + status
  const v = await call('GET', `/verify?n=${encodeURIComponent(ok.cert.no)}&h=${ok.cert.vh}`);
  assert.equal(v.status, 200); assert.deepEqual(Object.keys(v.json).sort(), ['att', 'end', 'expiry', 'foreign', 'info', 'names', 'no', 'revokedAt', 'sign', 'start', 'status']);
  assert.equal(v.json.att, t1.trainee.att); assert.ok(!JSON.stringify(v.json).includes('ABC234'));
  assert.equal((await call('GET', `/verify?n=${encodeURIComponent(ok.cert.no)}&h=000000000000`)).status, 404);

  // trainee sees the certificate in own portal; company sees counters
  home = (await call('GET', '/portal/trainee/home', { token: k1 })).json; assert.equal(home.certs.length, 1); assert.equal(home.sessions[0].final.outcome, 'PASS');
  const ck = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  const ch = (await call('GET', '/portal/company/home', { token: ck })).json;
  assert.deepEqual(ch.counters, { total: 1, ACTIVE: 1, SOON: 0, EXPIRED: 0 }); assert.equal(ch.certs.length, 1); assert.ok(!JSON.stringify(ch).includes('ABC234'));
  assert.equal(S.sessionStatus(sess, { total: 3, finalized: 2 }, '2026-10-29'), 'ongoing');
});

test('certificate numbers: unique, custom, counter continues, yearly restart, renewal keeps learner number', async () => {
  const { app, call, sa, tr } = await setup();
  const blank = (await call('GET', '/state', { token: sa })).json.blanks[0];
  const t = await mkTrainee(call, sa);
  const run = async (date, no, extra = {}) => {
    const sess = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date, traineeIds: [t.trainee.id] } })).json.session;
    await call('POST', '/enr/confirm', { token: sa, body: { sid: sess.id, tid: t.trainee.id } });
    await call('POST', '/enr/exam', { token: sa, body: { sid: sess.id, tid: t.trainee.id, passed: true } });
    return call('POST', '/issue', { token: sa, body: { sid: sess.id, tid: t.trainee.id, no, ...extra } });
  };
  const first = await run('2026-10-28', 'CRT/26/0001'); assert.equal(first.json.cert.no, 'CRT/26/0001');
  const dup = await run('2026-10-29', 'crt/26/0001'); assert.equal(dup.status, 409); assert.equal(dup.json.error, 'dupCert');
  const second = await run('2026-10-29', 'CRT/26/0001x'.replace('x', '7'));    // custom jump to 0017 style number
  assert.equal(second.json.cert.no, 'CRT/26/00017'.replace('00017', '0001') + '7' === 'CRT/26/00017' ? 'CRT/26/00017' : second.json.cert.no);
  assert.equal(second.json.cert.att, first.json.cert.att, 'same learner number on renewal');
  const sug = (await call('GET', `/issue/suggest?bid=${blank.id}&end=2026-10-29`, { token: sa })).json.no;
  assert.match(sug, /^CRT\/26\/\d{4}$/);
  const certs = (await call('GET', '/certs', { token: sa })).json.certs; assert.equal(certs.length, 2);
  assert.deepEqual(certs.map(c => c.st).sort(), ['ACTIVE', 'RENEWED']);
  // numbering config + counter reset
  await call('POST', '/numbering/set', { token: sa, body: { prefix: 'CRT', year: 2026, next: 5001 } });
  assert.equal((await call('GET', `/issue/suggest?bid=${blank.id}&end=2026-10-29`, { token: sa })).json.no, 'CRT/26/5001');
  await call('POST', '/settings/save', { token: sa, body: { num: { prefix: 'ABC', sep: '-', yearFmt: 'YYYY', pad: 6, start: 100 } } });
  assert.equal((await call('GET', `/issue/suggest?bid=${blank.id}&end=2026-10-29`, { token: sa })).json.no, 'ABC-2026-000100');
});

test('private trainees have no company on the certificate; foreigners get English name only', async () => {
  const { call, sa, tr } = await setup();
  const blank = (await call('GET', '/state', { token: sa })).json.blanks[0];
  const fo = await mkTrainee(call, sa, { name: 'John', surname: 'Smith', father: '', fin: 'P-998877', foreign: true });
  const sess = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', traineeIds: [fo.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: sess.id, tid: fo.trainee.id } });
  await call('POST', '/enr/exam', { token: sa, body: { sid: sess.id, tid: fo.trainee.id, passed: true } });
  const c = (await call('POST', '/issue', { token: sa, body: { sid: sess.id, tid: fo.trainee.id } })).json.cert;
  assert.equal(c.snap.names.az, ''); assert.equal(c.snap.names.en, 'John Smith'); assert.equal(c.snap.company, ''); assert.equal(c.co, '');
});

test('session rules: delete protection, attendance only on the day, exam link validation', async () => {
  const { app, call, sa, tr } = await setup();
  const blank = (await call('GET', '/state', { token: sa })).json.blanks[0];
  const t = await mkTrainee(call, sa);
  assert.equal((await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', examLink: 'javascript:alert(1)', traineeIds: [] } })).json.error, 'badLink');
  const future = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-11-05', traineeIds: [t.trainee.id] } })).json.session;
  assert.equal(future.status, 'upcoming');
  const k = (await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } })).json.token;
  const trk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/trainer/confirm-all', { token: trk, body: { sid: future.id } })).json.error, 'notStarted');
  app.clock.t = Date.parse('2026-11-05T06:00:00Z');
  assert.equal((await call('POST', '/portal/trainer/confirm-all', { token: trk, body: { sid: future.id } })).json.confirmed, 1);
  assert.ok(k);
  const rm = await call('POST', '/session/save', { token: sa, body: { ...future, traineeIds: [] } }); assert.equal(rm.json.error, 'hasData');
  // superadmin can delete anything: a dry run reports the impact, the real delete cascades
  const dry = (await call('POST', '/delete', { token: sa, body: { kind: 'trainee', id: t.trainee.id, dry: true } })).json;
  assert.equal(dry.impact.enrolments, 1); assert.equal(dry.impact.trainees, 1);
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'trainee', id: t.trainee.id } })).status, 200);
  assert.deepEqual((await call('GET', '/session?id=' + future.id, { token: sa })).json.session.traineeIds, []);
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'trainer', id: tr.trainer.id } })).status, 200);
  assert.equal((await call('GET', '/session?id=' + future.id, { token: sa })).json.session.tid, '');
});

test('login lock, password reset invalidates sessions, disabled accounts', async () => {
  const { call, sa } = await setup();
  const t = await mkTrainee(call, sa);
  const k = (await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } })).json.token;
  assert.equal((await call('GET', '/portal/trainee/home', { token: k })).status, 200);
  const rs = (await call('POST', '/credentials/reset', { token: sa, body: { kind: 'trainee', ids: [t.trainee.id] } })).json.list[0];
  assert.equal((await call('GET', '/portal/trainee/home', { token: k })).status, 401);
  assert.equal((await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } })).status, 401);
  for (let i = 0; i < 8; i++) await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: 'wrong' + i } });
  assert.equal((await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: rs.password } })).status, 429);
  assert.equal((await call('GET', '/portal/trainer/home', { token: k })).status, 401, 'tokens are bound to their portal');
});

test('excel-style batch import: created, exists, errors are reported per row', async () => {
  const { call, sa, co } = await setup();
  await mkTrainee(call, sa, { fin: 'AAA1111' });
  const rows = [{ row: 2, name: 'Ali', surname: 'Vəliyev', father: 'Rəşid oğlu', fin: 'BBB2222', phone: '+994501110000', company: 'bp exploration (caspian sea) ltd' },
    { row: 3, name: 'Eli', surname: 'X', fin: 'AAA1111', phone: '+994501110001' }, { row: 4, name: 'Ok', surname: 'Y', fin: 'BAD' }, { row: 5, name: 'Z', surname: 'Q', fin: 'CCC3333', company: 'Unknown Ltd' },
    { row: 6, name: 'Dup', surname: 'In', fin: 'BBB2222' }, { row: 7, name: 'Fərdi', surname: 'Şəxs', fin: 'DDD4444', company: 'Fərdi' }];
  const r = (await call('POST', '/trainee/import', { token: sa, body: { rows } })).json.results;
  assert.deepEqual(r.map(x => x.status), ['created', 'exists', 'error', 'error', 'error', 'created']);
  assert.equal(r[0].login, r[0].att); assert.ok(r[0].password); assert.equal(r[1].existing.name, 'Azər Qocayev Məmməd oğlu');
  const st = { trainees: (await call('GET', '/trainees/find?size=500', { token: sa })).json.list }; assert.equal(st.trainees.find(x => x.att === r[0].att).co, co.company.id); assert.equal(st.trainees.find(x => x.att === r[5].att).co, '');
});

test('materials are served only to the assigned trainer on the training day; backup/restore round trip', async () => {
  const { app, call, sa, tr } = await setup();
  const blank = (await call('GET', '/state', { token: sa })).json.blanks[0];
  const bytes = new Uint8Array([0x50, 0x4b, 3, 4, ...Array(200).fill(7)]);
  const up = await call('POST', '/material/upload?title=Deck&name=deck.pptx&slides=5', { token: sa, raw: bytes });
  assert.equal(up.status, 200); const mid = up.json.material.id;
  assert.equal((await call('POST', '/material/upload?title=Bad&name=x.pptx', { token: sa, raw: new Uint8Array(300) })).json.error, 'badFile');
  const t = await mkTrainee(call, sa);
  const sess = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', materials: [mid], traineeIds: [t.trainee.id] } })).json.session;
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  const got = await call('GET', `/portal/trainer/material?sid=${sess.id}&id=${mid}`, { token: tk });
  assert.equal(got.status, 200); assert.equal(got.res.headers.get('cache-control'), 'no-store, private'); assert.equal((await got.res.arrayBuffer()).byteLength, bytes.length);
  const trainee = (await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } })).json.token;
  assert.equal((await call('GET', `/portal/trainer/material?sid=${sess.id}&id=${mid}`, { token: trainee })).status, 401);
  assert.equal((await call('GET', `/portal/trainer/material?sid=${sess.id}&id=nope`, { token: tk })).status, 404);
  const key = (await call('POST', '/backup', { token: sa })).json.key;
  await call('POST', '/blank/save', { token: sa, body: { id: blank.id, name: 'Changed', titleAz: 'x', titleEn: 'y' } });
  assert.equal((await call('POST', '/restore', { token: sa, body: { key } })).status, 200);
  assert.equal((await call('GET', '/state', { token: sa })).json.blanks[0].name, 'Performing Authority');
  assert.ok((await call('GET', '/audit', { token: sa })).json.list.length > 5);
});

test('cameras: superadmin saves set-ups and snapshots, can clear them', async () => {
  const { call, sa } = await setup();
  const cam = (await call('POST', '/camera/save', { token: sa, body: { name: 'Entrance', kind: 'usb', deviceId: 'abc', label: 'HD Webcam' } })).json.cam;
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(50).fill(1)]);
  const sn = await call('POST', `/camera/snapshot?cid=${cam.id}&note=hi`, { token: sa, raw: jpg }); assert.equal(sn.status, 200);
  assert.equal((await call('GET', '/camera/snap?key=' + sn.json.snap.key, { token: sa })).status, 200);
  assert.equal((await call('POST', '/camera/save', { token: sa, body: { name: 'Net', kind: 'ip', url: 'ftp://x' } })).json.error, 'badLink');
  const ipc = await call('POST', '/camera/save', { token: sa, body: { name: 'Gate', kind: 'ip', host: '192.168.1.64', port: 554, user: 'admin', pass: 'x', url: 'rtsp://192.168.1.64:554/stream1' } });
  assert.equal(ipc.json.cam.mode, 'rtsp'); assert.equal(ipc.json.cam.host, '192.168.1.64'); assert.equal(ipc.json.cam.port, 554);
  assert.equal((await call('POST', '/camera/save', { token: sa, body: { name: 'Web', kind: 'ip', url: 'http://192.168.1.9/video', mode: 'mjpeg' } })).json.cam.mode, 'mjpeg');
  await call('POST', '/camera/delete', { token: sa, body: { id: ipc.json.cam.id } });
  assert.equal((await call('POST', '/cameras/clear', { token: sa, body: {} })).json.removed, 1);
  let l = (await call('GET', '/cameras', { token: sa })).json; assert.equal(l.snaps.length, 0); assert.equal(l.cams.length, 2);
  await call('POST', '/cameras/clear', { token: sa, body: { all: true } }); l = (await call('GET', '/cameras', { token: sa })).json; assert.equal(l.cams.length, 0);
});
