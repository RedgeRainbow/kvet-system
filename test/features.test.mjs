import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import * as S from '../public/js/shared.js';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
async function setup() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });   // most tests skip the feedback step (tested separately)
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'BP Caspian', email: 'a@b.az' } })).json;
  const tr = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Təleh', surname: 'Bəkirov', fin: 'TRN1234' }) })).json;
  const st = (await call('GET', '/state', { token: sa })).json, blank = st.blanks[0];
  return { app, call, sa, co, tr, blank, st };
}
const mk = async (call, sa, o) => (await call('POST', '/trainee/save', { token: sa, body: person(o) })).json;
/* one trainee released with a certificate */
async function certified(ctx, o = {}) {
  const { call, sa, tr, blank, co } = ctx, t = await mk(call, sa, { co: co.company.id, ...o });
  const sess = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', traineeIds: [t.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: sess.id, tid: t.trainee.id } });
  await call('POST', '/enr/exam', { token: sa, body: { sid: sess.id, tid: t.trainee.id, passed: true, score: 90 } });
  const rel = (await call('POST', '/issue', { token: sa, body: { sid: sess.id, tid: t.trainee.id } })).json;
  assert.equal(rel.result, 'PASS');
  return { t, sess, cert: rel.cert };
}

test('deleting a certificate archives it; restore and permanent delete work; only superadmin', async () => {
  const ctx = await setup(), { call, sa, app } = ctx, { cert, sess, t } = await certified(ctx);
  const ad = await app.mkStaff('ad@kvet.az', 'admin');
  assert.equal((await call('POST', '/delete', { token: ad, body: { kind: 'cert', id: cert.no } })).status, 403);
  assert.equal((await call('GET', '/archive', { token: ad })).status, 403);
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'cert', id: cert.no } })).status, 200);
  assert.equal((await call('GET', '/certs', { token: sa })).json.certs.length, 0);
  const gone = await call('GET', `/verify?n=${encodeURIComponent(cert.no)}&h=${cert.vh}`); assert.equal(gone.json.status, 'INVALID'); assert.equal(gone.json.names, undefined);
  assert.equal((await call('GET', `/verify?n=${encodeURIComponent(cert.no)}&h=000000000000`)).status, 404);
  const arch = (await call('GET', '/archive', { token: sa })).json.list; assert.equal(arch.length, 1); assert.equal(arch[0].no, cert.no);
  // the trainee is back in the issue queue (result was withdrawn)
  assert.equal((await call('GET', '/session?id=' + sess.id, { token: sa })).json.enrs[0].final, undefined);
  assert.equal((await call('POST', '/archive/restore', { token: sa, body: { no: cert.no } })).status, 200);
  assert.equal((await call('GET', '/certs', { token: sa })).json.certs.length, 1);
  assert.equal((await call('GET', '/session?id=' + sess.id, { token: sa })).json.enrs[0].final.certNo, cert.no);
  await call('POST', '/delete', { token: sa, body: { kind: 'cert', id: cert.no } });
  assert.equal((await call('POST', '/archive/delete', { token: sa, body: { no: cert.no } })).json.removed, 1);
  assert.equal((await call('GET', '/archive', { token: sa })).json.list.length, 0);
  assert.equal(t.trainee.att.startsWith('E-'), true);
});

test('deleting a session / blank / company cascades without orphans and archives certificates', async () => {
  const ctx = await setup(), { call, sa, co, blank, app } = ctx, { sess } = await certified(ctx);
  const dry = (await call('POST', '/delete', { token: sa, body: { kind: 'blank', id: blank.id, dry: true } })).json.impact;
  assert.equal(dry.sessions, 1); assert.equal(dry.certs, 1); assert.equal(dry.enrolments, 1);
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'company', id: co.company.id } })).status, 200);
  assert.equal((await call('GET', '/trainees/find?size=500', { token: sa })).json.list[0].co, '');
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'blank', id: blank.id } })).status, 200);
  const d = app.store._dump();
  assert.equal(Object.keys(d.sessions || {}).length, 0); assert.equal(Object.keys(d.enr || {}).length, 0); assert.equal(Object.keys(d.certs || {}).length, 0);
  assert.equal(Object.keys(d.archive).length, 1);
  assert.ok(!Object.keys(d.logins || {}).some(k => k.startsWith('company:')), 'company login freed');
  assert.equal((await call('GET', '/session?id=' + sess.id, { token: sa })).status, 404);
});

test('enrolment delete (Issue queue row) removes the trainee from the session', async () => {
  const ctx = await setup(), { call, sa, tr, blank } = ctx, t = await mk(call, sa);
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', traineeIds: [t.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  assert.equal((await call('GET', '/issue/queue', { token: sa })).json.list.length, 1);
  assert.equal((await call('POST', '/delete', { token: sa, body: { kind: 'enrol', id: `${s.id}|${t.trainee.id}` } })).status, 200);
  assert.equal((await call('GET', '/issue/queue', { token: sa })).json.list.length, 0);
  assert.equal((await call('GET', '/trainees/find?size=500', { token: sa })).json.list.length, 1);
});

test('purge: dry run counts, needs DELETE, backs up first, can reuse the old FIN afterwards', async () => {
  const ctx = await setup(), { call, sa, app } = ctx; await certified(ctx); await mk(call, sa, { fin: '9XYZ999', name: 'Başqa' });
  const dry = (await call('POST', '/purge', { token: sa, body: { kinds: ['trainees', 'sessions'], dry: true } })).json;
  assert.equal(dry.impact.trainees, 2); assert.equal(dry.impact.sessions, 1); assert.equal(dry.impact.certs, 1);
  assert.equal((await call('POST', '/purge', { token: sa, body: { kinds: ['trainees'] } })).status, 400);
  const r = (await call('POST', '/purge', { token: sa, body: { kinds: ['trainees', 'sessions', 'certs', 'archive'], confirm: 'DELETE' } })).json;
  assert.ok(r.backup.includes('before-purge')); assert.ok(app.bucket._keys().includes(r.backup));
  assert.equal((await call('GET', '/trainees/find?size=500', { token: sa })).json.list.length, 0);
  assert.equal((await call('GET', '/archive', { token: sa })).json.list.length, 0);
  assert.equal((await call('POST', '/trainee/save', { token: sa, body: person() })).status, 200);
  // "before" keeps newer records
  const keep = (await call('POST', '/purge', { token: sa, body: { kinds: ['trainees'], before: '2020-01-01', dry: true } })).json; assert.equal(keep.impact.trainees, 0);
  const au = (await call('GET', '/audit?cat=delete', { token: sa })).json; assert.ok(au.list.some(x => x.action === 'purge'));
});

test('dashboard stats: trained / passed / pass rate / issued / expiring, configurable window', async () => {
  const ctx = await setup(), { call, sa, tr, blank } = ctx; const { t } = await certified(ctx);
  const t2 = await mk(call, sa, { fin: '2ABC234', name: 'Murad' });
  const s2 = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', traineeIds: [t2.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s2.id, tid: t2.trainee.id } });
  await call('POST', '/enr/exam', { token: sa, body: { sid: s2.id, tid: t2.trainee.id, passed: false } });
  await call('POST', '/issue', { token: sa, body: { sid: s2.id, tid: t2.trainee.id } });
  const st = (await call('GET', '/stats?period=month', { token: sa })).json;
  assert.equal(st.trained, 2); assert.equal(st.passed, 1); assert.equal(st.failed, 1); assert.equal(st.passRate, 50); assert.equal(st.issued, 1); assert.equal(st.expiring, 0);
  assert.equal(st.byCompany[0].trainees, 1); assert.equal(st.byCourse[0].trainees, 2); assert.equal(st.byCourse[0].sessions, 2);
  assert.equal((await call('GET', '/stats?period=lastMonth', { token: sa })).json.trained, 0);
  // certificate valid 24 months: window of 730 days reaches it, 90 does not
  await call('POST', '/settings/save', { token: sa, body: { dash: { expDays: 730, tiles: ['issued', 'bogus'], top: 5, period: 'year' } } });
  const s = (await call('GET', '/state', { token: sa })).json.settings.dash; assert.deepEqual(s.tiles, ['issued']); assert.equal(s.expDays, 730);
  assert.equal((await call('GET', '/stats', { token: sa })).json.expiring, 1);
  assert.equal(t.trainee.att.length > 0, true);
});

test('audit trail: logins, before/after changes, filters, secrets masked', async () => {
  const ctx = await setup(), { call, sa } = ctx, t = (await mk(call, sa)).trainee;
  await call('POST', '/staff/login', { body: { email: 'boss@kvet.az', password: 'nope' } });
  await call('POST', '/trainee/save', { token: sa, body: person({ id: t.id, phone: '+994509998877', fin: '2ZZZ999' }) });
  const all = (await call('GET', '/audit?limit=100', { token: sa })).json;
  const up = all.list.find(x => x.action === 'trainee.update'); assert.ok(up.entity.id === t.id);
  assert.ok(up.changes.some(c => c.f === 'phone' && c.to === '+994509998877'));
  assert.ok(!JSON.stringify(all).includes('2ZZZ999') && !JSON.stringify(all).includes('1ABC234'), 'FIN never written to the audit trail');
  assert.ok(all.list.some(x => x.action === 'login.fail')); assert.ok(all.list.some(x => x.action === 'login.ok'));
  assert.equal((await call('GET', '/audit?cat=auth', { token: sa })).json.list.every(x => x.action.startsWith('login')), true);
  assert.equal((await call('GET', '/audit?from=2099-01-01', { token: sa })).json.total, 0);
  assert.equal((await call('GET', '/audit?q=phone', { token: sa })).json.total >= 1, true);
  const ed = await ctx.app.mkStaff('ed@kvet.az', 'editor'); assert.equal((await call('GET', '/audit', { token: ed })).status, 403);
});

test('portal logins: an account missing from the login registry is not found by a table scan; System -> repair re-registers it', async () => {
  const { app, call, sa } = await setup(), { pbk } = await import('../functions/_lib/auth.js');
  const salt = 'ab'.repeat(8); await app.store.put('companies', [{ id: 'old1', data: { id: 'old1', name: 'Old Co', login: 'OldCo', salt, hash: await pbk('secret123', salt), on: true } }]);
  assert.equal((await call('POST', '/login', { body: { role: 'company', login: 'oldco', password: 'secret123' } })).status, 401);
  assert.equal((await call('POST', '/system/logins/repair', { token: sa, body: {} })).status, 200);
  assert.equal((await call('POST', '/login', { body: { role: 'company', login: 'oldco', password: 'wrong' } })).status, 401);
  const ok = await call('POST', '/login', { body: { role: 'company', login: 'oldco', password: 'secret123' } }); assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/portal/company/home', { token: ok.json.token })).status, 200);
  assert.ok((await call('GET', '/audit?q=wrong%20password', { token: sa })).json.total >= 1);
  assert.ok((await call('GET', '/audit?q=unknown%20login', { token: sa })).json.total >= 1);
});

test('practical sheets: faults x penalty = award, range items, time block, header auto-fields', async () => {
  const sheet = { mode: 'penalty', rule: { maxPenalty: 40 }, timePenalty: true, timeRate: 2,
    headerFields: [{ id: 'a', label: 'Set', type: 'number' }, { id: 'b', label: 'Start', type: 'time' }, { id: 'c', label: 'Finish', type: 'time' }, { id: 'd', label: 'Dur', type: 'duration' }, { id: 'e', label: 'Excess', type: 'excess' }],
    sections: [{ id: 's', title: 'x', items: [{ id: 'i1', text: 'Rough', penalty: '3-5' }, { id: 'i2', text: 'Shock', penalty: '5' }] }] };
  let c = S.validateSheetData(sheet, { faults: { i1: 2, i2: 1 }, pts: { i1: 4 }, header: { a: '10', b: '09:00', c: '09:14' } });
  assert.deepEqual(c.answers, { i1: 8, i2: 5 }); assert.equal(c.header.d, '0:14'); assert.equal(c.header.e, '0:04'); assert.equal(c.timePenalty, 8);   // 4 min x 2
  const r = S.evaluateSheet(sheet, { ...c, timePenalty: 30 }); assert.equal(r.total, 43); assert.equal(r.result, 'FAIL'); assert.equal(r.reason, 'penalty');
  assert.throws(() => S.validateSheetData(sheet, { faults: { i1: 1 }, pts: { i1: 9 } }), /badInput/);            // outside the 3-5 range
  assert.throws(() => S.validateSheetData(sheet, { faults: { zz: 1 } }), /badInput/);
  assert.deepEqual(S.validateSheetData(sheet, { answers: { i2: 5 } }).faults, { i2: 1 });                          // old shape still accepted
  assert.equal(S.timeCalc({ headerFields: sheet.headerFields }, { a: '10', b: '23:50', c: '00:05' }).duration, 15);  // past midnight
});

test('practical via API: seeded crane sheet keeps faults, examiner reg number and header values', async () => {
  const ctx = await setup(), { call, sa, tr, blank, st } = ctx, t = await mk(call, sa), sh = st.sheets.find(x => x.id === 'sample-ogc');
  assert.ok(sh.headerFields.some(h => h.type === 'excess') && sh.headerFields.some(h => h.auto === 'candidate'));
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', sheetId: sh.id, traineeIds: [t.trainee.id] } })).json.session;
  await call('POST', '/enr/confirm', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  await call('POST', '/enr/doh/paper', { token: sa, body: { sid: s.id, tid: t.trainee.id } });
  const hid = lbl => sh.headerFields.find(h => h.label.includes(lbl)).id;
  const r = (await call('POST', '/enr/practical', { token: sa, body: { sid: s.id, tid: t.trainee.id, data: { faults: { i1: 2, i11: 1 }, pts: { i11: 4 }, header: { [hid('Set')]: '10', [hid('Start')]: '10:00', [hid('Finish')]: '10:12' }, examiner: 'Ex', examinerReg: 'REG-7' } } })).json.enr.prac;
  assert.equal(r.faults.i1, 2); assert.equal(r.examinerReg, 'REG-7'); assert.equal(r.header[hid('Excess')], '0:02');
  assert.equal(r.total, 10 + 4 + 2);   // 2x5 + 1x4 + time penalty 2 min x rate 1
  assert.equal(r.result, 'INCOMPLETE', 'not final until the examiner marks the test completed');
  const r2 = (await call('POST', '/enr/practical', { token: sa, body: { sid: s.id, tid: t.trainee.id, data: { ...r, done: true } } })).json.enr.prac;
  assert.equal(r2.result, 'PASS'); assert.equal(r2.done, true);
  assert.equal(sh.sections.find(x => x.col2).title, 'Lifting/Lowering/Transporting Continued');
});

test('trainer can list candidates, register a new one into own session, add/remove; FIN never returned', async () => {
  const ctx = await setup(), { call, sa, tr, blank } = ctx, t = await mk(call, sa, { fin: '5AAA555' });
  const s = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2026-10-29', traineeIds: [] } })).json.session;
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: tr.creds.login, password: tr.creds.password } })).json.token;
  // only people from the trainer's own sessions are listed; anyone else is found by exact learner number
  const c = (await call('GET', '/portal/trainer/candidates', { token: tk })).json; assert.equal(c.list.length, 0);
  const lk = (await call('GET', '/portal/trainer/lookup?att=' + t.trainee.att, { token: tk })).json; assert.equal(lk.person.id, t.trainee.id); assert.ok(!JSON.stringify(lk).includes('5AAA555'));
  assert.equal((await call('GET', '/portal/trainer/lookup?att=E-2026', { token: tk })).status, 400);
  assert.equal((await call('POST', '/portal/trainer/session/trainees', { token: tk, body: { sid: s.id, add: [t.trainee.id] } })).json.count, 1);
  const n = await call('POST', '/portal/trainer/trainee/save', { token: tk, body: person({ fin: '6BBB666', name: 'Yeni', surname: 'Namizəd', sid: s.id }) });
  assert.equal(n.status, 200); assert.ok(n.json.creds.password); assert.ok(!JSON.stringify(n.json).includes('6BBB666'));
  assert.equal((await call('GET', '/portal/trainer/session?id=' + s.id, { token: tk })).json.trainees.length, 2);
  const dup = await call('POST', '/portal/trainer/trainee/save', { token: tk, body: person({ fin: '6BBB666' }) }); assert.equal(dup.status, 409); assert.equal(dup.json.error, 'dupFin');
  assert.equal(dup.json.existing, undefined, 'a trainer must not learn who holds an ID/FIN');
  assert.ok(!JSON.stringify(dup.json).includes('Namizəd'));
  const dupStaff = await call('POST', '/trainee/save', { token: sa, body: person({ fin: '6BBB666' }) }); assert.equal(dupStaff.json.existing.name.includes('Namizəd'), true, 'admins still see the existing person');
  assert.equal((await call('GET', '/portal/trainer/candidates', { token: tk })).json.list.length, 2);
  assert.equal((await call('POST', '/portal/trainer/session/trainees', { token: tk, body: { sid: s.id, remove: [t.trainee.id] } })).json.count, 1);
  // not someone else's session
  const o = (await call('POST', '/trainer/save', { token: sa, body: person({ fin: 'TRN7777', name: 'Digər' }) })).json;
  const tk2 = (await call('POST', '/login', { body: { role: 'trainer', login: o.creds.login, password: o.creds.password } })).json.token;
  assert.equal((await call('POST', '/portal/trainer/session/trainees', { token: tk2, body: { sid: s.id, add: [t.trainee.id] } })).status, 404);
  // results lock removal (attendance alone does not)
  await call('POST', '/portal/trainer/confirm', { token: tk, body: { sid: s.id, tid: n.json.trainee.id } });
  await call('POST', '/portal/trainer/evaluate', { token: tk, body: { sid: s.id, tid: n.json.trainee.id, behavior: 'good', punctuality: 'ontime', engagement: 4 } });
  assert.equal((await call('POST', '/portal/trainer/session/trainees', { token: tk, body: { sid: s.id, remove: [n.json.trainee.id] } })).json.error, 'hasData');
});

test('filters round-trip through the hash format', () => {
  const f = S.buildFilter({ issued: '2026-10-01..2026-10-31', bid: 'b1', x: '' }); assert.deepEqual(S.parseFilter(f), { issued: '2026-10-01..2026-10-31', bid: 'b1' });
  assert.deepEqual(S.periodRange('2026-02', '2026-10-31'), ['2026-02-01', '2026-02-28']);
});
