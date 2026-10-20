# Final Android functional repair — 14 October 2026

This repair supersedes Phase 3's requirement for new media-rights columns. The
owner explicitly authorizes streaming and distribution of the existing catalog.
No database migration or write is needed or performed.

Confirmed root causes: the legacy adapter discarded `link` and `Downloadurls`,
then required `published`, `streaming_authorized`, `offline_authorized`,
`video_url` and `download_url` fields absent from the actual `moviesv2` schema.
Watch Now was disabled and Download hidden. Downloads also required sign-in even
though the website distributes these movies publicly. The native engine itself
already supports MP4/HLS and resumable transfers.

The website source was freshly inspected. Details load `moviesv2` by ID;
`Downloadurls` options carry `watchUrl` and `downloadUrl`. Selected Wix/Reba
sources refresh through the website's `/reba/resolve` worker with a JSON POST
containing `url` and `name`. Android uses the same worker with a 12-second
request timeout and one request per detail load. Direct HTTPS MP4/HLS sources
remain independent of secondary provider failures. Hosted web pages are not
misrepresented as native media. Explicit backend denials remain effective.

The supplied MP4 belongs to live movie `Runner`, record ID
`bd27a2b6-405f-430e-a78c-1c3409c41b3c`. The storage-path UUID is not its database
record ID. Both watch and download options contain that MP4. A browser-header
range request returned HTTP 206, `video/mp4`, `bytes 0-1023/699077773` and an
MP4 `ftyp` header. This establishes connectivity only, not decoded playback.

Version code 6 retains package, artwork, navigation, colors, native player,
resumable download/integrity verification, and the existing preview certificate.
Anonymous downloads have a device-local index and can play offline. Completed
files can be saved through Android's ACTION_CREATE_DOCUMENT picker and opened
with a video app. Export streams bytes natively without loading entire movies
into JavaScript memory or requesting broad storage access. Transfer progress is
actual byte progress; completion requires file verification.

Local domain/media regression checks: 21 passed. First CI run's web tests,
web/mobile TypeScript, live catalog checks and Expo export passed. Its Kotlin
compile exposed React Native 0.81's removed module-level `currentActivity`
accessor; fixed to `ReactApplicationContext.currentActivity` before the next build.

Build and native acceptance results must be taken from the final Actions run,
not inferred from local unit tests or the older version-5 fixture evidence.
Physical Samsung A05 playback/audio, filesystem permissions and external app
handoffs remain device acceptance work. Account/profile synchronization still
uses a schema differing from the deployed website and remains outside verified
media functionality.
