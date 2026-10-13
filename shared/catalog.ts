import type { SupabaseClient } from '@supabase/supabase-js';
import type { Movie } from '../src/types';
import { normalizeMovie } from './domain.mjs';

type CatalogOptions = { mode?: 'published' | 'legacy-public'; mediaContract?: 'rights-v1' };

// Read-only audit of filimehome.com verified this project's legacy public schema.
// This compatibility mode never grants streaming rights or changes database access.
export function catalogOptionsFor(url: string | undefined): CatalogOptions {
  return { mode: url?.replace(/\/$/, '') === 'https://byelcaamxxvfltnegxby.supabase.co' ? 'legacy-public' : 'published' };
}

export function createCatalog(client: SupabaseClient | null, options: CatalogOptions = {}) {
  const legacy = options.mode === 'legacy-public';
  const visible = (row: Record<string, unknown>) => !legacy || !Object.prototype.hasOwnProperty.call(row, 'published') || row.published === true;
  const requireClient = () => {
    if (!client) throw new Error('Supabase is not configured. Set the public URL and publishable key.');
    return client;
  };
  const mediaRights = async (id?: string) => {
    if (options.mediaContract !== 'rights-v1') return new Map<string, Record<string, unknown>>();
    const rights = new Map<string, Record<string, unknown>>();
    for (let from = 0; ; from += 200) {
      let query = requireClient().from('movie_media_rights').select('movie_id,published,streaming_authorized,offline_authorized,video_url,download_url,source_expires_at,offline_expires_at,media_headers,download_size,download_md5').eq('published', true);
      if (id) query = query.eq('movie_id', id);
      const { data, error } = await query.order('movie_id').range(from, from + 199);
      if (error) throw new Error('The approved media contract is unavailable. Contact FilimeHome; browsing requires a valid backend configuration.');
      for (const row of data || []) rights.set(String(row.movie_id), row);
      if (!data || data.length < 200) return rights;
    }
  };
  const merge = (movie: Movie, rights: Map<string, Record<string, unknown>>) => {
    const approved = rights.get(movie.id);
    // Only explicit owner-provisioned rights rows may add media to legacy metadata.
    return approved ? normalizeMovie({ ...movie, ...approved, id: movie.id }) : movie;
  };
  return {
    async list(): Promise<Movie[]> {
      const rows: Movie[] = [];
      for (let from = 0; ; from += 200) {
        let query = requireClient().from('moviesv2').select('*');
        if (!legacy) query = query.eq('published', true);
        const { data, error } = await query.order('id').range(from, from + 199);
        if (error) throw new Error(`Movie catalog unavailable: ${error.message}`);
        rows.push(...(data ?? []).filter(visible).map(normalizeMovie));
        if (!data || data.length < 200) { const rights = await mediaRights(); return rows.map(movie => merge(movie, rights)); }
      }
    },
    async get(id: string): Promise<Movie | null> {
      let query = requireClient().from('moviesv2').select('*').eq('id', id);
      if (!legacy) query = query.eq('published', true);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(`Movie details unavailable: ${error.message}`);
      return data && visible(data) ? merge(normalizeMovie(data), await mediaRights(id)) : null;
    },
  };
}
