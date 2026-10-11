# FilimeHome 2.0 implementation and verification

For the verified live website project, exact public configuration and existing
4,055-row catalog integration, see [Live backend](LIVE_BACKEND.md). Browsing now
supports that existing legacy schema without a database migration. The original
unconfigured previews below are historical; use the latest configured APK link
in the live-backend guide.

## Repository audit

The original project is a React 19/Vite 6/TypeScript website, Express server,
React Router navigation, Tailwind 4 styles, Motion animations and Lucide icons.
It uses Supabase `moviesv2`. There is no Firebase configuration, native project,
app icon file, Android signing configuration or existing test suite.
Its visual identity is black surfaces, red actions, gold accents and rounded cards.

Problems found: Vite injected Gemini/TMDB private keys into browser code;
Supabase configuration was hardcoded; the home catalog fetched only three rows;
details could only resolve that in-memory list; search generated fictional database
results; sample movie titles linked to an unrelated video; profile details were
fictional; errors were swallowed as empty results. These behaviors are corrected.

## Implemented source

- Existing Vite website and card design preserved; real catalog search, responsive
  results, direct movie-detail loading and account/admin/player routes added.
- Independent Expo SDK 54 app in `mobile/`, using React Native 0.81, TypeScript,
  React Navigation native stack and bottom tabs. Android back uses stack and tab history.
- Home featured carousel, real trending flags, release-date ordering, catalog-based
  recommendations, category filters, Movies, Series, Search, Favorites/Watchlist,
  Details, Player, Profile, Downloads and Settings.
- Supabase email authentication, display-name updates, user-specific saved lists,
  history/continue watching, error/retry/empty states and cached catalog metadata.
- Native authorized HTTPS playback through expo-video; HLS, native controls,
  fullscreen, seeking, progress/resume, published source-quality variants and
  selectable embedded subtitle tracks. External subtitle files are supported by
  the web video element; Android streams must package subtitles into HLS.
- Offline downloads only for explicitly authorized direct MP4 files, with
  seven-day local expiry, status/content-type checks, removal and deletion on sign-out.
- Admin web editor for metadata, categories, poster uploads, series episodes,
  URLs, quality variants, subtitle metadata and publish/unpublish.
- Draft Supabase migration: publication/rights metadata, account tables,
  replacement catalog policies, ownership guards, admin-only writes and poster
  storage policies. It has not been applied to production.
- Private Gemini/TMDB keys now stay on Express. API requests require a verified
  Supabase user, bounded input and a per-user rate limit. Recommendations use
  actual catalog titles and do not require an AI key.
- EAS preview APK profile and GitHub Actions native release APK/startup workflow.

## Verification status

Dependency-free domain and mocked catalog tests cover URL safety, malformed data,
publication/rights gating, offline eligibility, filters, resume, admin validation,
pagination, direct details and backend errors. See the PR for the latest run results.
Mocked tests do not prove the live Supabase project or Android device integration.

GitHub Actions has verified the web tests, TypeScript check, production build and
private-key canary exclusion. It has also verified mobile TypeScript, Expo SDK
compatibility, Android export and native project generation. APK compilation and
emulator results are recorded in the PR. A preview APK was compiled and successfully installed/cold-launched
on API 35; the original resumed-activity text assertion failed. A separate workflow
reused that exact artifact on API 30 and passed visible Home, Movies, Series,
Search, Favorites, Profile and Android hardware-back checks.

The PostgreSQL 16 policy workflow successfully executed the migration and tested
publication, own-user reads/writes, administrator permissions, forged user_metadata
roles and broad legacy-policy bypass attempts in isolated auth/storage schemas.
This does not replace live Supabase configuration/integration testing.

Verified APK build commit: `56e5158d339a87c2535e0c8edb8f7574c7094196`.
Later commits record its exact dependency lock, test evidence and database guards;
no native application source changed after that compilation.

- [Compiled preview APK archive](https://github.com/footthill/Filimehome2.0/actions/runs/38068221949/artifacts/11675568777)
- [Passed Android UI/back checks](https://github.com/footthill/Filimehome2.0/actions/runs/38070773969)
- [Passed PostgreSQL policy tests](https://github.com/footthill/Filimehome2.0/actions/runs/38071158565)

Those historical previews embedded no Supabase values and displayed a configuration
error. The latest configured build uses the verified website project and real catalog;
see [Live backend](LIVE_BACKEND.md) for current results. Playback, subtitles, account
writes and downloads have not been exercised against live authorized content. The web
watchlist remains device-local. Android library synchronization is implemented in
source but its required tables are unavailable through the live public API.

At implementation time this workspace could not install dependencies:
the configured npm proxy returned `EPERM` / connection failures. Local web/mobile
type checking, Vite build and Expo export could not start because their binaries
were unavailable. No local Android SDK, adb or EAS credentials were available.
GitHub Actions is configured to perform these checks and compile/install a
standalone preview APK; an artifact is only verified after a successful workflow.

## Required backend setup

1. **Do not apply the draft migration just to enable catalog browsing.** First
   obtain the read-only deployed schema/RLS report linked in `docs/LIVE_BACKEND.md`.
   Review `supabase/migrations/202610100001_filimehome.sql` against that report and
   the website's existing account model before any production deployment.
   It preserves movie rows, adds fields, and **replaces existing moviesv2 policies**
   and defaults existing rows to unpublished. Applying it without a publication
   plan could hide the live catalog. Permissive legacy policies also need review
   because they can bypass new access checks.
   Existing unrelated policies on pre-existing account tables and `storage.objects`
   are constrained by restrictive ownership/admin guards and should still be audited. This migration has not been executed against the live project.
2. Configure only the public URL/publishable (anon) key in root `.env` and mobile
   `.env`, using the supplied examples. Never use a Supabase service-role key in
   Vite, Expo, the repository, or chat.
3. Enable email authentication and configure confirmation/recovery URLs to the
   deployed website's `/profile` route. Native recovery uses that website; no
   unconfigured deep-link flow is claimed.
4. Set an administrator's **app_metadata** role to `admin` through a trusted
   Supabase admin operation. `user_metadata` cannot grant access. Refresh the
   administrator's session after changing claims. The editor is `/admin`.
5. Review existing rows, confirm content rights and explicitly publish permitted
   titles. New publication and authorization flags default to false; no content
   is automatically authorized. Preserve the existing ID type/default; enter a
   compatible ID in the editor when the database does not generate one.
6. Hosts must serve authorized HTTPS MP4/HLS with appropriate MIME types. Web
   video/subtitle hosts must permit CORS. Published media URLs are public catalog
   data: use only sources safe to share. Premium entitlement, DRM and short-lived
   signed-link issuance are not implemented. Cached offline permission expires
   after seven days; offline revocation cannot be immediate.
7. Configure optional server-only Gemini/TMDB keys in the deployment secret
   manager. Rotate any private keys used in previous browser builds and remove
   old deployment bundles. Removing key injection cannot revoke leaked keys.

## Android build

For the latest configured universal testing APK, verified signing/checksum,
API 35 fresh-install/update/navigation results and Samsung troubleshooting, see
[Android installation](ANDROID_INSTALLATION.md).
The download in that guide supersedes the earlier preview artifact above.

Use Node 22. Install web and mobile dependencies, use the committed mobile
lockfile, and run checks:

```sh
npm ci
npm test
npm run lint
npm run build
cd mobile
npm ci
npx expo install --check
npm run typecheck
npm run export:android
```

GitHub Actions validates the verified public configuration in
`config/supabase-public.json`, or uses a complete pair of repository-variable
overrides: `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`EXPO_PUBLIC_SUPABASE_ANON_KEY` remains an
alias). No repository-variable change is required for the existing project.
The workflow rejects secret/service-role keys and tests real catalog access before
native compilation. These checks apply to this CI workflow; local and EAS builds
must also use public client credentials. See [Live backend](LIVE_BACKEND.md).
Its native release build uses the Expo template's debug signing key
for direct preview installation, not Play Store distribution. The workflow explicitly
builds all four Android ABIs, aligns/signs the standalone APK, verifies signing,
CRC integrity, actual manifest and 16 KB ZIP alignment, and tests it on API 35.
It uploads the APK, checksum, public certificate metadata, emulator UI screenshot
and package-manager logs. The committed mobile lockfile is the exact
resolved dependency snapshot from the successful compilation. No Expo account is needed
for this local Gradle CI route.

For EAS, authorize the Expo account through its normal login mechanism, link an
EAS project, set `EAS_PROJECT_ID`, configure the public environment values for
the preview environment and run `eas build --platform android --profile preview`
from `mobile/`. EAS signing can be managed in the authorized account. Do not send
passwords, keystores or tokens in chat. Package: `com.footthill.filimehome`.
Name: `FilimeHome 2.0`. The repository lacks launcher artwork; supply/approve an
icon before release. Real account writes, playback, downloads and deployed access
policies remain unverified. Catalog integration results and physical-device versus
emulator limitations are documented in the linked guides.

The dependency audit after nonbreaking web lockfile updates reported two remaining
findings (one low and one moderate); the initial mobile install reported 35
findings (12 moderate, 23 high). These transitive dependency findings require
further patching/SDK compatibility review before a production release. No blanket
claim of production security is made.
