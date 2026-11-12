/* Deleting records without leaving orphans.
   A plan is built in memory from one scan of the data (so it also works as a dry run that only counts), then applied in batches.
   Rules (superadmin only):
   - certificates are never destroyed by a delete: they move to the ARCHIVE (col `archive`), where they can be restored or erased for good
   - session   -> its enrolments go, its certificates are archived
   - trainee   -> leaves every session, enrolments go, certificates are archived, ID/FIN + login freed
   - blank     -> its sessions go (see above), remaining certificates of that training are archived
   - trainer / company / practical sheet / presentation -> removed; records that pointed at them are kept and just lose the link
   - enrolment (Issue queue row) -> the trainee leaves that session; enrolment data goes, its certificate is archived */
import { S, enrId, getMany, sessionsOf } from './core.js';
import { forgetAccounts } from './routes_notify.js';
import { loginKey } from './auth.js';

export const KINDS = ['blank', 'sheet', 'material', 'company', 'trainer', 'trainee', 'session', 'cert', 'enrol'];

export async function loadWorld(c) {
  const rows = async col => (await c.D.all(col)).map(r => r.data);
  const [sessions, enrs, certs, trainees, trainers, companies, blanks, sheets, materials, groups] = await Promise.all(['sessions', 'enr', 'certs', 'trainees', 'trainers', 'companies', 'blanks', 'sheets', 'materials', 'groups'].map(rows));
  const by = list => new Map(list.map(x => [x.id, x]));
  return { sessions, enrs, certs, trainees, trainers, companies, blanks, sheets, materials, groups, sById: by(sessions), tById: by(trainees), certByNo: new Map(certs.map(x => [x.no, x])), enrBy: new Map(enrs.map(e => [enrId(e.sid, e.tid), e])) };
}

/* The part of the database one delete can touch (the record, what hangs off it, and the small directories), instead of
   everything: the cascade below works the same on it. Bulk purge still uses loadWorld. */
export async function loadWorldFor(c, kind, id) {
  const D = c.D, rows = r => r.rows.map(x => x.data), q = (col, where) => D.query(col, { where }).then(rows);
  const sess = new Map(), enrs = new Map(), certs = new Map(), people = new Set();
  const addS = list => { for (const s of list) if (s) { sess.set(s.id, s); for (const t of s.traineeIds || []) people.add(t); } };
  const addC = list => { for (const x of list) if (x) { certs.set(x.no, x); people.add(x.tid); } };
  const addE = list => { for (const e of list) if (e) { enrs.set(enrId(e.sid, e.tid), e); people.add(e.tid); } };
  if (kind === 'session') addS([await D.get('sessions', id)]);
  else if (kind === 'enrol') { const [sid] = id.split('|'); addS([await D.get('sessions', sid)]); }
  else if (kind === 'trainee') { people.add(id); const [ss, es, cs] = await Promise.all([sessionsOf(D, id), q('enr', [['tid', 'eq', id]]), q('certs', [['tid', 'eq', id]])]); addS(ss); addE(es); addC(cs); }
  else if (kind === 'blank') { const [ss, cs] = await Promise.all([q('sessions', [['bid', 'eq', id]]), q('certs', [['bid', 'eq', id]])]); addS(ss); addC(cs); }
  else if (kind === 'sheet') addS(await q('sessions', [['sheetId', 'eq', id]]));
  else if (kind === 'material') addS(await q('sessions', [['materials', 'has', id]]));
  else if (kind === 'trainer') addS(await q('sessions', [['tid', 'eq', id]]));
  else if (kind === 'company') { const [ts, cs] = await Promise.all([q('trainees', [['co', 'eq', id]]), q('certs', [['co', 'eq', id]])]); for (const t of ts) people.add(t.id); addC(cs); }
  else if (kind === 'cert') { const x = await D.get('certs', id); if (x) { addC([x]); if (x.sid) addS([await D.get('sessions', x.sid)]); } }
  // everything attached to those sessions
  const sids = [...sess.keys()];
  for (let i = 0; i < sids.length; i += 60) { const part = sids.slice(i, i + 60); const [es, cs] = await Promise.all([q('enr', [['sid', 'in', part]]), q('certs', [['sid', 'in', part]])]); addE(es); addC(cs); }
  const small = async col => (await D.all(col)).map(r => r.data);
  const [trainees, trainers, companies, blanks, sheets, materials, groups] = await Promise.all([getMany(D, 'trainees', [...people]).then(m => [...m.values()]), ...['trainers', 'companies', 'blanks', 'sheets', 'materials', 'groups'].map(small)]);
  const sessions = [...sess.values()], E = [...enrs.values()], C = [...certs.values()], by = list => new Map(list.map(x => [x.id, x]));
  return { sessions, enrs: E, certs: C, trainees, trainers, companies, blanks, sheets, materials, groups, sById: by(sessions), tById: by(trainees), certByNo: new Map(C.map(x => [x.no, x])), enrBy: new Map(E.map(e => [enrId(e.sid, e.tid), e])) };
}

export function newPlan(c, w) {
  /** @type {{ del: Record<string, any>, upd: Record<string, any>, arch: Map<string, any>, files: string[], touched: Record<string, any>, w: any, [k: string]: any }} */
  const P = { del: {}, upd: {}, arch: new Map(), files: [], touched: {}, w };
  const set = (o, col) => (o[col] ??= new Map());
  const del = (col, id) => { set(P.del, col).set(id, true); if (col === 'enr') set(P.del, 'rel').set(id, true); };   // a release reservation goes with its enrolment
  const gone = (col, id) => !!P.del[col]?.has(id);
  const upd = (col, id, data) => set(P.upd, col).set(id, data);
  const sess = id => P.upd.sessions?.get(id) || w.sById.get(id);
  const by = c.user ? (c.user.email || c.user.name || c.user.id) : 'system';
  const bump = (k, id) => (P.touched[k] ??= new Set()).add(id);

  P.archiveCert = (x, via, touchEnr) => {
    if (!x || P.arch.has(x.no)) return;
    const e = w.enrBy.get(enrId(x.sid, x.tid));
    P.arch.set(x.no, { cert: x, final: e?.final?.certNo === x.no ? e.final : null, archivedAt: new Date(c.now()).toISOString(), by, via });
    del('certs', x.no);
    if (touchEnr && e?.final?.certNo === x.no && !gone('enr', enrId(x.sid, x.tid))) { const n = { ...e }; delete n.final; upd('enr', enrId(x.sid, x.tid), n); set(P.del, 'rel').set(enrId(x.sid, x.tid), true); }
  };
  P.session = (id, via = 'session') => {
    const s = w.sById.get(id); if (!s || gone('sessions', id)) return;
    del('sessions', id);
    for (const e of w.enrs) if (e.sid === id) del('enr', enrId(e.sid, e.tid));
    for (const x of w.certs) if (x.sid === id) P.archiveCert(x, via, false);
  };
  P.enrol = (sid, tid) => {
    const s = sess(sid); if (!s || gone('sessions', sid)) return;
    if ((s.traineeIds || []).includes(tid)) upd('sessions', sid, { ...s, traineeIds: s.traineeIds.filter(t => t !== tid) });
    del('enr', enrId(sid, tid));
    for (const x of w.certs) if (x.sid === sid && x.tid === tid) P.archiveCert(x, 'enrolment', false);
  };
  P.trainee = id => {
    const x = w.tById.get(id); if (!x || gone('trainees', id)) return;
    for (const s of w.sessions) if ((s.traineeIds || []).includes(id)) P.enrol(s.id, id);
    for (const e of w.enrs) if (e.tid === id) del('enr', enrId(e.sid, e.tid));
    for (const k of w.certs) if (k.tid === id) P.archiveCert(k, 'trainee', false);
    for (const g of w.groups) if ((g.traineeIds || []).includes(id)) upd('groups', g.id, { ...(P.upd.groups?.get(g.id) || g), traineeIds: (P.upd.groups?.get(g.id) || g).traineeIds.filter(x2 => x2 !== id) });
    del('trainees', id); if (x.fin) del('fins', x.fin); if (x.login) del('logins', loginKey('trainee', x.login));
  };
  P.cert = no => { const x = w.certByNo.get(no); if (x) P.archiveCert(x, 'delete', true); };
  P.blank = id => {
    if (!w.blanks.some(b => b.id === id) || gone('blanks', id)) return;
    for (const s of w.sessions) if (s.bid === id) P.session(s.id, 'training');
    for (const k of w.certs) if (k.bid === id) P.archiveCert(k, 'training', false);
    del('blanks', id);
  };
  P.sheet = id => {
    for (const s of w.sessions) if (s.sheetId === id && !gone('sessions', s.id)) { upd('sessions', s.id, { ...sess(s.id), sheetId: '' }); bump('sessions', s.id); }
    for (const b of w.blanks) if (b.defaultSheetId === id && !gone('blanks', b.id)) upd('blanks', b.id, { ...(P.upd.blanks?.get(b.id) || b), defaultSheetId: '' });
    del('sheets', id);
  };
  P.material = id => {
    const m = w.materials.find(x => x.id === id); if (!m) return;
    for (const s of w.sessions) if ((s.materials || []).includes(id) && !gone('sessions', s.id)) { upd('sessions', s.id, { ...sess(s.id), materials: sess(s.id).materials.filter(x => x !== id) }); bump('sessions', s.id); }
    if (m.key) P.files.push('materials/' + m.key); del('materials', id);
  };
  P.company = id => {
    const x = w.companies.find(k => k.id === id); if (!x) return;
    for (const t of w.trainees) if (t.co === id && !gone('trainees', t.id)) { upd('trainees', t.id, { ...(P.upd.trainees?.get(t.id) || t), co: '' }); bump('trainees', t.id); }
    for (const k of w.certs) if (k.co === id && !P.arch.has(k.no)) { upd('certs', k.no, { ...(P.upd.certs?.get(k.no) || k), co: '' }); bump('certs', k.no); }
    del('companies', id); if (x.login) del('logins', loginKey('company', x.login));
  };
  P.trainer = id => {
    const x = w.trainers.find(k => k.id === id); if (!x) return;
    for (const s of w.sessions) if (s.tid === id && !gone('sessions', s.id)) { upd('sessions', s.id, { ...sess(s.id), tid: '' }); bump('sessions', s.id); }
    del('trainers', id); if (x.login) del('logins', loginKey('trainer', x.login));
  };
  return P;
}

export function runKind(P, kind, id) {
  const f = { blank: P.blank, sheet: P.sheet, material: P.material, company: P.company, trainer: P.trainer, trainee: P.trainee, session: P.session, cert: P.cert }[kind];
  if (kind === 'enrol') { const [sid, tid] = String(id).split('|'); return P.enrol(sid, tid); }
  if (!f) throw new Error('kind');
  return f(id);
}

/* What the plan will do, in plain numbers (the confirm dialog shows these). */
export function impact(P) {
  const n = col => P.del[col]?.size || 0;
  const unlinked = col => [...(P.touched[col] || [])].filter(id => !P.del[col]?.has(id)).length;
  return { sessions: n('sessions'), enrolments: n('enr'), certs: P.arch.size, trainees: n('trainees'), trainers: n('trainers'), companies: n('companies'), blanks: n('blanks'), sheets: n('sheets'), materials: n('materials'),
    unlinkedSessions: unlinked('sessions'), unlinkedTrainees: unlinked('trainees'), unlinkedCerts: unlinked('certs') };
}
export const total = i => i.sessions + i.enrolments + i.certs + i.trainees + i.trainers + i.companies + i.blanks + i.sheets + i.materials;

export async function applyPlan(c, P) {
  // 1. archive first, so a failure can never lose a certificate
  if (P.arch.size) await c.D.put('archive', [...P.arch].map(([no, data]) => ({ id: no, data })));
  // 2. updates (skip rows that are being deleted anyway)
  for (const [col, m] of Object.entries(P.upd)) {
    const rows = [...m].filter(([id]) => !P.del[col]?.has(id)).map(([id, data]) => ({ id, data }));
    if (rows.length) await c.D.put(col, rows);
  }
  // 3. deletes
  // always by id (batched): a whole-collection wipe could also remove records created after the plan was made
  for (const [col, m] of Object.entries(P.del)) if (m.size) await c.D.delMany(col, [...m.keys()]);
  for (const k of P.files) await c.B.delete(k).catch(() => {});
  // 4. deleted trainers, companies and candidates: their conversation with the centre, events and panel settings
  const keys = [['trainees', 'trainee'], ['trainers', 'trainer'], ['companies', 'company']].flatMap(([col, k]) => [...(P.del[col]?.keys() || [])].map(id => k + ':' + id));
  if (keys.length) await forgetAccounts(c, keys);
}

/* Old certificate back from the archive (fails with dupCert when its number has been used since). */
export async function restoreFromArchive(c, no) {
  const a = await c.D.get('archive', no); if (!a) return null;
  await c.D.insert('certs', no, a.cert);
  if (a.final) { const e = await c.D.get('enr', enrId(a.cert.sid, a.cert.tid)); if (e && !e.final) { e.final = a.final; await c.D.put('enr', [{ id: enrId(e.sid, e.tid), data: e }]); await c.D.put('rel', [{ id: enrId(e.sid, e.tid), data: { at: a.final.at, by: 'restore' } }]); } }
  await c.D.del('archive', no);
  return a.cert;
}
export { S };
