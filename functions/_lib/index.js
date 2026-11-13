/* Router: builds the request context, enforces sign-in + role, maps errors to JSON. */
import { H, S, J, audit } from './core.js';
import { bearer, readTok, same, hmac } from './auth.js';
import { publicRoutes } from './routes_public.js';
import { portalRoutes } from './routes_portal.js';
import { peopleRoutes } from './routes_people.js';
import { trainingRoutes } from './routes_training.js';
import { findRoutes } from './routes_find.js';
import { systemRoutes } from './routes_system.js';
import { testRoutes } from './routes_tests.js';
import { cached } from './cache.js';
import { indexed } from './search.js';
import { tracked, revOf } from './live.js';
import { groupRoutes } from './routes_groups.js';
import { approvalRoutes } from './routes_approvals.js';
import { aiRoutes } from './routes_ai.js';
import { analyticsRoutes } from './routes_analytics.js';
import { candidateRoutes } from './routes_candidates.js';
import { libraryRoutes } from './routes_library.js';
import { notifyRoutes } from './routes_notify.js';
import { dmRoutes } from './routes_dm.js';

/* live updates: the pages poll their revision counter (see live.js) */
const liveRoutes = {
  'GET /rev': { auth: 'staff', act: 'view', async fn(c) { return { rev: await revOf(c.D, 'rev') }; } },
  'GET /portal/company/rev': { auth: 'company', async fn(c) { return { rev: await revOf(c.D, 'rev|c|' + c.me.id) }; } },
  'GET /portal/trainee/rev': { auth: 'trainee', async fn(c) { return { rev: await revOf(c.D, 'rev|p|' + c.me.id, 'rev|p|*') }; } },
  'GET /portal/trainer/rev': { auth: 'trainer', async fn(c) { const sid = String(c.url.searchParams.get('sid') || '').slice(0, 60); return { rev: await revOf(c.D, 'rev|t|' + c.me.id, 'rev|p|*', ...(sid ? ['rev|s|' + sid] : [])) }; } },
};
/* trainee routes that work before the profile (ID/FIN, phone) is complete */
const TRAINEE_OPEN = new Set(['/portal/trainee/home', '/portal/trainee/profile/complete', '/portal/trainee/password', '/portal/trainee/rev']);
export const TABLE = { ...publicRoutes, ...portalRoutes, ...peopleRoutes, ...trainingRoutes, ...findRoutes, ...systemRoutes, ...testRoutes, ...liveRoutes, ...groupRoutes, ...approvalRoutes, ...aiRoutes, ...analyticsRoutes, ...candidateRoutes, ...libraryRoutes, ...notifyRoutes, ...dmRoutes };
const ROUTES = Object.entries(TABLE).map(([k, v]) => {
  const [m, p] = k.split(' '), keys = [];
  const re = new RegExp('^' + p.replace(/:(\w+)/g, (_, n) => { keys.push(n); return '([^/]+)'; }) + '$');
  return { m, re, keys, v };
});
const PORTAL_COL = { trainer: 'trainers', trainee: 'trainees', company: 'companies' };

export function createHandler(deps) {
  /* JSON bodies: at most 2 MB (the largest real one, a 300-row import, is ~150 KB). File uploads read the raw body
   themselves and check their own limits. A broken or missing body reads as {}. */
const MAX_JSON = 2 * 1048576;
/** @param {Request} request */
async function readJson(request) {
  if (request.method !== 'POST') return {};
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_JSON) throw new H(413, 'tooLarge');
  const text = await request.text();
  if (text.length > MAX_JSON) throw new H(413, 'tooLarge');
  if (!text.trim()) return {};
  // a body that is not a JSON object is a bad request (it used to read as {} - or, for "null" / a list, crash the route)
  let v; try { v = JSON.parse(text); } catch { throw new H(400, 'badInput'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new H(400, 'badInput');
  return v;
}
/* security headers on every API answer (the site's _headers file does not reach Functions) */
const SEC = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'cross-origin-resource-policy': 'same-origin' };
/** @param {Response} res */
function secure(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEC)) if (!r.headers.has(k)) r.headers.set(k, v);
  if (!r.headers.has('cache-control')) r.headers.set('cache-control', 'no-store');
  return r;
}

/* API requests counted per day (System -> Health compares them with the hosting plan's daily limit). One in ten requests
     adds ten to the day's counter, so the count costs one database call per ten requests; it never delays the answer. */
  const countReq = (env, wu) => { try { if ((deps.rand || Math.random)() >= 0.1) return; const d = new Date((deps.now || Date.now)()).toISOString().slice(0, 10), p = deps.store(env).seqN('req|' + d, 10).catch(() => {}); wu ? wu(p) : p; } catch {} };
  return async function handle(request, env, wu) { return secure(await serve(request, env, wu)); };
  /** @param {Request} request @param {any} env @param {any} wu */
  async function serve(request, env, wu) {
    countReq(env, wu);
    const url = new URL(request.url), path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
    let who = '';
    try {
      deps.validate?.(env);
      // a browser page on another site may not change anything here (the API is only called by our own pages; tools and
      // the scheduler send no Origin). Sign-in with a bearer token already stops cross-site forgery; this is a second lock.
      const origin = request.headers.get('origin');
      if (origin && request.method !== 'GET' && origin !== url.origin) throw new H(403, 'badOrigin');
      /** @type {any} */ let route = null; let params = {};
      for (const r of ROUTES) { if (r.m !== request.method) continue; const m = r.re.exec(path); if (m) { route = r; try { r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); } catch { throw new H(404, 'noRec'); } break; } }   // a broken %-code in the address: not found
      if (!route) throw new H(404, 'noRec');
      const now = deps.now || Date.now;
      const live = tracked(indexed(cached(deps.store(env))));
      const c = { env, req: request, url, params, D: live.D, B: deps.bucket(env), A: deps.auth(env), now, today: () => S.bakuToday(now()), user: /** @type {any} */ (null), me: /** @type {any} */ (null),
        body: () => readJson(request) };

      /* opts.mfa: 'skip' = do not demand the second factor (sign-in / two-factor set-up routes) */
      c.staffFromToken = async (token, opts = {}) => {
        if (!token) throw new H(401, 'auth');
        // the break-glass account has its own short token (two parts; Supabase tokens have three) and works only while its secret is set
        if (token.split('.').length === 2) {
          const p = await readTok(env, token), secret = String(env.EMERGENCY_PASSWORD || '');
          if (p.r !== 'emergency' || secret.length < 16 || !same(p.k || '', (await hmac(env.TOKEN_SECRET, 'em|' + secret)).slice(0, 12))) throw new H(401, 'auth');
          return { id: 'emergency', email: 'admin_emergency', role: 'emergency', kind: 'staff', mfa: false, aal: 'aal2', emergency: true };
        }
        const u = await c.A.user(token), settingsP = c.D.get('settings', 'main'); let s = await c.D.get('staff', u.id);   // both reads at once
        // BOOTSTRAP_ADMIN_EMAIL only works while the system has no superadmin at all (first run); after that it is ignored.
        const boot = String(env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
        if (boot && u.email?.toLowerCase() === boot && s?.role !== 'superadmin' && !(await c.D.all('staff')).some(r => r.data.role === 'superadmin')) {
          s = { ...(s || {}), email: u.email, role: 'superadmin' }; await c.D.put('staff', [{ id: u.id, data: s }]);
        }
        if (!s) throw new H(403, 'forbidden');
        // signed out (POST /staff/logout): that session's access token is refused although it has not expired yet
        if (u.sid && s.out?.[u.sid]) throw new H(401, 'auth');
        // time-limited accounts (e.g. an external auditor): refused after the last day
        if (s.expires && S.bakuToday(now()) > s.expires) throw new H(403, 'accountExpired');
        const user = { id: u.id, email: u.email || s.email, role: S.legacyRole(s.role), kind: 'staff', mfa: !!s.mfa, aal: u.aal, sid: u.sid || '', exp: u.exp || 0 };
        if (opts.mfa !== 'skip') {
          if (s.mfa && u.aal !== 'aal2') throw new H(401, 'mfaRequired');
          const pol = (await settingsP)?.mfa || 'off';
          if (!s.mfa && (pol === 'all' || (pol === 'admins' && S.RANK[user.role] >= S.RANK.admin))) throw new H(403, 'mfaSetup');
        }
        return user;
      };

      const auth = route.v.auth;
      if (auth === 'cron') {
        const k = String(env.CRON_SECRET || '');
        if (k.length < 16 || !same(request.headers.get('x-cron-key') || '', k)) throw new H(401, 'auth');
        c.user = { kind: 'system', name: 'scheduler', role: 'system' };
      } else if (auth === 'staff') {
        c.user = await c.staffFromToken(bearer(request), { mfa: route.v.mfa }); who = 'staff:' + (c.user?.email || c.user?.id || '');
        if (!S.can(c.user.role, route.v.act || 'view')) throw new H(403, 'forbidden');
        // an auditor's every page / record opened is written to the audit trail (the counter polls are not)
        // every change made with the emergency account is written to the audit trail, whatever the route
        if (c.user.emergency && request.method !== 'GET') await audit(c, 'emergency.action', path).catch(() => {});
        if (c.user.role === 'auditor' && request.method === 'GET' && path !== '/rev' && path !== '/notify') await audit(c, 'auditor.view', path + (url.search || '').replace(/[?&]?(token|key)=[^&]*/g, '')).catch(() => {});
      } else if (PORTAL_COL[auth]) {
        const t = await readTok(env, bearer(request));
        if (t.r !== auth) throw new H(401, 'auth');
        const [acc] = await Promise.all([c.D.get(PORTAL_COL[auth], t.id), c.D.get('settings', 'main').catch(() => null)]);   // settings: almost every route needs them; read alongside
        if (!acc || acc.on === false || (acc.pv || 0) !== (t.pv || 0)) throw new H(401, 'auth');
        // signed in with a generated password while the office requires people to choose their own: nothing but that step
        if (t.mp && path !== `/portal/${auth}/password` && path !== `/portal/${auth}/logout`) throw new H(403, 'needPassword');
        c.me = acc; c.user = { kind: auth, id: acc.id, name: S.fullEn(acc) || acc.name }; who = auth + ':' + acc.id;
        if (auth === 'company') c.user.name = acc.name;
        // a trainee registered by the office without ID/FIN or phone gives them at the first sign-in, before anything else
        if (auth === 'trainee' && (acc.temp || !acc.fin || !acc.phone) && !TRAINEE_OPEN.has(path)) throw new H(403, 'needProfile');
      }
      try { const out = await route.v.fn(c); return out instanceof Response ? out : J(out); }
      finally { await live.flush(); }                 // also after a failed request that already wrote something
    } catch (/** @type {any} */ e) {
      if (e instanceof H) return J({ error: e.message, ...(e.extra || {}) }, e.status);
      // unexpected failure: written to the error log (System -> Error log) with a reference the person can quote
      console.error(e);
      const ref = (request.headers.get('cf-ray') || '').split('-')[0] || Math.random().toString(36).slice(2, 10);
      try {
        const D = deps.store(env), at = new Date((deps.now || Date.now)()).toISOString();
        await D.put('errlog', [{ id: at + '-' + ref, data: { at, ref, method: request.method, path, who, msg: String(e?.message || e).slice(0, 300), stack: String(e?.stack || '').split('\n').slice(0, 6).join('\n').slice(0, 900), status: e?.status || 0, body: String(e?.body || '').slice(0, 300) } }]);
      } catch {}
      return J({ error: 'server', ref }, 500);
    }
  };
}
