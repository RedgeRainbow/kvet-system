// Restore drill on a LOCAL PostgreSQL (no Supabase needed): the real storage code, the real schema.sql, a real wipe.
//   1. fills a database with a realistic data set (people, sessions, results, certificates, signatures, audit trail)
//   2. takes a backup through the API, reads it back, downloads the encrypted copy
//   3. scenario A: every record is deleted in the database (SQL), then POST /restore -> compared collection by collection
//   4. scenario B: the whole schema is dropped and created again from schema.sql (a brand-new database), the first admin is
//      bootstrapped, the copy is uploaded and restored -> compared again, the audit trail included
// Usage:  node tools/restore-drill-local.mjs --psql "psql -h /tmp/pg -p 5432 -U postgres -d kvet_drill" [--people 120]
// The database named there is WIPED. The REST layer between the app and PostgreSQL is tools/pg-rest-shim.mjs, a stand-in
// for Supabase's: for the conclusive test run tools/restore-drill.mjs against a staging Supabase project.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../functions/_lib/index.js';
import { supabaseStore, memoryStore, memoryBucket } from '../functions/_lib/store.js';
import { memoryAuth } from '../functions/_lib/auth.js';
import { RESTORE_COLS } from '../functions/_lib/routes_system.js';
import { startShim } from './pg-rest-shim.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const psql = String(arg('psql', '')).split(/\s+/).filter(Boolean), N = Number(arg('people', 120));
if (!psql.length) { console.error('give --psql "psql … -d <a database that may be wiped>"'); process.exit(2); }
const schema = readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');
const step = (s, ...a) => console.log(`\n== ${s}`, ...a), ok = (c, m) => { if (!c) { console.error('   FAILED: ' + m); process.exit(1); } console.log('   ok  ' + m); };

const shim = await startShim({ psql, port: Number(arg('port', 54330)) });
const freshDb = async () => { await shim.run(`do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$; drop schema public cascade; create schema public;`); await shim.run(schema); };
const env = { TOKEN_SECRET: 'drill-secret-drill-secret-01', BOOTSTRAP_ADMIN_EMAIL: 'boss@kvet.az', SUPABASE_URL: shim.url, SUPABASE_SERVICE_KEY: 'local' };
const auth = memoryAuth(), bucket = memoryBucket(); auth.addUser('boss@kvet.az', 'bosspass123');
let clock = Date.parse('2026-10-29T08:00:00Z');
const mkCall = handle => async (method, path, { token, body, raw, headers } = {}) => {
  const init = { method, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(headers || {}) } }; if (raw) init.body = raw; else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
  const res = await handle(new Request('https://t.test/api' + path, init), env); const ct = res.headers.get('content-type') || ''; return { status: res.status, json: ct.includes('json') ? await res.json() : null, res };
};

step('1. a realistic data set (built in memory through the API, then written to PostgreSQL)');
const mem = memoryStore(), memCall = mkCall(createHandler({ store: () => mem, bucket: () => bucket, auth: () => auth, now: () => clock, rand: () => 1 }));
const sa0 = (await memCall('POST', '/staff/login', { body: { email: 'boss@kvet.az', password: 'bosspass123' } })).json.access;
await memCall('POST', '/seed', { token: sa0, body: {} }); await memCall('POST', '/settings/save', { token: sa0, body: { fbRequired: false } }); await memCall('POST', '/staff/profile', { token: sa0, body: { name: 'Boss Bossov', title: 'Director' } });
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), ch => ch.charCodeAt(0));
await memCall('POST', '/upload?kind=logo', { token: sa0, raw: png, headers: { 'content-type': 'image/png' } });
const tr = (await memCall('POST', '/trainer/save', { token: sa0, body: { name: 'Taleh', surname: 'Bəkirov', fin: 'TRN1234', phone: '+994502223344' } })).json;
const co = (await memCall('POST', '/company/save', { token: sa0, body: { name: 'Drill & Co "MMC"' } })).json;
const blanks = (await memCall('GET', '/state', { token: sa0 })).json.blanks, bid = (blanks.find(b => !b.defaultSheetId) || blanks[0]).id;
const imp = await memCall('POST', '/trainee/import', { token: sa0, body: { rows: Array.from({ length: N }, (_, i) => ({ name: 'Əli' + i, surname: 'Şahbazov' + i, fin: 'D' + String(100000 + i), phone: '+9945013' + String(10000 + i), co: i % 3 ? co.company.id : '' })) } });
const people = (imp.json?.created || imp.json?.list || []).filter(x => x.login || x.creds); let ids = (await mem.all('trainees')).map(r => r.id);
for (let sN = 0; sN < Math.ceil(ids.length / 30); sN++) {
  const part = ids.slice(sN * 30, sN * 30 + 30), s = (await memCall('POST', '/session/save', { token: sa0, body: { bid, tid: tr.trainer.id, date: '2026-10-29', traineeIds: part } })).json.session;
  await memCall('POST', '/enr/attendance', { token: sa0, body: { sid: s.id, absent: [] } });
  for (const tid of part.slice(0, 12)) { await memCall('POST', '/enr/exam', { token: sa0, body: { sid: s.id, tid, passed: true, score: 88 } }); await memCall('POST', '/issue', { token: sa0, body: { sid: s.id, tid, sign: 'esign' } }); }
}
const one = (await memCall('POST', '/trainee/save', { token: sa0, body: { name: 'Nigar', surname: 'Əliyeva', fin: 'Z999999', phone: '+994509999999' } })).json;
await freshDb();
const db = supabaseStore(env); let rowsIn = 0;
for (const [col, m] of Object.entries(mem._dump())) { const rows = Object.entries(m).map(([id, data]) => ({ id, data })); rowsIn += rows.length; if (rows.length) await db.put(col, rows); }
for (const c of await mem.counters()) await db.bump(c.name, c.val);
ok(rowsIn > 100, `${rowsIn} records in ${Object.keys(mem._dump()).length} collections written to PostgreSQL (${ids.length} people, ${(await mem.all('certs')).length} certificates, ${(await mem.all('audit')).length} audit rows)`);

const call = mkCall(createHandler({ store: () => supabaseStore(env), bucket: () => bucket, auth: () => auth, now: () => clock }));
const login = async () => (await call('POST', '/staff/login', { body: { email: 'boss@kvet.az', password: 'bosspass123' } })).json.access;
const prints = async token => Object.fromEntries((await call('GET', '/backup/fingerprint', { token })).json.list.map(x => [x.col, `${x.n}:${x.h}`]));
const same = (a, b, cols) => cols.filter(c => (a[c] || '0') !== (b[c] || '0'));
let sa = await login();
ok((await call('GET', '/state', { token: sa })).status === 200, 'the app runs on PostgreSQL (sign-in, start-up data)');
const cert = (await db.all('certs'))[0].data, verify = async () => { const r = await call('GET', `/verify?n=${encodeURIComponent(cert.no)}&h=${cert.vh}`); if (process.env.DRILL_DEBUG) console.log('   verify ->', r.status, JSON.stringify(r.json).slice(0, 300)); return r.json?.status; };
ok((await verify()) === 'ACTIVE', `certificate ${cert.no} verifies`);

step('2. backup through the API, read back, encrypted copy kept outside');
const before = await prints(sa), t0 = Date.now(), key = (await call('POST', '/backup', { token: sa, body: {} })).json.key;
const v = (await call('POST', '/backup/verify', { token: sa, body: { key } })).json;
ok(v.total >= rowsIn, `${key}: ${v.total} records, ${(await bucket.head(key)).size} bytes, written and read back in ${Date.now() - t0} ms`);
const copy = new Uint8Array(await (await call('GET', '/backup/get?key=' + encodeURIComponent(key), { token: sa })).res.arrayBuffer());
ok(new TextDecoder('latin1').decode(copy).slice(0, 4) === 'KVB1' && !new TextDecoder('latin1').decode(copy).includes('Z999999'), 'the stored file is encrypted (no ID/FIN readable in it)');

step('P. "Delete old data" with every box ticked (System page), then restore the safety backup it made');
// The Workers Free plan allows 50 outgoing calls per request; the numbers below are the calls each request made to the database.
const FREE = 50, KINDS = ['sessions', 'enrolments', 'trainees', 'trainers', 'companies', 'blanks', 'sheets', 'materials', 'archive', 'snaps'];
shim.count(); const dry = await call('POST', '/purge', { token: sa, body: { kinds: KINDS, dry: true } }), nDry = shim.count();
ok(dry.status === 200 && dry.json.impact.trainees >= people, `preview: ${dry.json.impact.trainees} people, ${dry.json.impact.sessions} sessions, ${dry.json.impact.certs || 0} certificates (${nDry} database calls)`);
clock += 60e3; const pr = await call('POST', '/purge', { token: sa, body: { kinds: KINDS, confirm: 'DELETE' } }), nPurge = shim.count();
ok(pr.status === 200, `POST /purge -> ${pr.status}${pr.json?.error ? ' ' + pr.json.error : ''}: ${nPurge} database calls`);
const emptied = await prints(sa); ok(!emptied.trainees && !emptied.sessions && !emptied.certs && !emptied.enr && !emptied.archive, 'no people, sessions, enrolments, certificates or archive left');
shim.count(); clock += 60e3; const rP = await call('POST', '/restore', { token: sa, body: { key: pr.json.backup } }), nRestore = shim.count();
ok(rP.status === 200, `POST /restore of ${pr.json.backup} -> ${rP.status}: ${rP.json.rows} records back, ${nRestore} database calls`);
const afterP = await prints(sa), diffP = same(before, afterP, RESTORE_COLS.filter(c => c !== 'settings'));
ok(!diffP.length, `identical to before the delete${diffP.length ? ' EXCEPT ' + diffP : ''}`);
ok((await verify()) === 'ACTIVE', `certificate ${cert.no} verifies again`);
ok(Math.max(nDry, nPurge, nRestore) < FREE, `every one of these requests stays under the ${FREE} calls of the Workers Free plan`);

step('A. the data is deleted in the database, then restored in place');
const blocked = await shim.run(`delete from records where col = 'audit'`).then(() => false, e => /audit trail/.test(e.message));
ok(blocked, 'the audit trail refuses to be deleted (database rule)');
await shim.run(`delete from records where col <> 'audit' and col <> 'staff'`);
const gone = await prints(sa); ok(!gone.trainees && !gone.certs && !gone.sessions, 'wiped: no people, sessions or certificates left');
ok((await verify()) !== 'ACTIVE', 'the certificate no longer verifies');
clock += 60e3; const rA = await call('POST', '/restore', { token: sa, body: { key } });
ok(rA.status === 200, `POST /restore -> ${rA.status}: ${rA.json.rows} records back${rA.json.error ? ' ' + rA.json.error : ''}`);
const afterA = await prints(sa), diffA = same(before, afterA, RESTORE_COLS);
ok(!diffA.length, `all ${RESTORE_COLS.filter(c => before[c]).length} collections identical to before the wipe${diffA.length ? ' EXCEPT ' + diffA : ''}`);
ok((await verify()) === 'ACTIVE', 'the certificate verifies again');
ok((await call('POST', '/login', { body: { role: 'trainee', login: one.creds.login, password: one.creds.password } })).status === 200, 'a candidate signs in with the old password');

step('B. a brand-new database: schema.sql, first admin, upload the outside copy, restore');
const trailBefore = Number(await shim.run(`select count(*) from records where col = 'audit'`));
await freshDb(); for (const o of (await bucket.list({ prefix: 'backups/' })).objects) await bucket.delete(o.key);
for (const o of (await bucket.list({ prefix: 'assets/' })).objects) await bucket.delete(o.key);
ok(Number(await shim.run(`select count(*) from records`)) === 0, 'empty database, empty bucket');
sa = await login(); ok((await call('GET', '/state', { token: sa })).json?.role === 'superadmin', 'the bootstrap admin signs in on the empty system');
clock += 60e3; const up = await call('POST', '/backup/upload', { token: sa, raw: copy, headers: { 'content-type': 'application/octet-stream' } });
ok(up.status === 200 && up.json.total === v.total, `upload accepted and read through: ${up.json.total} records`);
clock += 60e3; const rB = await call('POST', '/restore', { token: sa, body: { key: up.json.key } });
ok(rB.status === 200, `POST /restore -> ${rB.status}: ${rB.json.rows} records, ${rB.json.audit} audit rows, ${rB.json.assets} files`);
const afterB = await prints(sa), diffB = same(before, afterB, RESTORE_COLS);
ok(!diffB.length, `all collections identical to the original${diffB.length ? ' EXCEPT ' + diffB : ''}`);
const trailAfter = Number(await shim.run(`select count(*) from records where col = 'audit'`));
ok(rB.json.audit >= trailBefore - 20 && trailAfter >= trailBefore - 5, `the audit trail is back: ${rB.json.audit} rows added (${trailBefore} before the loss, ${trailAfter} now)`);
ok(rB.json.assets >= 1 && (await bucket.list({ prefix: 'assets/' })).objects.length >= 1, 'the logo file is back in the bucket');
ok((await verify()) === 'ACTIVE', 'the certificate verifies');
ok((await call('POST', '/login', { body: { role: 'trainee', login: one.creds.login, password: one.creds.password } })).status === 200, 'a candidate signs in');
const next = (await call('POST', '/trainee/save', { token: sa, body: { name: 'Yeni', surname: 'Şəxs', fin: 'Y111111', phone: '+994508888888' } })).json;
ok(next.trainee && !ids.includes(next.trainee.id), `numbering continues after the restore (new learner number ${next.trainee?.att})`);
console.log('\nDRILL PASSED'); shim.close(); process.exit(0);
