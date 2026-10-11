# Existing website and Android backend

The live `https://filimehome.com` bundle and the original repository contain the
same Supabase URL and the same legacy public `anon` key. The deployed bundle
inspected was `/assets/index-By6JMowZ.js`. The read-only audit counted **4,055**
records in the existing `moviesv2` table. No Supabase database, movie record or auth user
was created or modified by this work.

Public URL: **`https://byelcaamxxvfltnegxby.supabase.co`**.

The exact public key is the `publicKey` value in
[`config/supabase-public.json`](../config/supabase-public.json). Its SHA-256
fingerprint is `4cd91c225ecba67b1e8147a74ed652b951d24d9f25bc4c202f8b04dd4e1812d9`.
This is the site's existing legacy `anon` JWT, which is a valid public client key;
no new `sb_publishable_` key was invented or generated. Its payload has `role=anon`
and the matching project reference. Successful real REST reads verified acceptance.

- [Original live-site/public-access audit](https://github.com/footthill/Filimehome2.0/actions/runs/38154065325)
- [Successful configured build and API 35 tests](https://github.com/footthill/Filimehome2.0/actions/runs/38155017001)
- [Download configured testing APK ZIP](https://github.com/footthill/Filimehome2.0/actions/runs/38155017001/artifacts/11708288100)
- [Real catalog report, APK inspection and emulator evidence](https://github.com/footthill/Filimehome2.0/actions/runs/38155017001/artifacts/11707834457)

Extract `FilimeHome-2.0-connected-android15.apk` from the ZIP. This is version code
**3**, signed with the same testing certificate as version 2. It passed API 35
update installation, fresh installation and cold launch. The emulator displayed
4,055 catalog results, searched **Go For Broke**, selected **Action**, opened its
details, and verified that its unapproved playback button stayed disabled. Home,
Movies, Series, Search, Favorites, Profile and hardware-back checks also passed.
No playback was performed.

The read-only integration report found 3,167 movie classifications, 748 series and
140 unclassified titles, plus 59 stored genre labels (including existing case
variants). It verified direct detail lookup for movie ID
`0057f5e9-241f-4f3d-89d7-a828caef3ebd`. All 15 automated tests, web/mobile TypeScript,
web production build/private-key canary checks and Expo compatibility/export passed.
The isolated PostgreSQL policy/audit checks passed in
[run 38155016878](https://github.com/footthill/Filimehome2.0/actions/runs/38155016878).
Those isolated checks do not verify production policies.

APK SHA-256: `c4712d165972d08b0b8781b127692be62283953c0122f50eec2ac32096e0587f`.
Compiled source: `0f3f6c6a24d0e085dc27b095509a2746dede1890`.
See [Android installation](ANDROID_INSTALLATION.md) for full package/signature
metadata, installation steps and physical Samsung testing limits.

## Sharing the existing project

The website and Android app can share this project and its existing movie rows.
Both clients' source now uses a compatibility adapter explicitly selected for this project.
The live table has `publishedAt`, `tmdb_overview`, `tmdb_type`, poster/backdrop
variants and other legacy fields. It does not have the draft migration's
`published`, `streaming_authorized` or `video_url` fields. The adapter reads actual
metadata, maps existing descriptions/artwork/classifications, excludes any
explicit `published:false` records if the schema later gains that field, and
retains all streaming/offline permissions as false when absent. Unknown types
remain unclassified instead of being invented as movies or series.

Categories are derived from real `genres` values. Search filters actual titles,
narrators, countries and genres. Movie details use direct ID lookups. The mobile
catalog and saved-title grid use bounded, virtualized rendering for the large
catalog. There is no fallback collection of invented movies.

## GitHub Actions configuration

In **Settings → Secrets and variables → Actions → Variables**, optional overrides
are:

| Repository variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://byelcaamxxvfltnegxby.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Copy the exact `publicKey` from `config/supabase-public.json` |

`EXPO_PUBLIC_SUPABASE_ANON_KEY` remains supported as a legacy alias. Set only one
key variable, or use identical values. Set both URL and key together. When neither
override is set, the workflow uses the verified public configuration file, so
this testing APK can be built without a dashboard configuration change.

The configuration step validates the URL, rejects `sb_secret_`, rejects legacy
JWT roles other than `anon`, and checks legacy key project/expiry. It then writes
the public values to the current job's `GITHUB_ENV` before Expo export and Gradle
bundling. It masks the key in subsequent CI logs to avoid unnecessary repetition.
Real backend reads run before native compilation and must succeed.

These values are intentionally public and recoverable from the website/APK.
Putting a key in GitHub Secrets does not make an `EXPO_PUBLIC_*` bundled value
private. Database security must come from grants, RLS and trusted server-side
authorization. Never put a service-role key, database password, signing key,
Gemini key or TMDB private key in Expo/Vite variables or this public JSON file.

The website accepts `VITE_SUPABASE_URL` and either
`VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`. The deployed website
was inspected but not redeployed or redesigned.

## Database permissions and unresolved configuration

Verified: the existing public key can SELECT movie metadata. Queries for the
proposed `profiles`, `user_library`, `watch_history` and `categories` tables
returned missing-relation errors. The deployed website also references
`appusers`, `users_filimehome`, `comments_filimehome` and `likes_filimehome`.
No user records were fetched, no authentication accounts created, and no write
permissions were probed by inserting fake data.

Anonymous reads cannot establish whether RLS is enabled or prove write denial
or isolation between authenticated users. Use
[`production_readonly.sql`](../supabase/audits/production_readonly.sql) in the
existing project's SQL editor with an authorized owner connection. Share its
schema/policy/grant result tables, not credentials or user records. The report
uses a read-only transaction ending in `ROLLBACK`. It has been validated against
isolated PostgreSQL fixtures; it has **not** been executed against production.

Do not apply the draft migration merely to make browsing work. This preview
requires no migration. The draft replaces existing `moviesv2` policies and
defaults existing rows to unpublished, so it needs deployed-schema and policy
review plus an explicit publication plan before use. Account/library/history
features also need a reviewed integration with the existing account model. Their
required tables are unavailable through the current public API; the owner's schema
report will confirm deployment/exposure. Profile/library/history synchronization
is currently unavailable against this backend. Supabase Auth itself remains
separately unverified.

## Authorized playback

The current live rows do not include the explicit playback rights/source fields
required by the app. Existing website/download links are not evidence of Android
distribution permission. The adapter does not promote those links to playable
sources. Streaming and downloads remain unavailable for unapproved titles.

An owner-approved existing movie ID/title and authorized direct HTTPS MP4/HLS
source are required for a real playback test, together with a reviewed place to
store that authorization. Do not send expiring privileged URLs, passwords or
secret keys in chat. No authorized playback, subtitles or downloads are claimed
as tested until those prerequisites are supplied and the native test passes.
