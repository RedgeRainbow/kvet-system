/* Derived fields kept on the records so the database can filter, count and page by them.
   Certificates also carry: exp (expiry, or 9999-12-31 for no expiry), cox (company id, or '-' for private) and renewed
   (number of the newer certificate of the same person and training; see renewals() below), so "valid / expiring / expired
   / renewed" lists are database queries.
   Search key. Every trainee and certificate carries `sk`: one normalised line of the words people search by (names in
   Azerbaijani and English, learner number, ID/FIN, phone, certificate number). The database then finds matches itself
   (store.query({ search })) instead of the server reading the whole collection.
   indexed(D) adds the key on every write, whatever route makes it; reindex() fills it in for records saved before. */
import * as S from '../../public/js/shared.js';

export const SK_VERSION = 2;
const line = (...v) => S.foldText(v.flat(Infinity).filter(x => x !== null && x !== undefined && x !== '').join(' ')).replace(/\s+/g, ' ').trim().slice(0, 400);
const KEYS = {
  // names and numbers only: ID/FIN, phone and e-mail are found by exact match, and only by staff allowed to see them
  trainees: t => line(S.fullAz(t), S.fullEn(t), t.att, t.id, t.login, ...(t.attWas || [])),
  certs: x => line(x.no, x.att, x.snap?.names?.az, x.snap?.names?.en, x.snap?.blank?.name, x.snap?.company),
  archive: x => line(x.no, x.cert?.no, x.att, x.name, x.cert?.att, x.cert?.snap?.names?.az, x.cert?.snap?.names?.en, x.trainee?.name, x.trainee?.att),
};
export const skOf = (col, data) => (KEYS[col] && data && typeof data === 'object' ? KEYS[col](data) : undefined);
const certExtra = x => ({ exp: x.expiry || '9999-12-31', cox: x.co || '-' });
const withSk = (col, data) => {
  if (!data || typeof data !== 'object') return data;
  const k = skOf(col, data), extra = col === 'certs' ? certExtra(data) : {};
  const same = (k === undefined || data.sk === k) && Object.entries(extra).every(([f, v]) => data[f] === v);
  return same ? data : { ...data, ...(k === undefined ? {} : { sk: k }), ...extra };
};
/* The newest certificate (not revoked) of a person for a training is current; older ones are RENEWED. Kept in `renewed`
   on the older ones; recomputed for the people concerned after every certificate change. */
export function renewedMap(list) {
  const newest = new Map();
  for (const c of list) { if (c.revoked) continue; const k = c.bid, cur = newest.get(k); if (!cur || c.start > cur.start || (c.start === cur.start && c.issuedAt > cur.issuedAt)) newest.set(k, c); }
  return new Map(list.map(c => [c.no, !c.revoked && newest.get(c.bid) !== c ? newest.get(c.bid).no : null]));
}
async function renewals(D, tids) {
  // the certificates of all these people in one read (it was one read per person: a batch delete of 1,000 people made 1,000 calls)
  const ids = [...new Set([...tids].filter(Boolean))]; if (!ids.length) return;
  /** @type {Map<string, any[]>} */ const by = new Map(ids.map(t => [t, []])); for (const r of await D.inList('certs', 'tid', ids)) by.get(r.data.tid)?.push(r.data);
  await Promise.all(ids.map(async tid => {
    const list = by.get(tid) || [], m = renewedMap(list);
    const fix = list.filter(c => (c.renewed || null) !== m.get(c.no)).map(c => { const x = { ...c }; if (m.get(c.no)) x.renewed = m.get(c.no); else delete x.renewed; return { id: c.no, data: withSk('certs', x) }; });
    if (fix.length) await D.put('certs', fix);
  }));
}
/* status of one certificate, from the stored fields (same result as S.annotateCerts over the whole list) */
export function certSt(c, today, soonDays) {
  if (c.revoked) return 'REVOKED'; if (c.renewed) return 'RENEWED';
  const left = S.daysBetween(today, c.expiry); return left < 0 ? 'EXPIRED' : left <= soonDays ? 'SOON' : 'ACTIVE';
}

const RENEW_KEYS = ['tid', 'bid', 'start', 'issuedAt', 'revoked'];
export function indexed(D) {
  if (!D) return D;
  return {
    ...D, __inner: D,
    async put(col, rows) {
      if (!KEYS[col]) return D.put(col, rows);
      // renewals only for people whose certificates changed in a way that matters (new, revoked, training, dates, holder)
      const olds = col === 'certs' ? await Promise.all(rows.map(x => D.get(col, x.id))) : [];
      const r = await D.put(col, rows.map(x => ({ ...x, data: withSk(col, x.data) })));
      if (col === 'certs') await renewals(D, rows.flatMap((x, i) => (RENEW_KEYS.some(k => JSON.stringify(olds[i]?.[k] ?? null) !== JSON.stringify(x.data?.[k] ?? null)) ? [x.data?.tid, olds[i]?.tid] : [])));
      return r;
    },
    async insert(col, id, data) { const r = await D.insert(col, id, KEYS[col] ? withSk(col, data) : data); if (col === 'certs') await renewals(D, [data?.tid]); return r; },
    async insertMany(col, rows) { const r = await D.insertMany(col, KEYS[col] ? rows.map(x => ({ ...x, data: withSk(col, x.data) })) : rows); if (col === 'certs') await renewals(D, rows.map(x => x.data?.tid)); return r; },
    async del(col, id) { const old = col === 'certs' ? await D.get(col, id) : null; const r = await D.del(col, id); if (old) await renewals(D, [old.tid]); return r; },
    async delMany(col, ids) { const olds = col === 'certs' ? await Promise.all(ids.map(id => D.get(col, id))) : []; const r = await D.delMany(col, ids); if (olds.length) await renewals(D, olds.map(x => x?.tid)); return r; },
  };
}

/* fills in missing / outdated keys (all collections that have one); returns how many records were updated */
export async function reindex(D) {
  let n = 0;
  for (const col of Object.keys(KEYS)) {
    const all = await D.all(col), ren = new Map();
    if (col === 'certs') { const g = new Map(); for (const r of all) { if (!g.has(r.data.tid)) g.set(r.data.tid, []); g.get(r.data.tid).push(r.data); } for (const l of g.values()) for (const [no, v] of renewedMap(l)) ren.set(no, v); }
    const fixRen = r => { if (col !== 'certs') return r; const x = { ...r.data }; if (ren.get(r.id)) x.renewed = ren.get(r.id); else delete x.renewed; return { id: r.id, data: x }; };
    const todo = all.map(fixRen).filter((r, i) => r.data && (withSk(col, r.data) !== r.data || (r.data.renewed || null) !== (all[i].data.renewed || null)));
    const W = D.__inner || D;                     // renewals were computed above for everyone at once
    for (let i = 0; i < todo.length; i += 500) { await W.put(col, todo.slice(i, i + 500).map(r => ({ id: r.id, data: withSk(col, r.data) }))); }
    n += todo.length;
  }
  return n;
}
