/* Searching and paging the collections that grow every year (trainees, certificates, old sessions).
   The database filters, counts and pages (store.query); a request reads only the rows it shows. */
import { H, S, str, num, need, getSettings, traineeOut, sessionRow, enrsFor, daysBefore, getMany, sessionsOf, bakuDayStart, bakuDayEnd } from './core.js';
import { certSt } from './search.js';

const EXPORT_MAX = 20000;
const canFin = c => S.can(c.user.role, 'fin.view');
export const strip = (c, t) => { const o = traineeOut(t, canFin(c)); if (c.user.role === 'auditor') { delete o.phone; delete o.email; delete o.login; } return o; };
const pageOf = q => ({ size: q.get('size') === null ? 50 : num(q.get('size'), 0, 500, 50), page: num(q.get('page'), 0, 1e6, 0) });
export const clean = x => { if (!x) return x; const { sk, exp, cox, ...o } = x; return o; };

/* trainees: free text (names, learner number), exact ID/FIN / phone / e-mail for those allowed, company, active */
export async function findTrainees(c, { q = '', co = '', on = '', size = 50, page = 0, from = '', to = '', type = '', sort = '', idsOnly = false } = {}) {
  const where = [], text = String(q).trim();
  // registered between two dates; type: temporary / foreign / local (registered with an Azerbaijani ID/FIN)
  if (S.isDate(from)) where.push(['createdAt', 'gte', bakuDayStart(from)]); if (S.isDate(to)) where.push(['createdAt', 'lt', bakuDayEnd(to)]);
  if (type === 'temp') where.push(['temp', 'eq', 'true']); else if (type === 'foreign') where.push(['foreign', 'eq', 'true']);
  else if (type === 'local') { where.push(['foreign', 'nn', 'true']); where.push(['temp', 'nn', 'true']); }
  const order = sort === 'old' ? ['createdAt', 'asc'] : sort === 'new' ? ['createdAt', 'desc'] : sort === 'name' ? ['surname', 'asc'] : ['id', 'desc'];
  // "select all that match": only the ids (at most 5000)
  if (idsOnly) {
    if (on === 'on') where.push(['on', 'nn', 'false']); else if (on === 'off') where.push(['on', 'eq', 'false']);
    if (co) where.push(co === '-' ? ['co', 'empty', true] : ['co', 'eq', co]);
    const r = await c.D.query('trainees', { where, search: text, limit: 5000, fields: ['id'] }); return { ids: r.rows.map(x => x.id) };
  }
  if (co) where.push(co === '-' ? ['co', 'empty', true] : ['co', 'eq', co]);
  if (on === 'on') where.push(['on', 'nn', 'false']); else if (on === 'off') where.push(['on', 'eq', 'false']);
  // exact identifiers first (only for staff who may see them)
  const exact = [];
  if (text && !/\s/.test(text) && canFin(c) && c.user.role !== 'auditor') {
    const fin = await c.D.get('fins', S.normFin(text)); if (fin?.id) exact.push(fin.id);
    const ph = S.normPhone(text); if (ph.replace(/\D/g, '').length >= 7) for (const r of (await c.D.query('trainees', { where: [['phone', 'eq', ph]], limit: 20 })).rows) exact.push(r.id);
    if (text.includes('@')) for (const r of (await c.D.query('trainees', { where: [['email', 'eq', text.toLowerCase()]], limit: 20 })).rows) exact.push(r.id);
  }
  const r = await c.D.query('trainees', { where, search: text, order, limit: size, offset: page * size, count: true });
  const ex = exact.length ? [...(await getMany(c.D, 'trainees', exact)).values()].filter(t => (!co || (co === '-' ? !t.co : t.co === co))) : [];
  const ids = new Set(ex.map(t => t.id)), list = [...ex, ...r.rows.map(x => x.data).filter(t => !ids.has(t.id))];
  if (on === 'on' || on === 'off') { const want = on === 'on'; for (let i = list.length - 1; i >= 0; i--) if ((list[i].on !== false) !== want) list.splice(i, 1); }
  return { list: list.map(t => strip(c, clean(t))), total: (r.total || 0) + ex.filter(t => !r.rows.some(x => x.id === t.id)).length };
}

/* certificates: status tab, training, company, issue period, expiring within N days, person, session, numbers */
async function certsQuery(c, p) {
  const st = await getSettings(c.D), today = c.today(), soon = st.soonDays ?? S.SOON_DAYS, soonDate = daysBefore(today, -soon);
  const base = [];
  if (p.bid) base.push(['bid', 'eq', p.bid]);
  if (p.co) base.push(['cox', 'eq', p.co]);
  if (p.tid) base.push(['tid', 'eq', p.tid]);
  if (p.sid) base.push(['sid', 'eq', p.sid]);
  if (p.nos?.length) base.push(['id', 'in', p.nos]);
  // waiting for a signature (superadmin / approver): not signed, not revoked, not waiting for / returned from approval
  if (p.unsigned) base.push(['sign', 'null', true], ['esign', 'null', true], ['revoked', 'null', true], ['approval.status', 'nn', 'pending'], ['approval.status', 'nn', 'returned']);
  if (p.issued) { const [a, z] = String(p.issued).split('..'); if (S.isDate(a)) base.push(['issuedAt', 'gte', bakuDayStart(a)]); if (S.isDate(z)) base.push(['issuedAt', 'lt', bakuDayEnd(z)]); base.push(['revoked', 'null', true]); }
  const live = [['revoked', 'null', true], ['renewed', 'null', true]];
  const ST = { REVOKED: [['revoked', 'null', false]], RENEWED: [['revoked', 'null', true], ['renewed', 'null', false]],
    EXPIRED: [...live, ['exp', 'lt', today]], SOON: [...live, ['exp', 'gte', today], ['exp', 'lte', soonDate]], ACTIVE: [...live, ['exp', 'gt', soonDate]] };
  const where = [...base, ...(ST[p.st] || []), ...(p.exp ? [...live, ['exp', 'gte', today], ['exp', 'lte', daysBefore(today, -Number(p.exp))]] : [])];
  const out = x => { const o = clean(x); o.st = certSt(x, today, soon); return o; };
  return { where, base, ST, out, today, soon };
}
export async function findCerts(c, p) {
  const { where, base, ST, out } = await certsQuery(c, p), search = p.q;
  const spec = { where, search, order: p.sort === 'expiry' ? ['exp', 'asc'] : ['issuedAt', 'desc'] };
  // Excel export of a filtered list: at most EXPORT_MAX rows in one go (narrow the filter for more)
  if (p.all && !p.tid && !p.sid && !p.nos?.length) { const n = (await c.D.query('certs', { ...spec, limit: 0, count: true })).total || 0; if (n > EXPORT_MAX) throw new H(413, 'tooMany', { n, max: EXPORT_MAX }); }
  const [res, ...counts] = await Promise.all([
    p.all ? c.D.query('certs', spec) : c.D.query('certs', { ...spec, limit: p.size, offset: p.page * p.size, count: true }),
    ...(p.counts ? ['ACTIVE', 'SOON', 'EXPIRED'].map(k => c.D.query('certs', { where: [...base, ...ST[k]], search, limit: 0, count: true }).then(r => r.total || 0)) : [])]);
  const k = p.counts ? { ACTIVE: counts[0], SOON: counts[1], EXPIRED: counts[2] } : null; if (k) k.total = k.ACTIVE + k.SOON + k.EXPIRED;
  return { certs: res.rows.map(r => out(r.data)), total: res.total ?? res.rows.length, counts: k };
}

/** @type {import('../../types/store').Routes} */
export const findRoutes = {
  'GET /trainees/find': { auth: 'staff', act: 'view', async fn(c) {
    const q = c.url.searchParams; return findTrainees(c, { q: str(q.get('q'), 100), co: str(q.get('co'), 60), on: str(q.get('on'), 3), from: str(q.get('from'), 10), to: str(q.get('to'), 10), type: str(q.get('type'), 10), sort: str(q.get('sort'), 6), idsOnly: q.get('ids') === '1', ...pageOf(q) });
  } },
  /* trainee records by id (names for lists that only hold ids: groups, requests, chips) */
  'POST /people': { auth: 'staff', act: 'view', async fn(c) {
    const b = await c.body(), ids = (Array.isArray(b.ids) ? b.ids : []).map(x => str(x, 40)).filter(Boolean).slice(0, 3000);
    return { list: [...(await getMany(c.D, 'trainees', ids)).values()].map(t => strip(c, clean(t))) };
  } },
  /* Excel import preview: which ID/FINs are already registered */
  'POST /fins/check': { auth: 'staff', act: 'trainee.import', async fn(c) {
    const b = await c.body(), fins = [...new Set((Array.isArray(b.fins) ? b.fins : []).map(f => S.normFin(f)).filter(Boolean))].slice(0, 5000);
    const owners = await getMany(c.D, 'fins', fins), people = await getMany(c.D, 'trainees', [...owners.values()].map(x => x.id));
    return { found: Object.fromEntries([...owners].map(([fin, o]) => [fin, people.get(o.id) ? strip(c, clean(people.get(o.id))) : { id: o.id }])) };
  } },
  /* one person's history: sessions and certificates */
  'GET /trainee/history': { auth: 'staff', act: 'view', async fn(c) {
    const id = str(c.url.searchParams.get('id'), 40), [sessions, certs] = await Promise.all([sessionsOf(c.D, id), findCerts(c, { tid: id, all: true })]);
    return { sessions: sessions.sort((a, b) => (a.date < b.date ? 1 : -1)).map(s => ({ id: s.id, date: s.date, bid: s.bid, cancelled: !!s.cancelled })), certs: certs.certs };
  } },
  'GET /certs': { auth: 'staff', act: 'view', async fn(c) {
    const q = c.url.searchParams, nos = str(q.get('nos'), 4000);
    return findCerts(c, { st: str(q.get('st'), 10), bid: str(q.get('bid'), 60), co: str(q.get('co'), 60), q: str(q.get('q'), 100), issued: str(q.get('issued'), 30), exp: num(q.get('exp'), 0, 3650, 0) || 0,
      tid: str(q.get('tid'), 40), sid: str(q.get('sid'), 60), nos: nos ? nos.split(',').map(S.normCertNo).filter(Boolean).slice(0, 500) : [], all: q.get('all') === '1', counts: q.get('counts') !== '0', unsigned: q.get('unsigned') === '1', sort: q.get('sort') === 'expiry' ? 'expiry' : '', ...pageOf(q) });
  } },
  /* sessions outside the start-up window (GET /state has the recent ones): by period, training, trainer */
  'GET /sessions/find': { auth: 'staff', act: 'view', async fn(c) {
    const q = c.url.searchParams, from = str(q.get('from'), 10), to = str(q.get('to'), 10), today = c.today(), where = [];
    need(S.isDate(from) || S.isDate(to), 'badInput');
    if (S.isDate(from)) where.push(['date', 'gte', from]); if (S.isDate(to)) where.push(['date', 'lte', to]);
    if (q.get('bid')) where.push(['bid', 'eq', str(q.get('bid'), 60)]); if (q.get('tid')) where.push(['tid', 'eq', str(q.get('tid'), 60)]);
    const rows = (await c.D.query('sessions', { where, order: ['date', 'desc'], limit: 1000, count: true }));
    const by = await enrsFor(c.D, rows.rows.map(r => r.id));
    return { sessions: rows.rows.map(r => sessionRow(r.data, by.get(r.id), today)), total: rows.total };
  } },
  /* how many sessions use each template / sheet / presentation / test (library pages) */
  'GET /usage': { auth: 'staff', act: 'view', async fn(c) {
    const { rows } = await c.D.query('sessions', { fields: ['bid', 'sheetId', 'materials', 'examId', 'examMode'] }), u = { blanks: {}, sheets: {}, materials: {}, tests: {} };
    const inc = (m, k) => { if (k) m[k] = (m[k] || 0) + 1; };
    for (const { data: s } of rows) { inc(u.blanks, s.bid); inc(u.sheets, s.sheetId); for (const m of s.materials || []) inc(u.materials, m); if (s.examMode === 'bank') inc(u.tests, s.examId); }
    return u;
  } },
};
