-- KVET training management system: run in Supabase -> SQL Editor (safe to run again; the editor runs it as ONE
-- transaction, so if any statement fails nothing at all is changed).
-- All access goes through the Cloudflare Function with the service key. Row-level security is ON and has NO policies,
-- so the public (anon) key can read or write nothing here, even if someone calls the database API directly.
--
-- v5 (round 20): every collection has its OWN table (rec_trainees, rec_certs, rec_sessions, …) with database-enforced
-- rules for the shape of its records. They are the partitions of "records", so the app keeps one address to talk to
-- and Postgres sends each read / write only to the table of that collection.
-- Upgrading from v4: running this file converts the old single table. The old table is NOT deleted: it is kept as
-- "records_v4" with every row, and can be dropped by hand once the new version has run well for a while:
--     drop table records_v4;

-- ---------------------------------------------------------------- step 1: v4 -> v5 (only if the old single table exists)
do $$ begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = current_schema() and c.relname = 'records' and c.relkind = 'r') then
    alter table records rename to records_v4;
    alter table records_v4 rename constraint records_pkey to records_v4_pkey;
  end if;
end $$;

-- ---------------------------------------------------------------- step 2: the tables
create table if not exists records(col text not null, id text not null, data jsonb not null, updated_at timestamptz default now(),
  primary key(col, id)) partition by list (col);
-- >>> generated: collection tables (tools/gen-schema.mjs, from functions/_lib/shapes.js; do not edit by hand)
create table if not exists rec_trainees partition of records for values in ('trainees');
create table if not exists rec_trainers partition of records for values in ('trainers');
create table if not exists rec_companies partition of records for values in ('companies');
create table if not exists rec_staff partition of records for values in ('staff');
create table if not exists rec_logins partition of records for values in ('logins');
create table if not exists rec_sessions partition of records for values in ('sessions');
create table if not exists rec_enr partition of records for values in ('enr');
create table if not exists rec_certs partition of records for values in ('certs');
create table if not exists rec_blanks partition of records for values in ('blanks');
create table if not exists rec_sheets partition of records for values in ('sheets');
create table if not exists rec_tests partition of records for values in ('tests');
create table if not exists rec_groups partition of records for values in ('groups');
create table if not exists rec_cogroups partition of records for values in ('cogroups');
create table if not exists rec_requests partition of records for values in ('requests');
create table if not exists rec_candreq partition of records for values in ('candreq');
create table if not exists rec_signs partition of records for values in ('signs');
create table if not exists rec_audit partition of records for values in ('audit');
create table if not exists rec_notes partition of records for values in ('notes');
create table if not exists rec_threads partition of records for values in ('threads');
create table if not exists rec_msgs partition of records for values in ('msgs');
create table if not exists rec_libdocs partition of records for values in ('libdocs');
create table if not exists rec_materials partition of records for values in ('materials');
create table if not exists rec_links partition of records for values in ('links');
create table if not exists rec_errlog partition of records for values in ('errlog');
create table if not exists rec_archive partition of records for values in ('archive');
create table if not exists rec_retired partition of records for values in ('retired');
create table if not exists rec_rel partition of records for values in ('rel');
create table if not exists rec_fins partition of records for values in ('fins');
create table if not exists rec_settings partition of records for values in ('settings');
create table if not exists rec_kb partition of records for values in ('kb');
create table if not exists rec_sigs partition of records for values in ('sigs');
create table if not exists rec_cams partition of records for values in ('cams');
create table if not exists rec_snaps partition of records for values in ('snaps');
create table if not exists rec_nseen partition of records for values in ('nseen');
create table if not exists rec_claims partition of records for values in ('claims');
create table if not exists rec_importres partition of records for values in ('importres');
create table if not exists rec_aireport partition of records for values in ('aireport');
create table if not exists rec_other partition of records default;
-- every collection table: no access with the public keys (the API only uses the service key)
alter table rec_trainees enable row level security; revoke all on rec_trainees from anon, authenticated;
alter table rec_trainers enable row level security; revoke all on rec_trainers from anon, authenticated;
alter table rec_companies enable row level security; revoke all on rec_companies from anon, authenticated;
alter table rec_staff enable row level security; revoke all on rec_staff from anon, authenticated;
alter table rec_logins enable row level security; revoke all on rec_logins from anon, authenticated;
alter table rec_sessions enable row level security; revoke all on rec_sessions from anon, authenticated;
alter table rec_enr enable row level security; revoke all on rec_enr from anon, authenticated;
alter table rec_certs enable row level security; revoke all on rec_certs from anon, authenticated;
alter table rec_blanks enable row level security; revoke all on rec_blanks from anon, authenticated;
alter table rec_sheets enable row level security; revoke all on rec_sheets from anon, authenticated;
alter table rec_tests enable row level security; revoke all on rec_tests from anon, authenticated;
alter table rec_groups enable row level security; revoke all on rec_groups from anon, authenticated;
alter table rec_cogroups enable row level security; revoke all on rec_cogroups from anon, authenticated;
alter table rec_requests enable row level security; revoke all on rec_requests from anon, authenticated;
alter table rec_candreq enable row level security; revoke all on rec_candreq from anon, authenticated;
alter table rec_signs enable row level security; revoke all on rec_signs from anon, authenticated;
alter table rec_audit enable row level security; revoke all on rec_audit from anon, authenticated;
alter table rec_notes enable row level security; revoke all on rec_notes from anon, authenticated;
alter table rec_threads enable row level security; revoke all on rec_threads from anon, authenticated;
alter table rec_msgs enable row level security; revoke all on rec_msgs from anon, authenticated;
alter table rec_libdocs enable row level security; revoke all on rec_libdocs from anon, authenticated;
alter table rec_materials enable row level security; revoke all on rec_materials from anon, authenticated;
alter table rec_links enable row level security; revoke all on rec_links from anon, authenticated;
alter table rec_errlog enable row level security; revoke all on rec_errlog from anon, authenticated;
alter table rec_archive enable row level security; revoke all on rec_archive from anon, authenticated;
alter table rec_retired enable row level security; revoke all on rec_retired from anon, authenticated;
alter table rec_rel enable row level security; revoke all on rec_rel from anon, authenticated;
alter table rec_fins enable row level security; revoke all on rec_fins from anon, authenticated;
alter table rec_settings enable row level security; revoke all on rec_settings from anon, authenticated;
alter table rec_kb enable row level security; revoke all on rec_kb from anon, authenticated;
alter table rec_sigs enable row level security; revoke all on rec_sigs from anon, authenticated;
alter table rec_cams enable row level security; revoke all on rec_cams from anon, authenticated;
alter table rec_snaps enable row level security; revoke all on rec_snaps from anon, authenticated;
alter table rec_nseen enable row level security; revoke all on rec_nseen from anon, authenticated;
alter table rec_claims enable row level security; revoke all on rec_claims from anon, authenticated;
alter table rec_importres enable row level security; revoke all on rec_importres from anon, authenticated;
alter table rec_aireport enable row level security; revoke all on rec_aireport from anon, authenticated;
alter table rec_other enable row level security; revoke all on rec_other from anon, authenticated;
-- <<< end of generated tables
alter table records enable row level security;
revoke all on records from anon, authenticated;

-- ---------------------------------------------------------------- step 3: copy the v4 rows (once, checked)
do $$ declare n_old bigint; n_new bigint; begin
  if to_regclass('records_v4') is not null and not exists (select 1 from records limit 1) then
    insert into records(col, id, data, updated_at) select col, id, data, updated_at from records_v4;
    select count(*) into n_old from records_v4; select count(*) into n_new from records;
    if n_old <> n_new then raise exception 'copy check failed: % rows in records_v4, % copied', n_old, n_new; end if;
    raise notice 'v5: % rows copied into the collection tables (records_v4 kept)', n_new;
  end if;
end $$;
-- the old table cannot be written by the app any more by mistake: nobody but the owner may touch it
do $$ begin if to_regclass('records_v4') is not null then
  execute 'alter table records_v4 enable row level security'; execute 'revoke all on records_v4 from anon, authenticated';
end if; end $$;

-- ---------------------------------------------------------------- step 4: the shape rules of every collection
-- >>> generated: record shape rules (tools/gen-schema.mjs, from functions/_lib/shapes.js; do not edit by hand)
-- added NOT VALID: every new or changed row is checked; rows saved before are checked just below
alter table rec_trainees drop constraint if exists rec_trainees_shape;
alter table rec_trainees add constraint rec_trainees_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'att'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_trainers drop constraint if exists rec_trainers_shape;
alter table rec_trainers add constraint rec_trainers_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'login'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_companies drop constraint if exists rec_companies_shape;
alter table rec_companies add constraint rec_companies_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'login'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_staff drop constraint if exists rec_staff_shape;
alter table rec_staff add constraint rec_staff_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'email'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'role'), 'missing') = 'string') not valid;
alter table rec_logins drop constraint if exists rec_logins_shape;
alter table rec_logins add constraint rec_logins_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'login'), 'missing') = 'string') not valid;
alter table rec_sessions drop constraint if exists rec_sessions_shape;
alter table rec_sessions add constraint rec_sessions_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'bid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'date'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id and coalesce(nullif(data->>'date', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' and coalesce(nullif(data->>'endDate', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') not valid;
alter table rec_enr drop constraint if exists rec_enr_shape;
alter table rec_enr add constraint rec_enr_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'sid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'tid'), 'missing') = 'string') not valid;
alter table rec_certs drop constraint if exists rec_certs_shape;
alter table rec_certs add constraint rec_certs_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'no'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'tid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'bid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'start'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'snap'), 'missing') = 'object' and coalesce(nullif(data->>'no', ''), id) = id and coalesce(nullif(data->>'start', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' and coalesce(nullif(data->>'end', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' and coalesce(nullif(data->>'expiry', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') not valid;
alter table rec_blanks drop constraint if exists rec_blanks_shape;
alter table rec_blanks add constraint rec_blanks_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_sheets drop constraint if exists rec_sheets_shape;
alter table rec_sheets add constraint rec_sheets_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_tests drop constraint if exists rec_tests_shape;
alter table rec_tests add constraint rec_tests_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'title'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'questions'), 'missing') = 'array' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_groups drop constraint if exists rec_groups_shape;
alter table rec_groups add constraint rec_groups_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_cogroups drop constraint if exists rec_cogroups_shape;
alter table rec_cogroups add constraint rec_cogroups_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'co'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'ids'), 'missing') = 'array' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_requests drop constraint if exists rec_requests_shape;
alter table rec_requests add constraint rec_requests_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'co'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'status'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_candreq drop constraint if exists rec_candreq_shape;
alter table rec_candreq add constraint rec_candreq_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'co'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'status'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_signs drop constraint if exists rec_signs_shape;
alter table rec_signs add constraint rec_signs_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'doc'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'role'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'hash'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_audit drop constraint if exists rec_audit_shape;
alter table rec_audit add constraint rec_audit_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'action'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'at'), 'missing') = 'string') not valid;
alter table rec_notes drop constraint if exists rec_notes_shape;
alter table rec_notes add constraint rec_notes_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'to'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'k'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'at'), 'missing') = 'string') not valid;
alter table rec_threads drop constraint if exists rec_threads_shape;
alter table rec_threads add constraint rec_threads_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'kind'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'acc'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_msgs drop constraint if exists rec_msgs_shape;
alter table rec_msgs add constraint rec_msgs_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'th'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'from'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'text'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_libdocs drop constraint if exists rec_libdocs_shape;
alter table rec_libdocs add constraint rec_libdocs_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'title'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'key'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_materials drop constraint if exists rec_materials_shape;
alter table rec_materials add constraint rec_materials_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'title'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_links drop constraint if exists rec_links_shape;
alter table rec_links add constraint rec_links_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'status'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id) not valid;
alter table rec_errlog drop constraint if exists rec_errlog_shape;
alter table rec_errlog add constraint rec_errlog_shape check (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'at'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'path'), 'missing') = 'string') not valid;
alter table rec_archive drop constraint if exists rec_archive_shape;
alter table rec_archive add constraint rec_archive_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_retired drop constraint if exists rec_retired_shape;
alter table rec_retired add constraint rec_retired_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_rel drop constraint if exists rec_rel_shape;
alter table rec_rel add constraint rec_rel_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_fins drop constraint if exists rec_fins_shape;
alter table rec_fins add constraint rec_fins_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_settings drop constraint if exists rec_settings_shape;
alter table rec_settings add constraint rec_settings_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_kb drop constraint if exists rec_kb_shape;
alter table rec_kb add constraint rec_kb_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_sigs drop constraint if exists rec_sigs_shape;
alter table rec_sigs add constraint rec_sigs_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_cams drop constraint if exists rec_cams_shape;
alter table rec_cams add constraint rec_cams_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_snaps drop constraint if exists rec_snaps_shape;
alter table rec_snaps add constraint rec_snaps_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_nseen drop constraint if exists rec_nseen_shape;
alter table rec_nseen add constraint rec_nseen_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_claims drop constraint if exists rec_claims_shape;
alter table rec_claims add constraint rec_claims_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_importres drop constraint if exists rec_importres_shape;
alter table rec_importres add constraint rec_importres_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_aireport drop constraint if exists rec_aireport_shape;
alter table rec_aireport add constraint rec_aireport_shape check (jsonb_typeof(data) = 'object') not valid;
alter table rec_other drop constraint if exists rec_other_shape;
alter table rec_other add constraint rec_other_shape check (jsonb_typeof(data) = 'object') not valid;
-- rows saved before that break the rules: select * from shape_problems;  (should be empty)
create or replace view shape_problems with (security_invoker = true) as
  select 'trainees'::text as col, id, data from rec_trainees where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'att'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'trainers'::text as col, id, data from rec_trainers where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'login'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'companies'::text as col, id, data from rec_companies where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'login'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'staff'::text as col, id, data from rec_staff where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'email'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'role'), 'missing') = 'string')
  union all
  select 'logins'::text as col, id, data from rec_logins where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'login'), 'missing') = 'string')
  union all
  select 'sessions'::text as col, id, data from rec_sessions where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'bid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'date'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id and coalesce(nullif(data->>'date', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' and coalesce(nullif(data->>'endDate', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
  union all
  select 'enr'::text as col, id, data from rec_enr where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'sid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'tid'), 'missing') = 'string')
  union all
  select 'certs'::text as col, id, data from rec_certs where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'no'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'tid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'bid'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'start'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'snap'), 'missing') = 'object' and coalesce(nullif(data->>'no', ''), id) = id and coalesce(nullif(data->>'start', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' and coalesce(nullif(data->>'end', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' and coalesce(nullif(data->>'expiry', ''), '2000-01-01') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
  union all
  select 'blanks'::text as col, id, data from rec_blanks where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'sheets'::text as col, id, data from rec_sheets where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'tests'::text as col, id, data from rec_tests where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'title'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'questions'), 'missing') = 'array' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'groups'::text as col, id, data from rec_groups where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'cogroups'::text as col, id, data from rec_cogroups where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'co'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'name'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'ids'), 'missing') = 'array' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'requests'::text as col, id, data from rec_requests where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'co'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'status'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'candreq'::text as col, id, data from rec_candreq where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'co'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'status'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'signs'::text as col, id, data from rec_signs where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'doc'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'role'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'hash'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'audit'::text as col, id, data from rec_audit where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'action'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'at'), 'missing') = 'string')
  union all
  select 'notes'::text as col, id, data from rec_notes where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'to'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'k'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'at'), 'missing') = 'string')
  union all
  select 'threads'::text as col, id, data from rec_threads where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'kind'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'acc'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'msgs'::text as col, id, data from rec_msgs where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'th'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'from'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'text'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'libdocs'::text as col, id, data from rec_libdocs where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'title'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'key'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'materials'::text as col, id, data from rec_materials where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'title'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'links'::text as col, id, data from rec_links where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'status'), 'missing') = 'string' and coalesce(nullif(data->>'id', ''), id) = id)
  union all
  select 'errlog'::text as col, id, data from rec_errlog where not (jsonb_typeof(data) = 'object' and coalesce(jsonb_typeof(data->'at'), 'missing') = 'string' and coalesce(jsonb_typeof(data->'path'), 'missing') = 'string')
  union all
  select 'archive'::text as col, id, data from rec_archive where not (jsonb_typeof(data) = 'object')
  union all
  select 'retired'::text as col, id, data from rec_retired where not (jsonb_typeof(data) = 'object')
  union all
  select 'rel'::text as col, id, data from rec_rel where not (jsonb_typeof(data) = 'object')
  union all
  select 'fins'::text as col, id, data from rec_fins where not (jsonb_typeof(data) = 'object')
  union all
  select 'settings'::text as col, id, data from rec_settings where not (jsonb_typeof(data) = 'object')
  union all
  select 'kb'::text as col, id, data from rec_kb where not (jsonb_typeof(data) = 'object')
  union all
  select 'sigs'::text as col, id, data from rec_sigs where not (jsonb_typeof(data) = 'object')
  union all
  select 'cams'::text as col, id, data from rec_cams where not (jsonb_typeof(data) = 'object')
  union all
  select 'snaps'::text as col, id, data from rec_snaps where not (jsonb_typeof(data) = 'object')
  union all
  select 'nseen'::text as col, id, data from rec_nseen where not (jsonb_typeof(data) = 'object')
  union all
  select 'claims'::text as col, id, data from rec_claims where not (jsonb_typeof(data) = 'object')
  union all
  select 'importres'::text as col, id, data from rec_importres where not (jsonb_typeof(data) = 'object')
  union all
  select 'aireport'::text as col, id, data from rec_aireport where not (jsonb_typeof(data) = 'object')
  union all
  select 'other'::text as col, id, data from rec_other where not (jsonb_typeof(data) = 'object');
revoke all on shape_problems from anon, authenticated;
-- a table whose old rows are all fine gets its rule fully validated; the others are reported
do $$ declare t text; n bigint; begin
  foreach t in array array['trainees', 'trainers', 'companies', 'staff', 'logins', 'sessions', 'enr', 'certs', 'blanks', 'sheets', 'tests', 'groups', 'cogroups', 'requests', 'candreq', 'signs', 'audit', 'notes', 'threads', 'msgs', 'libdocs', 'materials', 'links', 'errlog', 'archive', 'retired', 'rel', 'fins', 'settings', 'kb', 'sigs', 'cams', 'snaps', 'nseen', 'claims', 'importres', 'aireport', 'other'] loop
    select count(*) into n from shape_problems where col = t;
    if n = 0 then execute format('alter table rec_%s validate constraint rec_%s_shape', t, t);
    else raise warning 'rec_%: % old rows break the shape rule (see: select * from shape_problems)', t, n; end if;
  end loop;
end $$;
-- <<< end of generated rules

-- ---------------------------------------------------------------- counters and numbering
create table if not exists counters(name text primary key, val bigint not null default 0);
create or replace function next_seq(n text) returns bigint language plpgsql as $$
declare v bigint; begin
 insert into counters(name,val) values(n,1) on conflict(name) do update set val=counters.val+1 returning val into v; return v; end $$;
-- raise a counter to at least v (used when a custom certificate number is confirmed)
create or replace function bump_seq(n text, v bigint) returns bigint language plpgsql as $$
declare r bigint; begin
 insert into counters(name,val) values(n,v) on conflict(name) do update set val=greatest(counters.val,v) returning val into r; return r; end $$;
-- reserve k numbers of a counter at once (bulk import): returns the LAST number reserved
create or replace function next_seq_n(n text, k int) returns bigint language plpgsql as $$
declare v bigint; begin
 insert into counters(name,val) values(n,k) on conflict(name) do update set val=counters.val+k returning val into v; return v; end $$;
alter table counters enable row level security; revoke all on counters from anon, authenticated;

-- ---------------------------------------------------------------- login throttling, inside the database (parallel attempts cannot slip past)
create table if not exists login_locks(key text primary key, n int not null default 0, until timestamptz, updated_at timestamptz default now());
alter table login_locks enable row level security; revoke all on login_locks from anon, authenticated;
-- one failed attempt: returns the lock end (null = not locked). max failures in a row -> locked for lock_secs.
create or replace function login_fail(k text, max_fails int, lock_secs int) returns timestamptz language plpgsql as $$
declare r login_locks; begin
 -- failures older than the lock window are forgotten (a classroom's typos of last week never add up)
 insert into login_locks(key,n) values(k,1) on conflict(key) do update set n=case when login_locks.updated_at < now()-make_interval(secs=>lock_secs) then 1 else login_locks.n+1 end, updated_at=now() returning * into r;
 if r.n >= max_fails then update login_locks set n=0, until=now()+make_interval(secs=>lock_secs) where key=k returning * into r; end if;
 return case when r.until > now() then r.until else null end; end $$;
create or replace function login_state(k text) returns timestamptz language sql as $$ select until from login_locks where key=k and until > now() $$;
create or replace function login_ok(k text) returns void language sql as $$ delete from login_locks where key=k $$;

-- ---------------------------------------------------------------- restore from a backup in ONE transaction
-- rows are first copied into records_restore, then swapped in here. The audit trail is never part of a restore.
create table if not exists records_restore(col text not null, id text not null, data jsonb not null, primary key(col,id));
alter table records_restore enable row level security; revoke all on records_restore from anon, authenticated;
create or replace function apply_restore(cols text[], ctrs jsonb) returns int language plpgsql as $$
declare c int; begin
 if exists(select 1 from records_restore where col='audit') then raise exception 'audit cannot be restored'; end if;
 delete from records where col = any(cols);
 insert into records(col,id,data) select col,id,data from records_restore where col = any(cols);
 get diagnostics c = row_count;
 if ctrs is not null and jsonb_array_length(ctrs) > 0 then
  insert into counters(name,val) select x->>'name', (x->>'val')::bigint from jsonb_array_elements(ctrs) x
  on conflict(name) do update set val=greatest(counters.val, excluded.val);
 end if;
 delete from records_restore; return c; end $$;

-- ---------------------------------------------------------------- many records by a list of values in ONE call
-- (ids of a session's people, enrolments of 300 sessions …): a URL can only carry ~60 values
create or replace function records_in(p_col text, p_field text, p_vals text[], p_fields text[] default null)
returns table(id text, data jsonb) language plpgsql stable as $$
begin
  return query execute format('select r.id, %s from records r where r.col = $1 and %s = any($2)',
    case when p_fields is null then 'r.data' else '(select coalesce(jsonb_object_agg(k, r.data->k), ''{}''::jsonb) from unnest($3) k where r.data ? k)' end,
    case when p_field = 'id' then 'r.id' else format('(r.data->>%L)', p_field) end)
  using p_col, p_vals, p_fields;
end $$;

-- ---------------------------------------------------------------- System -> Health
create or replace function db_size() returns bigint language sql security definer set search_path = pg_catalog, public as $$ select pg_database_size(current_database()) $$;
-- rows and disk size of every collection table
create or replace function table_sizes() returns table(col text, rows bigint, bytes bigint) language sql security definer set search_path = pg_catalog, public as $$
  select substr(c.relname, 5), c.reltuples::bigint, pg_total_relation_size(c.oid)
  from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'records'::regclass order by 3 desc $$;

revoke execute on function next_seq(text), bump_seq(text, bigint), next_seq_n(text,int), login_fail(text,int,int), login_state(text), login_ok(text),
  apply_restore(text[],jsonb), records_in(text, text, text[], text[]), db_size(), table_sizes() from public, anon, authenticated;

-- ---------------------------------------------------------------- indexes (each on its own collection table)
-- Every list the app shows is filtered, counted and paged by the database; these keep it fast with years of data.
create extension if not exists pg_trgm;
-- prefix lookups (id like 'abc%'): signatures of a session, audit months, enrolments of a session
create index if not exists rec_col_id_prefix on records (col, id text_pattern_ops);
-- trainees
create index if not exists rec_trainees_co      on rec_trainees ((data->>'co'));
create index if not exists rec_trainees_sk      on rec_trainees using gin ((data->>'sk') gin_trgm_ops);
create index if not exists rec_trainees_phone   on rec_trainees ((data->>'phone'));
create index if not exists rec_trainees_email   on rec_trainees ((data->>'email'));
create index if not exists rec_trainees_created on rec_trainees ((data->>'createdAt'));
create index if not exists rec_trainees_surname on rec_trainees ((data->>'surname'));
-- certificates: by person / company / template / session / status / expiry / period, approval queue
create index if not exists rec_certs_tid      on rec_certs ((data->>'tid'));
create index if not exists rec_certs_co       on rec_certs ((data->>'co'));
create index if not exists rec_certs_cox      on rec_certs ((data->>'cox'));
create index if not exists rec_certs_bid      on rec_certs ((data->>'bid'));
create index if not exists rec_certs_sid      on rec_certs ((data->>'sid'));
create index if not exists rec_certs_sk       on rec_certs using gin ((data->>'sk') gin_trgm_ops);
create index if not exists rec_certs_exp      on rec_certs ((data->>'exp')) where (data->>'revoked') is null and (data->>'renewed') is null;
create index if not exists rec_certs_issued   on rec_certs ((data->>'issuedAt'));
create index if not exists rec_certs_approval on rec_certs ((data->'approval'->>'status')) where (data->'approval') is not null;
-- sessions: by date window, trainer, template, sheet, test; "which sessions include this person / presentation"
create index if not exists rec_sessions_tid   on rec_sessions ((data->>'tid'));
create index if not exists rec_sessions_date  on rec_sessions ((data->>'date'));
create index if not exists rec_sessions_bid   on rec_sessions ((data->>'bid'));
create index if not exists rec_sessions_sheet on rec_sessions ((data->>'sheetId'));
create index if not exists rec_sessions_exam  on rec_sessions ((data->>'examId'));
create index if not exists rec_sessions_json  on rec_sessions using gin (data jsonb_path_ops);
-- enrolments: per session, per person; open results (issue queue) without scanning closed ones
create index if not exists rec_enr_sid  on rec_enr ((data->>'sid'));
create index if not exists rec_enr_tid  on rec_enr ((data->>'tid'));
create index if not exists rec_enr_open on rec_enr ((data->>'sid')) where (data->>'final') is null;
-- queues and histories
create index if not exists rec_audit_eid       on rec_audit ((data->>'eid'));
create index if not exists rec_candreq_status  on rec_candreq ((data->>'status'));
create index if not exists rec_candreq_co      on rec_candreq ((data->>'co'));
create index if not exists rec_candreq_trainee on rec_candreq ((data->>'traineeId'));
create index if not exists rec_candreq_at      on rec_candreq ((data->>'at'));
create index if not exists rec_links_status    on rec_links ((data->>'status'));
create index if not exists rec_requests_co     on rec_requests ((data->>'co'));
create index if not exists rec_requests_status on rec_requests ((data->>'status'));
create index if not exists rec_requests_at     on rec_requests ((data->>'at'));
create index if not exists rec_signs_code      on rec_signs ((data->>'code'));
-- notifications, messages, company groups, error log
create index if not exists rec_notes_to      on rec_notes ((data->>'to'), (data->>'at'));
create index if not exists rec_notes_ref     on rec_notes ((data->>'ref')) where (data->>'ref') is not null;
create index if not exists rec_msgs_th       on rec_msgs ((data->>'th'), (data->>'at'));
create index if not exists rec_threads_last  on rec_threads ((data->>'lastAt'));
create index if not exists rec_cogroups_co   on rec_cogroups ((data->>'co'));
create index if not exists rec_errlog_at     on rec_errlog ((data->>'at'));
analyze records;
