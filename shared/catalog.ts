import type { SupabaseClient } from '@supabase/supabase-js';
import type { Movie } from '../src/types';
import { normalizeMovie } from './domain.mjs';

type CatalogOptions = { mode?: 'published' | 'legacy-public' };

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
  return {
    async list(): Promise<Movie[]> {
      const rows: Movie[] = [];
      for (let from = 0; ; from += 200) {
        let query = requireClient().from('moviesv2').select('*');
        if (!legacy) query = query.eq('published', true);
        const { data, error } = await query.order('id').range(from, from + 199);
        if (error) throw new Error(`Movie catalog unavailable: ${error.message}`);
        rows.push(...(data ?? []).filter(visible).map(normalizeMovie));
        if (!data || data.length < 200) return rows;
      }
    },
    async get(id: string): Promise<Movie | null> {
      let query = requireClient().from('moviesv2').select('*').eq('id', id);
      if (!legacy) query = query.eq('published', true);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(`Movie details unavailable: ${error.message}`);
      return data && visible(data) ? normalizeMovie(data) : null;
    },
  };
}
