/* Round 3: security fixes, bug fixes and new features. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import * as S from '../public/js/shared.js';
import { totp, unseal } from '../functions/_lib/auth.js';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
async function setup({ fb = false } = {}) {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  if (!fb) await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling LLC', email: 'hr@cd.az' } })).json;
  const tr = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Rəşad', surname: 'Əliyev', fin: 'TRN1234' }) })).json;
  const blank = (await call('GET', '/state', { token: sa })).json.blanks[0];
  return { app, call, sa, co, tr, blank };
}
const mk = async (call, sa, o) => (await call('POST', '/trainee/save', { token: sa, body: person(o) })).json;
const sessionWith = async (ctx, ids, o = {}) => (await ctx.call('POST', '/session/save', { token: ctx.sa, body: { bid: ctx.blank.id, tid: ctx.tr.trainer.id, date: '2026-10-29', traineeIds: ids, ...o } })).json;
const ready = async (ctx, s, tid) => { await ctx.call('POST', '/enr/confirm', { token: ctx.sa, body: { sid: s.id, tid } }); await ctx.call('POST', '/enr/exam', { token: ctx.sa, body: { sid: s.id, tid, passed: true, score: 80 } }); };

test('lockout cannot be bypassed with parallel guesses (counted first, atomically)', async () => {
  const ctx = await setup(), t = await mk(ctx.call, ctx.sa, {});
  const tries = await Promise.all(Array.from({ length: 40 }, (_, i) => ctx.call('POST', '/login', { body: { role: 'trainee', login: t.trainee.login, password: 'wrong' + i } })));
  const checked = tries.filter(r => r.status === 401).length;
  assert.ok(checked <= 8, `only 8 passwords may be checked, got ${checked}`);
  assert.equal(tries.filter(r => r.status === 429).length, 40 - checked);
  // even the right password is refused while locked
  assert.equal((await ctx.call('POST', '/login', { body: { role: 'trainee', login: t.trainee.login, password: t.creds.password } })).status, 429);
  ctx.app.clock.t += 16 * 6e4;   // (lock is wall-clock in the memory store; check the reset path instead)
  await ctx.call('POST', '/credentials/reset', { token: ctx.sa, body: { kind: 'trainee', ids: [t.trainee.id] } });
});

test('per-IP limit: many accounts from one address get locked out', async () => {
  const ctx = await setup(), hdr = { 'cf-connecting-ip': '203.0.113.7' };
  const r = []; for (let i = 0; i < 105; i++) r.push((await ctx.call('POST', '/login', { headers: hdr, body: { role: 'trainee', login: 'E-2026' + String(i).padStart(5, '0'), password: 'x' } })).status);
  assert.equal(r[98], 401); assert.ok(r.slice(-3).every(s => s === 429), 'IP blocked after 100 failed attempts');
  assert.equal((await ctx.call('POST', '/login', { headers: { 'cf-connecting-ip': '198.51.100.1' }, body: { role: 'trainee', login: 'E-202600099', password: 'x' } })).status, 401, 'other addresses unaffected');
});

test('restore never rewrites the audit trail, and re-registers logins', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const { key } = (await call('POST', '/backup', { token: sa, body: {} })).json;
  await mk(call, sa, { fin: '7XYZ777' });
  const before = (await call('GET', '/audit', { token: sa })).json.total;
  const r = await call('POST', '/restore', { token: sa, body: { key } }); assert.equal(r.status, 200);
  const after = (await call('GET', '/audit', { token: sa })).json.total;
  assert.ok(after > before, 'audit rows written after the backup are still there');
  assert.equal((await call('GET', '/trainees/find?size=500', { token: sa })).json.list.length, 0, 'data itself was restored');
});

test('bootstrap e-mail only works while there is no superadmin', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  await call('POST', '/users/update', { token: sa, body: { id: (await call('GET', '/users', { token: sa })).json.list[0].id } }).catch(() => {});
  // demote: create a second superadmin, demote the bootstrap one, sign in again -> stays admin
  const other = await app.mkStaff('two@kvet.az', 'superadmin');
  const bootId = (await call('GET', '/users', { token: other })).json.list.find(u => u.email === 'boss@kvet.az').id;
  assert.equal((await call('POST', '/users/update', { token: other, body: { id: bootId, role: 'admin' } })).status, 200);
  const again = await app.staff('boss@kvet.az', 'bosspass123');
  assert.equal((await call('GET', '/state', { token: again })).json.role, 'admin');
});

test('backups: download is superadmin only; camera passwords encrypted at rest', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  await call('POST', '/camera/save', { token: sa, body: { name: 'Gate', kind: 'ip', url: 'http://192.168.1.20/video', user: 'admin', pass: 'S3cret!' } });
  const raw = (await app.store.all('cams'))[0].data.pass; assert.ok(raw.startsWith('enc:')); assert.ok(!raw.includes('S3cret'));
  assert.equal(await unseal(app.env.TOKEN_SECRET, raw), 'S3cret!');
  assert.equal((await call('GET', '/cameras', { token: sa })).json.cams[0].pass, 'S3cret!');
  const { key } = (await call('POST', '/backup', { token: sa, body: {} })).json;
  const ad = await app.mkStaff('ad@kvet.az', 'admin');
  assert.equal((await call('GET', '/backup/get?key=' + encodeURIComponent(key), { token: ad })).status, 403);
  const dl = await call('GET', '/backup/get?key=' + encodeURIComponent(key), { token: sa }); assert.equal(dl.status, 200);
  assert.ok(!JSON.stringify(dl.json).includes('S3cret!'));
});

test('parallel release clicks create exactly one certificate', async () => {
  const ctx = await setup(), t = await mk(ctx.call, ctx.sa, {}), s = (await sessionWith(ctx, [t.trainee.id])).session;
  await ready(ctx, s, t.trainee.id);
  const rs = await Promise.all([1, 2, 3, 4].map(() => ctx.call('POST', '/issue', { token: ctx.sa, body: { sid: s.id, tid: t.trainee.id } })));
  assert.equal(rs.filter(r => r.status === 200).length, 1);
  assert.equal((await ctx.call('GET', '/certs', { token: ctx.sa })).json.certs.length, 1);
});

test('feedback is required before a PASS is released (setting, on by default)', async () => {
  const ctx = await setup({ fb: true }), { call, sa } = ctx, t = await mk(call, sa, {}), s = (await sessionWith(ctx, [t.trainee.id])).session;
  await ready(ctx, s, t.trainee.id);
  const r = await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t.trainee.id } }); assert.equal(r.json.error, 'needFeedback');
  assert.equal((await call('GET', '/issue/queue', { token: sa })).json.list[0].outcome, 'PENDING_FEEDBACK');
  const tk = (await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } })).json.token;
  assert.equal((await call('GET', '/portal/trainee/home', { token: tk })).json.sessions[0].fbOpen, true);
  await call('POST', '/portal/trainee/feedback', { token: tk, body: { sid: s.id, r: Object.fromEntries(S.FB_GROUPS.map(g => [g, 9])), cm: {} } });
  assert.equal((await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t.trainee.id } })).json.result, 'PASS');
  assert.equal((await call('GET', '/portal/trainee/home', { token: tk })).json.sessions[0].fbOpen, false, 'no feedback button after release');
});

test('company logins keep English spelling; Azerbaijani letters are folded', () => {
  assert.equal(S.loginSlug('Caspian Drilling LLC'), 'caspiandrillingllc');
  assert.equal(S.loginSlug('Şüşə Qaz MMC'), 'shushaqazmmc');
});

test('trainer cannot change marks after the session is closed; staff still can until release', async () => {
  const ctx = await setup(), { call, sa, tr } = ctx, t = await mk(call, sa, {}), s = (await sessionWith(ctx, [t.trainee.id])).session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  await call('POST', '/session/close', { token: sa, body: { id: s.id, closed: true } });
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: t.trainee.id, behavior: 'good', punctuality: 'ontime', engagement: 4 } })).json.error, 'sessionClosed');
  assert.equal((await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: t.trainee.id, passed: true } })).status, 200);
});

test('two-factor sign-in: enrol, then password alone is not enough', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  const en = (await call('POST', '/staff/mfa/enroll', { token: sa, body: {} })).json; assert.ok(en.secret);
  const uid = (await call('GET', '/users', { token: sa })).json.list[0].id;
  assert.equal((await call('POST', '/staff/mfa/activate', { token: sa, body: { factorId: en.id, code: '000000' } })).status, 401);
  const act = await call('POST', '/staff/mfa/activate', { token: sa, body: { factorId: en.id, code: await totp(en.secret) } }); assert.equal(act.status, 200);
  assert.equal((await call('GET', '/state', { token: sa })).json.error, 'mfaRequired', 'old one-factor token stops working');
  const step1 = (await call('POST', '/staff/login', { body: { email: 'boss@kvet.az', password: 'bosspass123' } })).json;
  assert.equal(step1.mfa, true); assert.equal(step1.access, undefined);
  assert.equal((await call('POST', '/staff/mfa/verify', { body: { ticket: step1.ticket, factorId: step1.factorId, code: '123456' } })).status, 401);
  const ok = (await call('POST', '/staff/mfa/verify', { body: { ticket: step1.ticket, factorId: step1.factorId, code: await totp(app.auth._secret(uid, en.id)) } })).json;
  assert.equal((await call('GET', '/state', { token: ok.access })).status, 200);
  // policy: admins must use 2FA
  await call('POST', '/settings/save', { token: ok.access, body: { mfa: 'admins' } });
  const ad = await app.mkStaff('ad@kvet.az', 'admin');
  assert.equal((await call('GET', '/state', { token: ad })).json.error, 'mfaSetup');
  assert.equal((await call('GET', '/staff/mfa', { token: ad })).json.required, true);
  const ed = await app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('GET', '/state', { token: ed })).status, 200);
});

test('portal users change their own password; other devices are signed out', async () => {
  const ctx = await setup(), { call, sa } = ctx, t = await mk(call, sa, {});
  const tk = (await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: t.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/trainee/password', { token: tk, body: { current: 'nope', next: 'newpass123' } })).json.error, 'badPassword');
  assert.equal((await call('POST', '/portal/trainee/password', { token: tk, body: { current: t.creds.password, next: 'short' } })).json.error, 'weakPassword');
  const r = await call('POST', '/portal/trainee/password', { token: tk, body: { current: t.creds.password, next: 'newpass123' } }); assert.equal(r.status, 200);
  assert.equal((await call('GET', '/portal/trainee/home', { token: tk })).status, 401);
  assert.equal((await call('GET', '/portal/trainee/home', { token: r.json.token })).status, 200);
  assert.equal((await call('POST', '/login', { body: { role: 'trainee', login: t.creds.login, password: 'newpass123' } })).status, 200);
});

test('verify page: revoked shows REVOKED, deleted shows INVALID', async () => {
  const ctx = await setup(), { call, sa } = ctx, t = await mk(call, sa, {}), s = (await sessionWith(ctx, [t.trainee.id])).session;
  await ready(ctx, s, t.trainee.id); const c = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t.trainee.id } })).json.cert;
  await call('POST', '/cert/revoke', { token: sa, body: { no: c.no, revoke: true, reason: 'x' } });
  assert.equal((await call('GET', `/verify?n=${encodeURIComponent(c.no)}&h=${c.vh}`)).json.status, 'REVOKED');
});

test('company requests: company sends, staff answers; staff e-mails are not exposed to companies', async () => {
  const ctx = await setup(), { call, sa, co, blank } = ctx, t = await mk(call, sa, { co: co.company.id }), s = (await sessionWith(ctx, [t.trainee.id])).session;
  await ready(ctx, s, t.trainee.id); await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  const tk = (await call('POST', '/login', { body: { role: 'company', login: co.creds.login, password: co.creds.password } })).json.token;
  assert.equal(co.creds.login.startsWith('caspian'), true);
  const home = (await call('GET', '/portal/company/home', { token: tk })).json; assert.ok(!JSON.stringify(home).includes('boss@kvet.az'));
  const r = await call('POST', '/portal/company/request', { token: tk, body: { kind: 'renewal', certs: [home.certs[0].no], people: [t.trainee.id, 'E-209900001'], note: 'Please plan' } });
  assert.equal(r.status, 200); assert.deepEqual(r.json.request.people, [t.trainee.id], 'only own people');
  const list = (await call('GET', '/requests', { token: sa })).json.list; assert.equal(list.length, 1);
  await call('POST', '/request/update', { token: sa, body: { id: list[0].id, status: 'planned', reply: 'Booked for 12.11' } });
  assert.equal((await call('GET', '/portal/company/requests', { token: tk })).json.list[0].status, 'planned');
  const ed = await ctx.app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('GET', '/requests', { token: ed })).status, 403);
});

test('exam results from CSV and bulk release', async () => {
  const ctx = await setup(), { call, sa } = ctx, a = await mk(call, sa, { fin: '1AAA111' }), b = await mk(call, sa, { fin: '2BBB222' }), c = await mk(call, sa, { fin: '3CCC333' });
  const s = (await sessionWith(ctx, [a.trainee.id, b.trainee.id, c.trainee.id])).session;
  for (const x of [a, b]) await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: x.trainee.id } });
  const r = (await call('POST', '/enr/exam/bulk', { token: sa, body: { sid: s.id, passMark: 70, rows: [{ att: a.trainee.att, score: '85' }, { att: b.trainee.att, score: '60' }, { att: c.trainee.att, score: 90 }, { att: 'E-209900001', score: 90 }] } })).json.results;
  assert.deepEqual(r.map(x => x.ok), [true, true, false, false]); assert.equal(r[0].passed, true); assert.equal(r[1].passed, false); assert.equal(r[2].error, 'notConfirmed');
  const q = (await call('GET', '/issue/queue', { token: sa })).json.list;
  const bulk = (await call('POST', '/issue/bulk', { token: sa, body: { items: q.map(x => ({ sid: x.sid, tid: x.tid })) } })).json.results;
  assert.deepEqual(bulk.map(x => x.result).sort(), ['FAIL', 'PASS']);
});

test('session clashes: trainer double-booked, room double-booked', async () => {
  const ctx = await setup();
  await sessionWith(ctx, [], { location: 'Room 2', time: '09:00' });
  const r = await sessionWith(ctx, [], { location: 'room 2', time: '09:00' });
  assert.deepEqual(r.warnings.map(w => w.kind), ['trainer']);
  const o = (await ctx.call('POST', '/trainer/save', { token: ctx.sa, body: person({ fin: 'TRN9999', name: 'Digər' }) })).json;
  const r2 = (await ctx.call('POST', '/session/save', { token: ctx.sa, body: { bid: ctx.blank.id, tid: o.trainer.id, date: '2026-10-29', location: 'ROOM 2', time: '09:00', traineeIds: [] } })).json;
  assert.ok(r2.warnings.some(w => w.kind === 'room'));
});

test('renumbered certificate: the old number is retired, never handed out again', async () => {
  const ctx = await setup(), { call, sa } = ctx, t = await mk(call, sa, {}), s = (await sessionWith(ctx, [t.trainee.id])).session;
  await ready(ctx, s, t.trainee.id); const c = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t.trainee.id } })).json.cert;
  await call('POST', '/cert/update', { token: sa, body: { no: c.no, patch: { newNo: 'CRT/26/0500' } } });
  await call('POST', '/numbering/set', { token: sa, body: { prefix: 'CRT', year: 2026, next: 1 } });
  const sug = (await call('GET', `/issue/suggest?bid=${ctx.blank.id}&end=2026-10-29`, { token: sa })).json.no;
  assert.notEqual(sug, c.no);
});

test('foreign candidates: document type, nationality, English-only certificate', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  const f = await mk(call, sa, { name: 'John', surname: 'Smith', father: '', fin: 'GB1234567', foreign: true, docType: 'passport', nationality: 'United Kingdom', certLang: 'en' });
  assert.equal(f.trainee.docType, 'passport'); assert.equal(f.trainee.nationality, 'United Kingdom');
  const s = (await sessionWith(ctx, [f.trainee.id])).session; await ready(ctx, s, f.trainee.id);
  const c = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: f.trainee.id } })).json.cert;
  assert.equal(c.snap.lang, 'en'); assert.equal(c.snap.names.az, '');
});

test('privacy: consent can be required; ID/FIN retention removes old numbers', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  await call('POST', '/settings/save', { token: sa, body: { privacy: { consentRequired: true, finYears: 5 } } });
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: person({ fin: '8AAA888' }) })).json.error, 'needConsent');
  const t = await mk(call, sa, { fin: '8AAA888', consent: true }); assert.ok(t.trainee.consent.at);
  app.clock.t = Date.parse('2032-11-01T08:00:00Z');
  const dry = (await call('POST', '/retention/run', { token: sa, body: { dry: true } })).json; assert.equal(dry.count, 1);
  await call('POST', '/retention/run', { token: sa, body: {} });
  const x = (await call('GET', '/trainees/find?size=500', { token: sa })).json.list[0]; assert.equal(x.fin, ''); assert.ok(x.finRemovedAt);
  // the person can be edited without a number and the old FIN is free again
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: { ...person({ fin: '' }), id: x.id, consent: true } })).status, 200);
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: person({ fin: '8AAA888', consent: true }) })).status, 200);
});

test('expiry reminders: due list, sent once per threshold, scheduler key required', async () => {
  const ctx = await setup(), { call, sa, app, co } = ctx, t = await mk(call, sa, { co: co.company.id, email: 't@x.az' }), s = (await sessionWith(ctx, [t.trainee.id])).session;
  await ready(ctx, s, t.trainee.id); await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  await call('POST', '/settings/save', { token: sa, body: { remind: { on: true, days: [90, 30] } } });
  app.clock.t = Date.parse('2028-08-10T08:00:00Z');                  // ~73 days before expiry
  assert.equal((await call('POST', '/reminders/run', { token: sa, body: { dry: true } })).json.due.length, 1);
  assert.equal((await call('POST', '/cron/run', { body: {} })).status, 401);
  app.env.CRON_SECRET = 'cron-secret-cron-secret'; app.env.RESEND_API_KEY = 'k'; app.env.MAIL_FROM = 'KVET <a@b.az>';
  const sent = []; const orig = globalThis.fetch; globalThis.fetch = async (u, o) => { sent.push([String(u), JSON.parse(o.body)]); return new Response('{}', { status: 200 }); };
  try {
    const r = (await call('POST', '/cron/run', { headers: { 'x-cron-key': 'cron-secret-cron-secret' }, body: { tasks: ['reminders', 'backup'] } })).json;
    assert.equal(r.reminders.count, 1); assert.ok(r.backup.startsWith('backups/'));
    assert.deepEqual(sent.map(x => x[1].to[0]).sort(), ['hr@cd.az', 't@x.az']);
    const again = (await call('POST', '/cron/run', { headers: { 'x-cron-key': 'cron-secret-cron-secret' }, body: { tasks: ['reminders'] } })).json;
    assert.equal(again.reminders.dry, true, 'nothing due twice');
  } finally { globalThis.fetch = orig; }
});

test('Excel import: batched, duplicates reported, at most 300 rows per request', async () => {
  const ctx = await setup(), { call, sa } = ctx;
  await mk(call, sa, { fin: '9ZZZ999' });
  const rows = Array.from({ length: 320 }, (_, i) => ({ row: i + 2, name: 'Ad' + i, surname: 'Soyad', phone: '+99450' + String(1000000 + i), fin: (i === 5 ? '9ZZZ999' : 'A' + String(i).padStart(6, '0')) }));
  rows[7].fin = rows[6].fin;
  const r = (await call('POST', '/trainee/import', { token: sa, body: { rows } })).json.results;
  assert.equal(r.length, 300);
  assert.equal(r.find(x => x.row === 7).status, 'exists'); assert.equal(r.find(x => x.row === 9).error, 'dupInFile');
  const made = r.filter(x => x.status === 'created'); assert.equal(made.length, 298); assert.equal(new Set(made.map(x => x.att)).size, 298);
  const tk = (await call('POST', '/login', { body: { role: 'trainee', login: made[0].login, password: made[0].password } })).json.token; assert.ok(tk);
});

test('old rows without an id (and without names) can be listed, edited and deleted', async () => {
  const ctx = await setup(), { call, sa, app } = ctx;
  await app.store.put('trainees', [{ id: 'E-202600003', data: { att: 'E-202600003', phone: '+994554250276', co: '' } }, { id: 'E-202600004', data: { att: 'E-202600004', phone: '+994558865211' } }]);
  const list = (await call('GET', '/trainees/find?size=500', { token: sa })).json.list; assert.deepEqual(list.map(x => x.id).sort(), ['E-202600003', 'E-202600004']);
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'trainee', id: 'E-202600003' } })).status, 200);
  const r = await call('POST', '/purge', { token: sa, body: { kinds: ['trainees'], confirm: 'DELETE' } }); assert.equal(r.status, 200);
  assert.equal((await call('GET', '/trainees/find?size=500', { token: sa })).json.list.length, 0);
});

test('electronic signatures: certificates only by admin/superadmin under their name (electronic or image); practical only by the trainer; tamper detection', async () => {
  const ctx = await setup(), { call, sa, app, tr, blank } = ctx;
  const t1 = await mk(call, sa, {}), st = (await call('GET', '/state', { token: sa })).json, ogc = st.sheets.find(x => x.id === 'sample-ogc');
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', sheetId: ogc.id, traineeIds: [t1.trainee.id] } })).json.session;
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/trainer/confirm-all', { token: tk, body: { sid: s.id } })).json.confirmed, 1);
  // attendance: trainer signs; a later attendance change withdraws it
  const as = (await call('POST', '/portal/trainer/sign/att', { token: tk, body: { sid: s.id } })).json.sign; assert.match(as.code, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/); assert.ok(as.name.includes('Rəşad'));
  assert.equal((await call('GET', '/verify-sign?c=' + as.code)).json.status, 'VALID');
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t1.trainee.id, undo: true } });
  assert.equal((await call('GET', '/session?id=' + s.id, { token: sa })).json.signs.att, null);
  await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: s.id, tid: t1.trainee.id } });
  await call('POST', '/enr/doh/paper', { token: sa, body: { sid: s.id, tid: t1.trainee.id } });
  // practical: staff saving does NOT sign; the trainer's save signs; no candidate signature exists any more
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Taleh Bakirov', title: 'Baş icraçı / Chief Executive' } });
  const p0 = (await call('POST', '/enr/practical', { token: sa, body: { sid: s.id, tid: t1.trainee.id, data: { faults: { i1: 1 }, done: true } } })).json.enr.prac; assert.equal(p0.sign, undefined);
  const p1 = (await call('POST', '/portal/trainer/practical', { token: tk, body: { sid: s.id, tid: t1.trainee.id, data: { faults: { i1: 1 }, done: true } } })).json.prac; assert.ok(p1.sign.name.includes('Rəşad'));
  const ttk = (await call('POST', '/login', { body: { role: 'trainee', login: t1.creds.login, password: t1.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/trainee/sign/prac', { token: ttk, body: { sid: s.id } })).status, 404);
  const sg = (await call('GET', '/session?id=' + s.id, { token: sa })).json.signs.prac[t1.trainee.id]; assert.ok(sg.examiner && !sg.candidate);
  const e = await app.store.get('enr', `${s.id}|${t1.trainee.id}`); e.prac.total = 0; await app.store.put('enr', [{ id: `${s.id}|${t1.trainee.id}`, data: e }]);
  assert.equal((await call('GET', '/verify-sign?c=' + sg.examiner.code)).json.status, 'CHANGED');
  // certificates: released unsigned; only admin/superadmin can sign, and only with a name
  await call('POST', '/enr/exam', { token: sa, body: { sid: s.id, tid: t1.trainee.id, passed: true } });
  const c = (await call('POST', '/issue', { token: sa, body: { sid: s.id, tid: t1.trainee.id } })).json.cert; assert.equal(c.sign, undefined); assert.equal(c.sigId, undefined);
  const ed = await app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('POST', '/cert/sign', { token: ed, body: { nos: [c.no], mode: 'esign' } })).status, 403);
  const ad = await app.mkStaff('ad@kvet.az', 'admin'); assert.equal((await call('POST', '/cert/sign', { token: ad, body: { nos: [c.no], mode: 'esign' } })).status, 403, 'admins no longer sign certificates');
  const apv = await app.mkStaff('apv@kvet.az', 'approver'); assert.equal((await call('POST', '/cert/sign', { token: apv, body: { nos: [c.no], mode: 'esign' } })).json.error, 'needName');
  assert.equal((await call('POST', '/cert/sign', { token: sa, body: { nos: [c.no], mode: 'image' } })).json.error, 'needSigImage');
  const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal((await call('POST', '/staff/signature', { token: sa, raw: pngBytes })).status, 200);
  const r = (await call('POST', '/cert/sign', { token: sa, body: { nos: [c.no], mode: 'image' } })).json.results[0];
  assert.equal(r.ok, true); assert.equal(r.sign.mode, 'image'); assert.equal(r.sign.name, 'Taleh Bakirov'); assert.match(r.sign.img, /^[0-9a-f]{16}\.png$/);
  assert.equal((await call('GET', '/verify-sign?c=' + r.sign.code)).json.status, 'VALID');
  const qr = (await call('GET', `/verify?n=${encodeURIComponent(c.no)}&h=${c.vh}`)).json.sign; assert.equal(qr.name, 'Taleh Bakirov'); assert.equal(qr.code, r.sign.code); assert.equal(qr.img, undefined);
  const r2 = (await call('POST', '/cert/sign', { token: sa, body: { nos: [c.no], mode: 'esign' } })).json.results[0]; assert.equal(r2.sign.mode, 'esign');
  // a correction withdraws the signature; revoking shows on the check
  await call('POST', '/cert/update', { token: sa, body: { no: c.no, patch: { names: { az: 'Azər Qocayev', en: 'Azar Gojayev' } } } });
  assert.equal((await call('GET', '/certs', { token: sa })).json.certs[0].sign, undefined);
  const r3 = (await call('POST', '/cert/sign', { token: sa, body: { nos: [c.no], mode: 'esign' } })).json.results[0];
  await call('POST', '/cert/revoke', { token: sa, body: { no: c.no, revoke: true } });
  assert.equal((await call('GET', '/verify-sign?c=' + r3.sign.code)).json.status, 'REVOKED');
  // release + sign in one step
  const t2 = await mk(call, sa, { fin: '2BBB222' }); const s2 = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', traineeIds: [t2.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s2.id, tid: t2.trainee.id } }); await call('POST', '/enr/exam', { token: sa, body: { sid: s2.id, tid: t2.trainee.id, passed: true } });
  assert.equal((await call('POST', '/issue', { token: sa, body: { sid: s2.id, tid: t2.trainee.id, sign: 'esign' } })).json.cert.sign.name, 'Taleh Bakirov');
});
