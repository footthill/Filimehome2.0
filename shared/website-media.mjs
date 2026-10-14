import { normalizeMovie, secureUrl, secureVideoUrl } from './domain.mjs';

// The owner authorizes the existing FilmHouse catalog for Android streaming and
// distribution. Apply this adapter only to the verified legacy project; explicit
// backend denials still win. No database writes or invented columns are required.
const resolver = 'https://filimehome-upload.andrewkubw.workers.dev/reba/resolve';
const refreshHosts = new Set(['cdn-video.rebamovie.com', 'download-video.wixmp.com', 'repackager.wixmp.com', 'video.wixstatic.com']);
export function websiteOptions(row) {
  let options = row?.Downloadurls;
  if (typeof options === 'string') { try { options = JSON.parse(options); } catch { options = []; } }
  return Array.isArray(options) ? options.filter(o => o && typeof o === 'object') : [];
}
function directMP4(value) {
  const url = secureUrl(value);
  return url && /\.mp4$/i.test(new URL(url).pathname) ? url : '';
}
export function websiteMovie(row) {
  const options = websiteOptions(row);
  const play = [row.video_url, row.watchUrl, ...options.map(o => o.watchUrl), row.link,
    row.download_url, row.downloadUrl, ...options.map(o => o.downloadUrl)].map(secureVideoUrl).find(Boolean) || '';
  const download = [row.download_url, row.downloadUrl, ...options.map(o => o.downloadUrl), row.link, play].map(directMP4).find(Boolean) || '';
  return normalizeMovie({ ...row, published: row.published !== false,
    streaming_authorized: row.streaming_authorized !== false,
    offline_authorized: row.offline_authorized !== false,
    video_url: play, download_url: download });
}
export async function resolveWebsiteMovie(row, request = fetch) {
  const movie = websiteMovie(row);
  if (row.published === false) return movie;
  const option = websiteOptions(row).find(o => {
    const url = secureUrl(o.watchUrl || o.downloadUrl);
    return url && refreshHosts.has(new URL(url).hostname);
  });
  if (!option || (movie.video_url && !refreshHosts.has(new URL(movie.video_url).hostname))) return movie;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    // Same worker, body and timeout as the website. One request per detail load;
    // Retry is user initiated. Never scrape hosted pages or hard-code a movie URL.
    const response = await request(resolver, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: option.watchUrl || option.downloadUrl, name: option.title || row.title || '' }), signal: controller.signal });
    if (!response.ok) throw new Error(`Video link refresh failed (HTTP ${response.status}).`);
    const url = directMP4((await response.json()).downloadUrl);
    if (!url) throw new Error('The video service did not return a supported HTTPS MP4 source.');
    return websiteMovie({ ...row, video_url: url, download_url: url });
  } catch (error) {
    return { ...movie, video_url: '', download_url: '', media_availability_error:
      error?.name === 'AbortError' ? 'Video link refresh timed out. Retry movie details.' : String(error?.message || error) };
  } finally { clearTimeout(timer); }
}
