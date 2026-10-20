import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogOptionsFor, createCatalog } from '../shared/catalog.ts';
import { canStream, canDownload } from '../shared/domain.mjs';

function backend(rows, failure = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'moviesv2');
      let id;
      const query = {
        abortSignal() { return query; },
        select(value) { assert.equal(value, '*'); return query; },
        eq(field, value) { calls.push([field, value]); if (field === 'id') id = value; return query; },
        order(field) { assert.equal(field, 'id'); return query; },
        range(from, to) { calls.push(['range', from, to]); return Promise.resolve({ data: failure ? null : rows.slice(from, to + 1), error: failure }); },
        maybeSingle() { return Promise.resolve({ data: rows.find(r => String(r.id) === id) || null, error: failure }); },
      };
      return query;
    },
  };
}
test('loads all catalog pages and filters publication on every request', async () => {
  const client = backend(Array.from({ length: 401 }, (_, id) => ({ id, title: 'Database title ' + id, published: true })));
  const movies = await createCatalog(client).list();
  assert.equal(movies.length, 401); assert.equal(movies[400].id, '400');
  assert.equal(client.calls.filter(c => c[0] === 'published' && c[1] === true).length, 3);
  assert.deepEqual(client.calls.filter(c => c[0] === 'range'), [['range', 0, 199], ['range', 200, 399], ['range', 400, 599]]);
});
test('direct detail lookup works beyond the first home-page results', async () => {
  const client = backend([{ id: 'beyond-home', title: 'Existing movie', published: true }]);
  assert.equal((await createCatalog(client).get('beyond-home')).title, 'Existing movie');
  assert.equal(await createCatalog(client).get('missing'), null);
  assert.ok(client.calls.some(c => c[0] === 'published' && c[1] === true));
});
test('backend failures surface instead of returning fake movies or empty success', async () => {
  const service = createCatalog(backend([], { message: 'network unavailable' }));
  await assert.rejects(service.list(), /network unavailable/);
  await assert.rejects(service.get('id'), /network unavailable/);
  await assert.rejects(createCatalog(null).list(), /not configured/);
});
test('explicit legacy catalog mode reads real metadata but grants no playback rights', async () => {
  const client = backend([{ id: 'legacy', title: 'Existing legacy title', tmdb_type: 'tv', tmdb_overview: 'Existing description' }, { id: 'hidden', title: 'Hidden', published: false }]);
  const catalog = createCatalog(client, catalogOptionsFor('https://byelcaamxxvfltnegxby.supabase.co'));
  const rows = await catalog.list();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'tv');
  assert.equal(rows[0].description, 'Existing description');
  assert.equal(canStream(rows[0]), false);
  assert.equal(canDownload(rows[0]), false);
  assert.equal(await catalog.get('hidden'), null);
  assert.equal((await catalog.get('legacy')).id, 'legacy');
  assert.equal(client.calls.some(c => c[0] === 'published'), false);
  assert.equal(catalogOptionsFor('https://otherproject.supabase.co').mode, 'published');
});

function rightsBackend(failure = null, rights = []) {
  const metadata = backend([{ id: 'approved', title: 'Real metadata', published: true,
    streaming_authorized: true, offline_authorized: true,
    video_url: 'https://old.invalid/movie.mp4', download_url: 'https://old.invalid/movie.mp4' }]);
  return { from(table) {
    if (table === 'moviesv2') return metadata.from(table);
    assert.equal(table, 'movie_media_rights');
    const q = { abortSignal() { return q; }, select() { return q; }, eq() { return q; }, order() { return q; },
      range() { return Promise.resolve({ data: failure ? null : rights, error: failure }); } };
    return q;
  } };
}
test('media contract outages preserve real browsing and fail closed for stale grants', async () => {
  const service = createCatalog(rightsBackend({ message: 'missing rights table' }), { mediaContract: 'rights-v1' });
  for (const movie of [(await service.list())[0], await service.get('approved')]) {
    assert.equal(movie.title, 'Real metadata');
    assert.equal(canStream(movie), false); assert.equal(canDownload(movie), false);
    assert.match(movie.media_availability_error, /could not be verified/);
  }
});

test('stalled catalog and details requests time out even when transport ignores abort', async () => {
  let signal;
  const query = { select() { return this; }, eq() { return this; }, order() { return this; },
    abortSignal(value) { signal = value; return this; },
    range() { return new Promise(() => {}); }, maybeSingle() { return new Promise(() => {}); } };
  const service = createCatalog({ from: () => query }, { timeoutMs: 10 });
  await assert.rejects(service.list(), /Movie catalog timed out/);
  assert.equal(signal.aborted, true);
  await assert.rejects(service.get('real'), /Movie details timed out/);
  assert.equal(signal.aborted, true);
});

test('catalog errors include real HTTP status and backend error code', async () => {
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, abortSignal() { return this; },
    range: async () => ({ status: 401, error: { code: 'PGRST301', message: 'Invalid JWT' } }) };
  await assert.rejects(createCatalog({ from: () => query }).list(), /HTTP 401, PGRST301.*Invalid JWT/);
});
test('sidecar grants are authoritative and absent rows never reuse inline permissions', async () => {
  const blocked = await createCatalog(rightsBackend(), { mediaContract: 'rights-v1' }).get('approved');
  assert.equal(canStream(blocked), false); assert.equal(canDownload(blocked), false);
  const approved = await createCatalog(rightsBackend(null, [{ movie_id: 'approved', published: true,
    streaming_authorized: true, video_url: 'https://approved.invalid/movie.m3u8' }]), { mediaContract: 'rights-v1' }).get('approved');
  assert.equal(canStream(approved), true); assert.equal(canDownload(approved), false);
  assert.equal(approved.video_url, 'https://approved.invalid/movie.m3u8');
});
