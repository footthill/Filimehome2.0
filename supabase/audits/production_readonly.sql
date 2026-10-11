-- FilimeHome: read-only production schema and access-policy report.
-- Run with an authorized database-owner connection in the existing Supabase
-- project's SQL editor. This script does not create, alter, publish, or delete
-- anything. It reports schema/access metadata only: no application rows,
-- user records, credentials, JWTs, or API keys are selected.
--
-- Share the result tables for review, not your connection string or credentials.
-- Missing relations/columns are configuration findings, not an instruction to
-- run a migration. Review changes against the existing website before deployment.
--
-- Limits: this snapshot cannot prove authenticated cross-user isolation or
-- application behavior. Those checks need authorized test-user sessions.
-- RLS policies do not protect against a table owner or a BYPASSRLS/service role;
-- such roles must never be embedded in the website or APK. Views and exposed
-- functions can introduce additional access paths requiring separate review.

begin transaction read only;
set local statement_timeout = '15s';
set local search_path = pg_catalog;

-- 1. Presence and RLS status. Includes the existing website account/social
-- tables and proposed application tables; missing tables are reported explicitly.
with expected(schema_name, table_name) as (
  values ('public', 'moviesv2'), ('public', 'appusers'),
         ('public', 'users_filimehome'), ('public', 'comments_filimehome'),
         ('public', 'likes_filimehome'), ('public', 'profiles'),
         ('public', 'user_library'), ('public', 'watch_history'),
         ('public', 'categories'), ('storage', 'objects')
)
select e.schema_name, e.table_name,
       c.oid is not null as relation_exists,
       c.relkind as relation_kind,
       c.relrowsecurity as row_level_security_enabled,
       c.relforcerowsecurity as force_row_level_security
from expected e
left join pg_namespace n on n.nspname = e.schema_name
left join pg_class c on c.relnamespace = n.oid and c.relname = e.table_name
order by e.schema_name, e.table_name;

-- 2. Actual column names/types/nullability. Defaults and row values are omitted.
select n.nspname as schema_name, c.relname as table_name,
       a.attnum as ordinal_position, a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as column_type,
       not a.attnotnull as is_nullable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
where (n.nspname, c.relname) in (
  ('public', 'moviesv2'), ('public', 'appusers'),
  ('public', 'users_filimehome'), ('public', 'comments_filimehome'),
  ('public', 'likes_filimehome'), ('public', 'profiles'),
  ('public', 'user_library'), ('public', 'watch_history'),
  ('public', 'categories'), ('storage', 'objects')
)
  and a.attnum > 0 and not a.attisdropped
order by n.nspname, c.relname, a.attnum;

-- 3. All policy expressions, including permissive/restrictive composition.
-- A permissive policy can widen access by OR-ing with another policy.
select schemaname as schema_name, tablename as table_name, policyname,
       permissive, roles, cmd as command,
       qual as using_expression, with_check as with_check_expression
from pg_policies
where (schemaname, tablename) in (
  ('public', 'moviesv2'), ('public', 'appusers'),
  ('public', 'users_filimehome'), ('public', 'comments_filimehome'),
  ('public', 'likes_filimehome'), ('public', 'profiles'),
  ('public', 'user_library'), ('public', 'watch_history'),
  ('public', 'categories'), ('storage', 'objects')
)
order by schemaname, tablename, policyname;

-- 4. Direct relation grants. PUBLIC is a PostgreSQL pseudo-role (grantee 0),
-- so inspect ACLs directly to include it reliably alongside the API roles.
select n.nspname as schema_name, c.relname as table_name,
       case when acl.grantee = 0 then 'PUBLIC' else r.rolname end as grantee,
       acl.privilege_type, acl.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
left join pg_roles r on r.oid = acl.grantee
where (n.nspname, c.relname) in (
  ('public', 'moviesv2'), ('public', 'appusers'),
  ('public', 'users_filimehome'), ('public', 'comments_filimehome'),
  ('public', 'likes_filimehome'), ('public', 'profiles'),
  ('public', 'user_library'), ('public', 'watch_history'),
  ('public', 'categories'), ('storage', 'objects')
)
  and (acl.grantee = 0 or r.rolname in ('anon', 'authenticated'))
order by n.nspname, c.relname, grantee, acl.privilege_type;

-- 5. Direct column grants can permit access even without a table-wide grant.
select n.nspname as schema_name, c.relname as table_name,
       a.attname as column_name,
       case when acl.grantee = 0 then 'PUBLIC' else r.rolname end as grantee,
       acl.privilege_type, acl.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
cross join lateral aclexplode(a.attacl) acl
left join pg_roles r on r.oid = acl.grantee
where (n.nspname, c.relname) in (
  ('public', 'moviesv2'), ('public', 'appusers'),
  ('public', 'users_filimehome'), ('public', 'comments_filimehome'),
  ('public', 'likes_filimehome'), ('public', 'profiles'),
  ('public', 'user_library'), ('public', 'watch_history'),
  ('public', 'categories'), ('storage', 'objects')
)
  and a.attnum > 0 and not a.attisdropped
  and (acl.grantee = 0 or r.rolname in ('anon', 'authenticated'))
order by n.nspname, c.relname, a.attnum, grantee, acl.privilege_type;

-- 6. Effective table privileges also reflect PUBLIC/inherited role grants.
-- A true result still requires applicable RLS policies and schema usage.
select n.nspname as schema_name, c.relname as table_name, r.rolname as api_role,
       r.rolsuper as is_superuser, r.rolbypassrls as bypasses_rls,
       has_schema_privilege(r.oid, n.oid, 'USAGE') as schema_usage,
       has_table_privilege(r.oid, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') as can_delete,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') as can_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join pg_roles r
where (n.nspname, c.relname) in (
  ('public', 'moviesv2'), ('public', 'appusers'),
  ('public', 'users_filimehome'), ('public', 'comments_filimehome'),
  ('public', 'likes_filimehome'), ('public', 'profiles'),
  ('public', 'user_library'), ('public', 'watch_history'),
  ('public', 'categories'), ('storage', 'objects')
)
  and r.rolname in ('anon', 'authenticated')
order by n.nspname, c.relname, r.rolname;

rollback;
