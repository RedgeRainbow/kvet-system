/* Data layer. Two interchangeable implementations of the same small interface:
   - supabaseStore(env): production, talks to the `records` + `counters` tables with the service key
   - memoryStore():      tests and the local dev server
   Interface: all, get, getMany, query, put, insert, del, delMany, byField, prefix, seq, peek, bump, call

   query(col, spec) is how growing collections (trainees, certificates, sessions, enrolments, audit…) are read: the database
   filters, sorts, counts and pages, so a request never pulls a whole collection. spec:
     where:  [[field, op, value], …]   op: eq ne in gt gte lt lte null (value true = missing) has (array field contains value)
                                       nn (missing or not equal: ne drops missing ones, as SQL does) empty (true: missing or '')
     search: 'words'                   every word must occur in data.sk (the normalised search key, see search.js)
     order:  [field, 'asc'|'desc']     limit, offset, count: true (-> total), fields: [...] (return only these data fields)
   'id' as a field means the record key. Comparisons are on the text value (ISO dates compare correctly). */
export class H extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }

const q = encodeURIComponent;
/* Records whose data carries its own id. Rows written by older versions / imports sometimes lack it: the id is then taken
   from the record key, so such rows can still be opened, edited and deleted. */
const ID_COLS = new Set(['trainees', 'trainers', 'companies', 'sessions', 'blanks', 'sheets', 'tests', 'groups', 'materials', 'requests', 'cams', 'sigs', 'snaps']);
export const withId = (col, id, data) => fill(col, id, repairRecord(col, id, data));
const fill = (col, id, data) => (ID_COLS.has(col) && data && typeof data === 'object' && (data.id === undefined || data.id === null || data.id === '') ? { ...data, id } : data);

import { foldText } from '../../public/js/shared.js';
import { shapeError, repairRecord } from './shapes.js';

export function supabaseStore(env) {
  /** @type {any} */ let rpcIn = null;                  // records_in available? (null = not tried yet)
  const K = env.SUPABASE_SERVICE_KEY;
  /** @type {Record<string, string>} */
  const A = K.startsWith('sb_') ? { apikey: K } : { apikey: K, authorization: 'Bearer ' + K };
  const call = async (path, o = {}) => {
    const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + path, { ...o, headers: { ...A, 'content-type': 'application/json', ...o.headers } });
    const t = await r.text();
    // 23514: the record breaks its collection's rule in the database (shapes.js / schema.sql)
    if (!r.ok && /"23514"/.test(t)) throw new H(422, 'badRecord', { detail: t.slice(0, 300) });
    if (!r.ok) { const e = new Error('db ' + r.status + ' ' + t); e.status = r.status; e.body = t; throw e; }
    return t ? JSON.parse(t) : null;
  };
  // like call(), also returns the total row count the database reports (Prefer: count=exact)
  const callN = async path => {
    const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + path, { headers: { ...A, prefer: 'count=exact' } });
    const t = await r.text();
    if (!r.ok) { const e = new Error('db ' + r.status + ' ' + t); e.status = r.status; e.body = t; throw e; }
    const total = Number((r.headers.get('content-range') || '').split('/')[1]);
    return { rows: t ? JSON.parse(t) : [], total: Number.isFinite(total) ? total : null };
  };
  // whole result in pages of 1000: the first page tells how many there are, the rest are fetched in parallel (6 at a time)
  const PAGE = 1000;
  const page = async (filter, select = 'col,id,data', order = 'id') => {
    const base = `records?${filter}&select=${select}&order=${order}`, map = p => p.map(r => ({ id: r.id, data: withId(r.col, r.id, r.data) }));
    const first = await callN(`${base}&limit=${PAGE}&offset=0`), out = map(first.rows);
    if (first.rows.length < PAGE) return out;
    const n = first.total ?? Infinity, offs = []; for (let o = PAGE; o < n && offs.length < 1000; o += PAGE) offs.push(o);
    if (!Number.isFinite(n)) { for (let o = PAGE; ; o += PAGE) { const p = await call(`${base}&limit=${PAGE}&offset=${o}`); out.push(...map(p)); if (p.length < PAGE) return out; } }
    for (let i = 0; i < offs.length; i += 6) for (const p of await Promise.all(offs.slice(i, i + 6).map(o => call(`${base}&limit=${PAGE}&offset=${o}`)))) out.push(...map(p));
    return out;
  };
  // 'approval.status' -> data->approval->>status
  const path = f => { if (f === 'id') return 'id'; const p = String(f).split('.'); return 'data' + p.slice(0, -1).map(k => '->' + k).join('') + '->>' + p.at(-1); };
  const lit = v => { const x = String(v); return /[,()"\\:]/.test(x) ? '"' + x.replace(/["\\]/g, m => '\\' + m) + '"' : x; };
  /** @param {any} [col] @param {any} [spec] */
  function filterOf(col, spec = {}) {
    const f = [`col=eq.${q(col)}`], ors = [];
    for (const [k, op, v] of spec.where || []) {
      if (op === 'nn') { ors.push(`or(${path(k)}.is.null,${path(k)}.neq.${lit(v)})`); continue; }
      if (op === 'empty') { ors.push(v ? `or(${path(k)}.is.null,${path(k)}.eq.)` : `and(${path(k)}.not.is.null,${path(k)}.neq.)`); continue; }
      if (op === 'has') { f.push(`data=cs.${q(JSON.stringify({ [k]: [v] }))}`); continue; }
      if (op === 'null') { f.push(`${path(k)}=${v ? 'is.null' : 'not.is.null'}`); continue; }
      if (op === 'in') { f.push(`${path(k)}=in.(${q(v.map(lit).join(','))})`); continue; }
      const o = { eq: 'eq', ne: 'neq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' }[op]; if (!o) throw new Error('bad op ' + op);
      f.push(`${path(k)}=${o}.${q(String(v))}`);
    }
    for (const w of searchWords(spec.search)) f.push(`data->>sk=ilike.${q('*' + w + '*')}`);
    if (ors.length) f.push('and=' + q('(' + ors.join(',') + ')'));
    return f.join('&');
  }
  return {
    A, call,
    all: col => page(`col=eq.${col}`),
    async get(col, id) { return withId(col, id, (await call(`records?col=eq.${col}&id=eq.${q(id)}&select=data`))[0]?.data); },
    /* several records of one collection in one query (ids quoted for PostgREST, 80 per request to keep URLs short) */
    // many ids at once: one call to records_in (schema.sql); chunked "in" queries if that function is not installed yet
    async getMany(col, ids) { return (await this.inList(col, 'id', ids)).map(r => ({ id: r.id, data: withId(col, r.id, r.data) })); },
    async inList(col, field, vals, fields) {
      const u = [...new Set(vals.map(String))], out = [];
      if (rpcIn !== false) try {
        for (let i = 0; i < u.length; i += 5000) out.push(...(await call('rpc/records_in', { method: 'POST', body: JSON.stringify({ p_col: col, p_field: field, p_vals: u.slice(i, i + 5000), p_fields: fields || null }) })));
        rpcIn = true; return out.map(r => ({ id: r.id, data: withId(col, r.id, r.data) }));
      } catch (/** @type {any} */ e) { if (!(e.status === 404 || /records_in/.test(e.body || ''))) throw e; rpcIn = false; out.length = 0; }
      for (let i = 0; i < u.length; i += 60 * 6) out.push(...(await Promise.all(Array.from({ length: Math.ceil(Math.min(360, u.length - i) / 60) }, (_, k) => this.query(col, { where: [[field, 'in', u.slice(i + k * 60, i + k * 60 + 60)]], fields }).then(r => r.rows)))).flat());
      return out;
    },
    byField: (col, f, v) => page(`col=eq.${col}&data->>${f}=eq.${q(v)}`),
    async query(col, spec = {}) {
      const sel = spec.fields ? 'col,id,' + spec.fields.map(k => `${k}:data->${k}`).join(',') : 'col,id,data';
      const [ok, dir] = spec.order || ['id', 'asc'], d = dir === 'desc' ? 'desc' : 'asc', order = ok === 'id' ? 'id.' + d : `${path(ok)}.${d}.nullslast,id.${d}`;
      const fl = filterOf(col, spec), shape = r => withId(col, r.id, spec.fields ? Object.fromEntries(spec.fields.filter(k => r[k] !== null && r[k] !== undefined).map(k => [k, r[k]])) : r.data);
      if (spec.limit === undefined) {                    // everything that matches (pages fetched in parallel)
        const base = `records?${fl}&select=${sel}&order=${order}`, first = await callN(`${base}&limit=${PAGE}&offset=0`), out = [...first.rows];
        if (first.rows.length === PAGE) { const offs = []; for (let o = PAGE; o < (first.total ?? 0); o += PAGE) offs.push(o); for (let i = 0; i < offs.length; i += 6) for (const p of await Promise.all(offs.slice(i, i + 6).map(o => call(`${base}&limit=${PAGE}&offset=${o}`)))) out.push(...p); }
        return { rows: out.map(r => ({ id: r.id, data: shape(r) })), total: out.length };
      }
      const base = `records?${fl}&select=${sel}&order=${order}&limit=${Math.max(0, Math.min(spec.limit, PAGE))}&offset=${spec.offset || 0}`;
      const res = spec.count ? await callN(base) : { rows: await call(base), total: null };
      return { rows: res.rows.map(r => ({ id: r.id, data: shape(r) })), total: res.total };
    },
    prefix: (col, p) => page(`col=eq.${col}&id=like.${q(p)}*`),
    async put(col, rows) {
      for (let i = 0; i < rows.length; i += 500)
        await call('records?on_conflict=col,id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500).map(r => ({ col, id: r.id, data: r.data }))) });
    },
    /* Plain INSERT: fails with 409 when the id already exists (used for numbers that must stay unique). */
    async insert(col, id, data) {
      try { await call('records', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ col, id, data }) }); }
      catch (/** @type {any} */ e) { if (e.status === 409 || /23505/.test(e.body || '')) throw new H(409, 'dup'); throw e; }
    },
    del: (col, id) => call(`records?col=eq.${col}&id=eq.${q(id)}`, { method: 'DELETE' }),
    /* Deletes many ids with one request per 40 ids (the Worker has a small sub-request budget). */
    async delMany(col, ids) {
      /* Few, large requests (a Worker has a small sub-request budget): as many ids per call as a safe URL length allows. */
      ids = [...ids]; let batch = [], len = 0;
      const flush = async () => { if (!batch.length) return; const list = '(' + batch.join(',') + ')'; batch = []; len = 0; await call(`records?col=eq.${col}&id=in.${q(list)}`, { method: 'DELETE' }); };
      for (const x of ids) { const v = '"' + String(x).replace(/([\\"])/g, '\\$1') + '"'; if (len + q(v).length + 3 > 6000) await flush(); batch.push(v); len += q(v).length + 3; }
      await flush();
    },
    delCol: col => call(`records?col=eq.${col}`, { method: 'DELETE' }),
    seq: n => call('rpc/next_seq', { method: 'POST', body: JSON.stringify({ n }) }),
    async peek(n) { return (await call(`counters?name=eq.${q(n)}&select=val`))[0]?.val ?? 0; },
    bump: (n, v) => call('rpc/bump_seq', { method: 'POST', body: JSON.stringify({ n, v }) }),
    counters: () => call('counters?select=name,val'),
    /* k numbers at once; returns the first of them */
    async seqN(n, k) { const last = Number(await call('rpc/next_seq_n', { method: 'POST', body: JSON.stringify({ n, k }) })); return last - k + 1; },
    /* INSERT many rows, skipping ids that already exist; returns the ids that were actually inserted. */
    async insertMany(col, rows) {
      const out = [];
      for (let i = 0; i < rows.length; i += 500) {
        const r = await call('records?on_conflict=col,id&select=id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(rows.slice(i, i + 500).map(r => ({ col, id: r.id, data: r.data }))) });
        out.push(...(r || []).map(x => x.id));
      }
      return out;
    },
    /* login throttling, atomic in the database */
    lockState: async k => { const v = await call('rpc/login_state', { method: 'POST', body: JSON.stringify({ k }) }); return v ? Date.parse(v) : 0; },
    lockFail: async (k, max, secs) => { const v = await call('rpc/login_fail', { method: 'POST', body: JSON.stringify({ k, max_fails: max, lock_secs: secs }) }); return v ? Date.parse(v) : 0; },
    lockOk: k => call('rpc/login_ok', { method: 'POST', body: JSON.stringify({ k }) }),
    /* all-or-nothing restore: stage the rows, then swap them in with one database transaction */
    async restore(cols, data, ctrs) {
      await call('records_restore?col=neq.__none__', { method: 'DELETE' });
      for (const col of cols) { const rows = (data[col] || []).map(x => ({ col, id: x.id, data: repairRecord(col, x.id, x.data) })); for (let i = 0; i < rows.length; i += 500) await call('records_restore', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) }); }
      return call('rpc/apply_restore', { method: 'POST', body: JSON.stringify({ cols, ctrs: ctrs || [] }) });
    },
    setCounters: rows => call('counters?on_conflict=name', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }),
  };
}

export function memoryStore() {
  const cols = new Map(), counters = new Map(), locks = new Map();
  const col = c => { if (!cols.has(c)) cols.set(c, new Map()); return cols.get(c); };
  const cp = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  // the same rules as the database constraints (shapes.js): a route writing a malformed record fails here in the tests
  const chk = (c, rs) => { for (const r of rs) { const e = shapeError(c, r.id, r.data); if (e) throw new H(422, 'badRecord', { detail: `${c}/${r.id}: ${e}` }); } };
  /** @param {(id: any, d?: any) => boolean} [f] */
  const rows = (c, f = () => true) => [...col(c)].filter(([id, d]) => f(id, d)).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, data]) => ({ id, data: withId(c, id, cp(data)) }));
  return {
    all: async c => rows(c),
    get: async (c, id) => withId(c, id, cp(col(c).get(id))),
    getMany: async (c, ids) => ids.filter(id => col(c).has(id)).map(id => ({ id, data: withId(c, id, cp(col(c).get(id))) })),
    async inList(c, f, vals, fields) { const set = new Set(vals.map(String)); return memQuery([...col(c)].filter(([id, d]) => set.has(String(f === 'id' ? id : d?.[f]))).map(([id, d]) => ({ id, data: withId(c, id, d) })), { fields }, cp).rows; },
    byField: async (c, f, v) => rows(c, (_, d) => String(d?.[f]) === String(v)),
    prefix: async (c, p) => rows(c, id => id.startsWith(p)),
    async query(c, spec = {}) { return memQuery([...col(c)].map(([id, d]) => ({ id, data: withId(c, id, d) })), spec, cp); },
    put: async (c, rs) => { chk(c, rs); for (const r of rs) col(c).set(r.id, cp(r.data)); },
    insert: async (c, id, data) => { chk(c, [{ id, data }]); if (col(c).has(id)) throw new H(409, 'dup'); col(c).set(id, cp(data)); },
    del: async (c, id) => { col(c).delete(id); },
    delMany: async (c, ids) => { for (const id of ids) col(c).delete(id); },
    delCol: async c => { col(c).clear(); },
    seq: async n => { const v = (counters.get(n) || 0) + 1; counters.set(n, v); return v; },
    peek: async n => counters.get(n) || 0,
    bump: async (n, v) => { if ((counters.get(n) || 0) < v) counters.set(n, v); return counters.get(n); },
    counters: async () => [...counters].map(([name, val]) => ({ name, val })),
    setCounters: async rs => { for (const r of rs) counters.set(r.name, r.val); },
    seqN: async (n, k) => { const v = (counters.get(n) || 0); counters.set(n, v + k); return v + 1; },
    insertMany: async (c, rs) => { chk(c, rs); const out = []; for (const r of rs) if (!col(c).has(r.id)) { col(c).set(r.id, cp(r.data)); out.push(r.id); } return out; },
    lockState: async k => { const l = locks.get(k); return l?.until > Date.now() ? l.until : 0; },
    lockFail: async (k, max, secs) => { const l = locks.get(k) || { n: 0, until: 0, at: 0 }; if (Date.now() - l.at > secs * 1000) l.n = 0; l.n++; l.at = Date.now(); if (l.n >= max) { l.n = 0; l.until = Date.now() + secs * 1000; } locks.set(k, l); return l.until > Date.now() ? l.until : 0; },
    lockOk: async k => { locks.delete(k); },
    restore: async (cs, data, ctrs) => { if (cs.includes('audit')) throw new Error('audit cannot be restored'); for (const c of cs) { col(c).clear(); for (const x of data[c] || []) col(c).set(x.id, cp(repairRecord(c, x.id, x.data))); } for (const r of ctrs || []) counters.set(r.name, Math.max(counters.get(r.name) || 0, r.val)); },
    _dump: () => Object.fromEntries([...cols].map(([c, m]) => [c, Object.fromEntries(m)])),
  };
}

export function memoryBucket() {
  const m = new Map();
  const wrap = o => o && { body: new Blob([o.buf]).stream(), arrayBuffer: async () => o.buf, json: async () => JSON.parse(new TextDecoder().decode(o.buf)), httpMetadata: o.meta, size: o.buf.byteLength };
  return {
    async put(k, v, opts) { const buf = typeof v === 'string' ? new TextEncoder().encode(v).buffer : v instanceof ArrayBuffer ? v : new Uint8Array(v).buffer; m.set(k, { buf, meta: opts?.httpMetadata, at: new Date() }); },
    async get(k) { return wrap(m.get(k)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '' } = {}) { return { objects: [...m].filter(([k]) => k.startsWith(prefix)).map(([key, o]) => ({ key, size: o.buf.byteLength, uploaded: o.at })) }; },
    _keys: () => [...m.keys()],
  };
}

/* ------------------------------------------------------------------ shared by both stores */
export const searchWords = s => foldText(s).split(/\s+/).map(w => w.replace(/[,()"*\\%_:]/g, '')).filter(Boolean).slice(0, 6);
const val = (r, f) => (f === 'id' ? r.id : String(f).split('.').reduce((o, k) => (o == null ? undefined : o[k]), r.data));
const txt = v => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
/** @param {any} [list] @param {any} [spec] @param {any} [cp] */
export function memQuery(list, spec = {}, cp = x => x) {
  const tests = (spec.where || []).map(([f, op, v]) => r => {
    const a = val(r, f), x = txt(a);
    switch (op) {
      case 'eq': return x === String(v); case 'ne': return x !== null && x !== String(v); case 'in': return x !== null && v.map(String).includes(x);
      case 'gt': return x !== null && x > String(v); case 'gte': return x !== null && x >= String(v); case 'lt': return x !== null && x < String(v); case 'lte': return x !== null && x <= String(v);
      case 'null': return (x === null) === !!v; case 'nn': return x === null || x !== String(v); case 'empty': return (x === null || x === '') === !!v; case 'has': return Array.isArray(a) && a.map(String).includes(String(v));
      default: throw new Error('bad op ' + op);
    }
  });
  const words = searchWords(spec.search);
  let out = list.filter(r => tests.every(t => t(r)) && words.every(w => String(r.data?.sk || '').toLowerCase().includes(w)));
  const [ok, dir] = spec.order || ['id', 'asc'], m = dir === 'desc' ? -1 : 1;
  out.sort((a, b) => { const x = txt(val(a, ok)), y = txt(val(b, ok)); if (x !== y) return x === null ? 1 : y === null ? -1 : (x < y ? -m : m); return a.id < b.id ? -m : m; });
  const total = out.length; if (spec.limit !== undefined) out = out.slice(spec.offset || 0, (spec.offset || 0) + spec.limit);
  return { rows: out.map(r => ({ id: r.id, data: spec.fields ? Object.fromEntries(spec.fields.filter(k => r.data?.[k] !== undefined && r.data?.[k] !== null).map(k => [k, cp(r.data[k])])) : cp(r.data) })), total };
}
