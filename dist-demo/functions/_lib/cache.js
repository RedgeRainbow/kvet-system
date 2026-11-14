/* Per-request read cache in front of the database (each API request gets its own; nothing is shared between requests).
   - get(col, id): the same record is read once per request; gets for the same collection issued together (Promise.all)
     become ONE query (id in …) instead of one round trip each.
   - all(col): read once per request; later get / byField / prefix on that collection are answered from it.
   - query(col, spec): the same query is answered once per request.
   - writes go to the database first, then update the cache, so a request always reads what it just wrote.
     A loaded collection is kept as a Map by id: an update costs O(1), also for bulk writes of thousands of rows.
   Records are handed out as copies: a caller changing an object it has not saved cannot affect another caller. */
import { FIELD_COLS, diffOps } from './store.js';
const cp = v => (v === null || v === undefined ? v : structuredClone(v));

export function cached(D) {
  const one = new Map(), full = new Map(), misc = new Map(), pend = new Map();
  const key = (col, id) => col + '\u0000' + id;
  const dropMisc = col => { for (const k of misc.keys()) if (k.startsWith(col + '\u0000')) misc.delete(k); };
  const flush = async col => {
    const p = pend.get(col); pend.delete(col); const ids = [...p.keys()];
    try {
      let rows;
      if (ids.length === 1 || !D.getMany) rows = await Promise.all(ids.map(async id => ({ id, data: await D.get(col, id) })));
      else rows = await D.getMany(col, ids);
      const got = new Map(rows.map(r => [String(r.id), r.data ?? null]));
      for (const id of ids) { const v = got.has(String(id)) ? got.get(String(id)) : null; one.set(key(col, id), Promise.resolve(v)); for (const [res] of p.get(id)) res(cp(v)); }
    } catch (/** @type {any} */ e) { for (const id of ids) { one.delete(key(col, id)); for (const [, rej] of p.get(id)) rej(e); } }
  };
  // full.get(col) = { p: Promise<Map id -> row>, m: the Map once loaded, ops: writes made while it was still loading }
  const loadFull = col => {
    if (full.has(col)) return full.get(col);
    /** @type {{ m: Map<string, any> | null, ops: ((m: Map<string, any>) => void)[] | null, p: Promise<Map<string, any>> }} */
    const f = { m: null, ops: [], p: /** @type {any} */ (null) };
    f.p = D.all(col).then(rows => { const m = new Map(rows.map(r => [String(r.id), r])); for (const op of f.ops || []) op(m); f.ops = null; f.m = m; return m; });
    f.p.catch(() => full.delete(col)); full.set(col, f); return f;
  };
  const onFull = (col, op) => { const f = full.get(col); if (!f) return; if (f.m) op(f.m); else f.ops.push(op); };
  const put1 = (col, id, data) => {
    one.set(key(col, id), Promise.resolve(cp(data)));
    if (full.has(col)) { const r = { id, data: cp(data) }; onFull(col, m => m.set(String(id), r)); }
    dropMisc(col);
  };
  const del1 = (col, id) => {
    one.set(key(col, id), Promise.resolve(null));
    onFull(col, m => m.delete(String(id)));
    dropMisc(col);
  };
  const rowsOf = async col => [...(await loadFull(col).p).values()];
  const copies = rows => rows.map(r => ({ id: r.id, data: cp(r.data) }));
  return {
    ...D,
    get(col, id) {
      const k = key(col, id);
      if (one.has(k)) return one.get(k).then(cp);
      if (full.has(col)) { const v = loadFull(col).p.then(m => m.get(String(id))?.data ?? null); one.set(k, v); return v.then(cp); }
      return new Promise((res, rej) => {
        let p = pend.get(col); if (!p) { p = new Map(); pend.set(col, p); Promise.resolve().then(() => flush(col)); }
        if (!p.has(id)) p.set(id, []); p.get(id).push([res, rej]);
      });
    },
    all(col) { return rowsOf(col).then(copies); },
    byField(col, f, v) {
      if (full.has(col)) return rowsOf(col).then(rows => copies(rows.filter(r => String(r.data?.[f]) === String(v))));
      const k = col + '\u0000f\u0000' + f + '\u0000' + v; if (!misc.has(k)) misc.set(k, D.byField(col, f, v));
      return misc.get(k).then(copies);
    },
    prefix(col, p) {
      if (full.has(col)) return rowsOf(col).then(rows => copies(rows.filter(r => String(r.id).startsWith(p)).sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1))));
      const k = col + '\u0000p\u0000' + p; if (!misc.has(k)) misc.set(k, D.prefix(col, p));
      return misc.get(k).then(copies);
    },
    query(col, spec = {}) {
      const k = col + '\u0000q\u0000' + JSON.stringify(spec); if (!misc.has(k)) { const p = D.query(col, spec); misc.set(k, p); p.catch(() => misc.delete(k)); }
      return misc.get(k).then(r => ({ total: r.total, rows: copies(r.rows) }));
    },
    /* Collections in FIELD_COLS (store.js): a record this request has read is written back as "what changed since I read
       it", so a change another request made to a different part of it in the meantime is kept. Records the request did
       not read one by one (or collections not listed) are written whole, as before. */
    async put(col, rows) {
      if (!FIELD_COLS.has(col) || !D.patch) { const r = await D.put(col, rows); for (const x of rows) put1(col, x.id, x.data); return r; }
      const whole = [], part = [];
      for (const x of rows) {
        const k = key(col, x.id);
        if (!one.has(k)) { whole.push(x); continue; }
        const base = await one.get(k).catch(() => undefined);
        if (base === undefined) { whole.push(x); continue; }
        const { set, unset } = diffOps(col, base, x.data);
        if (set.length || unset.length || base === null) part.push({ id: x.id, base: x.data, set, unset });
      }
      // many records changed by one request (a roll call): one database call for all of them
      if (part.length > 1 && D.patchMany) await D.patchMany(col, part); else for (const p of part) await D.patch(col, p.id, p.base, p.set, p.unset);
      if (whole.length) await D.put(col, whole);
      for (const x of rows) put1(col, x.id, x.data);
    },
    async insert(col, id, data) { const r = await D.insert(col, id, data); put1(col, id, data); return r; },
    async insertMany(col, rows) { const r = await D.insertMany(col, rows); const by = new Map(rows.map(x => [x.id, x])); for (const id of r || []) { const x = by.get(id); if (x) put1(col, id, x.data); } return r; },
    async del(col, id) { const r = await D.del(col, id); del1(col, id); return r; },
    async delMany(col, ids) { const r = await D.delMany(col, ids); for (const id of ids) del1(col, id); return r; },
    async restore(...a) { const r = await D.restore(...a); one.clear(); full.clear(); misc.clear(); return r; },
    async restoreApply(...a) { const r = await D.restoreApply(...a); one.clear(); full.clear(); misc.clear(); return r; },
  };
}
