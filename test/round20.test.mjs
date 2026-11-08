/* Round 20: one table per collection with database-enforced record rules, and type checking. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { memoryStore } from '../functions/_lib/store.js';
import { SHAPES, TABLES, shapeError, checkSql } from '../functions/_lib/shapes.js';
import { DCOLS } from '../functions/_lib/routes_system.js';
import { makeApp } from './helpers.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('record rules: a malformed record is refused by the store (same rules as the database)', async () => {
  const D = memoryStore();
  await assert.rejects(D.put('trainees', [{ id: 'T1', data: { name: 'No learner number' } }]), e => e.status === 422 && e.message === 'badRecord');
  await assert.rejects(D.insert('certs', 'C1', { no: 'C2', tid: 'T1', bid: 'b', start: '2026-01-01', snap: {} }), /badRecord/, 'number must match the key');
  await assert.rejects(D.put('sessions', [{ id: 'S1', data: { id: 'S1', bid: 'b', date: '01.02.2026' } }]), /badRecord/, 'dates are YYYY-MM-DD');
  await assert.rejects(D.insertMany('enr', [{ id: 'e', data: { sid: 'S1' } }]), /badRecord/);
  await D.put('trainees', [{ id: 'T1', data: { id: 'T1', att: 'T1' } }]);
  await D.put('unknowncol', [{ id: 'x', data: { anything: 1 } }]);                  // collections without rules: any object
  await assert.rejects(D.put('unknowncol', [{ id: 'y', data: /** @type {any} */ ('text') }]), /badRecord/);
  assert.equal(shapeError('certs', 'C1', { no: 'C1', tid: 'T', bid: 'b', start: '2026-01-01', end: '', snap: {} }), '');
});

test('record rules: every collection that is backed up has its own table; SQL rules exist for every shape', () => {
  for (const c of DCOLS) assert.ok(TABLES.includes(c), c + ' has its own table');
  for (const c of Object.keys(SHAPES)) { assert.ok(checkSql(c), c); }
  assert.equal(new Set(TABLES).size, TABLES.length);
});

test('schema.sql is generated from the same rules (not out of date)', () => {
  const r = spawnSync(process.execPath, ['tools/gen-schema.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('the demo seed passes the rules (the other 130 tests also run every write through them)', async () => {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  assert.equal((await call('POST', '/seed', { token: sa, body: {} })).status, 200);
  const st = (await call('GET', '/state', { token: sa })).json;
  assert.ok(st.blanks.length > 0, 'seeded templates saved');
});

test('type check passes (when TypeScript is installed)', { skip: !findTsc() && 'TypeScript not installed' }, () => {
  const r = spawnSync(findTsc(), ['-p', 'tsconfig.json'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
function findTsc() {
  for (const p of [ROOT + 'node_modules/.bin/tsc', process.env.HOME + '/.npm-global/bin/tsc', '/home/claude/.npm-global/bin/tsc']) if (existsSync(p)) return p;
  return '';
}

test('old enrolments without "tid" (saved before v3) are read and restored with it, from the record key', async () => {
  const D = memoryStore();
  await D.restore(['enr'], { enr: [{ id: '2026-11-30|pa|t1|E-202600005', data: { sid: '2026-11-30|pa|t1', att: '2026-11-30T09:00:00Z', co: 'c1', id: 'x' } }] }, []);
  const e = await D.get('enr', '2026-11-30|pa|t1|E-202600005');
  assert.equal(e.tid, 'E-202600005');
  assert.equal((await D.prefix('enr', '2026-11-30|pa|t1|'))[0].data.tid, 'E-202600005');
  await D.put('enr', [{ id: '2026-11-30|pa|t1|E-202600005', data: e }]);   // saving it again passes the rules
});

test('security: API answers carry security headers; other websites cannot post; oversized bodies are refused', async () => {
  const app = makeApp(), { call } = app, sa = await app.staff('boss@kvet.az', 'bosspass123');
  const r = await call('GET', '/public/info');
  assert.equal(r.res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.res.headers.get('x-frame-options'), 'DENY');
  assert.match(r.res.headers.get('content-security-policy') || '', /default-src 'none'/);
  assert.equal(r.res.headers.get('cache-control'), 'no-store');
  // same site (or no Origin, as tools and the scheduler send) works; another site's page is refused
  assert.equal((await call('POST', '/seed', { token: sa, body: {}, headers: { origin: 'https://t.test' } })).status, 200);
  const x = await call('POST', '/seed', { token: sa, body: {}, headers: { origin: 'https://evil.example' } });
  assert.equal(x.status, 403); assert.equal(x.json.error, 'badOrigin');
  assert.equal((await call('GET', '/public/info', { headers: { origin: 'https://evil.example' } })).status, 200, 'reading public info stays open');
  const big = await call('POST', '/trainee/import', { token: sa, raw: JSON.stringify({ rows: [], pad: 'x'.repeat(2.2 * 1048576) }), headers: { 'content-type': 'application/json' } });
  assert.equal(big.status, 413); assert.equal(big.json.error, 'tooLarge');
});
