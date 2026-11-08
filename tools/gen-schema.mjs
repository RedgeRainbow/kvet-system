/* Writes the generated part of schema.sql (one table per collection, row-level security, shape constraints) from
   functions/_lib/shapes.js, so the database rules and the code can never drift apart.
     node tools/gen-schema.mjs          rewrite the block in schema.sql
     node tools/gen-schema.mjs --check  exit 1 if schema.sql is out of date (the tests run this) */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SHAPES, TABLES, checkSql } from '../functions/_lib/shapes.js';

const FILE = fileURLToPath(new URL('../schema.sql', import.meta.url));
const MARK = [['-- >>> generated: collection tables (tools/gen-schema.mjs, from functions/_lib/shapes.js; do not edit by hand)', '-- <<< end of generated tables'],
  ['-- >>> generated: record shape rules (tools/gen-schema.mjs, from functions/_lib/shapes.js; do not edit by hand)', '-- <<< end of generated rules']];
const ALL = () => [...TABLES, 'other'];
const expr = c => { const x = checkSql(c); return `jsonb_typeof(data) = 'object'` + (x ? ` and ${x}` : ''); };

export function generated() {
  const A = [MARK[0][0]];
  for (const c of TABLES) A.push(`create table if not exists rec_${c} partition of records for values in ('${c}');`);
  A.push(`create table if not exists rec_other partition of records default;`);
  A.push('-- every collection table: no access with the public keys (the API only uses the service key)');
  for (const c of ALL()) A.push(`alter table rec_${c} enable row level security; revoke all on rec_${c} from anon, authenticated;`);
  A.push(MARK[0][1]);
  const B = [MARK[1][0], '-- added NOT VALID: every new or changed row is checked; rows saved before are checked just below'];
  for (const c of ALL()) {
    B.push(`alter table rec_${c} drop constraint if exists rec_${c}_shape;`);
    B.push(`alter table rec_${c} add constraint rec_${c}_shape check (${expr(c)}) not valid;`);
  }
  B.push('-- rows saved before that break the rules: select * from shape_problems;  (should be empty)');
  B.push('create or replace view shape_problems with (security_invoker = true) as');
  B.push(ALL().map(c => `  select '${c}'::text as col, id, data from rec_${c} where not (${expr(c)})`).join('\n  union all\n') + ';');
  B.push('revoke all on shape_problems from anon, authenticated;');
  B.push(`-- a table whose old rows are all fine gets its rule fully validated; the others are reported
do $$ declare t text; n bigint; begin
  foreach t in array array[${ALL().map(c => `'${c}'`).join(', ')}] loop
    select count(*) into n from shape_problems where col = t;
    if n = 0 then execute format('alter table rec_%s validate constraint rec_%s_shape', t, t);
    else raise warning 'rec_%: % old rows break the shape rule (see: select * from shape_problems)', t, n; end if;
  end loop;
end $$;`);
  B.push(MARK[1][1]);
  return [A.join('\n'), B.join('\n')];
}

export function render(s) {
  const g = generated(); let out = s;
  MARK.forEach(([b, e], i) => { const a = out.indexOf(b), z = out.indexOf(e); if (a < 0 || z < 0) throw new Error('markers not found in schema.sql: ' + b); out = out.slice(0, a) + g[i] + out.slice(z + e.length); });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = readFileSync(FILE, 'utf8'), next = render(s);
  if (process.argv.includes('--check')) { if (next !== s) { console.error('schema.sql is out of date: run node tools/gen-schema.mjs'); process.exit(1); } console.log('schema.sql up to date'); }
  else { writeFileSync(FILE, next); console.log(`schema.sql: ${TABLES.length + 1} collection tables, ${Object.keys(SHAPES).length} shape rules`); }
}
