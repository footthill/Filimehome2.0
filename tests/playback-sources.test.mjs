import test from 'node:test';
import assert from 'node:assert/strict';
import { canStream, normalizeMovie, secureVideoUrl, videoContentType } from '../shared/domain.mjs';
import { validateMovieDraft } from '../shared/admin.mjs';

// URL strings are test fixtures only; no remote media is requested.
const authorized = {
  published: true,
  streaming_authorized: true,
  video_url: 'https://media.example/owned.mp4',
};

test('authorized titles accept direct HTTPS MP4 and HLS paths, including signed URLs', () => {
  for (const [url, contentType] of [
    ['https://media.example/owned.mp4', 'progressive'],
    ['https://media.example/owned.MP4?signature=fixture#t=30', 'progressive'],
    ['https://media.example/owned.m3u8', 'hls'],
    ['https://media.example/owned.M3U8?signature=fixture#track', 'hls'],
  ]) {
    assert.equal(secureVideoUrl(url), url);
    assert.equal(videoContentType(url), contentType);
    assert.equal(canStream(normalizeMovie({ ...authorized, video_url: url })), true);
  }
});

test('missing sources or explicit rights remain blocked, including legacy download fields', () => {
  for (const patch of [
    { video_url: undefined }, { video_url: null }, { video_url: '' },
    { published: undefined }, { published: false }, { published: 'true' },
    { streaming_authorized: undefined }, { streaming_authorized: false }, { streaming_authorized: 'true' },
  ]) assert.equal(canStream(normalizeMovie({ ...authorized, ...patch })), false);

  const legacy = normalizeMovie({
    id: 'existing-legacy-title',
    link: authorized.video_url,
    Downloadurls: [{ url: authorized.video_url }],
    downloadurls: [authorized.video_url],
    hosted: true,
  });
  assert.equal(legacy.video_url, '');
  assert.equal(canStream(legacy), false);
  assert.equal(canStream(null), false);
});

test('unsafe or malformed media URLs are rejected before a player can request them', () => {
  for (const url of [
    'http://media.example/owned.mp4',
    'https://user:secret@media.example/owned.mp4',
    'javascript:owned.mp4',
    'file:///tmp/owned.mp4',
    'data:video/mp4;base64,fixture',
    '//media.example/owned.mp4',
    '/owned.mp4',
    'not a URL',
    'https://',
    'https://media.example/' + 'a'.repeat(4096) + '.mp4',
    undefined, null, 42, {},
  ]) {
    assert.equal(secureVideoUrl(url), '');
    assert.equal(videoContentType(url), null);
    assert.equal(canStream({ ...authorized, video_url: url }), false);
  }
});

test('unsupported formats and filenames hidden in query strings do not pass as media', () => {
  for (const path of [
    'owned.avi', 'owned.mkv', 'owned.webm', 'owned.mpd',
    'watch.html', 'download', 'owned.mp4/',
    'watch.html?file=owned.mp4',
    'download?source=https://media.example/owned.m3u8',
    'watch.html#owned.mp4',
    'owned.mp4.html',
  ]) {
    const url = 'https://media.example/' + path;
    assert.equal(secureVideoUrl(url), '');
    assert.equal(videoContentType(url), null);
    // The playback gate also validates callers that did not normalize first.
    assert.equal(canStream({ ...authorized, video_url: url }), false);
    assert.equal(normalizeMovie({ ...authorized, video_url: url }).video_url, '');
  }
});

test('alternate qualities and episodes use the same supported-source validation', () => {
  const movie = normalizeMovie({
    ...authorized,
    qualities: [
      { label: '720p', url: 'https://media.example/720.MP4?token=fixture' },
      { label: 'Unsupported', url: 'https://media.example/1080.avi' },
      { label: 'Download page', url: 'https://media.example/download?file=1080.mp4' },
    ],
    episodes: [
      { id: '1', title: 'Approved episode', video_url: 'https://media.example/episode.m3u8#track', streaming_authorized: true },
      { id: '2', title: 'Unsupported episode', video_url: 'https://media.example/episode.mkv', streaming_authorized: true },
      { id: '3', title: 'Unapproved episode', video_url: 'https://media.example/episode.mp4' },
    ],
  });
  assert.deepEqual(movie.qualities, [{ label: '720p', url: 'https://media.example/720.MP4?token=fixture' }]);
  assert.equal(movie.episodes[0].video_url, 'https://media.example/episode.m3u8#track');
  assert.equal(movie.episodes[0].streaming_authorized, true);
  assert.equal(movie.episodes[1].video_url, '');
  assert.equal(movie.episodes[2].streaming_authorized, false);
});

test('admin rejects unsupported primary, episode and quality sources instead of silently dropping them', () => {
  const draft = { ...authorized, title: 'Unit test only', type: 'movie', genres: [], episodes: [], qualities: [], subtitles: [] };
  assert.equal(validateMovieDraft(draft).video_url, authorized.video_url);
  for (const patch of [
    { video_url: 'https://media.example/unsupported.mpd' },
    { qualities: [{ label: 'Unsupported', url: 'https://media.example/unsupported.avi' }] },
    { episodes: [{ id: '1', title: 'Episode', season: 1, number: 1, streaming_authorized: true, video_url: 'https://media.example/watch.html' }] },
  ]) assert.throws(() => validateMovieDraft({ ...draft, ...patch }));
});
