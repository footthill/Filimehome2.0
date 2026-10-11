# FilimeHome 2.0

The existing React/Vite movie website, plus an Expo React Native Android app in
[`mobile/`](mobile). Both use the existing Supabase `moviesv2` backend and retain
FilimeHome's red-and-black design.

See [implementation, service setup and build instructions](docs/IMPLEMENTATION.md)
for verification limits, the draft database migration, admin access, content
rights and APK signing requirements. An APK is not considered ready until its
build and Android startup checks succeed.

## Website

Use Node 22, `npm ci`, copy `.env.example` to `.env`, configure the public Supabase
URL/anon key, then run `npm run dev`. Use `npm test`, `npm run lint` and
`npm run build` to validate. Production uses `NODE_ENV=production npm start`.
Gemini/TMDB are optional server-only secrets; never expose them through Vite or Expo.

## Android

Copy `mobile/.env.example` to `mobile/.env`, configure the same public Supabase
backend, then run `npm install` and `npx expo start` from `mobile/`.
The native source includes browsing, account/library sync and authorized video
playback. Existing catalog browsing requires no migration. Account/admin/playback
schema changes need review against the deployed database before use.

GitHub Actions validates the web/mobile code, compiles a standalone preview APK
and checks emulator startup. The EAS `preview` profile also produces an APK after
an Expo account/project and signing are authorized. Preview signing is not for
Play Store release. See the implementation document for exact configuration.

For the universal Android 15 testing APK, installation instructions, checksums
and Samsung device diagnostics, see [Android installation](docs/ANDROID_INSTALLATION.md).

The existing website's Supabase project and public client key are verified in
[Live backend](docs/LIVE_BACKEND.md). The configured preview reads the existing
catalog without creating a database or applying the draft migration.

The original AI Studio project remains at:
https://ai.studio/apps/ac23348d-1061-4447-8ead-c3100c69ddf5
