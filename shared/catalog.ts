import type { SupabaseClient } from '@supabase/supabase-js';
import type { Movie } from '../src/types';
import { normalizeMovie } from './domain.mjs';
import { websiteMovie, resolveWebsiteMovie } from './website-media.mjs';
import { withDeadline } from './deadline';

type CatalogOptions = { mode?: 'published' | 'legacy-public'; mediaContract?: 'rights-v1'; timeoutMs?: number };

// Read-only audit of filimehome.com verified this project's legacy public schema.
// Owner-authorized website compatibility; explicit publication/media denials remain effective.
export function catalogOptionsFor(url: string | undefined): CatalogOptions {
  return { mode: url?.replace(/\/$/, '') === 'https://byelcaamxxvfltnegxby.supabase.co' ? 'legacy-public' : 'published' };
}

export function createCatalog(client: SupabaseClient | null, options: CatalogOptions = {}) {
  const legacy = options.mode === 'legacy-public';
  const website = legacy && options.mediaContract !== 'rights-v1';
  const normalize = (row: Record<string, unknown>) => website ? websiteMovie(row) : normalizeMovie(row);
  const visible = (row: Record<string, unknown>) => !legacy || !Object.prototype.hasOwnProperty.call(row, 'published') || row.published === true;
  const requireClient = () => {
    if (!client) throw new Error('Supabase is not configured. Set the public URL and publishable key.');
    return client;
  };
  const mediaRights = async (signal: AbortSignal, id?: string) => {
    if (options.mediaContract !== 'rights-v1') return new Map<string, Record<string, unknown>>();
    const rights = new Map<string, Record<string, unknown>>();
    for (let from = 0; ; from += 200) {
      let query = requireClient().from('movie_media_rights').select('movie_id,published,streaming_authorized,offline_authorized,video_url,download_url,source_expires_at,offline_expires_at,media_headers,download_size,download_md5').eq('published', true);
      if (id) query = query.eq('movie_id', id);
      const { data, error } = await query.abortSignal(signal).order('movie_id').range(from, from + 199);
      if (error) throw new Error('The approved media contract is unavailable. Contact FilimeHome; browsing requires a valid backend configuration.');
      for (const row of data || []) rights.set(String(row.movie_id), row);
      if (!data || data.length < 200) return rights;
    }
  };
  const merge = (movie: Movie, rights: Map<string, Record<string, unknown>>) => {
    const approved = rights.get(movie.id);
    // Only explicit owner-provisioned rights rows may add media to legacy metadata.
    if (options.mediaContract !== 'rights-v1') return movie;
    // Sidecar mode is authoritative: never fall back to old inline grants.
    return normalizeMovie({ ...movie, streaming_authorized: false, offline_authorized: false,
      video_url: '', download_url: '', qualities: [], episodes: [], ...approved, id: movie.id });
  };
  const attachRights = async (movies: Movie[], signal: AbortSignal, id?: string) => {
    try { const rights = await mediaRights(signal, id); return movies.map(movie => merge(movie, rights)); }
    catch {
      // A media service failure must not hide otherwise accessible movie metadata.
      return movies.map(movie => ({ ...merge(movie, new Map()),
        media_availability_error: 'Media permissions could not be verified. Refresh this title and try again.' }));
    }
  };
  return {
    list(): Promise<Movie[]> { return withDeadline(async signal => {
      const rows: Movie[] = [];
      for (let from = 0; ; from += 200) {
        let query = requireClient().from('moviesv2').select('*');
        if (!legacy) query = query.eq('published', true);
        const { data, error, status } = await query.abortSignal(signal).order('id').range(from, from + 199);
        if (error) throw new Error(`Movie catalog unavailable (HTTP ${status}, ${error.code || 'request failed'}): ${error.message}`);
        rows.push(...(data ?? []).filter(visible).map(normalize));
        if (!data || data.length < 200) return attachRights(rows, signal);
      }
    }, options.timeoutMs, 'Movie catalog'); },
    get(id: string): Promise<Movie | null> { return withDeadline(async signal => {
      let query = requireClient().from('moviesv2').select('*').eq('id', id);
      if (!legacy) query = query.eq('published', true);
      const { data, error, status } = await query.abortSignal(signal).maybeSingle();
      if (error) throw new Error(`Movie details unavailable (HTTP ${status}, ${error.code || 'request failed'}): ${error.message}`);
      return data && visible(data) ? (await attachRights([website ? await resolveWebsiteMovie(data) : normalizeMovie(data)], signal, id))[0] : null;
    }, options.timeoutMs, 'Movie details'); },
  };
}
