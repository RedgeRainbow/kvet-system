/* Public routes (no sign-in), staff sign-in and portal sign-in. */
import { H, S, str, need, audit, getSettings, assetsOut, accredKeys, sigPassOk } from './core.js';
import { pbk, hmac, mkTok, loginKey, attempt, attemptOk, attemptBad, attemptKeys, same, rounds, PBK_MIN } from './auth.js';
import { checkCode } from './signs.js';

const ACCOUNT_COL = { trainer: 'trainers', trainee: 'trainees', company: 'companies' };

export const vh = async (env, no) => (await hmac(env.TOKEN_SECRET, 'verify|' + no)).slice(0, 12);

/* Break-glass sign-in "admin_emergency" (see shared.js ROLE_PLUS): only while the Cloudflare secret EMERGENCY_PASSWORD
   (at least 16 characters) is set. Same throttling as every sign-in; a 4-hour session; loudly logged. */
export const EMERGENCY_LOGIN = 'admin_emergency';
async function emergencyLogin(c, password, keys) {
  const secret = String(c.env.EMERGENCY_PASSWORD || ''), who = { name: EMERGENCY_LOGIN, role: 'emergency' };
  if (secret.length < 16 || !same(password, secret)) { await attemptBad(c, keys); await audit(c, 'login.fail', `${EMERGENCY_LOGIN} · ${secret.length < 16 ? 'emergency account not enabled' : 'wrong password'}`, { by: who }).catch(() => {}); throw new H(401, 'badLogin'); }
  await attemptOk(c, keys);
  const ip = c.req.headers.get('cf-connecting-ip') || '', at = new Date(c.now()).toISOString();
  const st = (await c.D.get('settings', 'main')) || {}; st.emergencyUses = [...(st.emergencyUses || []), { at, ip }].slice(-50); await c.D.put('settings', [{ id: 'main', data: st }]);
  await audit(c, 'login.emergency', `EMERGENCY ACCOUNT SIGNED IN${ip ? ' from ' + ip : ''}`, { by: who });
  return { access: await mkTok(c.env, { r: 'emergency', id: 'emergency', k: (await hmac(c.env.TOKEN_SECRET, 'em|' + secret)).slice(0, 12) }, 4 * 36e5), refresh: '', role: 'emergency', email: EMERGENCY_LOGIN };
}
/** @type {import('../../types/store').Routes} */
export const publicRoutes = {
  'GET /public/info': { auth: 'none', async fn(c) {
    const st = await getSettings(c.D), a = await assetsOut(c.D, st);
    return { name: st.company?.name || 'KVET', logo: a.logo };
  } },

  /* QR target. Shows ONLY: learner number, name and surname, training date, expiry date (+ validity). No FIN, no download. */
  'GET /verify': { auth: 'none', async fn(c) {
    const no = S.normCertNo(c.url.searchParams.get('n')), h = str(c.url.searchParams.get('h'), 20);
    need(no && h, 'noRec', 404);
    const cert = await c.D.get('certs', no);
    if (!cert || cert.vh !== h) {
      // a deleted (archived) certificate is reported as NOT VALID instead of "not found"
      const ar = await c.D.get('archive', no);
      if (ar?.cert?.vh === h) { const st = await getSettings(c.D); return { status: 'INVALID', no, info: { name: st.company?.name || 'KVET', logo: (await assetsOut(c.D, st)).logo } }; }
      throw new H(404, 'noRec');
    }
    // not approved yet: the QR page says so and shows nothing about the person
    if (!S.certDelivered(cert)) { const st0 = await getSettings(c.D); return { status: 'PENDING_APPROVAL', no: cert.no, info: { name: st0.company?.name || 'KVET', logo: (await assetsOut(c.D, st0)).logo } }; }
    const st = await getSettings(c.D), sib = (await c.D.byField('certs', 'tid', cert.tid)).map(r => r.data).filter(S.certDelivered);
    const me = S.annotateCerts(sib, S.bakuToday(c.now()), st.soonDays ?? S.SOON_DAYS).find(x => x.no === cert.no);
    return { status: me.st, no: cert.no, revokedAt: cert.revoked?.at || null, att: cert.snap.att, names: cert.snap.names, foreign: !!cert.snap.foreign, start: cert.start, end: cert.end, expiry: cert.expiry, sign: cert.sign ? { name: cert.sign.name, title: cert.sign.title || '', at: cert.sign.at, code: cert.sign.code, mode: cert.sign.mode || 'esign' } : null, info: { name: st.company?.name || 'KVET', logo: (await assetsOut(c.D, st)).logo } };
  } },

  /* checks a printed electronic-signature code */
  'GET /verify-sign': { auth: 'none', async fn(c) {
    // codes that do not exist are counted per address: 20 in 15 minutes, then that address waits (nobody mistypes that often)
    const ip = (c.req.headers.get('cf-connecting-ip') || '').trim(), k = ip ? 'vs:' + ip : '';
    if (k) { const u = await c.D.lockState(k); if (u) throw new H(429, 'locked', { until: new Date(u).toISOString() }); }
    const r = await checkCode(c, c.url.searchParams.get('c'));
    if (!r) { if (k) await c.D.lockFail(k, 20, 15 * 60).catch(() => {}); throw new H(404, 'noRec'); }
    const st = await getSettings(c.D); return { ...r, info: { name: st.company?.name || 'KVET', logo: (await assetsOut(c.D, st)).logo } };
  } },
  'GET /asset/:key': { auth: 'none', raw: true, async fn(c) {
    const n = c.params.key;
    if (!/^[a-f0-9]{16}\.png$/.test(n)) throw new H(404, 'noRec');
    // public: the logo and the accreditation logos in use. Everything else here is a signature or a stamp: office users only
    const st = await getSettings(c.D), open = n === st.logo || accredKeys(st).includes(n);
    if (!open && !(await sigPassOk(c, c.url.searchParams.get('s')))) throw new H(404, 'noRec');
    const o = await c.B.get('assets/' + n); if (!o) throw new H(404, 'noRec');
    return new Response(o.body, { headers: { 'content-type': 'image/png', 'cache-control': open ? 'public,max-age=31536000,immutable' : 'private,max-age=600' } });
  } },

  /* ---- staff sign-in (Supabase Auth behind the API). Every attempt lands in the audit trail. ---- */
  'POST /staff/login': { auth: 'none', async fn(c) {
    const b = await c.body(), email = str(b.email, 120).toLowerCase(), keys = attemptKeys(c, 'staff:' + email, { wide: email !== EMERGENCY_LOGIN }), who = { name: email || '?', role: 'staff' };
    try { await attempt(c, keys); } catch (/** @type {any} */ e) { await audit(c, 'login.locked', email, { by: who }).catch(() => {}); throw e; }
    if (email === EMERGENCY_LOGIN) return emergencyLogin(c, String(b.password || ''), keys);
    let t;
    try { t = await c.A.login(email, String(b.password || '')); } catch (/** @type {any} */ e) { await attemptBad(c, keys); await audit(c, 'login.fail', `${email} · wrong e-mail or password`, { by: who }).catch(() => {}); throw e; }
    await attemptOk(c, keys);
    let u; try { u = await c.staffFromToken(t.access, { mfa: 'skip' }); } catch (/** @type {any} */ e) { await audit(c, 'login.fail', `${email} · no staff role`, { by: who }).catch(() => {}); throw e; }
    if (u.mfa) {
      // second step: the code from the authenticator app (POST /staff/mfa/verify)
      const f = (await c.A.factors(t.access)).find(x => x.status === 'verified');
      if (f) { await audit(c, 'login.mfa', email, { by: { id: u.id, name: email, role: u.role } }).catch(() => {}); return { mfa: true, ticket: t.access, factorId: f.id, email: u.email }; }
      // marked "two-factor on" but the sign-in service holds no authenticator any more (removed there): without this the person
      // got a token every route refused. The mark is cleared; where two-factor is compulsory the set-up screen follows.
      const rec = await c.D.get('staff', u.id); if (rec?.mfa) { delete rec.mfa; await c.D.put('staff', [{ id: u.id, data: rec }]); await audit(c, 'mfa.missing', email, { by: { id: u.id, name: email, role: u.role } }).catch(() => {}); }
    }
    await audit(c, 'login.ok', email, { by: { id: u.id, name: email, role: u.role } }).catch(() => {});
    return { access: t.access, refresh: t.refresh, role: u.role, email: u.email };
  } },
  /* Two-factor sign-in, second step. Also throttled: a 6-digit code must not be guessable. */
  'POST /staff/mfa/verify': { auth: 'none', async fn(c) {
    const b = await c.body(), ticket = String(b.ticket || ''), u0 = await c.A.user(ticket), keys = attemptKeys(c, 'mfa:' + u0.id);
    await attempt(c, keys);
    let t; try { t = await c.A.verifyFactor(ticket, str(b.factorId, 80), str(b.code, 10)); } catch (/** @type {any} */ e) { await attemptBad(c, keys); await audit(c, 'login.fail', `${u0.email} · wrong two-factor code`, { by: { name: u0.email, role: 'staff' } }).catch(() => {}); throw e; }
    await attemptOk(c, keys);
    const u = await c.staffFromToken(t.access);
    await audit(c, 'login.ok', `${u.email} (2FA)`, { by: { id: u.id, name: u.email, role: u.role } }).catch(() => {});
    return { access: t.access, refresh: t.refresh, role: u.role, email: u.email };
  } },
  'POST /staff/refresh': { auth: 'none', async fn(c) {
    const b = await c.body(); const t = await c.A.refresh(String(b.refresh || ''));
    return { access: t.access, refresh: t.refresh };
  } },

  /* ---- trainer / trainee / company sign-in ----
     Accounts created before the login registry existed (or restored from an old backup) are found by their stored login and the registry is repaired. */
  'POST /login': { auth: 'none', async fn(c) {
    const b = await c.body(), role = str(b.role, 10), login = str(b.login, 60);
    need(ACCOUNT_COL[role] && login && b.password, 'badLogin', 401);
    const key = loginKey(role, login), keys = attemptKeys(c, key), who = { name: login, role };
    try { await attempt(c, keys); } catch (/** @type {any} */ e) { await audit(c, 'login.locked', `${role} ${login}`, { by: who }).catch(() => {}); throw e; }
    // the login registry is the only lookup: an unknown login never scans the accounts table (System -> "Repair login registry" rebuilds it)
    const col = ACCOUNT_COL[role], reg = await c.D.get('logins', key);
    const acc = (reg?.id && await c.D.get(col, reg.id)) || null;
    const why = !acc ? 'unknown login' : !acc.hash || !acc.salt ? 'no password set (reset it in Admin)' : acc.on === false ? 'account disabled' : '';
    const ok = !why && same(await pbk(String(b.password), acc.salt, acc.it), acc.hash);
    if (!ok) { await attemptBad(c, keys); await audit(c, 'login.fail', `${role} ${login} · ${why || 'wrong password'}`, { by: who }).catch(() => {}); throw new H(401, 'badLogin'); }
    await attemptOk(c, keys);
    await audit(c, 'login.ok', `${role} ${login}`, { by: { id: acc.id, name: login, role } }).catch(() => {});
    // stronger hashing configured since this password was stored: raised now, while the password is at hand
    const R = rounds(c.env);
    if (R > (Number(acc.it) || PBK_MIN)) try { acc.it = R; acc.hash = await pbk(String(b.password), acc.salt, R); await c.D.put(col, [{ id: acc.id, data: acc }]); } catch {}
    // settings.forcePw: a password the system generated (never changed by the person) only opens the "choose your own" step
    const mp = !!(await getSettings(c.D)).forcePw && !acc.pwAt;
    return { token: await mkTok(c.env, { r: role, id: acc.id, pv: acc.pv || 0, ...(mp ? { mp: 1 } : {}) }), role, ...(mp ? { mustPw: true } : {}) };
  } },
};
