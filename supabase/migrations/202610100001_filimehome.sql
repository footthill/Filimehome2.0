-- Additive content/account schema for the existing moviesv2 backend.
-- Run in the Supabase SQL editor or via supabase db push after reviewing existing schema.
-- Movie rows are preserved. Existing movie policies are replaced to enforce publication/admin access.
begin;

create table if not exists public.moviesv2 (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  poster text not null default '', image text not null default '',
  genres text[] not null default '{}', narrator text not null default '',
  country text not null default '', release_date text not null default '',
  "modifiedAt" text not null default '', video_url text not null default '',
  type text not null default 'movie' check (type in ('movie', 'tv'))
);
alter table public.moviesv2 add column if not exists description text not null default '';
alter table public.moviesv2 add column if not exists published boolean not null default false;
alter table public.moviesv2 add column if not exists featured boolean not null default false;
alter table public.moviesv2 add column if not exists trending boolean not null default false;
alter table public.moviesv2 add column if not exists streaming_authorized boolean not null default false;
alter table public.moviesv2 add column if not exists offline_authorized boolean not null default false;
alter table public.moviesv2 add column if not exists download_url text not null default '';
alter table public.moviesv2 add column if not exists subtitles jsonb not null default '[]';
alter table public.moviesv2 add column if not exists qualities jsonb not null default '[]';
alter table public.moviesv2 add column if not exists episodes jsonb not null default '[]';

create or replace function public.is_filimehome_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;
revoke all on function public.is_filimehome_admin() from public;
grant execute on function public.is_filimehome_admin() to anon, authenticated;

alter table public.moviesv2 enable row level security;
-- Permissive policies combine with OR; old policies cannot be left behind.
do $$ declare policy record; begin
  for policy in select policyname from pg_policies where schemaname = 'public' and tablename = 'moviesv2'
  loop execute format('drop policy %I on public.moviesv2', policy.policyname); end loop;
end $$;
create policy movie_read on public.moviesv2 for select to anon, authenticated
  using (published = true or public.is_filimehome_admin());
create policy movie_insert on public.moviesv2 for insert to authenticated with check (public.is_filimehome_admin());
create policy movie_update on public.moviesv2 for update to authenticated
  using (public.is_filimehome_admin()) with check (public.is_filimehome_admin());
create policy movie_delete on public.moviesv2 for delete to authenticated using (public.is_filimehome_admin());
grant select on public.moviesv2 to anon;
grant select, insert, update, delete on public.moviesv2 to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80)
);
create table if not exists public.user_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id text not null,
  kind text not null check (kind in ('favorite', 'watchlist')),
  primary key (user_id, movie_id, kind)
);
create table if not exists public.watch_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id text not null,
  episode_id text not null default '',
  position double precision not null check (position >= 0 and position < 'Infinity'::float8),
  duration double precision not null check (duration > 0 and duration < 'Infinity'::float8),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id, episode_id),
  check (position <= duration)
);
create table if not exists public.categories (
  name text primary key check (length(name) between 1 and 80)
);
alter table public.profiles enable row level security;
alter table public.user_library enable row level security;
alter table public.watch_history enable row level security;
alter table public.categories enable row level security;
create policy profile_owner on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy library_read on public.user_library for select to authenticated using (user_id = auth.uid());
create policy library_insert on public.user_library for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.moviesv2 m where m.id::text = movie_id and m.published)
);
create policy library_update on public.user_library for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (select 1 from public.moviesv2 m where m.id::text = movie_id and m.published)
);
create policy library_delete on public.user_library for delete to authenticated using (user_id = auth.uid());
create policy history_owner_read on public.watch_history for select to authenticated using (user_id = auth.uid());
create policy history_owner_delete on public.watch_history for delete to authenticated using (user_id = auth.uid());
create policy history_owner_insert on public.watch_history for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.moviesv2 m where m.id::text = movie_id and m.published and
    ((episode_id = '' and m.streaming_authorized) or exists (
      select 1 from jsonb_array_elements(m.episodes) e where e->>'id' = episode_id and e->>'streaming_authorized' = 'true'
    )))
);
create policy history_owner_update on public.watch_history for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (select 1 from public.moviesv2 m where m.id::text = movie_id and m.published and
    ((episode_id = '' and m.streaming_authorized) or exists (
      select 1 from jsonb_array_elements(m.episodes) e where e->>'id' = episode_id and e->>'streaming_authorized' = 'true'
    )))
);
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy categories_admin on public.categories for all to authenticated using (public.is_filimehome_admin()) with check (public.is_filimehome_admin());
grant select, insert, update, delete on public.profiles, public.user_library, public.watch_history to authenticated;
grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;
create index if not exists moviesv2_publication on public.moviesv2(published);
create index if not exists watch_history_recent on public.watch_history(user_id, updated_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('filimehome-posters', 'filimehome-posters', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy filimehome_poster_read on storage.objects for select to anon, authenticated using (bucket_id = 'filimehome-posters');
create policy filimehome_poster_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'filimehome-posters' and public.is_filimehome_admin());
create policy filimehome_poster_update on storage.objects for update to authenticated
  using (bucket_id = 'filimehome-posters' and public.is_filimehome_admin())
  with check (bucket_id = 'filimehome-posters' and public.is_filimehome_admin());
create policy filimehome_poster_delete on storage.objects for delete to authenticated
  using (bucket_id = 'filimehome-posters' and public.is_filimehome_admin());
commit;
