/* Security audit tests (round 19): every route is checked against every kind of account.
   - authentication: no token -> refused; a token of another portal -> refused;
   - authorisation: staff routes refuse the roles whose rank / role list does not allow the action;
   - robustness: empty or malformed input never makes the server fail (no 5xx);
   - data isolation: a candidate, trainer or company cannot read or change another one's records by passing its ids;
   - no secrets in responses (password hashes, salts, search keys). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from './helpers.mjs';
import { TABLE } from '../functions/_lib/index.js';
import * as S from '../public/js/shared.js';

const person = (o = {}) => ({ name: 'Azər', surname: 'Qocayev', father: 'Məmməd oğlu', fin: '1ABC234', phone: '+994501234567', ...o });
async function world() {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  await call('POST', '/seed', { token: sa, body: {} });
  await call('POST', '/settings/save', { token: sa, body: { fbRequired: false } });
  await call('POST', '/staff/profile', { token: sa, body: { name: 'Taleh Bakirov', title: 'Superadmin' } });
  const st = (await call('GET', '/state', { token: sa })).json, blank = st.blanks[0], today = st.today;
  const login = async (role, cr) => (await call('POST', '/login', { body: { role, login: cr.login, password: cr.password } })).json.token;
  const coA = (await call('POST', '/company/save', { token: sa, body: { name: 'Alpha LLC' } })).json, coB = (await call('POST', '/company/save', { token: sa, body: { name: 'Beta LLC' } })).json;
  const t1 = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Rəşad', fin: 'TRN1111', phone: '+994551111111' }) })).json, t2 = (await call('POST', '/trainer/save', { token: sa, body: person({ name: 'Elçin', fin: 'TRN2222', phone: '+994552222222' }) })).json;
  const a = (await call('POST', '/trainee/save', { token: sa, body: person({ co: coA.company.id }) })).json, b = (await call('POST', '/trainee/save', { token: sa, body: person({ name: 'Bəhruz', fin: '2BBB222', phone: '+994502222222', co: coB.company.id }) })).json;
  const s1 = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: t1.trainer.id, date: today, traineeIds: [a.trainee.id] } })).json.session;
  const s2 = (await call('POST', '/session/save', { token: sa, body: { bid: blank.id, tid: t2.trainer.id, date: today, traineeIds: [b.trainee.id] } })).json.session;
  const certA = (await call('POST', '/cert/issue-direct', { token: sa, body: { tid: a.trainee.id, bid: blank.id, start: today, end: today } })).json.cert;
  await call('POST', '/cert/sign', { token: sa, body: { nos: [certA.no], mode: 'esign' } });
  const tok = {
    none: '', sa, trainee: await login('trainee', a.creds), traineeB: await login('trainee', b.creds), trainer: await login('trainer', t1.creds), trainerB: await login('trainer', t2.creds),
    company: await login('company', coA.creds), companyB: await login('company', coB.creds),
  };
  for (const r of ['admin', 'editor', 'approver', 'auditor']) tok[r] = await app.mkStaff(r + '@kvet.az', r);
  return { app, call, tok, ids: { a: a.trainee.id, b: b.trainee.id, s1: s1.id, s2: s2.id, certA: certA.no, t1: t1.trainer.id, coA: coA.company.id }, today, blank };
}
const ROLES = ['superadmin', 'admin', 'editor', 'approver', 'auditor'];
const PORTALS = ['trainee', 'trainer', 'company'];
// routes that end the session or start long jobs: not called in the sweep
const SKIP = new Set(['POST /logout', 'POST /staff/logout']);
const routes = () => Object.entries(TABLE).filter(([k]) => !k.includes(':') && !SKIP.has(k)).map(([k, r]) => { const [method, path] = k.split(' '); return { k, method, path, ...r }; });

test('every route: no token and other portals are refused; staff actions follow the role table; nothing answers with 5xx', async () => {
  const { call, tok } = await world(), problems = [];
  const hit = (r, t) => call(r.method, r.path, { token: t, ...(r.method === 'POST' ? (r.raw ? { raw: new Uint8Array([1, 2, 3]) } : { body: {} }) : {}) });
  for (const r of routes()) {
    if (!['staff', ...PORTALS].includes(r.auth)) { const x = await hit(r, ''); if (x.status >= 500) problems.push(`${r.k} public -> ${x.status}`); continue; }
    const none = await hit(r, ''); if (none.status !== 401 && none.status !== 403) problems.push(`${r.k} without token -> ${none.status}`);
    for (const p of PORTALS) if (r.auth !== p) { const x = await hit(r, tok[p]); if (x.status < 400 || x.status >= 500) problems.push(`${r.k} with ${p} token -> ${x.status}`); }
    if (r.auth === 'staff') {
      for (const role of ROLES) {
        const x = await hit(r, role === 'superadmin' ? tok.sa : tok[role]), allowed = !r.act || S.can(role, r.act);
        if (!allowed && x.status < 400) problems.push(`${r.k} (${r.act}) allowed for ${role}`);
        if (x.status >= 500 && x.json?.error !== 'aiNotConfigured') problems.push(`${r.k} as ${role} -> ${x.status} ${JSON.stringify(x.json)}`);
      }
    } else {
      const x = await hit(r, tok[r.auth]); if (x.status >= 500) problems.push(`${r.k} as ${r.auth} with empty input -> ${x.status} ${JSON.stringify(x.json)}`);
      if (r.auth !== 'staff') { const y = await hit(r, tok.sa); if (y.status < 400) problems.push(`${r.k} answers a staff token`); }
    }
  }
  assert.deepEqual(problems, []);
});

test('data isolation: candidates, trainers and companies cannot reach each other\'s records', async () => {
  const { call, tok, ids } = await world(), leak = [];
  const deny = async (label, method, path, t, body) => { const x = await call(method, path, { token: t, body }); if (x.status < 400) leak.push(`${label}: ${x.status} ${JSON.stringify(x.json).slice(0, 120)}`); };
  // candidate B with candidate A's session / person
  await deny('trainee test of another session', 'GET', '/portal/trainee/test?sid=' + ids.s1, tok.traineeB);
  for (const [p, body] of [['/portal/trainee/feedback', { sid: ids.s1, r: { g1: 9 }, cm: {} }], ['/portal/trainee/doh', { sid: ids.s1, a: {} }], ['/portal/trainee/tbt', { sid: ids.s1 }], ['/portal/trainee/test/save', { sid: ids.s1, ans: {} }], ['/portal/trainee/test/submit', { sid: ids.s1, ans: {} }], ['/portal/trainee/test/warn', { sid: ids.s1 }]])
    await deny('trainee ' + p, 'POST', p, tok.traineeB, body);
  const hb = JSON.stringify((await call('GET', '/portal/trainee/home', { token: tok.traineeB })).json); if (hb.includes(ids.a) || hb.includes(ids.certA)) leak.push('trainee home shows another person');
  // trainer B with trainer A's session
  await deny('trainer session', 'GET', '/portal/trainer/session?id=' + ids.s1, tok.trainerB);
  for (const [p, body] of [['/portal/trainer/confirm', { sid: ids.s1, tid: ids.a }], ['/portal/trainer/confirm-all', { sid: ids.s1 }], ['/portal/trainer/attendance', { sid: ids.s1, absent: [] }], ['/portal/trainer/evaluate', { sid: ids.s1, tid: ids.a, behavior: 'good', punctuality: 'ontime', engagement: 3 }],
    ['/portal/trainer/exam', { sid: ids.s1, open: true }], ['/portal/trainer/practical', { sid: ids.s1, tid: ids.a, marks: {} }], ['/portal/trainer/sign/att', { sid: ids.s1 }], ['/portal/trainer/sign/doc', { sid: ids.s1, doc: 'ev' }], ['/portal/trainer/tbt', { sid: ids.s1, topic: 'x' }],
    ['/portal/trainer/docs', { sid: ids.s1, open: true }], ['/portal/trainer/doh/paper', { sid: ids.s1, tid: ids.a }], ['/portal/trainer/session/trainees', { sid: ids.s1, add: [ids.b] }], ['/portal/trainer/trainee/save', { sid: ids.s1, id: ids.a, name: 'X' }], ['/portal/trainer/test/reset', { sid: ids.s1, tid: ids.a }], ['/portal/trainer/test/grade', { sid: ids.s1, tid: ids.a, marks: {} }]])
    await deny('trainer ' + p, 'POST', p, tok.trainerB, body);
  await deny('trainer lookup of a candidate not in their sessions', 'GET', '/portal/trainer/lookup?q=' + encodeURIComponent('1ABC234'), tok.trainerB);
  // company B with company A's people and certificates
  await deny('company person', 'GET', '/portal/company/person?id=' + ids.a, tok.companyB);
  await deny('company cert', 'GET', '/portal/company/cert?no=' + encodeURIComponent(ids.certA), tok.companyB);
  const hc = JSON.stringify((await call('GET', '/portal/company/home', { token: tok.companyB })).json); if (hc.includes(ids.a) || hc.includes(ids.certA)) leak.push('company home shows another company\'s people');
  const rqx = (await call('POST', '/portal/company/request', { token: tok.companyB, body: { kind: 'renewal', people: [ids.a], certs: [ids.certA] } })).json;
  if (rqx.request && (rqx.request.people.length || rqx.request.certs.length)) leak.push('a request kept another company\'s people');
  const rq = (await call('GET', '/portal/company/requests', { token: tok.companyB })).json; if (JSON.stringify(rq).includes(ids.a)) leak.push('request stored another company\'s person');
  // staff-only data through portals: never password hashes, salts, search keys or ID/FIN of others
  for (const [p, t] of [['/portal/trainee/home', tok.trainee], ['/portal/trainer/home', tok.trainer], ['/portal/trainer/session?id=' + ids.s1, tok.trainer], ['/portal/company/home', tok.company], ['/portal/company/person?id=' + ids.a, tok.company]]) {
    const j = JSON.stringify((await call('GET', p, { token: t })).json); for (const k of ['"hash"', '"salt"', '"sk"', '"pv"', 'TOKEN_SECRET']) if (j.includes(k)) leak.push(`${p} contains ${k}`);
  }
  const st = JSON.stringify((await call('GET', '/state', { token: tok.sa })).json); for (const k of ['"hash"', '"salt"']) if (st.includes(k)) leak.push('/state contains ' + k);
  // the public verification page shows a certificate, not the person's ID/FIN or phone
  const v = JSON.stringify((await call('GET', '/verify?no=' + encodeURIComponent(ids.certA))).json || {}); if (v.includes('1ABC234') || v.includes('994501234567')) leak.push('public verify shows ID/FIN or phone');
  assert.deepEqual(leak, []);
});

test('tokens: forged, tampered and expired tokens are refused; an expired token is refused', async () => {
  const { app, call, tok, ids } = await world();
  const [b, s] = tok.trainee.split('.'), p = JSON.parse(atob(b));
  const forged = btoa(JSON.stringify({ ...p, id: ids.b })) + '.' + s; assert.equal((await call('GET', '/portal/trainee/home', { token: forged })).status, 401, 'changed payload, old signature');
  assert.equal((await call('GET', '/portal/trainee/home', { token: btoa(JSON.stringify({ ...p, kind: 'staff' })) + '.x' })).status, 401);
  assert.equal((await call('GET', '/state', { token: tok.trainee })).status, 401, 'a portal token is not a staff token');
  const { mkTok } = await import('../functions/_lib/auth.js');
  const old = await mkTok(app.env, { ...p }, -1000); assert.equal((await call('GET', '/portal/trainee/home', { token: old })).status, 401, 'expired');
});

test('disaster recovery: everything wiped, then restored from the backup file, record for record', async () => {
  const { app, call, tok, ids } = await world();
  // activity in many collections: trainer work, messages, a toolbox talk, groups, requests
  await call('POST', '/portal/trainer/confirm', { token: tok.trainer, body: { sid: ids.s1, tid: ids.a } });
  await call('POST', '/portal/trainee/message', { token: tok.trainee, body: { text: 'Salam' } });
  await call('POST', '/group/save', { token: tok.sa, body: { name: 'G', traineeIds: [ids.a] } });
  await call('POST', '/portal/company/request', { token: tok.company, body: { kind: 'training', bid: (await call('GET', '/state', { token: tok.sa })).json.blanks[0].id, note: 'x' } });
  const { DCOLS } = await import('../functions/_lib/routes_system.js');
  const cols = DCOLS.filter(c => c !== 'audit'), snap = async () => Object.fromEntries(await Promise.all(cols.map(async c => [c, (await app.store.all(c)).map(r => r).sort((a, b) => (a.id < b.id ? -1 : 1))])));
  const key = (await call('POST', '/backup', { token: tok.sa, body: {} })).json.key; assert.ok(key);
  const before = await snap();
  for (const c of cols) { const all = await app.store.all(c); if (all.length) await app.store.delMany(c, all.map(r => r.id)); }
  assert.equal((await app.store.all('trainees')).length, 0, 'gone');
  // sign in again (the account record was wiped too: the superadmin comes back with the data)
  const r = await call('POST', '/restore', { token: await app.staff('boss@kvet.az', 'bosspass123'), body: { key } }); assert.equal(r.status, 200, JSON.stringify(r.json));
  const after = await snap(), strip = x => JSON.parse(JSON.stringify(x, (k, v) => (k === 'sk' || k === 'exp' || k === 'cox' ? undefined : v)));
  for (const c of cols) assert.deepEqual(strip(after[c]), strip(before[c]), 'collection ' + c);
  assert.equal((await call('GET', '/portal/trainee/home', { token: tok.trainee })).status, 200, 'portal accounts work again');
});

test('an unexpected failure answers with a reference and is written to the error log', async () => {
  const { app, call, tok } = await world();
  const q = app.store.query; app.store.query = async (col, spec) => { if (col === 'certs') throw new Error('database timeout (simulated)'); return q.call(app.store, col, spec); };
  const r = await call('GET', '/certs?counts=0', { token: tok.sa }); app.store.query = q;
  assert.equal(r.status, 500); assert.equal(r.json.error, 'server'); assert.ok(r.json.ref);
  const l = (await call('GET', '/errors', { token: tok.sa })).json.list; assert.equal(l[0].ref, r.json.ref); assert.match(l[0].msg, /simulated/); assert.equal(l[0].path, '/certs');
  assert.equal((await call('GET', '/errors', { token: tok.editor })).status, 403);
});

test('sign-in limits: a classroom behind one address signs in freely; guessing from one address is stopped and cannot be reset', async () => {
  const { makeApp } = await import('./helpers.mjs');
  const app = makeApp(), c2 = app.call, sa = await app.staff('boss@kvet.az', 'bosspass123'); await c2('POST', '/seed', { token: sa, body: {} });
  const ppl = []; for (let i = 0; i < 60; i++) ppl.push((await c2('POST', '/trainee/save', { token: sa, body: person({ name: 'N' + i, fin: 'C' + String(100000 + i), phone: '+99450' + (5000000 + i) }) })).json);
  const hdr = { 'cf-connecting-ip': '203.0.113.50' }, L = (r, pw) => c2('POST', '/login', { headers: hdr, body: { role: 'trainee', login: r.trainee.login, password: pw } }).then(x => x.status);
  // 60 people, each with one typo before the right password: all get in
  for (const r of ppl) { assert.equal(await L(r, 'typo'), 401); assert.equal(await L(r, r.creds.password), 200, 'classroom sign-in'); }
  // 40 more wrong guesses from the same address (100 failures in all): the address is locked, also for a correct password
  for (let i = 0; i < 40; i++) await L(ppl[i % 60], 'guess' + i);
  assert.equal(await L(ppl[5], ppl[5].creds.password), 429, 'locked address');
  assert.equal(await c2('POST', '/login', { headers: { 'cf-connecting-ip': '203.0.113.51' }, body: { role: 'trainee', login: ppl[5].trainee.login, password: ppl[5].creds.password } }).then(x => x.status), 200, 'other addresses unaffected');
});
