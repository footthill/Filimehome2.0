import { normalizeMovie, secureUrl, secureVideoUrl } from './domain.mjs';

export function validateMovieDraft(draft) {
  if (!draft || typeof draft !== 'object') throw new Error('Invalid movie data.');
  if (typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 200) throw new Error('Enter a title of 1–200 characters.');
  if (!['movie', 'tv'].includes(draft.type)) throw new Error('Choose movie or series.');
  if (!Array.isArray(draft.genres) || draft.genres.some(g => typeof g !== 'string' || !g.trim() || g.length > 80)) throw new Error('Categories must be names of 1–80 characters.');
  for (const field of ['poster', 'image', 'video_url', 'download_url']) {
    if (draft[field] && !secureUrl(draft[field])) throw new Error(field + ' must be an HTTPS URL without embedded credentials.');
  }
  for (const field of ['episodes', 'qualities', 'subtitles']) if (!Array.isArray(draft[field])) throw new Error(field + ' must be a JSON array.');
  if (draft.video_url && !secureVideoUrl(draft.video_url)) throw new Error('Video must be a direct HTTPS MP4 or HLS (.m3u8) source.');
  const ids = new Set();
  for (const e of draft.episodes) {
    if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.title !== 'string' || !e.title.trim() ||
        !Number.isInteger(e.season) || e.season < 1 || !Number.isInteger(e.number) || e.number < 1 ||
        (e.video_url && !secureVideoUrl(e.video_url))) throw new Error('Each episode needs a unique string ID, title, positive season/number, and a direct HTTPS MP4 or HLS source.');
    if (draft.published && e.video_url && e.streaming_authorized !== true) throw new Error('Authorize each episode URL before publishing.');
    ids.add(e.id);
  }
  for (const q of draft.qualities) if (!q || typeof q.label !== 'string' || !q.label || !secureVideoUrl(q.url)) throw new Error('Each quality needs a label and direct HTTPS MP4 or HLS source.');
  for (const sub of draft.subtitles) if (!sub || typeof sub.label !== 'string' || !sub.label || typeof sub.language !== 'string' || !sub.language || !secureUrl(sub.url)) throw new Error('Each subtitle needs a label, language and HTTPS URL.');
  if (draft.published && (draft.video_url || draft.qualities.length) && draft.streaming_authorized !== true) throw new Error('Confirm streaming rights before publishing video URLs.');
  if (draft.offline_authorized && (!draft.streaming_authorized || !secureUrl(draft.download_url) || !/\.mp4$/i.test(new URL(draft.download_url).pathname))) throw new Error('Offline viewing requires confirmed streaming rights and a direct HTTPS MP4 URL.');
  const normalized = normalizeMovie(draft);
  return { ...normalized, title: draft.title.trim(), genres: [...new Set(draft.genres.map(g => g.trim()))] };
}
