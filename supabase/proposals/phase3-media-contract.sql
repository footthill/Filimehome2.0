-- PROPOSAL ONLY: never automatically applied by CI. Requires owner schema/rights review.
-- Additive sidecar contract; does not alter moviesv2, legacy data or existing policies.
-- movie_id is text to avoid assuming the legacy table's SQL identifier type.
-- Review a foreign key/cast against the actual deployed schema before deployment.
begin;
create table public.movie_media_rights (
  movie_id text primary key,
  published boolean not null default false,
  streaming_authorized boolean not null default false,
  offline_authorized boolean not null default false,
  video_url text,
  download_url text,
  source_expires_at timestamptz,
  offline_expires_at timestamptz,
  media_headers jsonb not null default '{}'::jsonb,
  download_size bigint check (download_size > 0),
  download_md5 text check (download_md5 ~ '^[a-fA-F0-9]{32}$'),
  check (not streaming_authorized or video_url ~ '^https://'),
  check (not offline_authorized or download_url ~ '^https://')
);
alter table public.movie_media_rights enable row level security;
-- Proposed public distribution model ONLY. If rights are per-user, replace this
-- with a reviewed authenticated entitlement policy and authenticated resolver.
create policy "Read explicitly published owner-approved public sources"
  on public.movie_media_rights for select to anon, authenticated using (published = true);
grant select on public.movie_media_rights to anon, authenticated;
revoke insert, update, delete on public.movie_media_rights from anon, authenticated;
-- No grants of rights and no movie inserts are included. Owner provisions reviewed
-- movie IDs/sources via trusted tools after confirming distribution/offline rights.
commit;
