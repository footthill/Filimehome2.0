import type { Movie } from '../../src/types';
import { normalizeMovie } from '../../shared/domain.mjs';
// Build-time opt-in, used only by a separately named CI QA APK. No Supabase writes.
export const fixtureQA = process.env.EXPO_PUBLIC_FIXTURE_QA === '1';
export const fixtureOwner = 'local-generated-fixtures';
export const fixtureCatalog = {
  async list(): Promise<Movie[]> {
    if (!fixtureQA) throw new Error('Fixture QA is disabled.');
    const response = await fetch('https://127.0.0.1:8443/movies.json');
    if (!response.ok) throw new Error('Local fixture server is unavailable.');
    const rows = await response.json();
    return rows.map(normalizeMovie);
  },
  async get(id: string): Promise<Movie | null> { return (await this.list()).find(movie => movie.id === id) || null; },
};
