/* The shape every stored record must have, per collection: ONE definition used in three places.
   - the database: schema.sql has a CHECK constraint per collection table generated from this (tools/gen-schema.mjs);
     a write that breaks it is refused by Postgres itself, whichever code path makes it
   - the memory store (tests, dev server) checks the same rules on every write, so a test fails as soon as some route
     writes a record without a required field
   - types/records.d.ts describes the same records for the type checker (npm run typecheck)

   req:  fields that must be present, with their JSON type ('string' | 'number' | 'boolean' | 'object' | 'array')
   key:  the data field that must equal the record key when present ('id' for most; certificates are keyed by number)
   date: fields that must look like YYYY-MM-DD when present and not empty
   Old rows are not re-checked (the constraints are added NOT VALID); every new or changed row is. */
export const SHAPES = {
  trainees:  { key: 'id', req: { att: 'string' } },
  trainers:  { key: 'id', req: { name: 'string', login: 'string' } },
  companies: { key: 'id', req: { name: 'string', login: 'string' } },
  staff:     { req: { email: 'string', role: 'string' } },
  logins:    { req: { login: 'string' } },
  sessions:  { key: 'id', req: { bid: 'string', date: 'string' }, date: ['date', 'endDate'] },
  enr:       { req: { sid: 'string', tid: 'string' } },
  certs:     { key: 'no', req: { no: 'string', tid: 'string', bid: 'string', start: 'string', snap: 'object' }, date: ['start', 'end', 'expiry'] },
  blanks:    { key: 'id', req: { name: 'string' } },
  sheets:    { key: 'id', req: { name: 'string' } },
  tests:     { key: 'id', req: { title: 'string', questions: 'array' } },
  groups:    { key: 'id', req: { name: 'string' } },
  cogroups:  { key: 'id', req: { co: 'string', name: 'string', ids: 'array' } },
  requests:  { key: 'id', req: { co: 'string', status: 'string' } },
  candreq:   { key: 'id', req: { co: 'string', status: 'string' } },
  signs:     { key: 'id', req: { doc: 'string', role: 'string', hash: 'string' } },
  audit:     { req: { action: 'string', at: 'string' } },
  notes:     { req: { to: 'string', k: 'string', at: 'string' } },
  threads:   { key: 'id', req: { kind: 'string', acc: 'string' } },
  msgs:      { key: 'id', req: { th: 'string', from: 'string', text: 'string' } },
  libdocs:   { key: 'id', req: { title: 'string', key: 'string' } },
  materials: { key: 'id', req: { title: 'string' } },
  links:     { key: 'id', req: { status: 'string' } },
  errlog:    { req: { at: 'string', path: 'string' } },
};

/* collections with a table of their own (everything else shares the "other" table) */
export const TABLES = [...Object.keys(SHAPES), 'archive', 'retired', 'rel', 'fins', 'settings', 'kb', 'sigs', 'cams', 'snaps', 'nseen', 'claims', 'importres', 'aireport'];

/* Records saved by older versions that miss a field the key already holds get it back when read or restored:
   enrolments keyed "<session>|<trainee>" without "tid" (before v3 the trainee was not stored inside the record). */
export function repairRecord(col, id, data) {
  if (col === 'enr' && data && typeof data === 'object' && !data.tid && typeof id === 'string' && id.includes('|')) return { ...data, tid: id.slice(id.lastIndexOf('|') + 1) };
  return data;
}

const jtype = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const DATE = /^\d{4}-\d{2}-\d{2}/;
/* the reason a record breaks its collection's shape, or '' (same rules as the database constraints) */
export function shapeError(col, id, data) {
  if (jtype(data) !== 'object') return 'not an object';
  const s = SHAPES[col]; if (!s) return '';
  for (const [f, ty] of Object.entries(s.req)) if (jtype(data[f]) !== ty) return `${f} must be ${ty}`;
  if (s.key && data[s.key] !== undefined && data[s.key] !== null && data[s.key] !== '' && String(data[s.key]) !== String(id)) return `${s.key} differs from the record key`;
  for (const f of s.date || []) if (data[f] !== undefined && data[f] !== null && data[f] !== '' && !DATE.test(String(data[f]))) return `${f} is not a date`;
  return '';
}

/* ---- SQL (used by tools/gen-schema.mjs) ---- */
const SQLT = { string: 'string', number: 'number', boolean: 'boolean', object: 'object', array: 'array' };
export function checkSql(col) {
  const s = SHAPES[col]; if (!s) return null;
  const parts = Object.entries(s.req).map(([f, ty]) => `coalesce(jsonb_typeof(data->'${f}'), 'missing') = '${SQLT[ty]}'`);
  if (s.key) parts.push(`coalesce(nullif(data->>'${s.key}', ''), id) = id`);
  for (const f of s.date || []) parts.push(`coalesce(nullif(data->>'${f}', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`);
  return parts.join(' and ');
}
