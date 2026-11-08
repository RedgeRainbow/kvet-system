import test from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs'; import { join } from 'node:path';
import { DICT } from '../public/js/dict.js';
import { RU } from '../public/js/dict_ru.js';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (f === 'vendor' ? [] : walk(p)) : p.endsWith('.js') ? [p] : []; });
const files = walk('public/js').filter(f => !f.endsWith('dict.js') && !f.endsWith('dict_ru.js')), src = files.map(f => readFileSync(f, 'utf8')).join('\n');
test('every static t() key exists in both languages', () => {
  const keys = new Set([...src.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map(m => m[1]));
  for (const m of src.matchAll(/\bt\(([^()]*\?[^()]*)\)/g)) for (const q of m[1].matchAll(/'([A-Za-z0-9_]+)'/g)) if (!/^[A-Z_]+$/.test(q[1])) keys.add(q[1]);
  const miss = [...keys].filter(k => !k.endsWith('_') && !['by', 'scale'].includes(k) && !DICT[k]);
  assert.deepEqual(miss, []);
  for (const [k, v] of Object.entries(DICT)) assert.ok(v[0] && v[1], k);
});
test('dynamic key families are complete', () => {
  const fam = { beh_: ['excellent', 'good', 'satisfactory', 'poor'], pun_: ['ontime', 'late', 'vlate'], cs_: ['ACTIVE', 'SOON', 'EXPIRED', 'REVOKED', 'RENEWED'], st_: ['upcoming', 'ongoing', 'review', 'completed', 'cancelled'],
    oc_: ['ABSENT', 'PENDING_PRACTICAL', 'FAIL', 'PENDING_EXAM', 'PASS'], pr_: ['PASS', 'FAIL', 'INCOMPLETE'], rel_: ['PASS', 'FAIL'], mode_: ['passfail', 'penalty', 'rating'], modeHint_: ['passfail', 'penalty', 'rating'],
    role_: ['superadmin', 'admin', 'editor', 'approver', 'auditor'], roleDesc_: ['superadmin', 'admin', 'editor', 'approver', 'auditor'], approve_: ['tests', 'materials', 'certs'], theme_: ['auto', 'dark', 'light'], failWhy_: ['practical', 'exam', 'absent', 'disq', 'penalty', 'item', 'avg'], why_: ['practical', 'exam', 'absent', 'disq', 'penalty', 'item', 'avg'], scale: [1, 2, 3, 4, 5], by: ['self', 'staff', 'trainer'] };
  const miss = []; for (const [p, ks] of Object.entries(fam)) for (const k of ks) if (!DICT[p + k]) miss.push(p + k); assert.deepEqual(miss, []);
});

test('Russian: every text has a Russian version with the same {placeholders}', () => {
  const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
  const miss = Object.keys(DICT).filter(k => !RU[k]), bad = Object.keys(DICT).filter(k => RU[k] && ph(RU[k]) !== ph(DICT[k][1]));
  assert.deepEqual(miss, [], 'missing Russian'); assert.deepEqual(bad, [], 'placeholders differ');
  assert.deepEqual(Object.keys(RU).filter(k => !DICT[k]), [], 'Russian keys that no longer exist');
});
