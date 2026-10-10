\set ON_ERROR_STOP on
-- Isolated test schemas reproduce Supabase's trusted JWT claims interface.
-- These fixtures are never deployed as application content.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create table auth.users (id uuid primary key);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid; $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id text primary key, bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

\ir ../supabase/migrations/202610100001_filimehome.sql

-- Simulate broad pre-existing policies on shared account/storage tables.
-- Restrictive guards must prevent these policies from bypassing ownership/admin checks.
create policy legacy_open_profiles on public.profiles for all to anon, authenticated using (true) with check (true);
create policy legacy_open_library on public.user_library for all to anon, authenticated using (true) with check (true);
create policy legacy_open_history on public.watch_history for all to anon, authenticated using (true) with check (true);
create policy legacy_open_categories on public.categories for all to anon, authenticated using (true) with check (true);
create policy legacy_open_storage on storage.objects for all to anon, authenticated using (true) with check (true);
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.moviesv2 (id, title, published, streaming_authorized) values
  ('published', 'Policy test fixture', true, true), ('draft', 'Unpublished fixture', false, false);
insert into public.profiles values ('00000000-0000-0000-0000-000000000001', 'Owner'), ('00000000-0000-0000-0000-000000000002', 'Other user');
insert into public.user_library values ('00000000-0000-0000-0000-000000000002', 'published', 'favorite');
insert into public.watch_history values ('00000000-0000-0000-0000-000000000002', 'published', '', 10, 100, now());
insert into storage.objects values ('poster', 'filimehome-posters', 'owner-poster.jpg');

create function public.assert_true(condition boolean, label text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'Assertion failed: %', label; end if; end;
$$;
create function public.assert_denied(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege or check_violation then return;
  end;
  raise exception 'Write was unexpectedly allowed: %', statement;
end;
$$;
grant execute on function public.assert_true(boolean,text), public.assert_denied(text) to anon, authenticated;

set role anon;
select public.assert_true((select count(*) from public.moviesv2) = 1, 'anonymous readers see only published movies');
select public.assert_true((select count(*) from public.profiles) = 0, 'anonymous readers cannot see profiles despite legacy policy');
select public.assert_denied($q$insert into storage.objects values ('anon-poster','filimehome-posters','unauthorized.jpg')$q$);
reset role;

-- A forged user_metadata role must not grant admin rights.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","user_metadata":{"role":"admin"},"app_metadata":{}}', false);
set role authenticated;
select public.assert_true(not public.is_filimehome_admin(), 'user metadata cannot promote an administrator');
select public.assert_true((select count(*) from public.profiles) = 1, 'profiles remain isolated despite broad legacy policies');
select public.assert_true((select count(*) from public.user_library) = 0, 'other users saved lists remain private');
select public.assert_true((select count(*) from public.watch_history) = 0, 'other users progress remains private');
select public.assert_denied($q$insert into public.moviesv2(id,title) values ('unauthorized','Not permitted')$q$);
select public.assert_denied($q$insert into public.profiles values ('00000000-0000-0000-0000-000000000003','Not owner')$q$);
select public.assert_denied($q$insert into public.user_library values ('00000000-0000-0000-0000-000000000002','published','watchlist')$q$);
select public.assert_denied($q$insert into public.user_library values ('00000000-0000-0000-0000-000000000001','draft','watchlist')$q$);
select public.assert_denied($q$insert into public.watch_history values ('00000000-0000-0000-0000-000000000001','draft','',10,100,now())$q$);
select public.assert_denied($q$insert into public.categories values ('Unauthorized category')$q$);
select public.assert_denied($q$insert into storage.objects values ('user-poster','filimehome-posters','unauthorized.jpg')$q$);
insert into public.user_library values ('00000000-0000-0000-0000-000000000001','published','favorite');
insert into public.watch_history values ('00000000-0000-0000-0000-000000000001','published','',20,100,now());
update public.profiles set display_name = 'Updated owner' where id = auth.uid();
select public.assert_true((select count(*) from public.user_library) = 1, 'owner can save a published movie');
select public.assert_true((select count(*) from public.watch_history) = 1, 'owner can persist authorized playback');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', false);
set role authenticated;
select public.assert_true(public.is_filimehome_admin(), 'trusted app metadata grants admin access');
select public.assert_true((select count(*) from public.moviesv2) = 2, 'admin can view unpublished movies');
insert into public.moviesv2 (id,title,published) values ('admin-created','Admin fixture',false);
update public.moviesv2 set published = true where id = 'admin-created';
insert into public.categories values ('Admin category');
insert into storage.objects values ('admin-poster','filimehome-posters','authorized.jpg');
select public.assert_true((select published from public.moviesv2 where id = 'admin-created'), 'admin can publish');
reset role;
select 'PostgreSQL publication, ownership, admin and legacy-policy bypass checks passed.' as result;
