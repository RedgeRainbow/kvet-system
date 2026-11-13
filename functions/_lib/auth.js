/* Crypto helpers, portal tokens, staff authentication provider and login throttling. */
import { H } from './store.js';

const enc = new TextEncoder();
export const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
export const rnd = n => hex(crypto.getRandomValues(new Uint8Array(n)));
export const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
/** @param {string} p @param {string} salt @param {number} [it] rounds this hash was made with (accounts: `it`; none = 100,000) */
export const pbk = async (p, salt, it) => hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(salt), iterations: Number(it) >= PBK_MIN ? Number(it) : PBK_MIN, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', enc.encode(p), 'PBKDF2', false, ['deriveBits']), 256));
/* Rounds for passwords people choose or sign in with from now on. The variable PBKDF2_ROUNDS raises it (OWASP: 600,000);
   it needs the CPU time of the Workers Paid plan, so the default stays 100,000. Generated passwords are hashed at the
   default (a bulk import hashes hundreds at once) and raised at the person's first sign-in. */
export const PBK_MIN = 100000;
export const rounds = env => { const n = Math.floor(Number(env?.PBKDF2_ROUNDS)); return n >= PBK_MIN && n <= 1000000 ? n : PBK_MIN; };
export const hmac = async (secret, msg) => { const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg))); };

/* Readable one-time passwords: no 0/O, 1/l/I. */
const ALPHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/* Candidates' passwords are easy to type from a printed slip: three letters (upper, lower, upper; no look-alikes such as
   I / l / O) followed by five digits, e.g. "CdC48302". Until v3.34 the digits were always 12345, which left 12,167 possible
   passwords for sign-in names that run in sequence (learner numbers): few enough to find one by trying a handful of
   passwords on many accounts, under any lockout. With random digits there are 1.2 billion. */
export function candidatePassword() {
  const U = 'ABCDEFGHJKMNPQRSTUVWXYZ', L = 'abcdefghjkmnpqrstuvwxyz', r = crypto.getRandomValues(new Uint32Array(4));
  return U[r[0] % U.length] + L[r[1] % L.length] + U[r[2] % U.length] + String(r[3] % 100000).padStart(5, '0');
}
export function genPassword(n = 8) {
  const out = []; const buf = crypto.getRandomValues(new Uint8Array(n * 4));
  for (const b of buf) { if (b < 256 - (256 % ALPHA.length)) out.push(ALPHA[b % ALPHA.length]); if (out.length === n) break; }
  return out.join('');
}
/* Constant-time string compare. */
export function same(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* -------------------------------------------------------- portal tokens */
const TTL = 12 * 36e5;
export async function mkTok(env, p, ttl = TTL) { const b = btoa(JSON.stringify({ ...p, exp: Date.now() + ttl })); return b + '.' + await hmac(env.TOKEN_SECRET, b); }
export async function readTok(env, token) {
  const [b, s] = String(token || '').split('.');
  if (!b || !s || !same(await hmac(env.TOKEN_SECRET, b), s)) throw new H(401, 'auth');
  let p; try { p = JSON.parse(atob(b)); } catch { throw new H(401, 'auth'); }
  if (!(p.exp > Date.now())) throw new H(401, 'auth');
  return p;
}
export const bearer = r => (r.headers.get('authorization') || '').slice(7);

/* ---------------------------------------- login registry + brute-force lock
   col `logins`: id = "<role>:<login lowercase>" -> { login, id: accountId } (unique per role)
   col `locks` : id = same key -> { n, until } */
export const loginKey = (role, login) => `${role}:${String(login).trim().toLowerCase()}`;
export async function claimLogin(D, role, wanted, accountId) {
  const base = String(wanted).trim().replace(/[^A-Za-z0-9._-]/g, '') || role;
  for (let i = 0; i < 40; i++) {
    const login = i === 0 ? base : base + Math.floor(10 + Math.random() * 990);
    try { await D.insert('logins', loginKey(role, login), { login, id: accountId }); return login; } catch (/** @type {any} */ e) { if (!(e instanceof H) || e.message !== 'dup') throw e; }
  }
  throw new H(500, 'server');
}
/* Brute-force protection.
   - Per account: every attempt is COUNTED FIRST (atomically, in the database) and only then is the password checked, so a
     burst of parallel guesses cannot slip past the limit: 8 attempts, then 15 minutes locked; a successful sign-in clears it.
   - Per IP address: only FAILED attempts count (100 in 15 minutes, then that address is locked for 15 minutes), and a
     successful sign-in does not clear it. A classroom shares one address: thirty people signing in (and the odd typo) never
     lock it, while one address guessing across many accounts is stopped - and cannot reset the counter with an account of its own. */
/* - Who gets locked (v3.35): the 8-attempt lock is per account AND address. Before, it was per account alone, so anybody
     who knew a sign-in name (learner numbers run in sequence; the office e-mail is public) could keep that account locked
     for good with 9 requests every 15 minutes, from one computer - including the break-glass account. Now those guesses
     lock only the guesser's own address for that account. A wider limit still protects the account against guessing from
     many addresses at once: 40 FAILED attempts in 15 minutes, whatever the address, lock it for everyone for 15 minutes
     (not used for the break-glass account, whose secret is at least 16 random characters and must stay reachable). */
export const LOCK = { account: 8, ip: 100, wide: 40, secs: 15 * 60 };
const ipOf = c => (c.req?.headers?.get?.('cf-connecting-ip') || c.req?.headers?.get?.('x-forwarded-for') || '').split(',')[0].trim();
export const wideKey = key => 'all:' + key;
/** @param {any} c @param {string} key @param {{ wide?: boolean }} [o] */
export function attemptKeys(c, key, { wide = true } = {}) {
  const ip = ipOf(c); if (!ip) return [[key, LOCK.account]];                 // no address known (tools, tests): per account, as before
  return [[key + '@' + ip, LOCK.account], ['ip:' + ip, LOCK.ip], ...(wide ? [[wideKey(key), LOCK.wide]] : [])];
}
export async function attempt(c, keys) {
  for (const [k] of keys) { const u = await c.D.lockState(k); if (u) throw new H(429, 'locked', { until: new Date(u).toISOString() }); }
  const [k, max] = keys[0]; const u = await c.D.lockFail(k, max + 1, LOCK.secs); if (u) throw new H(429, 'locked', { until: new Date(u).toISOString() });
}
/* a failed attempt: counts for the address */
export async function attemptBad(c, keys) { for (const [k, max] of keys.slice(1)) await c.D.lockFail(k, max, LOCK.secs).catch(() => {}); }
export async function attemptOk(c, keys) { await c.D.lockOk(keys[0][0]); }

/* ----------------------------------------------------- secrets at rest (camera passwords)
   AES-GCM with a key derived from TOKEN_SECRET. Stored as "enc:<iv>.<ciphertext>" (hex). */
async function aesKey(secret) { const raw = await crypto.subtle.digest('SHA-256', enc.encode('kvet-at-rest|' + secret)); return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
export async function seal(secret, plain) {
  if (!plain) return ''; const iv = crypto.getRandomValues(new Uint8Array(12));
  return 'enc:' + hex(iv) + '.' + hex(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(plain)));
}
export async function unseal(secret, v) {
  if (!v || !String(v).startsWith('enc:')) return v || '';
  const [iv, ct] = String(v).slice(4).split('.');
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(iv) }, await aesKey(secret), unhex(ct))); } catch { return ''; }
}

/* ------------------------------------------------------------------- TOTP (RFC 6238) */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const b32 = bytes => { let bits = '', out = ''; for (const b of bytes) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]; return out; };
const unb32 = s => { let bits = ''; for (const ch of String(s).toUpperCase().replace(/=+$/, '')) bits += B32.indexOf(ch).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return new Uint8Array(out); };
export async function totp(secret, at = Date.now(), step = 0) {
  const ctr = Math.floor(at / 30000) + step, msg = new Uint8Array(8); let x = ctr; for (let i = 7; i >= 0; i--) { msg[i] = x & 255; x = Math.floor(x / 256); }
  const k = await crypto.subtle.importKey('raw', unb32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg)), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}

/* ------------------------------------------------------------- JWT (staff access tokens)
   Supabase signs access tokens with an asymmetric key (ES256/RS256, published as JWKS) or, on older projects, with the
   project's JWT secret (HS256). Verified locally when possible, so a request does not need a round trip to Supabase. */
const b64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), ch => ch.charCodeAt(0));
export const jwtClaims = tok => { try { return JSON.parse(new TextDecoder().decode(b64u(String(tok).split('.')[1]))); } catch { return null; } };
/** @type {{ at: number, keys: any[] }} */
let jwksCache = { at: 0, keys: [] };
async function jwks(base) {
  if (Date.now() - jwksCache.at < 6e5 && jwksCache.keys.length) return jwksCache.keys;
  try { const r = await fetch(base + '/auth/v1/.well-known/jwks.json'); if (r.ok) jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] }; } catch {}
  return jwksCache.keys;
}
/* Returns the claims when the signature and expiry check out, null when it cannot be checked locally, throws when it is invalid. */
export async function verifyJwt(token, { base, secret }) {
  const [h, p, sg] = String(token || '').split('.'); if (!h || !p || !sg) throw new H(401, 'auth');
  let head; try { head = JSON.parse(new TextDecoder().decode(b64u(h))); } catch { throw new H(401, 'auth'); }
  const data = enc.encode(h + '.' + p), sig = b64u(sg); let ok = /** @type {any} */ (null);
  if (head.alg === 'HS256') {
    if (!secret) return null;
    const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']); ok = await crypto.subtle.verify('HMAC', k, sig, data);
  } else if (head.alg === 'ES256' || head.alg === 'RS256') {
    const jwk = (await jwks(base)).find(k => k.kid === head.kid); if (!jwk) return null;
    const alg = head.alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    const key = await crypto.subtle.importKey('jwk', jwk, alg, false, ['verify']);
    ok = await crypto.subtle.verify(head.alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : alg, key, sig, data);
  } else return null;
  if (!ok) throw new H(401, 'auth');
  const c = jwtClaims(token); if (!c || !(c.exp * 1000 > Date.now())) throw new H(401, 'auth');
  return c;
}

/* ---------------------------------------------- staff auth (Supabase Auth)
   The browser never talks to Supabase: it calls /api/staff/login and /api/staff/refresh. */
export function supabaseAuth(env) {
  const base = env.SUPABASE_URL, pub = { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' };
  /** @type {Record<string, string>} */
  const srv = env.SUPABASE_SERVICE_KEY.startsWith('sb_') ? { apikey: env.SUPABASE_SERVICE_KEY } : { apikey: env.SUPABASE_SERVICE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY };
  const tokens = d => ({ access: d.access_token, refresh: d.refresh_token, user: { id: d.user.id, email: d.user.email } });
  return {
    async login(email, password) {
      const r = await fetch(base + '/auth/v1/token?grant_type=password', { method: 'POST', headers: pub, body: JSON.stringify({ email, password }) });
      const d = await r.json().catch(() => ({})); if (!r.ok || !d.access_token) throw new H(401, 'badLogin'); return tokens(d);
    },
    async refresh(refresh) {
      const r = await fetch(base + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: pub, body: JSON.stringify({ refresh_token: refresh }) });
      const d = await r.json().catch(() => ({})); if (!r.ok || !d.access_token) throw new H(401, 'auth'); return tokens(d);
    },
    /* { id, email, aal } from a valid access token: checked locally (JWKS / JWT secret) when possible, else by Supabase */
    async user(token) {
      const claims = await verifyJwt(token, { base, secret: env.SUPABASE_JWT_SECRET });
      if (claims) return { id: claims.sub, email: claims.email, aal: claims.aal || 'aal1', sid: claims.session_id || '', exp: claims.exp };
      const r = await fetch(base + '/auth/v1/user', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + token } });
      if (!r.ok) throw new H(401, 'auth'); const u = await r.json(), cl = jwtClaims(token); return { id: u.id, email: u.email, aal: cl?.aal || 'aal1', sid: cl?.session_id || '', exp: cl?.exp };
    },
    /* sign-out: this session's refresh token stops working (the access token is refused by the app itself: staff.out) */
    async logout(token) { await fetch(base + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + token } }).catch(() => {}); },
    /* ---- two-factor (TOTP) through Supabase Auth MFA ---- */
    async factors(token) {
      const r = await fetch(base + '/auth/v1/user', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + token } });
      if (!r.ok) throw new H(401, 'auth'); return ((await r.json()).factors || []).filter(f => f.factor_type === 'totp').map(f => ({ id: f.id, status: f.status }));
    },
    async enroll(token) {
      const r = await fetch(base + '/auth/v1/factors', { method: 'POST', headers: { ...pub, authorization: 'Bearer ' + token }, body: JSON.stringify({ factor_type: 'totp', friendly_name: 'KVET ' + Date.now() }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new H(400, 'mfaError'); return { id: d.id, qr: d.totp?.qr_code || '', secret: d.totp?.secret || '', uri: d.totp?.uri || '' };
    },
    async verifyFactor(token, factorId, code) {
      const h = { ...pub, authorization: 'Bearer ' + token }, f = encodeURIComponent(factorId);
      const ch = await fetch(base + '/auth/v1/factors/' + f + '/challenge', { method: 'POST', headers: h, body: '{}' }); const c = await ch.json().catch(() => ({})); if (!ch.ok) throw new H(400, 'mfaError');
      const r = await fetch(base + '/auth/v1/factors/' + f + '/verify', { method: 'POST', headers: h, body: JSON.stringify({ challenge_id: c.id, code: String(code) }) });
      const d = await r.json().catch(() => ({})); if (!r.ok || !d.access_token) throw new H(401, 'badCode'); return tokens(d);
    },
    async unenroll(token, factorId) { await fetch(base + '/auth/v1/factors/' + encodeURIComponent(factorId), { method: 'DELETE', headers: { ...pub, authorization: 'Bearer ' + token } }); },
    async adminResetMfa(userId) {
      const r = await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(userId) + '/factors', { headers: srv }); const list = r.ok ? await r.json() : [];
      for (const f of (Array.isArray(list) ? list : list.factors || [])) await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(userId) + '/factors/' + encodeURIComponent(f.id), { method: 'DELETE', headers: srv });
    },
    /* A new staff sign-in. If Supabase already has an account with this e-mail (created earlier in the Supabase dashboard, by
       an old sign-up, or left over after a staff record was deleted), that account is reused: confirmed and given this password.
       Otherwise the staff record would point to nothing and the person could never sign in. */
    async createUser(email, password) {
      const r = await fetch(base + '/auth/v1/admin/users', { method: 'POST', headers: { ...srv, 'content-type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { const id = d.id || d.user?.id; if (!id) throw new H(502, 'authFailed'); return { id }; }
      const msg = String(d.msg || d.message || d.error_description || d.error_code || d.code || '');
      if (r.status === 422 && /exist|already|registered/i.test(msg)) {
        const old = await this.findByEmail(email); if (!old) throw new H(409, 'userExists');
        const u = await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(old.id), { method: 'PUT', headers: { ...srv, 'content-type': 'application/json' }, body: JSON.stringify({ password, email_confirm: true, ban_duration: 'none' }) });
        if (!u.ok) throw new H(400, 'weakPassword');
        return { id: old.id, reused: true };
      }
      if (/password/i.test(msg)) throw new H(400, 'weakPassword');
      throw new H(400, 'authFailed');
    },
    async findByEmail(email) {
      for (let page = 1; page <= 50; page++) {
        const r = await fetch(base + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: srv }); if (!r.ok) return null;
        const d = await r.json().catch(() => ({})), list = Array.isArray(d) ? d : d.users || [];
        const hit = list.find(u => String(u.email || '').toLowerCase() === email.toLowerCase()); if (hit) return hit;
        if (list.length < 200) return null;
      }
      return null;
    },
    async setPassword(id, password) {
      const r = await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'PUT', headers: { ...srv, 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!r.ok) throw new H(400, 'badInput');
    },
    async deleteUser(id) { await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE', headers: srv }); },
  };
}

/* In-process auth provider for tests and the local dev server. */
export function memoryAuth() {
  const users = new Map(), toks = new Map(); let n = 0;
  const issue = (u, aal = 'aal1', sid = 's' + (n + 1)) => { const access = 'a' + (++n) + rnd(6), refresh = 'r' + n + rnd(6); toks.set(access, { id: u.id, aal, sid }); toks.set(refresh, { id: u.id, aal, sid }); return { access, refresh, user: { id: u.id, email: u.email } }; };
  const who = t => { const x = toks.get(t); const u = x && users.get(x.id); if (!u) throw new H(401, 'auth'); return { u, aal: x.aal }; };
  return {
    addUser(email, password) { const u = { id: 'u' + (++n) + rnd(3), email: email.toLowerCase(), password, factors: [] }; users.set(u.id, u); return u; },
    async login(email, password) { const u = [...users.values()].find(x => x.email === String(email).toLowerCase()); if (!u || u.password !== password) throw new H(401, 'badLogin'); return issue(u); },
    async refresh(r) { const { u, aal } = who(r); return issue(u, aal, toks.get(r).sid); },
    async user(t) { const { u, aal } = who(t); return { id: u.id, email: u.email, aal, sid: toks.get(t).sid, exp: Math.floor(Date.now() / 1000) + 3600 }; },
    async logout(t) { const sid = toks.get(t)?.sid; for (const [k, v] of toks) if (k.startsWith('r') && v.sid === sid) toks.delete(k); },   // like Supabase: the refresh token dies, the access token lives on until it expires
    async createUser(email, password) { const u = [...users.values()].find(x => x.email === email); if (u) { u.password = password; return { id: u.id, reused: true }; } return { id: this.addUser(email, password).id }; },
    async setPassword(id, p) { const u = users.get(id); if (u) u.password = p; },
    async deleteUser(id) { users.delete(id); },
    async factors(t) { return who(t).u.factors.map(f => ({ id: f.id, status: f.status })); },
    async enroll(t) { const { u } = who(t); const f = { id: 'f' + rnd(4), secret: b32(crypto.getRandomValues(new Uint8Array(20))), status: 'unverified' }; u.factors.push(f); return { id: f.id, qr: '', secret: f.secret, uri: 'otpauth://totp/KVET:' + u.email + '?secret=' + f.secret }; },
    async verifyFactor(t, fid, code) { const { u } = who(t); const f = u.factors.find(x => x.id === fid); if (!f) throw new H(400, 'mfaError'); const ok = [-1, 0, 1].map(s => totp(f.secret, Date.now(), s)); if (!(await Promise.all(ok)).includes(String(code))) throw new H(401, 'badCode'); f.status = 'verified'; return issue(u, 'aal2'); },
    async unenroll(t, fid) { const { u } = who(t); u.factors = u.factors.filter(f => f.id !== fid); },
    async adminResetMfa(id) { const u = users.get(id); if (u) u.factors = []; },
    _secret: (id, fid) => users.get(id)?.factors.find(f => f.id === fid)?.secret,
  };
}
