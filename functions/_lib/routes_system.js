/* Staff routes: bootstrap state, settings, uploads, numbering, users, backups, audit log, cameras, deletes, starter templates. */
import { H, S, J, str, num, need, bool, uid, audit, getSettings, assetsOut, publicSettings, traineeOut, trainerOut, stripSecret, sessionRow, enrsFor, daysBefore, RECENT_DAYS, queryIn, diff, accredKeys } from './core.js';
import { reindex, SK_VERSION } from './search.js';
import { rnd, seal, unseal, loginKey } from './auth.js';
import { runReminders, runRetention } from './jobs.js';
import { KINDS, loadWorld, loadWorldFor, newPlan, runKind, impact, total, applyPlan, restoreFromArchive } from './deletion.js';
import { SEED_BLANKS, SEED_SHEETS } from './seed.js';
import { suggestNo } from './routes_training.js';
import { notify } from './routes_notify.js';

export const DCOLS = ['blanks', 'sheets', 'tests', 'groups', 'kb', 'materials', 'companies', 'trainers', 'trainees', 'sessions', 'enr', 'rel', 'signs', 'certs', 'archive', 'retired', 'fins', 'logins', 'requests', 'candreq', 'libdocs', 'cogroups', 'notes', 'nseen', 'threads', 'msgs', 'links', 'settings', 'sigs', 'cams', 'snaps', 'audit'];
/* A restore replaces everything EXCEPT the audit trail (and staff accounts, which live in Supabase Auth): the trail of who did what is never rewritten. */
export const RESTORE_COLS = DCOLS.filter(k => k !== 'audit');

/* Rebuilds the login registry (col "logins") from the accounts themselves. Run after a restore and from System. */
async function rebuildLogins(c) {
  let n = 0; const rows = [];
  for (const [role, col] of [['trainer', 'trainers'], ['trainee', 'trainees'], ['company', 'companies']])
    for (const { data: x } of await c.D.all(col)) if (x.login) { rows.push({ id: loginKey(role, x.login), data: { login: x.login, id: x.id } }); n++; }
  await c.D.put('logins', rows); return n;
}

async function dump(c) {
  const cols = {}; for (const k of DCOLS) cols[k] = await c.D.all(k);
  return { v: 2, at: new Date(c.now()).toISOString(), cols, counters: await c.D.counters() };
}
async function makeBackup(c, tag = '') {
  const key = `backups/kvet-${new Date(c.now()).toISOString().replace(/[:.]/g, '-')}${tag}.json`;
  await c.B.put(key, JSON.stringify(await dump(c)), { httpMetadata: { contentType: 'application/json' } }); return key;
}
const listBackups = async c => (await c.B.list({ prefix: 'backups/', limit: 1000 })).objects.map(o => ({ key: o.key, size: o.size, at: o.uploaded })).sort((a, b) => (a.key < b.key ? 1 : -1));
const goodKey = k => /^backups\/[\w.-]+\.json$/.test(k || '');
const png = buf => { const b = new Uint8Array(buf.slice(0, 4)); return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47; };
const jpg = buf => { const b = new Uint8Array(buf.slice(0, 3)); return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; };

/* ---------------------------------------------------------- purge filters */
const PURGE = {
  sessions: (w, before) => w.sessions.filter(x => !before || (x.date || '') < before).map(x => ['session', x.id]),
  certs: (w, before) => w.certs.filter(x => !before || (x.issuedAt || '').slice(0, 10) < before).map(x => ['cert', x.no]),
  trainees: (w, before) => w.trainees.filter(x => !before || (x.createdAt || '').slice(0, 10) < before).map(x => ['trainee', x.id]),
  trainers: (w, before) => w.trainers.filter(x => !before || (x.createdAt || '').slice(0, 10) < before).map(x => ['trainer', x.id]),
  companies: (w, before) => w.companies.filter(x => !before || (x.createdAt || '').slice(0, 10) < before).map(x => ['company', x.id]),
  blanks: (w, before) => w.blanks.filter(x => !before || (x.createdAt || '').slice(0, 10) < before).map(x => ['blank', x.id]),
  sheets: (w, before) => w.sheets.filter(x => !before || (x.createdAt || '').slice(0, 10) < before).map(x => ['sheet', x.id]),
  materials: (w, before) => w.materials.filter(x => !before || (x.at || '').slice(0, 10) < before).map(x => ['material', x.id]),
};
const PURGE_KEYS = [...Object.keys(PURGE), 'archive', 'snaps'];

/* Groups audit actions for the filter chips. */
export function auditCat(a) {
  a = String(a || '');
  if (/^(login|logout)/.test(a)) return 'auth';
  if (/^(delete|purge|archive|cert\.restore\.archive|backup\.delete|user\.delete|camera\.(delete|clear))/.test(a)) return 'delete';
  if (/^(cert|release|issue)/.test(a)) return 'cert';
  if (/^(trainee|trainer|company|credentials)/.test(a)) return 'people';
  if (/^(session|attendance|enr|practical|exam|feedback|trainer\.evaluate|material|blank|sheet)/.test(a)) return 'training';
  return 'system';
}

/* external auditors read records but not people's contact details (phone, e-mail, logins) */
function people(role, companies, trainers, trainees) {
  if (role !== 'auditor') return { companies, trainers, trainees };
  const strip = ({ phone, email, login, contactPerson, ...x }) => x;
  return { companies: companies.map(strip), trainers: trainers.map(strip), trainees: trainees.map(strip) };
}
/* Requests page: besides the companies' training requests, the candidates companies sent for registration and the
   candidates trainers added themselves (last 180 days). */
async function otherRequests(c) {
  const fin = S.can(c.user.role, 'fin.view'), since = new Date(c.now() - 180 * 864e5).toISOString();
  // open requests whatever their age + everything from the last 180 days (the history stays in the database)
  const [pend, recent, trainersAdded] = await Promise.all([c.D.query('candreq', { where: [['status', 'eq', 'pending']] }), c.D.query('candreq', { where: [['at', 'gte', since]] }),
    c.D.query('trainees', { where: [['createdAt', 'gte', since], ['createdBy.kind', 'eq', 'trainer']] })]);
  const seen = new Set(), cand = [...pend.rows, ...recent.rows].map(r => r.data).filter(x => !seen.has(x.id) && seen.add(x.id));
  const candidates = cand.map(x => ({ ...x, person: { ...x.person, fin: fin ? x.person.fin : '' } })).sort((a, b) => b.at.localeCompare(a.at));
  const byTrainers = trainersAdded.rows.map(r => r.data).filter(t => t.createdBy?.kind === 'trainer' && (t.createdAt || '') >= since)
    .map(t => ({ id: t.id, att: t.att, name: S.fullAz(t), co: t.co || '', by: t.createdBy.name, at: t.createdAt })).sort((a, b) => b.at.localeCompare(a.at));
  return { candidates, byTrainers };
}
/* company training requests: open ones (new / planned) whatever their age + the last 12 months */
async function recentRequests(c) {
  const since = new Date(c.now() - 365 * 864e5).toISOString();
  const [open, recent] = await Promise.all([c.D.query('requests', { where: [['status', 'in', ['new', 'planned']]] }), c.D.query('requests', { where: [['at', 'gte', since]] })]);
  const seen = new Set(); return [...open.rows, ...recent.rows].map(r => r.data).filter(x => !seen.has(x.id) && seen.add(x.id)).sort((a, b) => (a.at < b.at ? 1 : -1));
}
/* the signed-in staff member's own record; accounts created directly in Supabase may not have one yet */
const ownStaff = async c => (await c.D.get('staff', c.user.id)) || { email: c.user.email || '', role: c.user.role || '' };

/** @type {import('../../types/store').Routes} */
export const systemRoutes = {
  /* ------------------------------------------------------------ bootstrap */
  'GET /state': { auth: 'staff', act: 'state', async fn(c) {
    const fin = S.can(c.user.role, 'fin.view'), today = c.today(), st = await getSettings(c.D);
    if (!S.can(c.user.role, 'view')) { const me = (await c.D.get('staff', c.user.id)) || /** @type {import('../../types/records').StaffRecord} */ ({}); return { role: c.user.role, me: { id: c.user.id, email: c.user.email, name: me.name || '', title: me.title || '' }, today, settings: publicSettings(st), assets: await assetsOut(c.D, st), blanks: [], sheets: [], materials: [], tests: [], groups: [], companies: [], trainers: [], trainees: [], sessions: [] }; }
    // records saved before the search key existed get it once (see search.js)
    if (st.skV !== SK_VERSION) { await reindex(c.D); const s2 = await getSettings(c.D); s2.skV = SK_VERSION; await c.D.put('settings', [{ id: 'main', data: s2 }]); }
    // Library and people directories are small and sent whole. Trainees and certificates are not (they grow every year):
    // pages search them on the server. Sessions: the recent window only (older ones: GET /sessions/find).
    const rows = async col => (await c.D.all(col)).map(r => r.data), since = daysBefore(today, RECENT_DAYS);
    /** @type {any[]} */
    const [blanks, sheets, materials, companies, trainers, sessions, tests, groups, nTrainees, nCerts, nSessions] = await Promise.all([...['blanks', 'sheets', 'materials', 'companies', 'trainers'].map(rows),
      c.D.query('sessions', { where: [['date', 'gte', since]] }).then(r => r.rows.map(x => x.data)), rows('tests'), rows('groups'),
      ...['trainees', 'certs', 'sessions'].map(k => c.D.query(k, { limit: 0, count: true }).then(r => r.total))]);
    const by = await enrsFor(c.D, sessions.map(s => s.id)), trainees = [];
    const me = (await c.D.get('staff', c.user.id)) || /** @type {import('../../types/records').StaffRecord} */ ({});
    const emergency = c.user.role === 'superadmin' ? (st.emergencyUses || []).filter(u => u.at > (st.emergencyAck || '')) : c.user.emergency ? true : undefined;
    return { role: c.user.role, emergency, me: { id: c.user.id, email: c.user.email, name: me.name || '', title: me.title || '', sigImg: me.sigKey ? '/api/asset/' + me.sigKey : '' }, today, settings: publicSettings(st), assets: await assetsOut(c.D, st),
      blanks, sheets, materials,
      // auditors and approvers read the training section: test names only (no questions or answer keys), no groups
      tests: S.can(c.user.role, 'library') ? tests : tests.map(({ questions, proposal, ...x }) => ({ ...x, questions: [], nQuestions: (questions || []).length })),
      groups: S.can(c.user.role, 'library') ? groups : [], ...people(c.user.role, companies.map(stripSecret), trainers.map(t => trainerOut(t, fin)), trainees.map(t => traineeOut(t, fin))),
      sessions: sessions.map(s => sessionRow(s, by.get(s.id), today)).sort((a, b) => (a.date < b.date ? 1 : -1)), sessionsSince: since, counts: { trainees: nTrainees, certs: nCerts, sessions: nSessions } };
  } },

  /* -------------------------------------------------------------- settings */
  'POST /settings/save': { auth: 'staff', act: 'settings.save', async fn(c) {
    const b = await c.body(), st = await getSettings(c.D), was = JSON.parse(JSON.stringify(st));
    if (b.company) st.company = { name: str(b.company.name, 120), nameEn: str(b.company.nameEn, 120), phone: str(b.company.phone, 60), email: str(b.company.email, 120), website: str(b.company.website, 120), address: str(b.company.address, 250), director: str(b.company.director, 120), directorTitle: str(b.company.directorTitle, 120) };
    if (b.num) {
      const n = b.num, cur = S.numCfg(st);
      st.num = { prefix: str(n.prefix, 12).toUpperCase().replace(/[^A-Z0-9]/g, '') || cur.prefix, sep: ['/', '-', '.', ''].includes(n.sep) ? n.sep : cur.sep, yearFmt: n.yearFmt === 'YYYY' ? 'YYYY' : 'YY', pad: num(n.pad, 1, 8, cur.pad), start: num(n.start, 1, 99999999, cur.start) };
    }
    if (b.soonDays !== undefined) st.soonDays = num(b.soonDays, 1, 365, S.SOON_DAYS);
    if (b.showFather !== undefined) st.showFather = bool(b.showFather);
    if (b.dash) {
      const d = b.dash, cur = S.dashCfg(st);
      st.dash = { expDays: num(d.expDays, 1, 730, cur.expDays), tiles: Array.isArray(d.tiles) ? [...new Set(d.tiles)].filter(k => S.DASH_TILES.includes(k)) : cur.tiles, top: [5, 8, 10, 15, 20].includes(Number(d.top)) ? Number(d.top) : cur.top, period: ['month', 'lastMonth', 'year'].includes(d.period) ? d.period : cur.period };
    }
    if (b.fbRequired !== undefined) st.fbRequired = bool(b.fbRequired);
    if (b.certCompany !== undefined) st.certCompany = bool(b.certCompany);
    if (b.mfa !== undefined) { need(S.can(c.user.role, 'users'), 'forbidden', 403); st.mfa = ['off', 'admins', 'all'].includes(b.mfa) ? b.mfa : 'off'; }
    if (b.remind) { const r = b.remind; st.remind = { on: bool(r.on), days: [...new Set((r.days || []).map(Number))].filter(d => Number.isInteger(d) && d > 0 && d <= 365).sort((a, z) => z - a).slice(0, 4), toCompany: r.toCompany !== false, toTrainee: r.toTrainee !== false }; }
    if (b.approvals) { need(S.can(c.user.role, 'users'), 'forbidden', 403); st.approvals = S.approvalsCfg({ approvals: b.approvals }); }   // superadmin decides what needs approval
    if (b.privacy) st.privacy = { consentRequired: bool(b.privacy.consentRequired), finYears: num(b.privacy.finYears, 0, 50, 0) };
    await c.D.put('settings', [{ id: 'main', data: st }]);
    await audit(c, 'settings.save', '', { entity: { kind: 'settings', id: 'main', label: 'Settings' }, changes: [...diff(was.company, st.company, Object.keys(st.company || {})), ...diff(was.num, st.num, Object.keys(st.num || {})), ...diff({ soonDays: was.soonDays, showFather: was.showFather, dash: was.dash, fbRequired: was.fbRequired, certCompany: was.certCompany, mfa: was.mfa, remind: was.remind, privacy: was.privacy }, { soonDays: st.soonDays, showFather: st.showFather, dash: st.dash, fbRequired: st.fbRequired, certCompany: st.certCompany, mfa: st.mfa, remind: st.remind, privacy: st.privacy })] });
    return { settings: publicSettings(st) };
  } },
  'POST /numbering/set': { auth: 'staff', act: 'settings.save', async fn(c) {
    const b = await c.body(), st = await getSettings(c.D), cfg = S.numCfg(st);
    const prefix = str(b.prefix, 12).toUpperCase().replace(/[^A-Z0-9]/g, '') || cfg.prefix, year = num(b.year, 2000, 2200), next = num(b.next, 1, 99999999);
    need(year && next, 'badInput');
    await c.D.setCounters([{ name: S.certCounterName(cfg, prefix, year), val: next - 1 }]); await audit(c, 'numbering.set', `${prefix} ${year} next=${next}`);
    return { next: (await suggestNo(c, st, prefix, year)).no };
  } },
  'POST /upload': { auth: 'staff', act: 'settings.save', raw: true, async fn(c) {
    const kind = c.url.searchParams.get('kind') || ''; need(['logo', 'accred', 'sig', 'stamp'].includes(kind), 'badInput');
    const buf = await c.req.arrayBuffer(); need(buf.byteLength && buf.byteLength <= 3e6 && png(buf), 'badFile');
    const key = rnd(8) + '.png'; await c.B.put('assets/' + key, buf, { httpMetadata: { contentType: 'image/png' } });
    if (kind === 'sig') {
      for (const x of await c.D.all('sigs')) if (x.data.on) { x.data.on = false; await c.D.put('sigs', [x]); }
      const id = 'g' + Date.now(); await c.D.put('sigs', [{ id, data: { id, key, at: new Date(c.now()).toISOString(), on: true } }]);
    } else { const st = await getSettings(c.D); if (kind === 'accred') st.accred = [...accredKeys(st), key]; else st[kind] = key; await c.D.put('settings', [{ id: 'main', data: st }]); }
    await audit(c, 'upload', kind); return J({ ok: 1, assets: await assetsOut(c.D, await getSettings(c.D)) });
  } },
  'POST /asset/remove': { auth: 'staff', act: 'settings.save', async fn(c) {
    const b = await c.body(), st = await getSettings(c.D);
    if (b.kind === 'accredDefault') delete st.accred;          // back to the seven logos of the sample certificate
    else if (b.kind === 'accred') { st.accred = [...accredKeys(st)]; st.accred.splice(Number(b.i), 1); }
    else if (b.kind === 'accredMove') { st.accred = [...accredKeys(st)]; const i = Number(b.i), j = i + (Number(b.dir) < 0 ? -1 : 1); if (st.accred[i] && st.accred[j]) [st.accred[i], st.accred[j]] = [st.accred[j], st.accred[i]]; } else if (b.kind === 'logo' || b.kind === 'stamp') delete st[b.kind]; else throw new H(400, 'badInput');
    await c.D.put('settings', [{ id: 'main', data: st }]); await audit(c, 'asset.remove', b.kind); return { assets: await assetsOut(c.D, st) };
  } },

  /* ---------------------------------------------------------------- seed */
  'POST /seed': { auth: 'staff', act: 'seed', async fn(c) {
    let added = 0; const b = await c.body();
    for (const s of SEED_SHEETS) if (bool(b.refresh) && await c.D.get('sheets', s.id)) { const old = await c.D.get('sheets', s.id); await c.D.put('sheets', [{ id: s.id, data: { ...s, createdAt: old?.createdAt || new Date(c.now()).toISOString() } }]); added++; } else if (!(await c.D.get('sheets', s.id))) { await c.D.put('sheets', [{ id: s.id, data: { ...s, createdAt: new Date(c.now()).toISOString() } }]); added++; }
    for (const b of SEED_BLANKS) if (!(await c.D.get('blanks', b.id))) { await c.D.put('blanks', [{ id: b.id, data: { ...b, createdAt: new Date(c.now()).toISOString() } }]); added++; }
    await audit(c, 'seed', String(added)); return { added };
  } },

  /* -------------------------------------------------------------- deletes
     { kind, id, dry } -> dry: only the impact numbers; otherwise the cascade described in deletion.js is applied. Certificates go to the archive. */
  'POST /delete': { auth: 'staff', act: 'delete', async fn(c) {
    const b = await c.body(), kind = str(b.kind, 20), id = kind === 'cert' ? S.normCertNo(str(b.id, 100)) : str(b.id, 100); need(KINDS.includes(kind) && id, 'badInput');
    const w = await loadWorldFor(c, kind, id), P = newPlan(c, w); runKind(P, kind, id); const imp = impact(P);
    if (bool(b.dry)) return { impact: imp, total: total(imp) };
    need(total(imp) > 0, 'noRec', 404);
    const label = { session: () => w.sById.get(id) && `${w.sById.get(id).date} ${w.blanks.find(x => x.id === w.sById.get(id).bid)?.name || ''}`, trainee: () => { const x = w.tById.get(id); return x && `${x.att} ${S.fullAz(x)}`; }, trainer: () => { const x = w.trainers.find(k => k.id === id); return x && S.fullAz(x); },
      company: () => w.companies.find(k => k.id === id)?.name, blank: () => w.blanks.find(k => k.id === id)?.name, sheet: () => w.sheets.find(k => k.id === id)?.name, material: () => w.materials.find(k => k.id === id)?.title, cert: () => id }[kind]?.() || id;
    await applyPlan(c, P);
    await audit(c, 'delete.' + kind, `${label}${imp.certs ? ` · ${imp.certs} certificate(s) archived` : ''}`, { entity: { kind, id, label: String(label) }, changes: Object.entries(imp).filter(([, v]) => v).map(([f, v]) => ({ f, from: '', to: String(v) })) });
    return { ok: 1, impact: imp };
  } },

  /* Batch delete (People pages: select, or "select all that match the filter", then delete): { kind, ids, dry, confirm:'DELETE' }.
     One plan for all of them: the same cascade and certificate archiving as a single delete. More than 20: a backup is taken first. */
  'POST /delete/many': { auth: 'staff', act: 'delete', async fn(c) {
    const b = await c.body(), kind = str(b.kind, 20), ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(x => str(x, 100)).filter(Boolean))].slice(0, 5000);
    need(['trainee', 'trainer', 'company', 'session', 'blank', 'sheet', 'material'].includes(kind) && ids.length, 'badInput');
    const w = await loadWorld(c), P = newPlan(c, w); for (const id of ids) runKind(P, kind, id); const imp = impact(P);
    if (bool(b.dry)) return { impact: imp, total: total(imp) };
    need(b.confirm === 'DELETE', 'badInput'); need(total(imp) > 0, 'noRec', 404);
    const backup = ids.length > 20 ? await makeBackup(c, '-before-batch-delete') : null;
    await applyPlan(c, P);
    await audit(c, 'delete.many.' + kind, `${ids.length} ${kind}(s)${imp.certs ? ` · ${imp.certs} certificate(s) archived` : ''}`, { changes: Object.entries(imp).filter(([, v]) => v).map(([f, v]) => ({ f, from: '', to: String(v) })) });
    return { ok: 1, impact: imp, backup: backup || null };
  } },
  /* Bulk "delete old data": { kinds:[...], before:'YYYY-MM-DD' (optional), dry, confirm:'DELETE' }. Takes a backup first. */
  'POST /purge': { auth: 'staff', act: 'delete', async fn(c) {
    const b = await c.body(), kinds = [...new Set((b.kinds || []).map(x => str(x, 20)))].filter(k => PURGE_KEYS.includes(k)), before = str(b.before, 10);
    need(kinds.length && (!before || S.isDate(before)), 'badInput');
    const w = await loadWorld(c), P = newPlan(c, w);
    for (const k of kinds) if (PURGE[k]) for (const [kind, id] of PURGE[k](w, before)) runKind(P, kind, id);
    let archiveCount = 0, archiveIds = [];
    if (kinds.includes('archive')) { archiveIds = (await c.D.all('archive')).filter(r => !before || (r.data.cert?.issuedAt || '').slice(0, 10) < before).map(r => r.id); archiveCount = archiveIds.length; }
    const snaps = kinds.includes('snaps') ? await c.D.all('snaps') : [];
    const imp = { ...impact(P), archive: archiveCount, snaps: snaps.length };
    if (bool(b.dry)) return { impact: imp, total: total(imp) + archiveCount + snaps.length };
    need(b.confirm === 'DELETE', 'badInput');
    const backup = await makeBackup(c, '-before-purge');
    await applyPlan(c, P);
    // erase the archive last, so certificates archived by this very purge can be erased too when "archive" is ticked without a date limit
    if (kinds.includes('archive')) { const ids = before ? archiveIds : (await c.D.all('archive')).map(r => r.id); await c.D.delMany('archive', ids); imp.archive = ids.length; }
    for (const r of snaps) { await c.B.delete(r.data.key).catch(() => {}); } if (snaps.length) await c.D.delMany('snaps', snaps.map(r => r.id));
    await audit(c, 'purge', `${kinds.join(',')}${before ? ' before ' + before : ' (all)'} · backup ${backup}`, { entity: { kind: 'purge', id: backup, label: kinds.join(', ') }, changes: Object.entries(imp).filter(([, v]) => v).map(([f, v]) => ({ f, from: '', to: String(v) })) });
    return { ok: 1, impact: imp, backup };
  } },

  /* ------------------------------------------------------------- archive (deleted certificates) */
  'GET /archive': { auth: 'staff', act: 'archive', async fn(c) {
    return { list: (await c.D.all('archive')).map(r => ({ no: r.id, ...r.data })).sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1)) };
  } },
  'POST /archive/restore': { auth: 'staff', act: 'archive', async fn(c) {
    const no = S.normCertNo((await c.body()).no); let x;
    try { x = await restoreFromArchive(c, no); } catch (/** @type {any} */ e) { if (e instanceof H && e.message === 'dup') throw new H(409, 'dupCert'); throw e; }
    need(x, 'noRec', 404); await audit(c, 'cert.restore.archive', no, { entity: { kind: 'cert', id: no, label: no } }); return { cert: x };
  } },
  'POST /archive/delete': { auth: 'staff', act: 'archive', async fn(c) {
    const b = await c.body(), nos = (b.all ? (await c.D.all('archive')).map(r => r.id) : [S.normCertNo(b.no)]).filter(Boolean);
    need(nos.length, 'noRec', 404); await c.D.delMany('archive', nos);
    await audit(c, 'archive.delete', b.all ? `all (${nos.length})` : nos[0], { entity: { kind: 'cert', id: nos[0], label: nos.length > 1 ? `${nos.length} certificates` : nos[0] } }); return { removed: nos.length };
  } },

  /* the superadmin has seen the emergency sign-in warning */
  'POST /emergency/ack': { auth: 'staff', act: 'delete', async fn(c) { const st = await getSettings(c.D); st.emergencyAck = new Date(c.now()).toISOString(); await c.D.put('settings', [{ id: 'main', data: st }]); await audit(c, 'emergency.ack', ''); return { ok: 1 }; } },
  /* ---------------------------------------------------------------- users */
  'GET /users': { auth: 'staff', act: 'users', async fn(c) { return { today: c.today(), list: (await c.D.all('staff')).filter(x => x.id !== 'emergency').map(x => ({ id: x.id, ...x.data, role: S.legacyRole(x.data.role), mfa: !!x.data.mfa })) }; } },
  'POST /users': { auth: 'staff', act: 'users', async fn(c) {
    const b = await c.body(), email = str(b.email, 120).toLowerCase();
    need(S.goodEmail(email) && email && String(b.password || '').length >= 8 && S.RANK[b.role] && S.ASSIGNABLE(b.role), 'badInput');
    const expires = S.isDate(b.expires) ? b.expires : '';
    need(!expires || expires >= c.today(), 'badExpiry');                 // an end date in the past would lock the account at once
    const taken = (await c.D.all('staff')).find(r => String(r.data.email || '').toLowerCase() === email); need(!taken, 'userExists', 409);
    const u = await c.A.createUser(email, b.password); await c.D.put('staff', [{ id: u.id, data: { email, role: b.role, name: str(b.name, 120), title: str(b.title, 120), ...(expires ? { expires } : {}) } }]);
    await audit(c, 'user.create', `${email} ${b.role}${expires ? ' until ' + expires : ''}${u.reused ? ' (existing sign-in account linked)' : ''}`); return { ok: 1, reused: !!u.reused };
  } },
  'POST /users/update': { auth: 'staff', act: 'users', async fn(c) {
    const b = await c.body(), x = await c.D.get('staff', str(b.id, 80)); need(x, 'noRec', 404);
    if (b.role) { need(S.RANK[b.role] && S.ASSIGNABLE(b.role) && b.id !== c.user.id, 'badInput'); x.role = b.role; await c.D.put('staff', [{ id: b.id, data: x }]); }
    if (b.password) { need(String(b.password).length >= 8, 'badInput'); await c.A.setPassword(b.id, b.password); }
    if ('name' in b || 'title' in b || 'expires' in b) { if ('name' in b) x.name = str(b.name, 120); if ('title' in b) x.title = str(b.title, 120); if ('expires' in b) { if (S.isDate(b.expires)) x.expires = b.expires; else delete x.expires; } await c.D.put('staff', [{ id: b.id, data: x }]); }
    await audit(c, 'user.update', x.email); return { ok: 1 };
  } },
  'POST /users/delete': { auth: 'staff', act: 'users', async fn(c) {
    const b = await c.body(); need(b.id !== c.user.id, 'badInput');
    const x = await c.D.get('staff', String(b.id));
    await c.A.deleteUser(String(b.id)); await c.D.del('staff', String(b.id)); await audit(c, 'user.delete', `${x?.email || b.id} ${x?.role || ''}`); return { ok: 1 };
  } },

  /* -------------------------------------------------------------- backups */
  'GET /backups': { auth: 'staff', act: 'backup.view', async fn(c) { return { list: await listBackups(c) }; } },
  'POST /backup': { auth: 'staff', act: 'backup.create', async fn(c) { const key = await makeBackup(c); await audit(c, 'backup.create', key); return { key }; } },
  'POST /backup/auto': { auth: 'staff', act: 'backup.create', async fn(c) {
    const l = await listBackups(c); if (l[0] && c.now() - Date.parse(l[0].at) < 864e5) return { skipped: 1 };
    const key = await makeBackup(c); for (const o of l.slice(89)) await c.B.delete(o.key); return { key };
  } },
  'GET /backup/get': { auth: 'staff', act: 'backup.download', raw: true, async fn(c) {
    const k = c.url.searchParams.get('key') || ''; need(goodKey(k), 'badInput'); const o = await c.B.get(k); need(o, 'noRec', 404);
    return new Response(o.body, { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="' + k.split('/')[1] + '"' } });
  } },
  'POST /backup/delete': { auth: 'staff', act: 'backup.delete', async fn(c) { const b = await c.body(); need(goodKey(b.key), 'badInput'); await c.B.delete(b.key); await audit(c, 'backup.delete', b.key); return { ok: 1 }; } },
  'POST /restore': { auth: 'staff', act: 'backup.restore', async fn(c) {
    const b = await c.body(); need(goodKey(b.key), 'badInput'); const o = await c.B.get(b.key); need(o, 'noRec', 404); const d = await o.json();
    need(d?.cols, 'badInput');
    const before = await makeBackup(c, '-before-restore');
    // one database transaction (see apply_restore in schema.sql): either everything is restored or nothing changes
    await c.D.restore(RESTORE_COLS, d.cols, d.counters || []);
    const logins = await rebuildLogins(c);
    await audit(c, 'backup.restore', `${b.key} · safety backup ${before} · ${logins} logins re-registered`); return { ok: 1, before };
  } },

  'POST /system/logins/repair': { auth: 'staff', act: 'backup.restore', async fn(c) { const n = await rebuildLogins(c); await audit(c, 'logins.repair', String(n)); return { count: n }; } },

  /* ------------------------------------------------------------ scheduled jobs */
  'POST /cron/run': { auth: 'cron', async fn(c) {
    const b = await c.body(), tasks = Array.isArray(b.tasks) && b.tasks.length ? b.tasks : ['backup', 'reminders', 'retention'], out = {};
    if (tasks.includes('backup')) {
      const l = await listBackups(c);
      if (l[0] && c.now() - Date.parse(l[0].at) < 20 * 36e5) out.backup = 'skipped';
      else { out.backup = await makeBackup(c, '-auto'); for (const o of l.slice(89)) await c.B.delete(o.key); await audit(c, 'backup.auto', out.backup); }
    }
    if (tasks.includes('reminders')) out.reminders = await runReminders(c);
    if (tasks.includes('retention')) out.retention = await runRetention(c);
    // the error log keeps 60 days; claims of handed-in tests 400 days
    { const old = new Date(c.now() - 60 * 864e5).toISOString(), ids = (await c.D.query('errlog', { where: [['at', 'lt', old]], limit: 1000, fields: ['at'] })).rows.map(r => r.id); if (ids.length) await c.D.delMany('errlog', ids); out.errlog = ids.length; }
    return out;
  } },
  /* System health: what to check before a training day. Database and file storage response times (measured now), the last
     backup, unexpected errors, API requests counted per day against the hosting plan's daily limit, database size. */
  'GET /health': { auth: 'staff', act: 'backup.view', async fn(c) {
    const st = await getSettings(c.D), today = c.today(), dayAgo = new Date(c.now() - 864e5).toISOString(), weekAgo = new Date(c.now() - 7 * 864e5).toISOString();
    const time = async f => { const t0 = performance.now(); try { await f(); return Math.round(performance.now() - t0); } catch { return null; } };
    const db = []; for (let i = 0; i < 3; i++) db.push(await time(() => c.D.query('settings', { where: [['id', 'eq', 'main']], limit: 1, offset: i, fields: ['id'] })));
    const r2 = await time(() => c.B.list({ prefix: 'backups/', limit: 1 }));
    const [backups, err1, err7, size] = await Promise.all([listBackups(c).catch(() => []),
      c.D.query('errlog', { where: [['at', 'gte', dayAgo]], limit: 0, count: true }).then(r => r.total || 0),
      c.D.query('errlog', { where: [['at', 'gte', weekAgo]], limit: 0, count: true }).then(r => r.total || 0),
      c.D.call ? c.D.call('rpc/db_size', { method: 'POST', body: '{}' }).then(Number).catch(() => null) : null]);
    // database structure (schema.sql v5): one table per collection, and old rows that break the record rules
    const [tables, problems] = c.D.call ? await Promise.all([c.D.call('rpc/table_sizes', { method: 'POST', body: '{}' }).catch(() => null),
      c.D.call('shape_problems?select=col,id&limit=50').catch(() => null)]) : [undefined, undefined];
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.parse(today) - i * 864e5).toISOString().slice(0, 10); days.push({ d, n: await c.D.peek('req|' + d) }); }
    const ok = db.filter(x => x !== null), med = ok.length ? ok.sort((a, b) => a - b)[Math.floor(ok.length / 2)] : null;
    return { at: new Date(c.now()).toISOString(), db: { ms: med, ok: ok.length === 3 }, r2: { ms: r2, ok: r2 !== null },
      backup: backups[0] ? { at: backups[0].at, size: backups[0].size, count: backups.length } : null, errors: { day: err1, week: err7 },
      requests: { days, plan: st.cfPlan || 'free', limit: (st.cfPlan || 'free') === 'free' ? 100000 : 0 }, dbSize: size, dbLimit: (st.dbPlan || 'free') === 'free' ? 500 * 1048576 : 8 * 1073741824, dbPlan: st.dbPlan || 'free',
      schema: tables === undefined ? null : { tables: tables ? tables.map(x => ({ col: x.col, rows: Number(x.rows), bytes: Number(x.bytes) })) : null, problems: problems || [] } };
  } },
  'POST /health/plan': { auth: 'staff', act: 'settings.save', async fn(c) {
    const b = await c.body(), st = await getSettings(c.D);
    if (['free', 'paid'].includes(b.cfPlan)) st.cfPlan = b.cfPlan; if (['free', 'pro'].includes(b.dbPlan)) st.dbPlan = b.dbPlan;
    await c.D.put('settings', [{ id: 'main', data: st }]); return { ok: 1 };
  } },
  /* Error log: unexpected server failures (the reference shown to the person is in "ref"). Superadmin / auditor read it. */
  'GET /errors': { auth: 'staff', act: 'audit.view', async fn(c) {
    const r = await c.D.query('errlog', { order: ['at', 'desc'], limit: 200, count: true }); return { list: r.rows.map(x => x.data), total: r.total };
  } },
  'POST /errors/clear': { auth: 'staff', act: 'settings.save', async fn(c) {
    const ids = (await c.D.query('errlog', { limit: 1000, fields: ['at'] })).rows.map(r => r.id); if (ids.length) await c.D.delMany('errlog', ids); await audit(c, 'errors.clear', String(ids.length)); return { n: ids.length };
  } },
  'POST /reminders/run': { auth: 'staff', act: 'settings.save', async fn(c) { const b = await c.body(); return runReminders(c, { dry: bool(b.dry) }); } },
  'POST /retention/run': { auth: 'staff', act: 'delete', async fn(c) { const b = await c.body(); return runRetention(c, { dry: bool(b.dry) }); } },

  /* -------------------------------------------------------- company requests */
  'GET /requests': { auth: 'staff', act: 'requests', async fn(c) { return { ...(await otherRequests(c)), list: await recentRequests(c) }; } },
  'POST /request/update': { auth: 'staff', act: 'requests', async fn(c) {
    const b = await c.body(), x = await c.D.get('requests', str(b.id, 60)); need(x, 'noRec', 404);
    if (['new', 'planned', 'done', 'rejected'].includes(b.status)) x.status = b.status;
    if ('reply' in b) x.reply = str(b.reply, 1000);
    x.updatedAt = new Date(c.now()).toISOString(); x.updatedBy = c.user.email;
    await c.D.put('requests', [{ id: x.id, data: x }]); await audit(c, 'request.update', `${x.coName} · ${x.status}`);
    await notify(c, 'company:' + x.co, 'nRqUpdated', ['rq_' + x.status, x.reply || ''], 'requests');
    return { request: x };
  } },

  /* --------------------------------------------------- two-factor sign-in (own account) */
  'GET /staff/mfa': { auth: 'staff', mfa: 'skip', async fn(c) {
    const st = await getSettings(c.D), pol = st.mfa || 'off';
    const me = (await c.D.get('staff', c.user.id)) || /** @type {import('../../types/records').StaffRecord} */ ({});
    return { name: me.name || '', title: me.title || '', sigImg: me.sigKey ? '/api/asset/' + me.sigKey : '', canSignCerts: S.can(c.user.role, 'cert.sign'), enabled: c.user.mfa, aal: c.user.aal, required: pol === 'all' || (pol === 'admins' && S.RANK[c.user.role] >= S.RANK.admin) };
  } },
  'POST /staff/mfa/enroll': { auth: 'staff', mfa: 'skip', async fn(c) {
    const tok = (c.req.headers.get('authorization') || '').slice(7);
    for (const f of await c.A.factors(tok)) if (f.status !== 'verified') await c.A.unenroll(tok, f.id);   // drop unfinished set-ups
    return c.A.enroll(tok);
  } },
  'POST /staff/mfa/activate': { auth: 'staff', mfa: 'skip', async fn(c) {
    const b = await c.body(), tok = (c.req.headers.get('authorization') || '').slice(7);
    const t = await c.A.verifyFactor(tok, str(b.factorId, 80), str(b.code, 10));
    const s = await ownStaff(c); s.mfa = true; await c.D.put('staff', [{ id: c.user.id, data: s }]);
    await audit(c, 'mfa.enable', c.user.email); return { access: t.access, refresh: t.refresh };
  } },
  /* own name and job title: used when this person signs documents electronically */
  'POST /staff/profile': { auth: 'staff', async fn(c) {
    const b = await c.body(), s = await ownStaff(c); s.name = str(b.name, 120); s.title = str(b.title, 120);
    await c.D.put('staff', [{ id: c.user.id, data: s }]); await audit(c, 'profile.update', s.name); return { name: s.name, title: s.title };
  } },
  /* own password (staff): the current one is checked by signing in with it */
  'POST /staff/password': { auth: 'staff', async fn(c) {
    need(!c.user.emergency, 'forbidden', 403);
    const b = await c.body(), nw = String(b.next || '');
    try { await c.A.login(c.user.email, String(b.current || '')); } catch { throw new H(400, 'badPassword'); }
    need(nw.length >= 8 && nw.length <= 100 && /[A-Za-z]/.test(nw) && /\d/.test(nw), 'weakPassword');
    await c.A.setPassword(c.user.id, nw); await audit(c, 'password.change', `staff ${c.user.email}`); return { ok: 1 };
  } },
  /* own handwritten signature image (PNG), used when an admin signs certificates "with my signature image" */
  'POST /staff/signature': { auth: 'staff', act: 'cert.sign', raw: true, async fn(c) {
    const buf = await c.req.arrayBuffer(); need(buf.byteLength && buf.byteLength <= 2e6 && png(buf), 'badFile');
    const key = rnd(8) + '.png'; await c.B.put('assets/' + key, buf, { httpMetadata: { contentType: 'image/png' } });
    const s = await ownStaff(c); s.sigKey = key; await c.D.put('staff', [{ id: c.user.id, data: s }]); await audit(c, 'signature.upload', s.name || c.user.email);
    return J({ img: '/api/asset/' + key });
  } },
  'POST /staff/signature/remove': { auth: 'staff', act: 'cert.sign', async fn(c) { const s = await ownStaff(c); delete s.sigKey; await c.D.put('staff', [{ id: c.user.id, data: s }]); await audit(c, 'signature.remove', s.name || c.user.email); return { ok: 1 }; } },
  'POST /staff/mfa/disable': { auth: 'staff', async fn(c) {
    const st = await getSettings(c.D), pol = st.mfa || 'off';
    need(!(pol === 'all' || (pol === 'admins' && S.RANK[c.user.role] >= S.RANK.admin)), 'mfaMandatory', 409);
    const tok = (c.req.headers.get('authorization') || '').slice(7);
    for (const f of await c.A.factors(tok)) await c.A.unenroll(tok, f.id);
    const s = await ownStaff(c); delete s.mfa; await c.D.put('staff', [{ id: c.user.id, data: s }]);
    await audit(c, 'mfa.disable', c.user.email); return { ok: 1 };
  } },
  /* superadmin: a colleague lost the phone */
  'POST /users/mfa/reset': { auth: 'staff', act: 'users', async fn(c) {
    const b = await c.body(), x = await c.D.get('staff', str(b.id, 80)); need(x, 'noRec', 404);
    await c.A.adminResetMfa(b.id); delete x.mfa; await c.D.put('staff', [{ id: b.id, data: x }]); await audit(c, 'mfa.reset', x.email); return { ok: 1 };
  } },

  /* Audit trail: filters by date range, user, category and free text. Rows are read per month (their ids start with the timestamp). */
  'GET /audit': { auth: 'staff', act: 'audit.view', async fn(c) {
    const q = c.url.searchParams, from = str(q.get('from'), 10), to = str(q.get('to'), 10), user = str(q.get('user'), 120).toLowerCase(), cat = str(q.get('cat'), 20), text = str(q.get('q'), 100).toLowerCase(), entity = str(q.get('entity'), 120);
    const lim = num(q.get('limit'), 1, 500, 100), off = num(q.get('offset'), 0, 1e6, 0);
    let rows;
    if (entity && !S.isDate(from) && !S.isDate(to)) {
      // one record's history: indexed lookup + text mentions in the last 90 days (rows written before the index existed)
      const recent = []; for (let i = 0; i < 4; i++) { const d = new Date(c.now()); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); recent.push(d.toISOString().slice(0, 7)); }
      const [byId, ...months] = await Promise.all([c.D.query('audit', { where: [['eid', 'eq', entity]] }), ...recent.map(p => c.D.prefix('audit', p))]);
      const seen = new Set(); rows = [...byId.rows, ...months.flat()].filter(r => !seen.has(r.id) && seen.add(r.id));
    } else if (S.isDate(from) || S.isDate(to)) {
      const a = S.isDate(from) ? from : '2000-01-01', z = S.isDate(to) ? to : c.today(), months = [];
      for (let y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7)); `${y}-${S.pad(m)}` <= z.slice(0, 7) && months.length < 60; m++) { if (m > 12) { m = 1; y++; } months.push(`${y}-${S.pad(m)}`); }
      rows = (await Promise.all(months.map(p => c.D.prefix('audit', p)))).flat();        // months in parallel
    } else {
      // no period given: the last 3 months (the trail grows without limit; older entries are reached with a period)
      const months = []; for (let i = 0; i < 3; i++) { const d = new Date(c.now()); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
      rows = (await Promise.all(months.map(p => c.D.prefix('audit', p)))).flat();
    }
    let list = rows.map(r => r.data);
    const day = x => S.bakuToday(Date.parse(x.at));
    if (S.isDate(from)) list = list.filter(x => day(x) >= from); if (S.isDate(to)) list = list.filter(x => day(x) <= to);
    if (user) list = list.filter(x => (x.by?.name || '').toLowerCase().includes(user) || (x.by?.role || '').toLowerCase() === user);
    if (cat) list = list.filter(x => auditCat(x.action) === cat);
    if (entity) list = list.filter(x => x.entity?.id === entity || (x.detail || '').includes(entity));
    if (text) list = list.filter(x => [x.action, x.detail, x.by?.name, x.entity?.label, x.entity?.id, x.ip, (x.changes || []).map(k => `${k.f} ${k.from} ${k.to}`).join(' ')].join(' ').toLowerCase().includes(text));
    list.sort((a, b) => (a.at < b.at ? 1 : -1));
    const cats = {}; for (const x of list) cats[auditCat(x.action)] = (cats[auditCat(x.action)] || 0) + 1;
    const users = [...new Set(list.map(x => x.by?.name).filter(Boolean))].slice(0, 100);
    return { total: list.length, cats, users, list: list.slice(off, off + lim), recentOnly: !entity && !S.isDate(from) && !S.isDate(to) };
  } },

  /* ------------------------------------------------------------ dashboard numbers
     "Trained" = confirmed attendance in a session that starts in the period; pass rate = passed / released results. */
  'GET /stats': { auth: 'staff', act: 'dashboard', async fn(c) {
    const st = await getSettings(c.D), cfg = S.dashCfg(st), today = c.today(), p = c.url.searchParams;
    const [from, to] = S.isDate(p.get('from')) && S.isDate(p.get('to')) ? [p.get('from'), p.get('to')] : S.periodRange(str(p.get('period'), 16) || cfg.period, today);
    // the period's sessions, their enrolments and people; certificate figures are database counts
    const [sessAll, companies, blanks] = await Promise.all([c.D.query('sessions', { where: [['date', 'gte', from], ['date', 'lte', to]] }).then(r => r.rows.map(x => x.data)), c.D.all('companies'), c.D.all('blanks')]);
    const cos = new Map(companies.map(r => [r.id, r.data.name])), bl = new Map(blanks.map(r => [r.id, r.data.name]));
    const sess = sessAll.filter(s => !s.cancelled), sid = new Set(sess.map(s => s.id)), sById = new Map(sess.map(s => [s.id, s]));
    const live = [['revoked', 'null', true], ['renewed', 'null', true]], n = where => c.D.query('certs', { where, limit: 0, count: true }).then(r => r.total || 0);
    const [enrMap, tById, issuedN, soonN, expiredN] = await Promise.all([enrsFor(c.D, [...sid], ['sid', 'tid', 'att', 'final']), queryIn(c.D, 'trainees', 'id', sess.flatMap(s => s.traineeIds || []), { fields: ['co'] }).then(l => new Map(l.map(t => [t.id, t]))),
      n([['revoked', 'null', true], ['issuedAt', 'gte', from], ['issuedAt', 'lte', to + 'T99']]), n([...live, ['exp', 'gte', today], ['exp', 'lte', daysBefore(today, -cfg.expDays)]]), n([...live, ['exp', 'lt', today]])]);
    const w = { enrs: [...enrMap.values()].flat(), tById };
    const out = { from, to, today, expDays: cfg.expDays, trained: 0, passed: 0, failed: 0, pending: 0, sessions: sess.length, issued: 0, expiring: 0, expired: 0, byCompany: /** @type {any[]} */ ([]), byCourse: /** @type {any[]} */ ([]) };
    const co = new Map(), cr = new Map();
    for (const s of sess) cr.set(s.bid, { bid: s.bid, name: bl.get(s.bid) || '—', sessions: 0, trainees: 0, passed: 0, ...cr.get(s.bid) }), cr.get(s.bid).sessions++;
    for (const e of w.enrs) {
      if (!sid.has(e.sid) || !e.att) continue;
      const s = sById.get(e.sid), t = w.tById.get(e.tid); out.trained++;
      const key = t?.co && cos.has(t.co) ? t.co : '', row = co.get(key) || { id: key, name: key ? cos.get(key) : '', trainees: 0, passed: 0 }; row.trainees++; co.set(key, row);
      const cur = s && cr.get(s.bid); if (cur) cur.trainees++;
      if (e.final?.outcome === 'PASS') { out.passed++; row.passed++; cur.passed++; } else if (e.final) out.failed++; else out.pending++;
    }
    const released = out.passed + out.failed; out.passRate = released ? Math.round((out.passed / released) * 1000) / 10 : null;
    out.issued = issuedN; out.expiring = soonN; out.expired = expiredN;
    const top = cfg.top;
    out.byCompany = [...co.values()].sort((a, b) => b.trainees - a.trainees).slice(0, top); out.companiesTotal = co.size;
    out.byCourse = [...cr.values()].sort((a, b) => b.trainees - a.trainees || b.sessions - a.sessions).slice(0, top); out.coursesTotal = cr.size;
    return out;
  } },

  /* -------------------------------------------------------------- cameras
     Saved camera set-ups (browser/USB cameras by device label, or network cameras by URL) and snapshots, superadmin only. */
  'GET /cameras': { auth: 'staff', act: 'camera', async fn(c) {
    const cams = await Promise.all((await c.D.all('cams')).map(async r => ({ ...r.data, pass: await unseal(c.env.TOKEN_SECRET, r.data.pass) })));
    return { cams: cams.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)), snaps: (await c.D.all('snaps')).map(r => r.data).sort((a, b) => (a.at < b.at ? 1 : -1)) };
  } },
  'POST /camera/save': { auth: 'staff', act: 'camera', async fn(c) {
    const b = await c.body(); let x;
    const f = { name: str(b.name, 80), kind: b.kind === 'ip' ? 'ip' : 'usb', deviceId: str(b.deviceId, 200), label: str(b.label, 200), url: str(b.url, 500), notes: str(b.notes, 300), res: str(b.res, 20),
      host: str(b.host, 120), port: num(b.port, 1, 65535) ?? '', user: str(b.user, 80), pass: str(b.pass, 120), mode: ['mjpeg', 'snap', 'rtsp'].includes(b.mode) ? b.mode : '' };
    need(f.name, 'badInput'); if (f.kind === 'ip') { need(/^(https?|rtsp):\/\/[^\s]+$/i.test(f.url), 'badLink'); if (f.url.startsWith('rtsp')) f.mode = 'rtsp'; }
    f.pass = await seal(c.env.TOKEN_SECRET, f.pass);      // camera passwords are kept encrypted at rest (and in backups)
    if (b.id) { x = await c.D.get('cams', str(b.id, 60)); need(x, 'noRec', 404); if (!b.pass && x.pass) f.pass = x.pass; Object.assign(x, f); } else x = { id: uid('cam'), ...f, createdAt: new Date(c.now()).toISOString() };
    await c.D.put('cams', [{ id: x.id, data: x }]); await audit(c, 'camera.save', `${x.name}${x.host ? ' ' + x.host : ''}`, { entity: { kind: 'camera', id: x.id, label: x.name } }); return { cam: { ...x, pass: await unseal(c.env.TOKEN_SECRET, x.pass) } };
  } },
  'POST /camera/snapshot': { auth: 'staff', act: 'camera', raw: true, async fn(c) {
    const cid = str(c.url.searchParams.get('cid'), 60), cam = await c.D.get('cams', cid); need(cam, 'noRec', 404);
    const buf = await c.req.arrayBuffer(); need(buf.byteLength && buf.byteLength <= 3e6 && jpg(buf), 'badFile');
    const key = 'camera/' + rnd(8) + '.jpg', id = uid('sn');
    await c.B.put(key, buf, { httpMetadata: { contentType: 'image/jpeg' } });
    const x = { id, cid, camName: cam.name, key, note: str(c.url.searchParams.get('note'), 200), at: new Date(c.now()).toISOString(), by: c.user.email, size: buf.byteLength };
    await c.D.put('snaps', [{ id, data: x }]); await audit(c, 'camera.snapshot', cam.name); return J({ snap: x });
  } },
  'GET /camera/snap': { auth: 'staff', act: 'camera', raw: true, async fn(c) {
    const k = c.url.searchParams.get('key') || ''; need(/^camera\/[a-f0-9]{16}\.jpg$/.test(k), 'badInput'); const o = await c.B.get(k); need(o, 'noRec', 404);
    return new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=3600' } });
  } },
  'POST /camera/delete': { auth: 'staff', act: 'camera', async fn(c) {
    const b = await c.body(), id = str(b.id, 60);
    if (b.snap) { const x = await c.D.get('snaps', id); if (x) { await c.B.delete(x.key); await c.D.del('snaps', id); } }
    else { await c.D.del('cams', id); }
    await audit(c, 'camera.delete', id); return { ok: 1 };
  } },
  /* "Clear camera data": all saved snapshots, or snapshots + camera set-ups. */
  'POST /cameras/clear': { auth: 'staff', act: 'camera', async fn(c) {
    const b = await c.body(); let n = 0;
    for (const r of await c.D.all('snaps')) { await c.B.delete(r.data.key); n++; } await c.D.delCol('snaps');
    if (b.all) await c.D.delCol('cams');
    await audit(c, 'camera.clear', b.all ? 'all' : 'snapshots'); return { removed: n };
  } },
};
