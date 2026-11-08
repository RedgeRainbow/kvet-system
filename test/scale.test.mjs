/* Round 17: years of data. Lists are filtered, counted and paged by the database; the office start-up carries no people
   records and only recent sessions; derived fields (search key, renewal) stay correct as records change. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import { memoryStore, memQuery } from '../functions/_lib/store.js';
import { cached } from '../functions/_lib/cache.js';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
async function setup() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Taleh Bakirov', title: 'Superadmin' } });
  const tr = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Rəşad', surname: 'Əliyev', fin: 'TRN1234' }) })).json;
  const st = (await call('GET', '/state', { token: sa })).json;
  return { app, call, sa, tr, blank: st.blanks[0], today: st.today };
}

test('query layer: filters, null-safe operators, nested fields, array contains, search, order, paging, counts', async () => {
  const rows = [
    { id: 'a', data: { d: '2025-01-02', on: false, co: 'x', tags: ['p', 'q'], ap: { st: 'pending' }, sk: 'eli memmedov' } },
    { id: 'b', data: { d: '2026-01-01', co: '', tags: ['q'], ap: { st: 'approved' }, sk: 'rauf aliyev' } },
    { id: 'c', data: { d: '2024-06-01' } }];
  const ids = spec => memQuery(rows, spec).rows.map(r => r.id).join(',');
  assert.equal(ids({ where: [['d', 'gte', '2025-01-01']] }), 'a,b');
  assert.equal(ids({ where: [['on', 'nn', 'false']] }), 'b,c', 'missing counts as "not false"');
  assert.equal(ids({ where: [['co', 'empty', true]] }), 'b,c'); assert.equal(ids({ where: [['co', 'empty', false]] }), 'a');
  assert.equal(ids({ where: [['ap.st', 'eq', 'pending']] }), 'a'); assert.equal(ids({ where: [['ap.st', 'nn', 'pending']] }), 'b,c');
  assert.equal(ids({ where: [['tags', 'has', 'p']] }), 'a'); assert.equal(ids({ where: [['id', 'in', ['c', 'a']]] }), 'a,c');
  assert.equal(ids({ search: 'MƏMMƏD əli' }), 'a', 'search folds case and Azerbaijani letters');
  assert.equal(ids({ order: ['d', 'desc'] }), 'b,a,c');
  const p = memQuery(rows, { order: ['d', 'asc'], limit: 1, offset: 1, count: true }); assert.equal(p.total, 3); assert.equal(p.rows[0].id, 'a');
  assert.deepEqual(memQuery(rows, { where: [['id', 'eq', 'a']], fields: ['d', 'co'] }).rows[0].data, { d: '2025-01-02', co: 'x' });
});

test('request cache: bulk writes into a loaded collection stay O(1) and visible to later reads', async () => {
  const raw = memoryStore(); await raw.put('t', Array.from({ length: 20000 }, (_, i) => ({ id: 'r' + i, data: { i } })));
  const D = cached(raw); await D.all('t');
  const t0 = performance.now(); await D.put('t', Array.from({ length: 20000 }, (_, i) => ({ id: 'r' + i, data: { i, x: 1 } }))); await D.all('t');
  assert.ok(performance.now() - t0 < 3000, 'bulk update of a loaded collection is fast');
  assert.equal((await D.get('t', 'r19999')).x, 1); await D.del('t', 'r5'); assert.equal((await D.all('t')).length, 19999); assert.equal(await D.get('t', 'r5'), null);
});

test('office start-up carries no people records and only recent sessions; older ones on request', async () => {
  const { call, sa, tr, blank, today } = await setup();
  const t1 = (await call('POST', '/trainee/save', { token: sa, body: person() })).json.trainee;
  const old = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: '2024-03-01', traineeIds: [t1.id] } })).json.session;
  const now = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: tr.trainer.id, date: today, traineeIds: [t1.id] } })).json.session;
  const st = (await call('GET', '/state', { token: sa })).json;
  assert.deepEqual(st.trainees, []); assert.equal(st.counts.trainees, 1); assert.equal(st.counts.sessions, 2);
  assert.ok(st.sessions.some(s => s.id === now.id)); assert.ok(!st.sessions.some(s => s.id === old.id), 'a 2024 session is outside the start-up window');
  const f = (await call('GET', '/sessions/find?from=2024-01-01&to=2024-12-31', { token: sa })).json;
  assert.deepEqual(f.sessions.map(s => s.id), [old.id]); assert.equal(f.sessions[0].stats.total, 1);
  // the session page brings its participants; the person's history covers every year
  assert.equal((await call('GET', '/session?id=' + old.id, { token: sa })).json.people[0].id, t1.id);
  assert.equal((await call('GET', '/trainee/history?id=' + t1.id, { token: sa })).json.sessions.length, 2);
  assert.equal((await call('GET', '/usage', { token: sa })).json.blanks[blank.id], 2, 'library usage counts every year');
  // trainer portal: the last 12 months, the rest on request
  const lg = (await call('POST', '/credentials/reset', { token: sa, body: { kind: 'trainer', ids: [tr.trainer.id] } })).json.list[0];
  const tk = (await call('POST', '/login', { body: { role: 'trainer', login: lg.login, password: lg.password } })).json.token;
  const h = (await call('GET', '/portal/trainer/home', { token: tk })).json; assert.equal(h.sessions.length, 1); assert.equal(h.older, 1);
  assert.equal((await call('GET', '/portal/trainer/home?all=1', { token: tk })).json.sessions.length, 2);
});

test('trainee search: names fold, paging and counts, ID/FIN only for those allowed, company and status filters', async () => {
  const { app, call, sa } = await setup();
  const co = (await call('POST', '/company/save', { token: sa, body: { name: 'Caspian Drilling' } })).json.company;
  for (let i = 0; i < 12; i++) await call('POST', '/trainee/save', { token: sa, body: person({ name: 'Məmməd' + i, fin: 'F' + String(100000 + i), phone: '+99450' + (1000000 + i), co: i % 2 ? co.id : '' }) });
  const f = q => call('GET', '/trainees/find?' + q, { token: sa }).then(r => r.json);
  assert.equal((await f('q=memmed1')).total, 3, 'Məmməd1, Məmməd10, Məmməd11');
  const p0 = await f('size=5'), p1 = await f('size=5&page=1'); assert.equal(p0.total, 12); assert.equal(p0.list.length, 5); assert.ok(!p1.list.some(x => p0.list.some(y => y.id === x.id)));
  assert.equal((await f('co=' + co.id)).total, 6); assert.equal((await f('co=-')).total, 6);
  assert.equal((await f('q=F100003')).list[0].name, 'Məmməd3', 'exact ID/FIN for staff who may see it');
  const ed = await app.mkStaff('ed@kvet.az', 'editor');
  assert.equal((await call('GET', '/trainees/find?q=F100003', { token: ed })).json.list.length, 0, 'not for those who may not');
  assert.ok(!JSON.stringify(await f('size=50')).includes('"sk"'), 'the search key is never sent');
  const x = (await f('q=memmed5')).list[0]; await call('POST', '/trainee/save', { token: sa, body: { ...x, ...person({ name: 'Məmməd5', fin: 'F100005', phone: '+994501000005' }), id: x.id, on: false } });
  assert.equal((await f('on=off')).total, 1); assert.equal((await f('on=on')).total, 11);
  assert.equal((await f('q=memmed5')).list[0].on, false, 'the search key follows edits');
});

test('certificate lists: status filters, counts, renewal upkeep (incl. revoke / restore), search, numbers, export cap', async () => {
  const { call, sa, blank, today } = await setup();
  const t1 = (await call('POST', '/trainee/save', { token: sa, body: person() })).json.trainee;
  const issue = body => call('POST', '/cert/issue-direct', { token: sa, body: { tid: t1.id, bid: blank.id, ...body } }).then(r => r.json.cert);
  const a = await issue({ start: '2023-01-10', end: '2023-01-10', expiry: '2025-01-10' });
  const b = await issue({ start: today, end: today });
  const C = q => call('GET', '/certs?' + q, { token: sa }).then(r => r.json);
  assert.equal((await C('st=RENEWED')).certs[0].no, a.no, 'the older one is RENEWED');
  assert.deepEqual((await C('')).counts, { ACTIVE: 1, SOON: 0, EXPIRED: 0, total: 1 });
  // revoking the newer certificate makes the older one current again (expired); restoring reverses it
  await call('POST', '/cert/revoke', { token: sa, body: { no: b.no, revoke: true, reason: 'test' } });
  assert.equal((await C('st=EXPIRED')).certs[0].no, a.no); assert.equal((await C('st=REVOKED')).certs[0].no, b.no);
  await call('POST', '/cert/revoke', { token: sa, body: { no: b.no, revoke: false } });
  assert.equal((await C('st=RENEWED')).total, 1); assert.equal((await C('st=ACTIVE')).total, 1);
  assert.equal((await C('q=qocayev')).total, 2, 'search by holder name'); assert.equal((await C('q=' + encodeURIComponent(b.no))).certs[0].no, b.no);
  assert.equal((await C('nos=' + encodeURIComponent(a.no + ',' + b.no) + '&counts=0')).certs.length, 2);
  assert.equal((await C('exp=3650&sort=expiry')).certs[0].no, b.no, 'expiring within N days, soonest first');
  assert.ok(!JSON.stringify(await C('')).includes('"sk"'));
  // deleting the newer certificate (archive) makes the older one current again
  await call('POST', '/delete', { token: sa, body: { kind: 'cert', id: b.no } });
  assert.equal((await C('st=EXPIRED')).certs[0].no, a.no);
});

test('records saved before this version get their search key and renewal flags on the first start-up', async () => {
  const app = makeApp(), { call, store } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} }); await call('GET', '/state', { token: sa });
  // simulate data written by an older version (no sk / exp / renewed)
  await store.put('trainees', [{ id: 'E-202000001', data: { id: 'E-202000001', att: 'E-202000001', name: 'Köhnə', surname: 'Qeyd' } }]);
  await store.put('certs', [{ id: 'OLD/1', data: { no: 'OLD/1', tid: 'E-202000001', bid: 'b1', start: '2020-01-01', issuedAt: '2020-01-01', expiry: '2022-01-01', snap: { names: { az: 'Köhnə Qeyd' } } } },
    { id: 'OLD/2', data: { no: 'OLD/2', tid: 'E-202000001', bid: 'b1', start: '2022-01-01', issuedAt: '2022-01-01', expiry: '2030-01-01', snap: { names: { az: 'Köhnə Qeyd' } } } }]);
  const s = await store.get('settings', 'main'); delete s.skV; await store.put('settings', [{ id: 'main', data: s }]);
  await call('GET', '/state', { token: sa });
  assert.equal((await call('GET', '/trainees/find?q=kohne', { token: sa })).json.total, 1);
  assert.equal((await call('GET', '/certs?st=RENEWED', { token: sa })).json.certs[0].no, 'OLD/1');
});
