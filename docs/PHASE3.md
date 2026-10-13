# Phase 3 media and Android repair

The app retains FilimeHome's catalog and black/gold/green UI. No production writes
or policy changes are part of this repair. Package remains `com.footthill.filimehome`;
version code increases to 4 for installation over the Phase 2 preview.

## Diagnosis and production contract

The website reads `moviesv2` and uses `link`, `hosted`, `Downloadurls`, `watchUrl`
and `downloadUrl`. Its JS also calls a `/reba/resolve` worker to refresh some links.
Stored sources include hosted pages and DASH `.mpd`; some signed media URLs expire.
Neither these fields nor the resolver prove Android distribution/offline permission.
The app intentionally does not call that resolver or promote legacy URLs into rights.
An approved resolver contract (provider permission, authentication/entitlement,
allowed hosts/redirects, expiry, supported MP4/HLS result, safe request headers) is
required before enabling it. No scraping, DRM bypass, or resolver extraction occurs.

Existing metadata fields remain separately browsable. Direct playback requires
`published:true`, `streaming_authorized:true`, a valid HTTPS `.mp4` or `.m3u8`, and
an unexpired `source_expires_at` when present. Downloads independently require
`published:true`, `offline_authorized:true` and a direct HTTPS `.mp4` `download_url`.
A streaming permission/source is not required for an independently authorized download.

If the live legacy schema stays unchanged, the additive reviewed proposal is
`supabase/proposals/phase3-media-contract.sql`. It creates a separate rights table,
not new movies or modifications to moviesv2 policies. **It has not been applied.**
After owner review, deploy that contract or supply an equivalent approved contract,
provision only approved movie IDs/sources, and set the Actions repository variable
`EXPO_PUBLIC_MEDIA_CONTRACT=rights-v1`. The mobile adapter then joins explicit rights
with existing real metadata. Default is disabled; absent rights never become grants.
The proposed public-read policy assumes public distribution; per-user entitlements
require a separately reviewed authenticated policy and source resolver.

Optional public non-secret `media_headers` allow Accept, User-Agent, HTTPS Referer
and Origin. Authorization/Cookie/private tokens are not accepted from public rows.
Provider redirects and HLS segment URLs must remain HTTPS with valid certificates.
Credentialed resolver/header use remains blocked pending the owner/provider contract.
`download_size` and `download_md5` provide optional expected byte/hash verification;
`offline_expires_at` bounds offline access. MD5 here is transfer-corruption detection,
not a cryptographic authorization guarantee. Offline access is capped at seven days
or the earlier explicit owner expiry, and files are removed when signing out.
Profiles/library/history still require owner review of the deployed account schema;
the legacy backend is not silently migrated into the draft account schema.

## Repairs and limits

Native retries refresh metadata/rights, wait for actual readiness, then restore
position/pause intent. Buffering/error/loading states and fullscreen are visible.
Downloads use Expo SDK 54's supported legacy resumable API in private app documents
storage without broad storage permission. Jobs expose progress, pause/resume/cancel,
reject duplicates, stage `.part` files, check MIME/size/MD5/MP4 header, then promote
completed files and serialize the saved index. Failed and canceled partial files
are cleaned. Saved offline files are rechecked before use. Paused transfers resume
within the current process; after app restart they require a fresh retry. Mobile OS
background execution is not promised. Signed-link refresh after expiry rechecks
current approved metadata; no unauthorized fallback source is chosen.

## Reproducible native fixture QA

`media_fixture_server.py --prepare` creates original FFmpeg test patterns and sine
audio, MP4, HLS segments, poster, and a two-day local test CA. No third-party movie
content is fetched. The QA job serves HTTPS on emulator loopback via adb reverse.
A separate `EXPO_PUBLIC_FIXTURE_QA=1` build trusts that CA only for 127.0.0.1 and
uses a fixture-only catalog/download identity; it disables Supabase entirely.
The deliverable APK is built without that flag or test CA. Both use the same native
player/download/screens code. QA does not prove live production movie playback.
Native tests cover MP4/HLS, headers, redirects, pause/seek/fullscreen, failure/retry,
authorization/expiry gates, downloads, pause/resume/cancel, truncated/invalid/hash
failure cleanup, explicit retry, completed-file removal and offline playback with
the network tunnel removed. Production catalog/navigation are separately exercised
on the deliverable APK by the existing Android 15 smoke test. Samsung A05 physical
hardware remains a separate required verification; an emulator is not that device.

## Verification in this workspace (13 October 2026)

The fresh read-only audit returned HTTP 200 for the website and movie metadata.
Queries for `published`, `streaming_authorized`, and `video_url` each returned
PostgreSQL error 42703 (missing column); see `phase3-backend-evidence.json`.
Production streaming/download authorization has not been established.

The dependency-free Node regression set passed 29 tests, including authorization,
MP4/HLS URL validation, expired links, transfer integrity, readiness/error/timeout
recovery, paused retry intent, and clamping retry seeks to shorter refreshed media.
Python fixture/QA scripts compile, and `git diff --check` passes. These unit checks
do not demonstrate native decoding, file transfers, navigation, or offline playback.

Full locked dependency installation timed out; existing offline caches are incomplete.
Full `npm test`, web/mobile TypeScript, Expo export, Android build, emulator install,
native fixture playback/download/offline tests remain unverified locally.
Java, adb, emulator, and ffmpeg are not available on PATH in this workspace.
The configured CI jobs must pass before the APK can be accepted.
Samsung Galaxy A05 hardware testing is pending actual device access.

A partial-cache mobile TypeScript run exposed a canceled-job narrowing error;
that source error was fixed. Other diagnostics stemmed from the incomplete
React Native package, so a passing full TypeScript check is still required.
GitHub push was attempted and rejected because no HTTPS username/token was
available; no Phase 3 workflow run or APK artifact was created in this session.
