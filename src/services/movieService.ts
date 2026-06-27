import { supabase } from '../lib/supabaseClient';
import { Movie } from '../types';

const mapMovie = (m: any): Movie => ({
  id: String(m.id),
  title: m.title,
  poster: m.poster || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop',
  image: m.image || 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop',
  genres: m.genres || [],
  narrator: m.narrator || '',
  country: m.country || '',
  release_date: m.release_date || '',
  modifiedAt: m.modifiedAt || '',
  video_url: m.video_url,
  type: m.type || 'movie',
});

export async function fetchTrending(): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('moviesv2')
    .select('*')
    .limit(20);
  
  if (error) {
    console.error('Supabase Error fetchTrending:', JSON.stringify(error, null, 2));
    return [];
  }
  return (data || []).map(mapMovie);
}

export async function fetchByType(type: 'movie' | 'tv'): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('moviesv2')
    .select('*')
    .eq('type', type)
    .limit(20);
  
  if (error) {
    console.error('Supabase Error fetchByType:', JSON.stringify(error, null, 2));
    return [];
  }
  return (data || []).map(mapMovie);
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('moviesv2')
    .select('*')
    .ilike('title', `%${query}%`);
  
  if (error) {
    console.error('Supabase Error searchMovies:', JSON.stringify(error, null, 2));
    return [];
  }
  return (data || []).map(mapMovie);
}

export async function fetchSimilar(id: string, type: 'movie' | 'tv'): Promise<Movie[]> {
  const { data, error } = await supabase
    .from('moviesv2')
    .select('*')
    .eq('type', type)
    .neq('id', id)
    .limit(5);
  
  if (error) {
    console.error('Supabase Error fetchSimilar:', JSON.stringify(error, null, 2));
    return [];
  }
  return (data || []).map(mapMovie);
}
