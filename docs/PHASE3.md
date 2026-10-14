# Phase 3 media and Android repair

The app retains FilimeHome's catalog and black/gold/green UI. No production writes
or policy changes are part of this repair. Package remains `com.footthill.filimehome`;
version code increases to 5 for installation over the Phase 2 preview.

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
with existing real metadata. Default is disabled; absent rights never become grants. In sidecar mode, that table
is authoritative: absent rows never fall back to older inline grants. A rights-service
outage preserves browsable metadata with disabled media actions and a visible retry.
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

## Feature diagnosis

| Feature | Verified cause / repair | Remaining acceptance |
| --- | --- | --- |
| Live Watch Now | Legacy source pages, DASH links and resolver results have no explicit Android rights or MP4/HLS contract. Keep actions disabled until approved sources exist. | Owner rights/source configuration and real authorized playback. |
| Live Download | `Downloadurls` contains provider pages/expiring URLs; independent offline grants and direct approved download fields are missing. Never infer rights from visibility or `hosted`. | Owner offline permission/source configuration and real authorized transfer. |
| Catalog/details | Real legacy artwork, descriptions, types and paginated metadata are adapted separately from media. Rights-service failure previously hid metadata; now it preserves browsing with disabled media and Retry movie details. | CI metadata/navigation passed; production account integration remains separate. |
| Native player | Retry must await native readiness before restoring seek/pause intent and refresh rights/source metadata. Native controls provide play/pause/seek/fullscreen, with visible status/error/retry. | MP4/HLS, pause/seek/fullscreen and retry fixture checks passed; Galaxy A05 decoding needs physical testing. |
| Downloads/offline | Resumable app-private `.part` transfers require status/MIME/size/hash/header validation, atomic promotion, serialized index and offline lease/file checks. | Interruption/integrity/pause/resume/cancel/offline fixture checks passed. Live downloads await approved rights. |
| Android APK | Keep package and preview certificate, include Samsung ARM ABIs, increase version code to 5, inspect actual APK and perform normal API 35 update/fresh installation. | Version-5 production emulator and combined CI passed; physical Galaxy A05 testing remains pending. |
| Account/profile/library | Existing deployed account schema differs from the proposed profiles/saved/history contract. | Owner account-schema review and authenticated integration tests; no account migration applied. |

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
A separate emulator-only instrumentation helper snapshots accessibility trees without
waiting for an actively updating video UI to become idle. It never ships in the APK.
The deliverable APK is built without that flag or test CA. Both use the same native
player/download/screens code. QA does not prove live production movie playback.
Native tests cover MP4/HLS, headers, redirects, pause/seek/fullscreen, failure/retry,
authorization/expiry gates, downloads, pause/resume/cancel, truncated/invalid/hash
failure cleanup, explicit retry, completed-file removal and offline playback with
the network tunnel removed. Production catalog/navigation are separately exercised
on the deliverable APK by the existing Android 15 smoke test. Samsung A05 physical
hardware remains a separate required verification; an emulator is not that device.

## Verification on 14 October 2026

The fresh read-only audit returned HTTP 200 for the website and movie metadata.
All ten media-contract fields (`published`, `streaming_authorized`, `video_url`,
`offline_authorized`, `download_url`, `source_expires_at`, `offline_expires_at`,
`media_headers`, `download_size`, `download_md5`) returned error 42703 (missing
column). `movie_media_rights` returned 42P01 (missing relation). See
`phase3-backend-evidence.json`. This is a production configuration/rights blocker,
not permission to reinterpret `link`, `hosted` or `Downloadurls` as grants.

Ubuntu CI passed all 35 automated domain/catalog tests, web TypeScript and web
build, mobile TypeScript, Expo compatibility and native compilation for the repaired
catalog adapter. Local full checks cannot run because the dependency cache is
incomplete (`tsx` missing); 29 dependency-free regression tests passed locally.
The Android 15 production emulator verified normal signature-preserving update,
fresh installation, cold launch, tab/profile/hardware-back navigation, real catalog
(4,076 titles at test time), search, category selection and direct movie details.
Those catalog checks intentionally verified disabled playback for an unapproved
movie. They do not establish live production playback or downloading.

All **15 native original-media checks passed**: MP4, HLS, HTTPS redirects, provider
headers, pause/seek/fullscreen, denied/expired-source gates, failed-source retry,
interrupted/invalid/corrupt transfer rejection, successful interrupted-transfer retry,
pause/resume/cancel, completed authorized download, offline playback after removing
the network tunnel, and completed-file removal. Reviewed screenshots show actual
decoded HLS and offline video frames. These are legal locally generated fixtures,
not live production movies.

QA fixes addressed stale shell UI dumps during active player updates, accessibility
connection startup, and the first-use Android fullscreen tutorial. The final harness
waits for a fresh native player window after tutorial removal before injecting Back;
logs from the failed attempt showed a key-up event dropped by the removed tutorial.
The delivered app does not include the UI snapshot helper or fixture test CA.

### Delivered version-5 APK and evidence

- [Successful combined workflow](https://github.com/footthill/Filimehome2.0/actions/runs/38528839914).
- [FilimeHome-2.0-Phase3-APK artifact](https://github.com/footthill/Filimehome2.0/actions/runs/38528839914/artifacts/11877820667).
- [15 native media fixture assertions, screenshots and logs](https://github.com/footthill/Filimehome2.0/actions/runs/38528839914/artifacts/11877881688).
- [Production Android 15/catalog/install/signature evidence](https://github.com/footthill/Filimehome2.0/actions/runs/38528839914/artifacts/11877229180).
- Build source commit: `c5311bc05cd086c31b11571f649139f6ebd86da1`.
- APK: **`FilimeHome-2.0-Phase3.apk`**, **71,253,975 bytes**.
- SHA-256: `370880b6ddc417c30bcade34e8d1899d2870755e3d08b8edb2312b77d7240307`.
- Package `com.footthill.filimehome`, version code **5**, minimum SDK **24**, target SDK **36**.
- ABIs: **arm64-v8a, armeabi-v7a, x86, x86_64**.
- Existing preview certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Signature verification, ZIP CRC integrity and 16 KB ZIP native-library alignment passed.
- API 35 x86_64 emulator: compatible update from the earlier version-2 preview,
  fresh installation, cold launch, real catalog, search, category/details, navigation
  and Android Back checks passed. Physical Samsung execution is not established.

Download the artifact ZIP, **extract** it, and install the `.apk` inside using
Android's normal installation flow. The artifact also includes `SHA256SUMS` and
`metadata.json`. Keep signature and device security checks enabled. See
`ANDROID_INSTALLATION.md` for package-manager diagnosis if the phone rejects it.
Later documentation commits do not change this tested native source.

Samsung Galaxy A05 hardware execution remains pending physical device access.
The preview keeps the existing `com.footthill.filimehome` package and preview signing
certificate; it is a testing APK, not a production release signing identity.
No production database writes, migrations or authorization-policy changes occurred.

## Exact owner actions required for live acceptance

1. Review `supabase/proposals/phase3-media-contract.sql` against the deployed schema
   and distribution model. Approve public distribution only if that matches the
   actual rights; per-user entitlements need an authenticated contract instead.
2. Deploy the approved additive contract through the owner's controlled backend
   process and provision only rights-confirmed movie IDs with HTTPS MP4/HLS playback
   sources and independently authorized direct MP4 download sources.
3. Set `EXPO_PUBLIC_MEDIA_CONTRACT=rights-v1` for Actions after the sidecar exists;
   rebuild the APK. Do not set it before contract deployment.
4. If using the website's legacy resolver, provide explicit provider/owner permission
   for Android streaming/downloads, authentication/entitlement rules, allowed hosts
   and redirects, supported format, expiry and safe header contract. Existing website
   behavior and a reachable link cannot establish those rights.
5. Verify at least one approved production movie for streaming, one approved download
   and offline playback, plus ordinary installation/update and decoding on the
   Samsung Galaxy A05. Account/library/history require separate review of the
   existing backend account schema as described in `LIVE_BACKEND.md`.
