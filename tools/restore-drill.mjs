// Restore drill against a STAGING copy of the system (a second Pages project + a second Supabase project).
// It proves, on real infrastructure, that a backup made by the app can bring back a database that lost everything:
//   sign in -> checksums of every collection -> backup -> read it back -> keep the encrypted copy as a file
//   -> DELETE every record in the staging database (the audit trail refuses, by design) -> restore -> checksums again
// Usage:
//   node tools/restore-drill.mjs --api https://kvet-staging.pages.dev --email you@kvet.az --password '…' \
//        --supabase-url https://<staging-ref>.supabase.co --service-key '<staging service key>' --confirm <staging-ref>
// Safety: it refuses the Supabase project named in wrangler.toml (production), and --confirm must repeat the project ref.
// The account needs the superadmin role and no two-factor on staging. Nothing is installed; Node 20+.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? String(process.argv[i + 1] || '') : ''; };
const api = arg('api').replace(/\/+$/, ''), sbUrl = arg('supabase-url').replace(/\/+$/, ''), key = arg('service-key'), email = arg('email'), password = arg('password');
const die = m => { console.error('\nSTOPPED: ' + m); process.exit(1); }, ok = (c, m) => { if (!c) die(m); console.log('   ok  ' + m); };
if (!api || !sbUrl || !key || !email || !password) die('missing arguments - see the top of this file');
const ref = (sbUrl.match(/^https?:\/\/([^./:]+)/) || [])[1] || '';
let prod = ''; try { prod = (readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8').match(/SUPABASE_URL\s*=\s*"([^"]+)"/) || [])[1] || ''; } catch {}
if (prod && prod.replace(/\/+$/, '') === sbUrl) die('this is the PRODUCTION Supabase project of wrangler.toml. The drill deletes every record: use a staging project.');
if (arg('confirm') !== ref) die(`this drill DELETES every record in ${sbUrl}. To go on, add:  --confirm ${ref}`);

const call = async (method, path, { token, body } = {}) => {
  const r = await fetch(api + '/api' + path, { method, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body ? { 'content-type': 'application/json' } : {}), origin: api }, body: body ? JSON.stringify(body) : undefined }).catch(e => die(`cannot reach ${api}: ${e.cause?.code || e.message}`));
  const ct = r.headers.get('content-type') || ''; return { status: r.status, json: ct.includes('json') ? await r.json() : null, res: r };
};
const A = key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: 'Bearer ' + key };
const prints = async token => { const r = await call('GET', '/backup/fingerprint', { token }); if (r.status !== 200) die(`GET /backup/fingerprint -> ${r.status} ${JSON.stringify(r.json)} (is this version deployed, and schema.sql run?)`); return Object.fromEntries(r.json.list.map(x => [x.col, `${x.n}:${x.h}`])); };
const SKIP = new Set(['audit', 'staff', 'errlog']);

console.log(`Restore drill\n  app       ${api}\n  database  ${sbUrl}`);
const li = await call('POST', '/staff/login', { body: { email, password } });
if (li.json?.mfa) die('this account has two-factor on; use a staging superadmin without it');
const token = li.json?.access; ok(token, token ? `signed in as ${email}` : `sign-in failed: HTTP ${li.status} ${JSON.stringify(li.json)}`);
const before = await prints(token), cols = Object.keys(before).filter(c => !SKIP.has(c)), total = cols.reduce((n, c) => n + Number(before[c].split(':')[0]), 0);
ok(total > 0, `${total} records in ${cols.length} collections before the drill`);
const t0 = Date.now(), bk = await call('POST', '/backup', { token, body: {} }); ok(bk.status === 200, `backup written: ${bk.json?.key}`);
const v = await call('POST', '/backup/verify', { token, body: { key: bk.json.key } }); ok(v.status === 200 && v.json.total >= total, `backup read back: ${v.json?.total} records (${Date.now() - t0} ms)`);
const file = `kvet-drill-${ref}.kvb`, copy = new Uint8Array(await (await call('GET', '/backup/get?key=' + encodeURIComponent(bk.json.key), { token })).res.arrayBuffer()); writeFileSync(file, copy);
ok(copy.length > 12 && new TextDecoder('latin1').decode(copy.subarray(0, 4)) === 'KVB1', `encrypted copy saved as ./${file} (${copy.length} bytes)`);

const tryAudit = await fetch(`${sbUrl}/rest/v1/records?col=eq.audit&id=eq.__drill__`, { method: 'DELETE', headers: A });
const wipe = await fetch(`${sbUrl}/rest/v1/records?col=not.in.(audit,staff)`, { method: 'DELETE', headers: { ...A, prefer: 'return=minimal' } });
ok(wipe.ok, `every record deleted in the staging database (HTTP ${wipe.status}${tryAudit.ok ? '' : '; the audit trail refused, as it should'})`);
const gone = await prints(token); ok(cols.every(c => !gone[c]), 'checked: the collections are empty');
const t1 = Date.now(), rs = await call('POST', '/restore', { token, body: { key: bk.json.key } });
ok(rs.status === 200, `restore -> HTTP ${rs.status}: ${rs.json?.rows} records in ${Date.now() - t1} ms${rs.json?.error ? ' (' + rs.json.error + ')' : ''}`);
const after = await prints(token), bad = cols.filter(c => before[c] !== after[c]);
ok(!bad.length, bad.length ? `DIFFERENT after the restore: ${bad.join(', ')}` : `all ${cols.length} collections are identical to before the wipe, record for record`);
console.log(`\nDRILL PASSED  (${new Date().toISOString()})\nKeep ./${file} or delete it: it is an encrypted copy of the staging data.`);
