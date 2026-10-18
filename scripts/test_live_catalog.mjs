// Real, read-only integration checks. Never inserts fixture movies or plays unapproved media.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createCatalog, catalogOptionsFor } from '../shared/catalog.ts';
import { canStream, canDownload, filterCatalog } from '../shared/domain.mjs';
import { validatePublicConfig } from '../shared/public-config.mjs';

const config = validatePublicConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
const catalog = createCatalog(client, catalogOptionsFor(config.url));
const movies = await catalog.list();
assert.ok(movies.length > 0, 'The actual backend returned no visible catalog records.');
assert.equal(new Set(movies.map(movie => movie.id)).size, movies.length, 'Duplicate IDs across catalog pages');
const categories = [...new Set(movies.flatMap(movie => movie.genres))].filter(Boolean).sort();
assert.ok(categories.length, 'No actual movie categories were found.');
const genre = categories[0];
const candidate = movies.find(movie => movie.genres.includes(genre) && /^[A-Za-z0-9][A-Za-z0-9 ]{2,44}$/.test(movie.title));
assert.ok(candidate, 'No safe ASCII title available for Android input automation.');
const query = candidate.title;
const searched = filterCatalog(movies, query);
const filtered = filterCatalog(movies, query, genre);
assert.ok(filtered.length && searched.length, 'Real title/category filtering failed.');
assert.ok(filtered.every(movie => movie.genres.includes(genre)), 'Category filter returned unrelated metadata.');
const movie = filtered[0];
const details = await catalog.get(movie.id);
assert.equal(details?.title, movie.title, 'Direct movie detail lookup failed.');
assert.deepEqual(details.genres, movie.genres, 'Detail categories differ from catalog metadata.');
const eligible = movies.filter(canStream);
const report = { project_url: config.url, catalog_mode: catalogOptionsFor(config.url).mode,
  total: movies.length, category_count: categories.length, categories,
  classified_movies: movies.filter(movie => movie.type === 'movie').length,
  classified_series: movies.filter(movie => movie.type === 'tv').length,
  unclassified: movies.filter(movie => movie.type === 'unknown').length,
  query, query_count: searched.length, genre, filtered_count: filtered.length,
  movie: { id: movie.id, title: movie.title, genres: movie.genres, stream_authorized: canStream(movie) },
  authorized_playback_candidates: eligible.length,
  playback_test: eligible.length ? 'requires authorized native playback test' : 'blocked: no explicit authorized streaming sources in the existing schema',
  rls_verification: 'Anonymous SELECT verified. Deployed RLS policies and authenticated isolation require owner metadata/test sessions.' };
await mkdir('backend-audit', { recursive: true });
await writeFile('backend-audit/live-catalog.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

// Owner-supplied URL is a verification target only. Never inject it into a movie.
const ownerProbe = 'https://pub-e93ca026964e48dab84e209dd9964abd.r2.dev/movies/self/468f6c24-e597-4d95-8d0c-ef9d08313457/runner-2026-delivery-men-perfect.mp4';
const approved = movies.find(item => item.video_url === ownerProbe || item.download_url === ownerProbe)
  || movies.find(item => item.title.toLocaleLowerCase() === 'runner' && canStream(item) && canDownload(item));
assert.ok(approved, 'No real catalog record matches the owner-approved verification media. Do not inject a source.');
const current = await catalog.get(approved.id);
assert.ok(current && canStream(current) && canDownload(current), 'Owner-approved movie lacks usable current playback/download sources.');
assert.ok(current.poster || current.image, 'Real verification title has no poster/artwork.');
const media = { id: current.id, title: current.title, query: current.title,
  owner_probe_url: ownerProbe, playback_url: current.video_url, download_url: current.download_url,
  owner_url_matches_backend: current.video_url === ownerProbe || current.download_url === ownerProbe,
  poster_available: Boolean(current.poster || current.image),
  narrator: movies.find(item => /^[A-Za-z][A-Za-z0-9 ]{2,35}$/.test(item.narrator))?.narrator || '' };
await writeFile('backend-audit/approved-media.json', JSON.stringify(media, null, 2) + '\n');
console.log('Approved real catalog media:', JSON.stringify({ id: media.id, title: media.title, owner_url_matches_backend: media.owner_url_matches_backend }));
