// A SMALL stand-in for Supabase's REST layer (PostgREST), for LOCAL drills only: it lets the real storage code
// (functions/_lib/store.js) talk to a plain local PostgreSQL that has schema.sql loaded.
// It understands exactly the request shapes store.js sends - not PostgREST in general - and runs each as SQL through psql.
// Never expose it: it has no authentication. Used by tools/restore-drill-local.mjs.
import http from 'node:http';
import { spawn } from 'node:child_process';

const ident = s => { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw err(400, 'bad name ' + s); return s; };
const err = (status, message, code = 'SHIM') => Object.assign(new Error(message), { status, code });
const lit = v => "'" + String(v).replace(/'/g, "''") + "'";
/* data->a->>b  ->  (data->'a'->>'b') ; id / col / name / val / key stay columns */
function colExpr(k) {
  if (/^(id|col|name|val|key|updated_at)$/.test(k)) return k;
  const m = k.match(/^data((?:->>?[^-]+)*)$/); if (!m) throw err(400, 'bad column ' + k);
  if (k === 'data') return 'data';
  return '(data' + m[1].replace(/(->>?)([^-]+)/g, (_, op, name) => op + lit(name)) + ')';
}
/* "a,b,\"c,d\"" -> ['a','b','c,d'] (top-level commas; quotes and brackets respected) */
function splitTop(s) {
  const out = []; let cur = '', depth = 0, inq = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (inq) { if (ch === '\\') { cur += ch + s[++i]; continue; } if (ch === '"') inq = false; cur += ch; continue; }
    if (ch === '"') { inq = true; cur += ch; continue; }
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch; }
  out.push(cur); return out;
}
const unq = s => (s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/\\(["\\])/g, '$1') : s);
function cond(expr, rule) {
  let not = false; if (rule.startsWith('not.')) { not = true; rule = rule.slice(4); }
  const i = rule.indexOf('.'), op = i < 0 ? rule : rule.slice(0, i), v = i < 0 ? '' : rule.slice(i + 1); let sql;
  if (op === 'is') sql = `${expr} is ${v === 'null' ? 'null' : v === 'true' ? 'true' : 'false'}`;
  else if (op === 'in') sql = `${expr} in (${splitTop(v.replace(/^\(|\)$/g, '')).map(x => lit(unq(x))).join(',') || 'null'})`;
  else if (op === 'like' || op === 'ilike') sql = `${expr} ${op} ${lit(v.replace(/\*/g, '%'))}`;
  else if (op === 'cs') sql = `${expr} @> ${lit(v)}::jsonb`;
  else { const o = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]; if (!o) throw err(400, 'bad operator ' + op); sql = `${expr} ${o} ${lit(unq(v))}`; }
  return not ? `not (${sql})` : sql;
}
/* or(a.eq.1,and(b.is.null,c.neq.2)) */
function logic(kind, body) {
  return '(' + splitTop(body).map(part => { const m = part.match(/^(or|and)\((.*)\)$/s); if (m) return logic(m[1], m[2]); const j = part.search(/\.(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs)\./); if (j < 0) throw err(400, 'bad condition ' + part); return cond(colExpr(part.slice(0, j)), part.slice(j + 1)); }).join(kind === 'or' ? ' or ' : ' and ') + ')';
}
function parse(url) {
  const where = [], o = { select: '*', order: '', limit: null, offset: 0, conflict: '' };
  for (const [k, v] of url.searchParams) {
    if (k === 'select') o.select = v; else if (k === 'order') o.order = v; else if (k === 'limit') o.limit = Number(v); else if (k === 'offset') o.offset = Number(v); else if (k === 'on_conflict') o.conflict = v;
    else if (k === 'or' || k === 'and') where.push(logic(k, v.replace(/^\(|\)$/g, '')));
    else where.push(cond(colExpr(k), v));
  }
  return { ...o, where: where.length ? ' where ' + where.join(' and ') : '' };
}
const selectSql = s => (s === '*' ? '*' : splitTop(s).map(p => { const m = p.match(/^([A-Za-z0-9_]+):(.+)$/); return m ? `${colExpr(m[2].replace(/->([^->]+)$/, '->$1')).replace(/^\((.*)\)$/, '$1')} as "${ident(m[1])}"` : colExpr(p); }).join(', '));
const orderSql = s => (s ? ' order by ' + splitTop(s).map(p => { const bits = p.split('.'), mods = []; while (['asc', 'desc', 'nullslast', 'nullsfirst'].includes(bits.at(-1))) mods.unshift(bits.pop()); return colExpr(bits.join('.')) + ' ' + mods.map(m => ({ nullslast: 'nulls last', nullsfirst: 'nulls first' }[m] || m)).join(' '); }).join(', ') : '');

export function startShim({ port = 54330, psql = ['psql'], log = false } = {}) {
  /* one SQL statement -> its single JSON value */
  const run = sql => new Promise((res, rej) => {
    const p = spawn(psql[0], [...psql.slice(1), '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', '-']); let out = '', e = '';
    p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (e += d));
    p.on('close', code => { if (code === 0) return res(out.trim()); const m = e.match(/ERROR:\s+([0-9A-Z]{5}):\s*(.*)/); rej(err(m?.[1] === '23505' ? 409 : m?.[1] === '42883' ? 404 : m?.[1] === '42501' ? 403 : 400, m?.[2] || e.trim(), m?.[1] || 'XX000')); });
    p.stdin.end(sql + '\n');
  });
  const tag = () => '$j' + Math.random().toString(36).slice(2) + '$';
  const fns = new Map();
  async function fnInfo(name) {
    if (!fns.has(name)) { const r = await run(`select json_build_object('names', proargnames, 'types', (select array_agg(t::regtype::text order by o) from unnest(proargtypes) with ordinality as x(t, o)), 'set', proretset, 'ret', prorettype::regtype::text) from pg_proc where proname = ${lit(name)} and pronamespace = 'public'::regnamespace limit 1`); if (!r) throw err(404, `Could not find the function public.${name} in the schema cache`, 'PGRST202'); fns.set(name, JSON.parse(r)); }
    return fns.get(name);
  }
  let reqs = 0;                                                    // requests since the last count(): each is one sub-request of a Worker
  const server = http.createServer(async (req, res) => {
    reqs++;
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks).toString('utf8'), url = new URL(req.url, 'http://x'), path = url.pathname.replace(/^\/rest\/v1\//, ''), prefer = String(req.headers.prefer || '');
    try {
      let out = '', headers = {};
      if (path.startsWith('rpc/')) {
        const name = ident(path.slice(4)), f = await fnInfo(name), args = body ? JSON.parse(body) : {}, t = tag(), n = (f.names || []).slice(0, (f.types || []).length);
        const call = `${name}(${Object.keys(args).map(k => { const i = n.indexOf(k); if (i < 0) throw err(404, `Could not find the function public.${name}(${k}) in the schema cache`, 'PGRST202'); const ty = f.types[i]; return `${ident(k)} => ${ty === 'jsonb' || ty === 'json' ? `(j->${lit(k)})` : ty.endsWith('[]') ? `(select array_agg(x)::${ty} from jsonb_array_elements_text(case when jsonb_typeof(j->${lit(k)}) = 'array' then j->${lit(k)} else '[]'::jsonb end) x)` : `(j->>${lit(k)})::${ty}`}`; }).join(', ')})`;
        out = await run(`with a as (select ${t}${JSON.stringify(args)}${t}::jsonb as j) select ${f.set ? `coalesce(json_agg(r), '[]') from a, ${call} r` : f.ret === 'void' ? `'null' from a, lateral (select ${call}) r` : `to_json(${call}) from a`}`);
      } else {
        const table = ident(path), q = parse(url);
        if (req.method === 'GET') {
          const page = `select ${selectSql(q.select)} from ${table}${q.where}${orderSql(q.order)}${q.limit === null ? '' : ' limit ' + q.limit} offset ${q.offset}`;
          if (prefer.includes('count=exact')) { const r = JSON.parse(await run(`select json_build_object('rows', (select coalesce(json_agg(t), '[]') from (${page}) t), 'n', (select count(*) from ${table}${q.where}))`)); out = JSON.stringify(r.rows); headers['content-range'] = `${q.offset}-${q.offset + r.rows.length - 1}/${r.n}`; }
          else out = await run(`select coalesce(json_agg(t), '[]') from (${page}) t`);
        } else if (req.method === 'DELETE') { out = await run(`with d as (delete from ${table}${q.where} returning 1) select 'null' from (select count(*) from d) x`); }
        else if (req.method === 'POST') {
          const t = tag(), rows = JSON.parse(body), list = Array.isArray(rows) ? rows : [rows], cols = Object.keys(list[0] || {}).map(ident);
          const conflict = q.conflict ? ` on conflict (${q.conflict.split(',').map(ident).join(',')}) ${prefer.includes('ignore-duplicates') ? 'do nothing' : 'do update set ' + cols.filter(c => !q.conflict.split(',').includes(c)).map(c => `${c} = excluded.${c}`).join(', ')}` : '';
          const ins = `insert into ${table}(${cols.join(',')}) select ${cols.map(c => (c === 'data' ? `x->'data'` : `x->>${lit(c)}`)).join(',')} from jsonb_array_elements(${t}${JSON.stringify(list)}${t}::jsonb) x${conflict}`;
          out = prefer.includes('return=representation') ? await run(`with i as (${ins} returning ${q.select === '*' ? '*' : selectSql(q.select)}) select coalesce(json_agg(i), '[]') from i`) : await run(`with i as (${ins} returning 1) select 'null' from (select count(*) from i) x`);
          res.writeHead(201, { 'content-type': 'application/json', ...headers }); return res.end(out === 'null' ? '' : out);
        } else throw err(405, 'method');
      }
      if (log) console.log(req.method, req.url.slice(0, 120), '->', out.length);
      res.writeHead(200, { 'content-type': 'application/json', ...headers }); res.end(out === 'null' ? '' : out);
    } catch (/** @type {any} */ e) {
      if (log || !e.status) console.error('shim', req.method, req.url.slice(0, 160), '->', e.status || 500, e.code, e.message);
      res.writeHead(e.status || 500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ code: e.code || 'SHIM', message: e.message }));
    }
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${port}`, close: () => server.close(), run, count: () => { const n = reqs; reqs = 0; return n; } })));
}
