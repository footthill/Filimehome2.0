import type { SupabaseClient } from '@supabase/supabase-js';
import type { Movie } from '../src/types';
import { normalizeMovie } from './domain.mjs';

export function createCatalog(client: SupabaseClient | null) {
  const requireClient = () => {
    if (!client) throw new Error('Supabase is not configured. Set the public URL and publishable key.');
    return client;
  };
  return {
    async list(): Promise<Movie[]> {
      const rows: Movie[] = [];
      for (let from = 0; ; from += 200) {
        const { data, error } = await requireClient().from('moviesv2').select('*')
          .eq('published', true).order('id').range(from, from + 199);
        if (error) throw new Error(`Movie catalog unavailable: ${error.message}`);
        rows.push(...(data ?? []).map(normalizeMovie));
        if (!data || data.length < 200) return rows;
      }
    },
    async get(id: string): Promise<Movie | null> {
      const { data, error } = await requireClient().from('moviesv2').select('*')
        .eq('id', id).eq('published', true).maybeSingle();
      if (error) throw new Error(`Movie details unavailable: ${error.message}`);
      return data ? normalizeMovie(data) : null;
    },
  };
}
