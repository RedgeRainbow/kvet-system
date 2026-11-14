/* Live updates without websockets: every request that writes data bumps small "revision" counters, and the pages poll the
   counter that concerns them (one cheap read every few seconds). Only when it changed does the page fetch its data again.
     rev            anything (admin panel, company portal)
     rev|s|<sid>    one session: enrolments, signatures, certificates, the session itself (trainer's open session)
     rev|t|<tid>    a trainer's sessions list
     rev|p|<tid>    one trainee (enrolments, certificates, own record, sessions they are in); rev|p|* = all trainees
     rev|c|<co>     one company's portal (its people, certificates, requests) */
const QUIET = new Set(['audit', 'notes', 'nseen', 'msgs', 'threads']);   // the audit trail changes on every sign-in; notes and messages: the bell polls them itself
const MANY = 50;                                // a session with more trainees bumps rev|p|* instead of each trainee

export function tracked(D) {
  const t = { any: false, keys: new Set() };
  const note = (col, rows) => {
    if (QUIET.has(col)) return; t.any = true;
    for (const { id, data } of rows) {
      const k = String(id ?? '');
      if (col === 'enr') { const [sid, tid] = k.split('|'); t.keys.add('rev|s|' + sid); if (tid) t.keys.add('rev|p|' + tid); }
      else if (col === 'sessions') { t.keys.add('rev|s|' + k); if (data?.tid) t.keys.add('rev|t|' + data.tid); const ids = data?.traineeIds || []; if (ids.length > MANY) t.keys.add('rev|p|*'); else ids.forEach(x => t.keys.add('rev|p|' + x)); }
      else if (col === 'signs') { const [doc, sid] = k.split('|'); if (doc !== 'cert' && sid) t.keys.add('rev|s|' + sid); }
      else if (col === 'certs') { if (data?.sid) t.keys.add('rev|s|' + data.sid); if (data?.tid) t.keys.add('rev|p|' + data.tid); if (data?.co) t.keys.add('rev|c|' + data.co); }
      else if (col === 'trainees') { t.keys.add('rev|p|' + k); if (data?.co) t.keys.add('rev|c|' + data.co); }
      else if (col === 'requests' || col === 'companies') t.keys.add('rev|c|' + (data?.co || (col === 'companies' ? k : '')));
      else if (col === 'tests' || col === 'blanks' || col === 'trainers') t.keys.add('rev|p|*');
    }
  };
  const wrap = {
    ...D,
    put: async (col, rows) => { const r = await D.put(col, rows); note(col, rows); return r; },
    insert: async (col, id, data) => { const r = await D.insert(col, id, data); note(col, [{ id, data }]); return r; },
    del: async (col, id) => { const r = await D.del(col, id); note(col, [{ id }]); return r; },
    delMany: async (col, ids) => { const r = await D.delMany(col, ids); note(col, ids.map(id => ({ id }))); return r; },
    restore: async (...a) => { const r = await D.restore(...a); t.any = true; t.keys.add('rev|p|*'); return r; },
    restoreApply: async (...a) => { const r = await D.restoreApply(...a); t.any = true; t.keys.add('rev|p|*'); return r; },
  };
  /* after the request: one bump per counter, in parallel */
  // many people changed at once (an import, a batch delete): one "all trainees" counter instead of one per person, so a
  // request never makes hundreds of database calls just for the live updates
  const flush = async () => {
    if (!t.any) return;
    let keys = [...t.keys]; const per = keys.filter(k => k.startsWith('rev|p|') && k !== 'rev|p|*');
    if (per.length > 10) keys = [...keys.filter(k => !per.includes(k) && k !== 'rev|p|*'), 'rev|p|*'];
    if (keys.length > 30) keys = [...keys.filter(k => k.startsWith('rev|c|') || k === 'rev|p|*').slice(0, 25), ...keys.filter(k => k.startsWith('rev|s|') || k.startsWith('rev|t|')).slice(0, 5)];
    await Promise.all([D.seq('rev'), ...keys.map(k => D.seq(k))]).catch(() => {});
  };
  return { D: wrap, flush };
}
export const revOf = async (D, ...keys) => (await Promise.all(keys.map(k => D.peek(k)))).join('.');
