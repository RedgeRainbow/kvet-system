/* Request context, responses, validation and shaping helpers shared by all route files. */
import { H } from './store.js';
import { rnd } from './auth.js';
import * as S from './shared.js';

export { H, S };
export const J = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...h } });
export const str = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
export const bool = v => v === true || v === 'true' || v === 1;
export const uid = p => p + Date.now().toString(36) + rnd(2);
/** a number within lo..hi, else the default (null when none is given)
 * @overload @param {any} v @param {number} lo @param {number} hi @returns {number | null} */
/** @overload @param {any} v @param {number} lo @param {number} hi @param {number} d @returns {number} */
/** @template T @overload @param {any} v @param {number} lo @param {number} hi @param {T} d @returns {number | T} */
/** @param {any} v @param {number} lo @param {number} hi @param {any} [d] */
export function num(v, lo, hi, d = null) { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; }
export const httpUrl = v => { const s = str(v, 500); if (!s) return ''; try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
export const enrId = (sid, tid) => `${sid}|${tid}`;
/** throws an H error unless cond holds (and tells the type checker that it holds afterwards)
 * @param {any} cond @param {string} [msg] @param {number} [status] @returns {asserts cond} */
export function need(cond, msg = 'badInput', status = 400) { if (!cond) throw new H(status, msg); }

/* ------------------------------------------------------------- audit trail
   One immutable row per action: when, who (id, name, role), IP, action, a short detail, the record it touched (entity) and, for edits, the changed fields (before -> after).
   Secrets (passwords, ID/FIN) are never written: a changed FIN is logged as "changed" only. */
const MASK = new Set(['fin', 'hash', 'salt', 'password']);
const short = v => { if (v === undefined || v === null || v === '') return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return s.length > 120 ? s.slice(0, 117) + '…' : s; };
export function diff(before, after, fields) {
  const out = [];
  for (const f of fields || Object.keys(after || {})) {
    const a = before?.[f], b = after?.[f];
    if (JSON.stringify(a ?? '') === JSON.stringify(b ?? '')) continue;
    out.push(MASK.has(f) ? { f, from: '', to: '(changed)' } : { f, from: short(a), to: short(b) });
  }
  return out.slice(0, 30);
}
/** @param {any} [c] @param {any} [action] @param {any} [detail] @param {any} [extra] */
function auditRow(c, action, detail = '', extra = {}) {
  const by = extra.by || (c.user ? { id: c.user.id, name: c.user.email || c.user.name || c.user.id, role: c.user.role || c.user.kind } : { name: 'system' });
  const at = new Date(c.now()).toISOString(), ip = c.req?.headers?.get?.('cf-connecting-ip') || c.req?.headers?.get?.('x-forwarded-for') || '';
  const row = { at, by, action, detail: String(detail).slice(0, 300) };
  if (ip) row.ip = String(ip).split(',')[0].trim().slice(0, 45);
  if (extra.entity) row.eid = String(extra.entity.id || '').slice(0, 100);       // indexed: a record's history without reading the trail
  if (extra.entity) row.entity = { kind: String(extra.entity.kind || '').slice(0, 20), id: String(extra.entity.id || '').slice(0, 100), label: String(extra.entity.label || '').slice(0, 120) };
  if (extra.changes?.length) row.changes = extra.changes;
  return { id: at + '-' + rnd(3), data: row };
}
/** @param {any} [c] @param {any} [action] @param {any} [detail] @param {any} [extra] */
export async function audit(c, action, detail = '', extra = {}) { await c.D.put('audit', [auditRow(c, action, detail, extra)]); }
/* several rows in ONE database call (roll call, closing an exam, …): items = [[action, detail], …]. One row per person is
   kept, as before; only the number of round trips changes. */
export async function auditMany(c, items) { if (items.length) await c.D.put('audit', items.map(([action, detail], i) => { const r = auditRow(c, action, detail); r.id += '-' + i; return r; })); }   // -i: the rows share one moment, their ids must not

/* -------------------------------------------------------------- settings */
export const getSettings = async D => (await D.get('settings', 'main')) || {};
/* Accreditation logos shown on the certificate until the admin uploads their own (Settings -> Accreditation logos). */
export const DEFAULT_ACCRED = [1, 2, 3, 4, 5, 6, 7].map(i => `default:${i}`);
export const accredKeys = st => (Array.isArray(st.accred) ? st.accred : DEFAULT_ACCRED);
export const assetUrl = k => (!k ? '' : String(k).startsWith('default:') ? `/img/accred/accred-${Number(String(k).slice(8))}.png` : '/api/asset/' + k);
export async function assetsOut(D, st) {
  const sigs = (await D.all('sigs')).map(r => r.data);
  const act = sigs.find(s => s.on);
  return { logo: assetUrl(st.logo), stamp: assetUrl(st.stamp), accred: accredKeys(st).map(assetUrl), sig: act ? { id: act.id, img: assetUrl(act.key) } : null, sigs: sigs.map(s => ({ ...s, img: assetUrl(s.key) })) };
}
/* For the candidate and company portals: the stamp only for somebody who holds a certificate, and only the signature
   images those certificates carry - not every signature the centre has ever used. (The images still reach the browser
   that draws the certificate; drawing certificates on the server would be the complete answer.) */
export const assetsFor = (a, sigIds) => { const ids = new Set(sigIds.filter(Boolean)); return { ...a, stamp: sigIds.length ? a.stamp : '', sig: null, sigs: a.sigs.filter(s => ids.has(s.id)).map(s => ({ id: s.id, img: s.img })) }; };
export const remindCfg = st => ({ on: !!st.remind?.on, days: (st.remind?.days || [90, 30]).filter(d => Number.isInteger(d) && d > 0 && d <= 365).slice(0, 4), toCompany: st.remind?.toCompany !== false, toTrainee: st.remind?.toTrainee !== false });
export const privacyCfg = st => ({ consentRequired: !!st.privacy?.consentRequired, finYears: Number.isInteger(st.privacy?.finYears) ? st.privacy.finYears : 0 });
export const publicSettings = st => ({ company: st.company || {}, num: S.numCfg(st), soonDays: st.soonDays ?? S.SOON_DAYS, showFather: !!st.showFather, dash: S.dashCfg(st),
  fbRequired: st.fbRequired !== false, certCompany: !!st.certCompany, mfa: st.mfa || 'off', forcePw: !!st.forcePw, remind: remindCfg(st), privacy: privacyCfg(st), approvals: S.approvalsCfg(st) });

/* ---------------------------------------------------------------- people */
export const stripSecret = ({ hash, salt, sk, ...x }) => x;          // sk: search key (search.js), never sent
export function traineeOut(x, withFin) {
  const o = stripSecret(x);
  if (!withFin) delete o.fin;
  // a "provisional" trainee was registered by the office without ID/FIN or phone; it is completed at the first sign-in
  o.provisional = !!x.temp || !x.fin || !x.phone;
  return o;
}
export const trainerOut = (x, withFin) => { const o = stripSecret(x); if (!withFin) delete o.fin; return o; };
/* Minimal person data for portals: never the ID/FIN, phone or e-mail. */
export const personLite = x => ({ id: x.id, att: x.att, name: x.name, surname: x.surname, father: x.father, nameEn: x.nameEn, surnameEn: x.surnameEn, fatherEn: x.fatherEn, foreign: !!x.foreign, co: x.co || '' });

/* --------------------------------------------------------------- sessions */
export async function enrOf(D, sid, tid) { return (await D.get('enr', enrId(sid, tid))) || { sid, tid }; }
export const saveEnr = (D, e) => D.put('enr', [{ id: enrId(e.sid, e.tid), data: e }]);
/* several enrolments in ONE database call (field-level, like saveEnr: see store.js FIELD_COLS) */
export const saveEnrs = async (D, list) => { if (list.length) await D.put('enr', list.map(e => ({ id: enrId(e.sid, e.tid), data: e }))); };
/* the enrolments of a session's candidates, read together (one query), in the order of the list */
export const enrsOfIds = (D, sid, tids) => Promise.all(tids.map(tid => enrOf(D, sid, tid)));
export async function enrsOfSession(D, s) {
  const rows = new Map((await D.prefix('enr', s.id + '|')).map(r => [r.data.tid, r.data]));
  return (s.traineeIds || []).map(tid => rows.get(tid) || { sid: s.id, tid });
}
export function statsOf(s, enrs) {
  const st = { total: (s.traineeIds || []).length, confirmed: 0, feedback: 0, evaluated: 0, practical: 0, finalized: 0, passed: 0, failed: 0 };
  for (const e of enrs) {
    if (e.att) st.confirmed++; if (e.fb) st.feedback++; if (e.ev) st.evaluated++;
    if (e.prac && e.prac.result !== 'INCOMPLETE') st.practical++;
    if (e.final) { st.finalized++; if (e.final.outcome === 'PASS') st.passed++; else st.failed++; }
  }
  return st;
}
/* ---------------------------------------------------------- reading at scale
   Lists never read whole growing collections: they read a window (recent sessions) or what a filter matches, and
   enrolments only for the sessions shown, with just the fields the lists need (no test answers). */
export const RECENT_DAYS = 120;                       // office start-up: sessions that started in the last 120 days or later
/* a calendar day in Baku (UTC+4, no summer time) as UTC moments: records store UTC times, people filter by Baku days */
export const bakuDayStart = d => new Date(Date.parse(d + 'T00:00:00+04:00')).toISOString();
export const bakuDayEnd = d => new Date(Date.parse(d + 'T00:00:00+04:00') + 864e5).toISOString();      // exclusive
export const daysBefore = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);
export const ENR_LITE = ['sid', 'tid', 'att', 'attBy', 'fb', 'ev', 'prac', 'final', 'absent', 'days', 'doh', 'exam'];
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
/* enrolments of the given sessions, grouped by session id */
export async function enrsFor(D, sids, fields = ENR_LITE) {
  const m = new Map(); if (!sids.length) return m;
  for (const e of await queryIn(D, 'enr', 'sid', sids, { fields })) { if (!m.has(e.sid)) m.set(e.sid, []); m.get(e.sid).push(e); }
  return m;
}
/* rows whose field is one of many values (chunked "in" queries, run in parallel) */
/** @param {any} D @param {string} col @param {string} field @param {any[]} values @param {{ fields?: string[], where?: any[] }} [o] */
export async function queryIn(D, col, field, values, { fields, where = /** @type {any[]} */ ([]) } = {}) {
  const u = [...new Set(values.filter(Boolean))]; if (!u.length) return [];
  // the field is always returned (callers group by it)
  const f = fields && !fields.includes(field) && field !== 'id' ? [...fields, field] : fields;
  const out = r => (field === 'id' && r.data && r.data.id === undefined ? { ...r.data, id: r.id } : r.data);
  if (!where.length && D.inList) return (await D.inList(col, field, u, f)).map(out);      // one call for any number of values
  const parts = await Promise.all(chunks(u, 60).map(v => D.query(col, { where: [[field, 'in', v], ...where], fields: f })));
  return parts.flatMap(p => p.rows.map(out));
}
/* records by id, many at once (missing ones left out) */
export async function getMany(D, col, ids) { const u = [...new Set(ids.filter(Boolean))]; const v = await Promise.all(u.map(id => D.get(col, id))); return new Map(/** @type {[string, any][]} */ (u.map((id, i) => [id, v[i]])).filter(([, x]) => x)); }
/* sessions that include a trainee (database index on the traineeIds array) */
export const sessionsOf = async (D, tid) => (await D.query('sessions', { where: [['traineeIds', 'has', tid]] })).rows.map(r => r.data);

/* All enrolments grouped by session id. Full scan: only for exports and maintenance, never for pages. */
export async function enrsBySession(D) {
  const m = new Map();
  for (const r of await D.all('enr')) { if (!m.has(r.data.sid)) m.set(r.data.sid, []); m.get(r.data.sid).push(r.data); }
  return m;
}
export const sessionRow = (s, enrs, today) => {
  const stats = statsOf(s, enrs || []);
  return { ...s, stats, status: S.sessionStatus(s, stats, today) };
};

/* ----------------------------------------------------------- certificates */
/* the certificate's own copy of everything printed on it. From the session: the training details (under the training name),
   the registration line (above "valid till") and the company line (setting / show / hide / custom text). */
/* Immutable public files (question pictures, logos): answered from Cloudflare's edge cache when they are there, so a class
   of 100 opening the same exam reads each picture from storage once per location, not 100 times. No signing per request. */
export async function edgeCached(req, make) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { try { const hit = await cache.match(req); if (hit) return hit; } catch {} }
  const res = await make(); if (cache && res.ok) { try { await cache.put(req, res.clone()); } catch {} }
  return res;
}
export function buildSnap({ trainee, company, trainer, blank, st, session = /** @type {any} */ (null) }) {
  const coMode = session?.coMode || (st.certCompany ? 'show' : 'hide');
  return {
    names: S.certNames(trainee, !!st.showFather), foreign: !!trainee.foreign, att: trainee.att,
    lang: trainee.foreign && trainee.certLang === 'en' ? 'en' : 'both', showCo: coMode === 'show', coMode, coText: session?.coText || '',
    company: company && !S.isPrivateCompany(company.name, company.id) ? company.name : '',
    trainer: trainer ? S.fullEn(trainer, false) : '',
    details: session?.certDetails || '', reg: session?.certReg || '',
    blank: { ...Object.fromEntries(['name', 'titleAz', 'titleEn', 'qualAz', 'qualEn', 'descAz', 'descEn', 'footAz', 'footEn', 'provider', 'credits'].map(k => [k, blank[k] ?? ''])), labels: S.cleanLabels(blank.labels) },
  };
}
export const certOut = c => ({ ...c });
