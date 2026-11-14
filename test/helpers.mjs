import { createHandler } from '../functions/_lib/index.js';
import { readFile } from 'node:fs/promises';
/* the site's own files (fonts, built-in pictures), which Pages serves through env.ASSETS */
export const siteFile = async p => new Uint8Array(await readFile(new URL('../public' + p, import.meta.url)));
import { memoryStore, memoryBucket } from '../functions/_lib/store.js';
import { memoryAuth } from '../functions/_lib/auth.js';

export function makeApp({ now = () => Date.parse('2026-10-29T08:00:00Z'), rand = () => 1 } = {}) {
  const store = memoryStore(), bucket = memoryBucket(), auth = memoryAuth();
  const clock = { t: now() };
  const handle = createHandler({ store: () => store, bucket: () => bucket, auth: () => auth, now: () => clock.t, rand, files: () => siteFile });
  const env = { TOKEN_SECRET: 'test-secret-test-secret', BOOTSTRAP_ADMIN_EMAIL: 'boss@kvet.az' };
  auth.addUser('boss@kvet.az', 'bosspass123');
  async function call(method, path, { token, body, raw, headers } = {}) {
    const init = { method, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(headers || {}) } };
    if (raw) init.body = raw; else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['content-type'] = 'application/json'; }
    const res = await handle(new Request('https://t.test/api' + path, init), env);
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, json: ct.includes('json') ? await res.json() : null, res };
  }
  const staff = async (email, password) => (await call('POST', '/staff/login', { body: { email, password } })).json?.access;
  const mkStaff = async (email, role, password = 'password123') => { auth.addUser(email, password); const id = [...Array(1)].length && (await auth.login(email, password)).user.id; await store.put('staff', [{ id, data: { email, role } }]); return staff(email, password); };
  return { call, store, bucket, auth, env, clock, staff, mkStaff };
}
