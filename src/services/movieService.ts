import { supabase, supabaseUrl } from '../lib/supabaseClient';
import { catalogOptionsFor, createCatalog } from '../../shared/catalog';
import type { Movie } from '../types';
import { filterCatalog } from '../../shared/domain.mjs';
export const catalog = createCatalog(supabase, catalogOptionsFor(supabaseUrl));
export const fetchTrending = () => catalog.list();
export const fetchByType = async (type: 'movie' | 'tv') => filterCatalog(await catalog.list(), '', '', type);
export const searchMovies = async (query: string) => filterCatalog(await catalog.list(), query);
export const fetchSimilar = async (id: string, type: Movie['type']) =>
  filterCatalog(await catalog.list(), '', '', type).filter(m => m.id !== id).slice(0, 8);

