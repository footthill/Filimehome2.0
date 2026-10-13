import { secureUrl, videoContentType } from './domain.mjs';

// Public metadata may carry non-secret provider headers, never credentials.
export function mediaHeaders(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [name, header] of Object.entries(value)) {
    if (!/^(accept|user-agent|referer|origin)$/i.test(name) || typeof header !== 'string' || header.length > 1024 || /[\r\n]/.test(header)) continue;
    if (/^(referer|origin)$/i.test(name) && !secureUrl(header)) continue;
    result[name] = header;
  }
  return result;
}
export function unexpired(value, now = Date.now()) {
  return value == null || value === '' || (typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > now);
}
export function sourceFor(movie, episodeId = '', now = Date.now()) {
  if (!movie || movie.published !== true) throw new Error('This title is not published for playback.');
  const source = episodeId ? movie.episodes?.find(e => e.id === episodeId) : movie;
  if (!source || source.streaming_authorized !== true) throw new Error('Streaming is not authorized for this title.');
  if (!unexpired(source.source_expires_at, now)) throw new Error('The video link has expired. Refresh the title to request a current authorized source.');
  const uri = secureUrl(source.video_url);
  const contentType = videoContentType(uri);
  if (!contentType) throw new Error('No supported authorized HTTPS MP4 or HLS source is available.');
  return { uri, contentType, headers: mediaHeaders(source.media_headers) };
}
export function mediaError(error) {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (/401|403|expired|forbidden/i.test(raw)) return 'The source denied access or the link expired. Refresh the title and retry; access permission is required.';
  if (/404|not found/i.test(raw)) return 'The video source is no longer available. Refresh the title or contact FilimeHome.';
  if (/space|ENOSPC|storage|disk full/i.test(raw)) return 'Not enough storage. Free space on your device and retry.';
  if (/network|connect|timeout|socket|host|internet/i.test(raw)) return 'The connection was interrupted. Check your internet connection and retry.';
  // Do not expose signed URL queries, credentials, or native request diagnostics.
  return 'The media request failed. Retry or refresh the title. The source must provide a supported playable file.';
}
export function validateDownload(result, info, movie, expectedBytes = 0) {
  if (!result || ![200, 206].includes(result.status)) throw new Error(`Download HTTP ${result?.status || 'failed'}`);
  const headers = Object.fromEntries(Object.entries(result.headers || {}).map(([k,v]) => [k.toLowerCase(),v]));
  const type = headers['content-type'] || result.mimeType || '';
  if (!/^video\/mp4(?:;|$)/i.test(type) && !/^application\/octet-stream(?:;|$)/i.test(type)) throw new Error('Download response is not MP4 media.');
  if (!info.exists || info.isDirectory || !Number.isFinite(info.size) || info.size < 12) throw new Error('Download file is missing or empty.');
  const expected = movie.download_size || expectedBytes;
  if (expected > 0 && info.size !== expected) throw new Error('Download is incomplete: file size mismatch.');
  if (movie.download_md5 && info.md5?.toLowerCase() !== movie.download_md5.toLowerCase()) throw new Error('Download integrity check failed.');
  return { size: info.size, md5: info.md5 || '' };
}
