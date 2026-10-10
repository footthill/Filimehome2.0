import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../shared/catalog.ts';

function backend(rows, failure = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'moviesv2');
      let id;
      const query = {
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
