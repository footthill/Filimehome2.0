import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMovie, secureUrl, canStream, canDownload, filterCatalog, resumePosition } from '../shared/domain.mjs';
import { validateMovieDraft } from '../shared/admin.mjs';

const row = { id: 12, title: 'Owned film', type: 'movie', genres: ['Action'], narrator: 'Narrator', country: 'Rwanda', published: true, streaming_authorized: true, video_url: 'https://media.example/owned.m3u8', offline_authorized: true, download_url: 'https://media.example/owned.mp4?signature=example', episodes: [], qualities: [], subtitles: [] };
test('normalizes legacy identifiers and malformed optional metadata without inventing media', () => {
  const movie = normalizeMovie({ id: 1, title: 'Existing title', genres: 'Action', poster: 'http://unsafe/image.jpg', qualities: [null], subtitles: [null], episodes: [null] });
  assert.equal(movie.id, '1'); assert.deepEqual(movie.genres, []); assert.equal(movie.poster, '');
  assert.equal(movie.published, false); assert.equal(movie.video_url, ''); assert.deepEqual(movie.episodes, []);
});
test('only HTTPS URLs without embedded credentials are accepted', () => {
  for (const url of ['http://example/video', 'javascript:alert(1)', 'file:///tmp/test', 'https://user:secret@example/video', null]) assert.equal(secureUrl(url), '');
  assert.equal(secureUrl('https://media.example/owned.mp4?token=value'), 'https://media.example/owned.mp4?token=value');
});
test('streaming requires explicit publication, rights and a valid URL', () => {
  assert.equal(canStream(normalizeMovie(row)), true);
  for (const patch of [{ published: false }, { streaming_authorized: false }, { streaming_authorized: 'true' }, { video_url: '' }, { video_url: 'http://media.example/a' }]) assert.equal(canStream(normalizeMovie({ ...row, ...patch })), false);
});
test('downloads require independent offline rights and a direct MP4 source', () => {
  assert.equal(canDownload(normalizeMovie(row)), true);
  for (const patch of [{ offline_authorized: false }, { published: false }, { download_url: 'https://media.example/owned.m3u8' }, { download_url: '' }]) assert.equal(canDownload(normalizeMovie({ ...row, ...patch })), false);
});
test('search combines actual title, narrator, country, category and type filters', () => {
  const movies = [normalizeMovie(row), normalizeMovie({ ...row, id: 13, title: 'Series', type: 'tv', genres: ['Drama'] })];
  assert.equal(filterCatalog(movies, ' RWANDA ', 'Action', 'movie').length, 1);
  assert.equal(filterCatalog(movies, 'narrator', 'Drama', 'tv')[0].title, 'Series');
  assert.equal(filterCatalog(movies, 'unknown').length, 0);
});
test('resume resets completed and invalid positions and retains partial progress', () => {
  assert.equal(resumePosition(42, 100), 42); assert.equal(resumePosition(95, 100), 0);
  assert.equal(resumePosition(-1, 100), 0); assert.equal(resumePosition(NaN, 100), 0); assert.equal(resumePosition(Infinity, 100), 0);
});
test('admin rejects unsafe sources, missing rights and malformed episode data', () => {
  assert.equal(validateMovieDraft(row).title, row.title);
  for (const patch of [{ title: '' }, { type: 'invalid' }, { video_url: 'http://media.example/video' }, { streaming_authorized: false }, { offline_authorized: true, download_url: '' }, { episodes: [{ id: '1', title: 'episode', season: 1, number: 1, video_url: 'https://media.example/e.mp4', streaming_authorized: false }] }, { subtitles: [{ label: 'EN', url: 'https://media.example/en.vtt' }] }]) assert.throws(() => validateMovieDraft({ ...row, ...patch }));
});
test('series episode IDs cannot be duplicated', () => {
  const episode = { id: 's1e1', title: 'Episode 1', season: 1, number: 1, video_url: 'https://media.example/e.mp4', streaming_authorized: true };
  assert.throws(() => validateMovieDraft({ ...row, episodes: [episode, episode] }));
});
