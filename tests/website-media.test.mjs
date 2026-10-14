import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteMovie, resolveWebsiteMovie } from '../shared/website-media.mjs';
import { canStream, canDownload } from '../shared/domain.mjs';
const mp4 = 'https://owner.example/movies/movie.mp4';
test('owner-authorized website catalog uses existing Downloadurls and same MP4 for both actions', () => {
  const movie = websiteMovie({ id: 'real', title: 'Real', Downloadurls: [{ watchUrl: mp4, downloadUrl: mp4 }] });
  assert.equal(movie.video_url, mp4); assert.equal(movie.download_url, mp4);
  assert.ok(canStream(movie)); assert.ok(canDownload(movie));
  assert.equal(canStream(websiteMovie({ link: mp4, streaming_authorized: false })), false);
  assert.equal(canDownload(websiteMovie({ link: mp4, offline_authorized: false })), false);
  assert.equal(canStream(websiteMovie({ link: mp4, published: false })), false);
});
test('HLS plays but hosted pages and HLS are not promoted to MP4 downloads', () => {
  const movie = websiteMovie({ Downloadurls: JSON.stringify([{ watchUrl: 'https://owner.example/live.m3u8' }]) });
  assert.ok(canStream(movie)); assert.equal(canDownload(movie), false);
  assert.equal(canStream(websiteMovie({ link: 'https://owner.example/page' })), false);
});
test('website worker refresh runs once and failed/unsupported results surface', async () => {
  const row = { Downloadurls: [{ watchUrl: 'https://cdn-video.rebamovie.com/manifest.mpd', title: 'Real' }] };
  let calls = 0;
  const result = await resolveWebsiteMovie(row, async (url, request) => {
    calls++; assert.ok(url.endsWith('/reba/resolve')); assert.equal(JSON.parse(request.body).name, 'Real');
    return { ok: true, json: async () => ({ downloadUrl: mp4 }) };
  });
  assert.equal(calls, 1); assert.ok(canStream(result)); assert.ok(canDownload(result));
  const failed = await resolveWebsiteMovie(row, async () => ({ ok: false, status: 503 }));
  assert.match(failed.media_availability_error, /503/); assert.equal(canStream(failed), false);
  const unsupported = await resolveWebsiteMovie(row, async () => ({ ok: true, json: async () => ({ downloadUrl: 'http://unsafe/movie.mp4' }) }));
  assert.equal(canDownload(unsupported), false);
});
test('available direct source is independent of broken secondary provider', async () => {
  const movie = await resolveWebsiteMovie({ link: mp4, Downloadurls: [{ watchUrl: 'https://cdn-video.rebamovie.com/manifest.mpd' }] }, () => { throw Error('must not request'); });
  assert.equal(movie.video_url, mp4);
});
