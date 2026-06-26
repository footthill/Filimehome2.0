const BASE_URL = '/api/tmdb';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

export async function fetchTrending() {
  try {
    const response = await fetch(`${BASE_URL}/trending/all/day`);
    const data = await response.json();
    return (data.results || []).map(formatMovie);
  } catch (err) {
    console.error('TMDB Error:', err);
    return [];
  }
}

export async function fetchByType(type: 'movie' | 'tv') {
  try {
    const response = await fetch(`${BASE_URL}/discover/${type}?sort_by=popularity.desc`);
    const data = await response.json();
    return (data.results || []).map((m: any) => formatMovie({ ...m, media_type: type }));
  } catch (err) {
    console.error('TMDB Error:', err);
    return [];
  }
}

export async function searchMovies(query: string) {
  try {
    const response = await fetch(`${BASE_URL}/search/multi?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    return (data.results || []).map(formatMovie);
  } catch (err) {
    console.error('TMDB Error:', err);
    return [];
  }
}

export async function fetchSimilar(id: string, type: 'movie' | 'tv') {
  try {
    const response = await fetch(`${BASE_URL}/${type}/${id}/similar`);
    const data = await response.json();
    return (data.results || []).map((m: any) => formatMovie({ ...m, media_type: type }));
  } catch (err) {
    console.error('TMDB Error:', err);
    return [];
  }
}

function formatMovie(m: any) {
  return {
    id: String(m.id),
    title: m.title || m.name,
    type: m.media_type === 'tv' ? 'tv' : 'movie',
    year: new Date(m.release_date || m.first_air_date).getFullYear() || 2024,
    rating: Number(m.vote_average?.toFixed(1)) || 0,
    posterUrl: m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop',
    backdropUrl: m.backdrop_path ? `${IMAGE_BASE_URL}${m.backdrop_path}` : 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop',
    description: m.overview,
    genres: [], // Need separate call for genres usually, skipping for simplicity
    cast: []
  };
}
