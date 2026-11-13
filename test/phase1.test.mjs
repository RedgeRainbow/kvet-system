/* v3.35 (audit, phase 1): field-level writes, sign-in throttling per account + address, candidate passwords,
   second factor needed to change the second factor. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import { memoryStore, diffOps, applyOps } from '../functions/_lib/store.js';
import { cached } from '../functions/_lib/cache.js';
import { totp } from '../functions/_lib/auth.js';
import * as S from '../public/js/shared.js';

async function classroom(n = 2) {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} }); await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: { name: 'Taleh', surname: 'Bekirov', fin: 'TRN1234', phone: '+994502223344' } })).json;
  const ppl = []; for (let i = 0; i < n; i++) ppl.push((await call('POST', '/trainee/save', { token: sa, body: { name: 'Ad' + i, surname: 'Soyad' + i, fin: 'A' + String(100000 + i), phone: '+9945012' + String(10000 + i) } })).json);
  const bid = (await call('GET', '/state', { token: sa })).json.blanks[0].id;
  const x = (await call('POST', '/test/save', { token: sa, body: { title: 'T', questions: Array.from({ length: 4 }, (_, i) => ({ text: 'Q' + i, options: ['a', 'b', 'c'], correct: 0 })) } })).json.test;
  const s = (await call('POST', '/session/save', { token: sa, body: { bid, tid: tr.trainer.id, date: '2026-10-29', traineeIds: ppl.map(p => p.trainee.id), examMode: 'bank', examId: x.id } })).json.session;
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  const toks = []; for (const p of ppl) toks.push((await call('POST', '/login', { body: { role: 'trainee', login: p.creds.login, password: p.creds.password } })).json.token);
  assert.equal((await call('POST', '/portal/trainer/attendance', { token: tk, body: { sid: s.id, absent: [] } })).status, 200);
  assert.equal((await call('POST', '/portal/trainer/exam', { token: tk, body: { sid: s.id, open: true } })).status, 200);
  return { app, call, sa, tr, tk, ppl, toks, s };
}
/* runs `first`, and while its write to the enrolment is on its way lets `then` run to the end (two requests at the same moment) */
async function interleave(app, first, then) {
  const { put, patch } = app.store; let done = false, other;
  const gate = f => async (col, ...a) => { if (col === 'enr' && !done) { done = true; other = await then(); } return f(col, ...a); };
  app.store.put = gate(put); if (patch) app.store.patch = gate(patch);
  try { return [await first(), other]; } finally { app.store.put = put; if (patch) app.store.patch = patch; }
}

test('a trainee hands in the test while the trainer saves the evaluation: both are kept', async () => {
  const { app, call, tk, ppl, toks, s } = await classroom(), tid = ppl[0].trainee.id;
  const q = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: toks[0] })).json.questions;
  const answers = Object.fromEntries(q.map(k => [k.id, k.options[0].id]));
  const [ev, sub] = await interleave(app,
    () => call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid, behavior: S.BEHAVIOR[0], punctuality: S.PUNCTUALITY[0], engagement: 4 } }),
    () => call('POST', '/portal/trainee/test/submit', { token: toks[0], body: { sid: s.id, answers } }));
  assert.equal(ev.status, 200); assert.equal(sub.status, 200);
  const e = await app.store.get('enr', `${s.id}|${tid}`);
  assert.ok(e.ev, 'the evaluation is saved'); assert.ok(e.test?.at, 'the hand-in was not overwritten by the evaluation'); assert.ok(e.exam || e.test.status === 'review', 'the result is still there');
  assert.equal((await call('GET', '/portal/trainee/test?sid=' + s.id, { token: toks[0] })).json.done, true, 'the candidate still sees the test as handed in');
});

test('an answer autosave that lands after the hand-in does not reopen the attempt; a warning is not lost to an autosave', async () => {
  const { app, call, ppl, toks, s } = await classroom(), tid = ppl[0].trainee.id;
  const q = (await call('GET', '/portal/trainee/test?sid=' + s.id, { token: toks[0] })).json.questions;
  const [, warn] = await interleave(app,
    () => call('POST', '/portal/trainee/test/save', { token: toks[0], body: { sid: s.id, answers: { [q[0].id]: q[0].options[0].id } } }),
    () => call('POST', '/portal/trainee/test/warn', { token: toks[0], body: { sid: s.id, kind: 'blur' } }));
  assert.equal(warn.status, 200);
  let e = await app.store.get('enr', `${s.id}|${tid}`);
  assert.equal(e.test.warns.length, 1, 'the warning survives the autosave that was on its way'); assert.equal(Object.keys(e.test.draft).length, 1);
  const [save, sub] = await interleave(app,
    () => call('POST', '/portal/trainee/test/save', { token: toks[0], body: { sid: s.id, answers: {} } }),
    () => call('POST', '/portal/trainee/test/submit', { token: toks[0], body: { sid: s.id, answers: {} } }));
  assert.equal(sub.status, 200); assert.equal(save.status, 200);
  e = await app.store.get('enr', `${s.id}|${tid}`); assert.ok(e.test.at && e.test.status, 'still handed in');
});

test('the office saves the session form while the trainer adds a candidate: the candidate stays', async () => {
  const { app, call, sa, tk, ppl, s } = await classroom(1);
  const extra = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Yeni', surname: 'Namized', fin: 'B123456', phone: '+994501299999' } })).json.trainee;
  // two request contexts over the same database: the office read the session, then the trainer added someone, then the office saved a note
  const office = cached(app.store), mine = await office.get('sessions', s.id);
  assert.equal((await call('POST', '/portal/trainer/session/trainees', { token: tk, body: { sid: s.id, add: [extra.id] } })).status, 200);
  mine.notes = 'projector needed'; await office.put('sessions', [{ id: s.id, data: mine }]);
  const now = await app.store.get('sessions', s.id);
  assert.equal(now.notes, 'projector needed'); assert.deepEqual(now.traineeIds, [ppl[0].trainee.id, extra.id]);
});

test('diffOps / applyOps: only what changed is written; a record that did not exist is written whole', () => {
  const base = { sid: 's', tid: 't', att: 'x', absent: { at: 1 }, test: { qs: [1], draft: { a: 1 }, warns: [] } };
  const next = { sid: 's', tid: 't', att: 'x', ev: { b: 1 }, test: { qs: [1], draft: { a: 1, b: 2 }, warns: [], savedAt: 'now' } };
  const d = diffOps('enr', base, next);
  assert.deepEqual(d.unset, [['absent']]); assert.deepEqual(d.set.map(o => o.p.join('.')).sort(), ['ev', 'test.draft', 'test.savedAt']);
  assert.deepEqual(applyOps(base, d.set, d.unset), next);
  // a finished attempt changes other parts of the test too: the whole test is written
  assert.deepEqual(diffOps('enr', base, { ...base, test: { ...base.test, at: 'now', status: 'graded' } }).set.map(o => o.p.join('.')), ['test']);
  assert.deepEqual(diffOps('enr', null, { sid: 's', tid: 't' }).set.map(o => o.p[0]), ['sid', 'tid']);
  // a nested write into a parent that is gone (the attempt was reset meanwhile) changes nothing
  assert.deepEqual(applyOps({ sid: 's' }, [{ p: ['test', 'draft'], v: {} }], []), { sid: 's' });
  // other collections are written whole
  const st = memoryStore(); let whole = 0; const put = st.put; st.put = (...a) => { whole++; return put(...a); };
  return (async () => { const c = cached(st); await c.put('settings', [{ id: 'main', data: { a: 1 } }]); const x = await c.get('settings', 'main'); x.b = 2; await c.put('settings', [{ id: 'main', data: x }]); assert.equal(whole, 2); })();
});

test('guessing at an account locks the guesser, not the account; many addresses together still hit a limit', async () => {
  const { call, ppl } = await classroom(1), p = ppl[0];
  const L = (ip, password) => call('POST', '/login', { headers: { 'cf-connecting-ip': ip }, body: { role: 'trainee', login: p.creds.login, password } }).then(r => r.status);
  for (let i = 0; i < 8; i++) assert.equal(await L('203.0.113.9', 'Wrong' + i), 401);
  assert.equal(await L('203.0.113.9', p.creds.password), 429, 'that address is locked for this account, also with the right password');
  assert.equal(await L('198.51.100.20', p.creds.password), 200, 'the real candidate, from another address, signs in');
  // 40 failed attempts in all (five addresses x 8): the account is closed for every address for 15 minutes
  for (let a = 1; a <= 4; a++) for (let i = 0; i < 8; i++) await L('203.0.113.' + (10 + a), 'Wrong' + i);
  assert.equal(await L('198.51.100.21', p.creds.password), 429, 'guessing from many addresses is stopped as well');
});

test('the break-glass account cannot be locked out by somebody else guessing', async () => {
  const app = makeApp(), { call } = app; app.env.EMERGENCY_PASSWORD = 'correct-horse-battery-staple-42';
  const L = (ip, password) => call('POST', '/staff/login', { headers: { 'cf-connecting-ip': ip }, body: { email: 'admin_emergency', password } }).then(r => r.status);
  for (let a = 0; a < 8; a++) for (let i = 0; i < 9; i++) await L('203.0.113.' + (30 + a), 'guess-guess-guess-' + i);
  assert.equal(await L('203.0.113.30', app.env.EMERGENCY_PASSWORD), 429, 'the guessing addresses are locked');
  assert.equal(await L('198.51.100.30', app.env.EMERGENCY_PASSWORD), 200, 'the owner of the secret still gets in');
});

test('candidate passwords: three letters and five digits that differ from person to person', async () => {
  const { ppl, call, sa } = await classroom(1), more = [];
  for (let i = 0; i < 20; i++) more.push((await call('POST', '/trainee/save', { token: sa, body: { name: 'P' + i, surname: 'Q' + i, fin: 'C' + String(200000 + i), phone: '+9945013' + String(10000 + i) } })).json.creds.password);
  for (const pw of [ppl[0].creds.password, ...more]) assert.match(pw, /^[A-HJ-NP-Z][a-hj-km-np-z][A-HJ-NP-Z]\d{5}$/);
  assert.ok(new Set(more.map(pw => pw.slice(3))).size > 15, 'the digits are random, not 12345 for everybody');
});

test('with two-factor on, the password alone cannot add another authenticator', async () => {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  const en = (await call('POST', '/staff/mfa/enroll', { token: sa, body: {} })).json;
  assert.equal((await call('POST', '/staff/mfa/activate', { token: sa, body: { factorId: en.id, code: await totp(en.secret) } })).status, 200, 'first set-up works with one factor');
  // somebody who only knows the password: the first sign-in step hands out a one-factor ticket
  const step1 = (await call('POST', '/staff/login', { body: { email: 'boss@kvet.az', password: 'bosspass123' } })).json; assert.equal(step1.mfa, true);
  const again = await call('POST', '/staff/mfa/enroll', { token: step1.ticket, body: {} });
  assert.equal(again.status, 401); assert.equal(again.json.error, 'mfaRequired');
  assert.equal((await call('POST', '/staff/mfa/activate', { token: step1.ticket, body: { factorId: 'x', code: '000000' } })).json.error, 'mfaRequired');
  // with the second factor passed, a new authenticator can be added (replacing a phone)
  const full = (await call('POST', '/staff/mfa/verify', { body: { ticket: step1.ticket, factorId: step1.factorId, code: await totp(en.secret) } })).json.access;
  assert.equal((await call('POST', '/staff/mfa/enroll', { token: full, body: {} })).status, 200);
});
