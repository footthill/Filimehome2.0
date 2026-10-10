# FilimeHome 2.0 implementation and verification

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
- Additive Supabase migration: publication/rights metadata, account tables,
  row-level security, admin-only writes and poster storage policies.
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
emulator results are recorded in the PR. These checks use no live Supabase values.

At implementation time this workspace could not install dependencies:
the configured npm proxy returned `EPERM` / connection failures. Local web/mobile
type checking, Vite build and Expo export could not start because their binaries
were unavailable. No local Android SDK, adb or EAS credentials were available.
GitHub Actions is configured to perform these checks and compile/install a
standalone preview APK; an artifact is only verified after a successful workflow.

## Required backend setup

1. Review the existing Supabase schema and back up its configuration. Apply
   `supabase/migrations/202610100001_filimehome.sql` through the SQL editor or CLI.
   It preserves movie rows, adds fields, and **replaces existing moviesv2 policies**
   because permissive legacy policies would bypass the new access checks.
   Existing unrelated policies on pre-existing account tables and `storage.objects`
   must be audited too. This migration has not been executed against the live project.
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

Use Node 22. Install web and mobile dependencies, commit the generated mobile
lockfile after resolution, and run checks:

```sh
npm ci
npm test
npm run lint
npm run build
cd mobile
npm install
npx expo install --check
npm run typecheck
npm run export:android
```

GitHub Actions reads public `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` repository variables. It can build without them,
but that APK will display a configuration error instead of a functional catalog.
Its generated native release build uses the Expo template's debug signing key
for direct preview installation, not Play Store distribution. It uploads the APK,
resolved lockfile, emulator startup screenshot and log. No Expo account is needed
for this local Gradle CI route.

For EAS, authorize the Expo account through its normal login mechanism, link an
EAS project, set `EAS_PROJECT_ID`, configure the public environment values for
the preview environment and run `eas build --platform android --profile preview`
from `mobile/`. EAS signing can be managed in the authorized account. Do not send
passwords, keystores or tokens in chat. Package: `com.footthill.filimehome`.
Name: `FilimeHome 2.0`. The repository lacks launcher artwork; supply/approve an
icon before release. Real accounts, catalog, playback, downloads, access policies
and physical-device navigation still require integration testing with configured services.

The dependency audit after nonbreaking web lockfile updates reported two remaining
findings (one low and one moderate); the initial mobile install reported 35
findings (12 moderate, 23 high). These transitive dependency findings require
further patching/SDK compatibility review before a production release. No blanket
claim of production security is made.
