export function secureUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

// Accept only explicitly supported direct media paths. A download page or a
// filename in the query string is not evidence that the response is video.
export function videoContentType(value) {
  const url = secureUrl(value);
  if (!url) return null;
  const pathname = new URL(url).pathname;
  if (/\.m3u8$/i.test(pathname)) return 'hls';
  if (/\.mp4$/i.test(pathname)) return 'progressive';
  return null;
}

export function secureVideoUrl(value) {
  return videoContentType(value) ? secureUrl(value) : '';
}

export function normalizeMovie(row) {
  const text = value => typeof value === 'string' ? value : '';
  const source = row && typeof row === 'object' ? row : {};
  const poster = [source.poster_large, source.poster, source.poster_medium, source.poster_small].map(secureUrl).find(Boolean) || '';
  const type = [source.type, source.tmdb_type].find(value => value === 'movie' || value === 'tv') || 'unknown';
  return {
    id: String(source.id ?? ''), title: text(source.title),
    poster, image: [source.backdrop_large, source.backdrop, source.image, poster].map(secureUrl).find(Boolean) || '',
    description: text(source.description) || text(source.tmdb_overview),
    genres: Array.isArray(source.genres) ? source.genres.filter(g => typeof g === 'string') : [],
    narrator: text(source.narrator), country: text(source.country),
    release_date: text(source.release_date), modifiedAt: text(source.modifiedAt),
    type,
    published: source.published === true,
    featured: source.featured === true, trending: source.trending === true,
    streaming_authorized: source.streaming_authorized === true,
    offline_authorized: source.offline_authorized === true,
    video_url: secureVideoUrl(source.video_url), download_url: secureUrl(source.download_url),
    subtitles: Array.isArray(source.subtitles) ? source.subtitles.map(s => ({
      label: text(s?.label), language: text(s?.language), url: secureUrl(s?.url),
    })).filter(s => s.url && s.label && s.language) : [],
    qualities: Array.isArray(source.qualities) ? source.qualities.map(q => ({
      label: text(q?.label), url: secureVideoUrl(q?.url),
    })).filter(q => q.url && q.label) : [],
    episodes: Array.isArray(source.episodes) ? source.episodes.map(e => ({
      id: text(e?.id), title: text(e?.title), season: Number(e?.season) || 1,
      number: Number(e?.number) || 1, video_url: secureVideoUrl(e?.video_url),
      streaming_authorized: e?.streaming_authorized === true,
    })).filter(e => e.id && e.title) : [],
  };
}

export function filterCatalog(movies, query = '', genre = '', type = '') {
  const term = query.trim().toLocaleLowerCase();
  return movies.filter(m => (!type || m.type === type) && (!genre || m.genres.includes(genre)) &&
    (!term || [m.title, m.narrator, m.country, ...m.genres].join(' ').toLocaleLowerCase().includes(term)));
}

export function canStream(movie) {
  return movie?.published === true && movie.streaming_authorized === true && Boolean(secureVideoUrl(movie.video_url));
}

export function canDownload(movie) {
  return canStream(movie) && movie.offline_authorized === true && Boolean(secureUrl(movie.download_url)) &&
    /\.mp4$/i.test(new URL(movie.download_url).pathname);
}

export function resumePosition(position, duration) {
  if (!Number.isFinite(position) || position < 0) return 0;
  if (Number.isFinite(duration) && duration > 0) return position >= duration - 10 ? 0 : Math.min(position, duration);
  return position;
}
