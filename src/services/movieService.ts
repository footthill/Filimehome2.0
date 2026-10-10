import { supabase } from '../lib/supabaseClient';
import { createCatalog } from '../../shared/catalog';
import { filterCatalog } from '../../shared/domain.mjs';
export const catalog = createCatalog(supabase);
export const fetchTrending = () => catalog.list();
export const fetchByType = async (type: 'movie' | 'tv') => filterCatalog(await catalog.list(), '', '', type);
export const searchMovies = async (query: string) => filterCatalog(await catalog.list(), query);
export const fetchSimilar = async (id: string, type: 'movie' | 'tv') =>
  filterCatalog(await catalog.list(), '', '', type).filter(m => m.id !== id).slice(0, 8);

