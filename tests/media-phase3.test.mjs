import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMovie, canDownload, canStream } from '../shared/domain.mjs';
import { sourceFor, mediaHeaders, validateDownload, mediaError } from '../shared/media.mjs';
import { replacePlaybackSource } from '../shared/playback.mjs';
const row = { published: true, streaming_authorized: true, offline_authorized: true, video_url: 'https://fixture.invalid/generated.mp4', download_url: 'https://fixture.invalid/generated.mp4' };
test('download authorization is independent of streaming permission and video source', () => {
  const movie = normalizeMovie({ ...row, streaming_authorized: false, video_url: '' });
  assert.equal(canStream(movie), false); assert.equal(canDownload(movie), true);
});
test('expired, malformed and unavailable sources fail before a player request', () => {
  for (const patch of [{ published: false }, { streaming_authorized: false }, { video_url: 'http://fixture.invalid/a.mp4' }, { source_expires_at: '2000-01-01T00:00:00Z' }, { source_expires_at: 'invalid' }]) assert.throws(() => sourceFor(normalizeMovie({ ...row, ...patch })));
  for (const suffix of ['mp4', 'm3u8']) assert.equal(sourceFor(normalizeMovie({ ...row, video_url: `https://fixture.invalid/generated.${suffix}` })).contentType, suffix === 'mp4' ? 'progressive' : 'hls');
});
test('provider headers cannot smuggle credentials, insecure referers or header injection', () => {
  assert.deepEqual(mediaHeaders({ Referer: 'https://fixture.invalid/approved', Authorization: 'secret', Cookie: 'secret', Origin: 'http://unsafe.invalid', Accept: 'video/mp4\r\nx: y' }), { Referer: 'https://fixture.invalid/approved' });
});
test('complete download validates MIME, status, bytes and owner-provided integrity', () => {
  const info = { exists: true, isDirectory: false, size: 123, md5: 'a'.repeat(32) };
  const result = { status: 200, headers: { 'Content-Type': 'video/mp4' } };
  assert.equal(validateDownload(result, info, { download_size: 123, download_md5: 'a'.repeat(32) }).size, 123);
  for (const changed of [{ status: 403 }, { status: 404 }, { status: 500 }, { headers: { 'content-type': 'text/html' } }]) assert.throws(() => validateDownload({ ...result, ...changed }, info, {}));
  for (const changed of [{ exists: false }, { size: 0 }, { size: 122 }, { md5: 'b'.repeat(32) }]) assert.throws(() => validateDownload(result, { ...info, ...changed }, { download_size: 123, download_md5: 'a'.repeat(32) }));
  assert.throws(() => validateDownload(result, info, {}, 124), /incomplete/);
});
test('replacement waits for actual native readiness before seeking or resuming', async () => {
  let notify; const calls = [];
  const player = { status: 'loading', addListener(_event, callback) { notify = callback; return { remove() {} }; }, async replaceAsync() { setTimeout(() => { player.status = 'readyToPlay'; notify({ status: 'readyToPlay' }); }, 10); }, set currentTime(value) { calls.push(['seek', value]); }, play() { calls.push(['play']); }, pause() { calls.push(['pause']); } };
  const pending = replacePlaybackSource(player, {}, { position: 9, playing: true });
  assert.deepEqual(calls, []); await pending; assert.deepEqual(calls, [['seek', 9], ['play']]);
});
test('replacement timeout and error never seek or start a failed source', async () => {
  let notify; const calls = [];
  const player = { status: 'loading', addListener(_event, callback) { notify = callback; return { remove() {} }; }, async replaceAsync() {}, set currentTime(value) { calls.push(value); }, play() { calls.push('play'); }, pause() {} };
  await assert.rejects(replacePlaybackSource(player, {}, { position: 5, playing: true }, 5), /timeout/);
  const failed = replacePlaybackSource(player, {}, { position: 5, playing: true }); notify({ status: 'error' }); await assert.rejects(failed); assert.deepEqual(calls, []);
});
test('understandable errors redact signed URLs and credentials', () => {
  const result = mediaError(new Error('https://fixture.invalid/movie.mp4?private=secret'));
  assert.equal(result.includes('secret'), false);
  assert.match(mediaError(new Error('HTTP 403')), /denied access/);
  assert.match(mediaError(new Error('ENOSPC')), /storage/);
  assert.match(mediaError(new Error('socket interrupted')), /connection/);
});

test('retry clamps saved position when the refreshed source is shorter', async () => {
  let position;
  const player = { status: 'readyToPlay', duration: 12, async replaceAsync() {}, set currentTime(value) { position = value; }, play() {}, pause() {} };
  await replacePlaybackSource(player, {}, { position: 50, playing: false });
  assert.equal(position, 11.9);
});
