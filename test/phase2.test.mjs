/* v3.35 (audit, phase 2): classroom actions in a handful of database calls, a release that survives a failure half-way,
   ID/FIN claims that never outlive a failed registration, no answer key on the trainer's page, no overruling of automatic
   marks, longer signature codes with a brake on guessing, malformed requests, reminders, Baku days. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import { createHandler } from '../functions/_lib/index.js';
import * as S from '../public/js/shared.js';

const mkPerson = i => ({ name: 'Ad' + i, surname: 'Soyad' + i, fin: 'A' + String(100000 + i), phone: '+9945012' + String(10000 + i) });
async function base() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} }); await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Boss Bossov', title: 'Director' } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Taleh', surname: 'Bekirov', fin: 'TRN1234', phone: '+994502223344' } })).json;
  const blanks = (await call('GET', '/state', { token: sa })).json.blanks, bid = (blanks.find(b => !b.defaultSheetId) || blanks[0]).id;
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  return { app, call, sa, tr, tk, bid };
}
async function classroom(n = 2, { bank = true } = {}) {
  const b = await base(), { call, sa, tr, bid } = b;
  const ppl = []; for (let i = 0; i < n; i++) ppl.push((await call('POST', '/trainee/save', { token: sa, body: mkPerson(i) })).json);
  const x = bank ? (await call('POST', '/test/save', { token: sa, body: { title: 'T', questions: Array.from({ length: 4 }, (_, i) => ({ text: 'Q' + i, options: ['a', 'b', 'c'], correct: 0 })) } })).json.test : null;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid, tid: tr.trainer.id, date: '2026-10-29', traineeIds: ppl.map(p => p.trainee.id), ...(bank ? { examMode: 'bank', examId: x.id } : {}) } })).json.session;
  const toks = []; for (const p of ppl) toks.push((await call('POST', '/login', { body: { role: 'trainee', login: p.creds.login, password: p.creds.password } })).json.token);
  return { ...b, ppl, toks, s, x };
}
/* counts the database round trips of the requests made inside fn */
async function counting(app, fn) {
  const st = app.store, keep = {}, n = { v: 0 };
  for (const [k, f] of Object.entries(st)) if (typeof f === 'function' && !k.startsWith('_')) { keep[k] = f; st[k] = (...a) => { n.v++; return f.apply(st, a); }; }
  try { await fn(); } finally { Object.assign(st, keep); }
  return n.v;
}

test('a class of 30: roll call, signing the sheet, confirm-all and closing the exam each stay far below 50 database calls', async () => {
  const { app, call, tk, toks, s, ppl } = await classroom(30), LIMIT = 25;
  let r; const cost = async (m, p, body) => counting(app, async () => { r = await call(m, p, { token: tk, body }); });
  assert.ok(await cost('POST', '/portal/trainer/attendance', { sid: s.id, absent: [ppl[0].trainee.id] }) <= LIMIT, 'roll call'); assert.deepEqual([r.json.present, r.json.absent], [29, 1]);
  assert.ok(await cost('POST', '/portal/trainer/confirm-all', { sid: s.id }) <= LIMIT, 'confirm all'); assert.equal(r.json.confirmed, 1);
  assert.equal((await call('POST', '/portal/trainer/confirm-all', { token: tk, body: { sid: s.id } })).json.confirmed, 0);
  assert.ok(await cost('POST', '/portal/trainer/sign/att', { sid: s.id }) <= LIMIT, 'sign attendance'); assert.ok(r.json.sign.code);
  await call('POST', '/portal/trainer/exam', { token: tk, body: { sid: s.id, open: true } });
  for (const t of toks) await call('GET', '/portal/trainee/test?sid=' + s.id, { token: t });
  assert.ok(await cost('POST', '/portal/trainer/exam', { sid: s.id, open: false }) <= LIMIT, 'close exam'); assert.equal(r.status, 200);
  const enrs = (await app.store.prefix('enr', s.id + '|')).map(x => x.data);
  assert.equal(enrs.filter(e => e.att).length, 30); assert.equal(enrs.filter(e => e.test?.at && e.test.closedBy === 'closed').length, 30, 'every open attempt was handed in');
  const trail = (await app.store.all('audit')).map(x => x.data);
  assert.equal(trail.filter(a => a.action === 'attendance.confirm').length, 30, 'one audit row per person, as before'); assert.equal(trail.filter(a => a.action === 'test.submit').length, 30);
  assert.ok(await cost('POST', '/portal/trainer/sign/doc', { sid: s.id, doc: 'exam' }) <= LIMIT, 'sign exam results'); assert.equal(r.status, 200);
});

test('release: a failure after the certificate was made does not lead to a second certificate', async () => {
  const { app, call, sa, s, ppl } = await classroom(1, { bank: false }), tid = ppl[0].trainee.id;
  await call('POST', '/enr/attendance', { token: sa, body: { sid: s.id, absent: [] } });
  await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid, passed: true, score: 90 } });
  // the database fails exactly when the result is written onto the enrolment (the certificate is in by then)
  const { patch } = app.store; let failed = false;
  app.store.patch = async (col, id, b, set, ...a) => { if (col === 'enr' && !failed && set.some(o => o.p[0] === 'final')) { failed = true; throw new Error('db 503 connection lost'); } return patch(col, id, b, set, ...a); };
  assert.equal((await call('POST', '/issue', { token: sa, body: { sid: s.id, tid } })).status, 500); assert.ok(failed);
  app.store.patch = patch;
  const again = await call('POST', '/issue', { token: sa, body: { sid: s.id, tid } });
  assert.equal(again.status, 200); assert.equal(again.json.result, 'PASS'); assert.equal(again.json.recovered, true);
  const certs = await app.store.all('certs'); assert.equal(certs.length, 1, 'still one certificate'); assert.equal(again.json.cert.no, certs[0].id);
  assert.equal((await app.store.get('enr', `${s.id}|${tid}`)).final.certNo, certs[0].id);
  assert.equal((await call('POST', '/issue', { token: sa, body: { sid: s.id, tid } })).json.error, 'alreadyReleased');
});

test('ID/FIN: a registration that fails gives its claim back; a claim of nobody is taken over; the repair removes leftovers', async () => {
  const { app, call, sa } = await base(), { put } = app.store;
  let failed = false; app.store.put = async (col, rows) => { if (col === 'trainees' && !failed) { failed = true; throw new Error('db 503'); } return put(col, rows); };
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: mkPerson(1) })).status, 500);
  app.store.put = put;
  assert.equal(await app.store.get('fins', 'A100001'), undefined, 'the claim was given back');
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: mkPerson(1) })).status, 200, 'the same person can be registered');
  // a claim left by an older version (nobody behind it): no longer "already registered" for ever
  await app.store.put('fins', [{ id: 'A100002', data: { id: 'E-202599999' } }]);
  const ok = await call('POST', '/trainee/save', { token: sa, body: mkPerson(2) }); assert.equal(ok.status, 200);
  assert.equal((await app.store.get('fins', 'A100002')).id, ok.json.trainee.id);
  // a claim made a moment ago is somebody's registration on its way: respected
  await app.store.put('fins', [{ id: 'A100003', data: { id: 'E-202599998', at: new Date().toISOString() } }]);
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: mkPerson(3) })).json.error, 'dupFin');
  // a real duplicate is still refused
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: { ...mkPerson(9), fin: 'A100001' } })).json.error, 'dupFin');
  await app.store.put('fins', [{ id: 'Z999999', data: { id: 'gone' } }]); await app.store.del('fins', 'A100001');
  const rep = (await call('POST', '/system/logins/repair', { token: sa, body: {} })).json;
  assert.ok(rep.count >= 2); assert.equal(rep.fins.added, 1); assert.ok(rep.fins.removed >= 1);
  assert.equal(await app.store.get('fins', 'Z999999'), undefined); assert.ok(await app.store.get('fins', 'A100001'));
});

test('the trainer\'s session page carries no answer key, and a trainer cannot overrule an automatic mark', async () => {
  const { app, call, sa, tk, toks, s, ppl } = await classroom(1), tid = ppl[0].trainee.id;
  await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [] } });
  const page = await call('GET', '/portal/trainer/session?id=' + s.id, { token: tk });
  assert.equal(page.json.test.questions, 4); assert.ok(page.json.test.title); assert.ok(!JSON.stringify(page.json).includes('"correct"'), 'no key in the page data');
  assert.equal((await app.store.get('sessions', s.id)).keySeen, undefined);
  await call('POST', '/portal/trainer/exam', { token: tk, body: { sid: s.id, open: true } });
  await call('GET', '/portal/trainee/test?sid=' + s.id, { token: toks[0] });
  const sub = await call('POST', '/portal/trainee/test/submit', { token: toks[0], body: { sid: s.id, answers: {} } });
  assert.equal(sub.json.status, 'graded'); assert.equal(sub.json.passed, false);
  const g = await call('POST', '/portal/trainer/test/grade', { token: tk, body: { sid: s.id, tid, passed: true } });
  assert.equal(g.status, 409); assert.equal(g.json.error, 'autoGraded');
  assert.equal((await app.store.get('enr', `${s.id}|${tid}`)).exam.passed, false);
  assert.equal((await call('POST', '/test/grade', { token: sa, body: { sid: s.id, tid, passed: true } })).status, 200, 'the office still can');
});

test('signature codes: 12 characters, older 8-character codes still check, guessing is slowed down', async () => {
  const { app, call, tk, s } = await classroom(1);
  await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [] } });
  const sg = (await call('POST', '/portal/trainer/sign/att', { token: tk, body: { sid: s.id } })).json.sign;
  assert.match(sg.code, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal((await call('GET', '/verify-sign?c=' + sg.code.replace(/-/g, '').toLowerCase())).json.status, 'VALID');
  const rec = (await app.store.all('signs'))[0]; await app.store.put('signs', [{ id: rec.id, data: { ...rec.data, code: 'ABCD-1234' } }]);
  assert.equal((await call('GET', '/verify-sign?c=ABCD-1234')).json.status, 'VALID', 'a code printed before v3.35');
  const hdr = { 'cf-connecting-ip': '203.0.113.77' }, guess = i => call('GET', '/verify-sign?c=' + (0x10000000 + i).toString(16), { headers: hdr }).then(r => r.status);
  for (let i = 0; i < 20; i++) assert.equal(await guess(i), 404);
  assert.equal(await guess(99), 429, 'the guessing address waits'); assert.equal((await call('GET', '/verify-sign?c=ABCD-1234', { headers: hdr })).status, 429);
  assert.equal((await call('GET', '/verify-sign?c=ABCD-1234', { headers: { 'cf-connecting-ip': '198.51.100.9' } })).status, 200, 'everybody else is unaffected');
});

test('malformed requests are refused as such: no server error, no error-log row', async () => {
  const { app, call, sa } = await base();
  assert.equal((await call('GET', '/asset/%E0%A4%A')).status, 404); assert.equal((await call('GET', '/qimg/%')).status, 404);
  for (const raw of ['null', '[1,2]', '"x"', '{bad', '12']) { const r = await call('POST', '/login', { raw, headers: { 'content-type': 'application/json' } }); assert.equal(r.status, 400, raw); assert.equal(r.json.error, 'badInput'); }
  assert.equal((await call('POST', '/staff/profile', { token: sa, raw: 'null', headers: { 'content-type': 'application/json' } })).status, 400);
  assert.equal((await call('POST', '/seed', { token: sa })).status, 200, 'an empty body is still fine');
  assert.equal((await app.store.all('errlog')).length, 0);
  assert.equal((await call('POST', '/users/delete', { token: sa, body: { id: 'nobody' } })).status, 404);
  assert.equal((await call('POST', '/users/update', { token: sa, body: { id: ['x'], name: 'n' } })).status, 404);
});

test('expiry reminders wait for approval; a candidate\'s own certificate carries no staff e-mail', async () => {
  const { call, sa, s, ppl, toks } = await classroom(1, { bank: false }), tid = ppl[0].trainee.id;
  await call('POST', '/enr/attendance', { token: sa, body: { sid: s.id, absent: [] } }); await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid, passed: true } });
  await call('POST', '/settings/save', { token: sa, body: { remind: { on: true, days: [90] }, approvals: { certs: true } } });
  const no = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid } })).json.cert.no;
  await call('POST', '/cert/update', { token: sa, body: { no, patch: { expiry: '2026-12-15' } } });
  assert.equal((await call('POST', '/reminders/run', { token: sa, body: { dry: true } })).json.due.length, 0, 'not approved yet: no reminder');
  assert.equal((await call('POST', '/approval/decide', { token: sa, body: { kind: 'cert', id: no, approve: true } })).status, 200);
  assert.deepEqual((await call('POST', '/reminders/run', { token: sa, body: { dry: true } })).json.due.map(d => d.no), [no]);
  const home = (await call('GET', '/portal/trainee/home', { token: toks[0] })).json;
  assert.equal(home.certs.length, 1); assert.equal(home.certs[0].no, no); assert.ok(home.certs[0].vh, 'the QR check value stays');
  assert.ok(!JSON.stringify(home.certs).includes('boss@kvet.az'), 'no staff e-mail');
});

test('"issued on" and audit filters mean days in Baku', async () => {
  const { app, call, sa, s, ppl } = await classroom(1, { bank: false }), tid = ppl[0].trainee.id;
  await call('POST', '/enr/attendance', { token: sa, body: { sid: s.id, absent: [] } }); await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid, passed: true } });
  app.clock.t = Date.parse('2026-10-31T21:30:00Z');                    // 1 November, 01:30 in Baku
  const no = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid } })).json.cert.no;
  const on = async d => (await call('GET', `/certs?issued=${d}..${d}&counts=0`, { token: sa })).json.certs.map(x => x.no);
  assert.deepEqual(await on('2026-11-01'), [no]); assert.deepEqual(await on('2026-10-31'), []);
  const trail = (await call('GET', '/audit?from=2026-11-01&to=2026-11-01', { token: sa })).json.list;
  assert.ok(trail.some(a => a.action === 'release.pass'), 'found although it is stored under October (UTC)');
});

test('the daily job clears sign-in counters that mean nothing any more', async () => {
  const app = makeApp(), { call } = app; app.env.CRON_SECRET = 'cron-secret-cron-secret';
  for (let i = 0; i < 3; i++) await call('POST', '/login', { headers: { 'cf-connecting-ip': '203.0.113.5' }, body: { role: 'trainee', login: 'E-20260000' + i, password: 'x' } });
  const run = () => call('POST', '/cron/run', { headers: { 'x-cron-key': app.env.CRON_SECRET }, body: { tasks: ['none'] } }).then(r => r.json);
  app.clock.t = Date.now(); assert.equal((await run()).locks, 0, 'fresh counters stay');
  app.clock.t = Date.now() + 2 * 864e5; assert.ok((await run()).locks >= 4, 'two days later they are gone');
});
