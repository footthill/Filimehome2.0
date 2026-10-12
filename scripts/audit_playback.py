"""Read-only Phase 1 evidence: website code and movie source field shapes, never media."""
import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path('playback-audit')
OUT.mkdir(exist_ok=True)
config = json.loads(Path('config/supabase-public.json').read_text())
assert config['url'] == 'https://byelcaamxxvfltnegxby.supabase.co'


def read(url, headers=None):
    request = urllib.request.Request(url, headers={'User-Agent': 'FilimeHome-phase1-readonly-audit', **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(8_000_001)
            if len(body) > 8_000_000:
                raise ValueError('Audit response too large')
            return response.status, body.decode('utf-8', errors='replace')
    except urllib.error.HTTPError as error:
        return error.code, error.read(20_000).decode('utf-8', errors='replace')


def url_shape(value):
    parsed = urllib.parse.urlsplit(value)
    return {'scheme': parsed.scheme, 'host': parsed.hostname,
            'extension': Path(parsed.path).suffix.lower()[:16],
            'query_present': bool(parsed.query)}


def shape(value):
    if isinstance(value, dict):
        return {'kind': 'object', 'keys': sorted(value), 'values': {k: shape(v) for k, v in value.items()}}
    if isinstance(value, list):
        return {'kind': 'array', 'length': len(value), 'items': [shape(v) for v in value[:5]]}
    if isinstance(value, str):
        try:
            nested = json.loads(value)
            if isinstance(nested, (list, dict)):
                return {'kind': 'json-string', 'value': shape(nested)}
        except ValueError:
            pass
        urls = re.findall(r'https?://[^\s<>"\x27]+', value)
        return {'kind': 'string', 'empty': not value, 'urls': [url_shape(u) for u in urls[:5]]}
    return {'kind': type(value).__name__}


def redact(text):
    text = re.sub(r'https?://[^\s<>"\x27`]+', lambda m: '<url:' + str(url_shape(m.group())['host']) + '>', text)
    text = re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[redacted-jwt]', text)
    text = re.sub(r'[A-Za-z0-9_-]{32,}', '[redacted-token]', text)
    return re.sub(r'(?i)((?:api_?key|secret|token|password|authorization)["\x27]?\s*[:=]\s*)["\x27][^"\x27]*["\x27]', r'\1"[redacted]"', text)


report = {'timestamp_utc': datetime.now(timezone.utc).isoformat(),
          'scope': 'GET public HTML/JS and movie metadata only. No media requests, database writes or user rows.',
          'rights_verification': 'URL fields and website behavior do not prove distribution rights.', 'assets': []}
status, html = read('https://filimehome.com')
report['website_status'] = status
asset_urls = set()
for path in re.findall(r'(?:src|href)=["\x27]([^"\x27]+\.js(?:\?[^"\x27]*)?)["\x27]', html):
    url = urllib.parse.urljoin('https://filimehome.com', path)
    if urllib.parse.urlsplit(url).netloc == 'filimehome.com':
        asset_urls.add(url)
needles = ['Downloadurls', 'downloadurls', 'watchUrl', 'function IT', 'hosted', 'm3u8', '.mpd', 'video/mp4', 'iframe', 'react-player', 'jwplayer', 'dashjs', 'shaka', 'Hls(', 'jsxs("video"', 'jsx("video"']
for url in sorted(asset_urls)[:12]:
    code, source = read(url)
    excerpts = {}
    if code == 200:
        for needle in needles:
            hits = list(re.finditer(re.escape(needle), source))
            if hits:
                before = 6000 if needle in ['jsx("video"', 'jsxs("video"'] else 450
                excerpts[needle] = {'count': len(hits), 'contexts': [redact(source[max(0, m.start()-before):m.end()+1000]) for m in hits[:8]]}
    report['assets'].append({'url': url, 'status': code, 'sha256': hashlib.sha256(source.encode()).hexdigest(), 'excerpts': excerpts})

headers = {'apikey': config['publicKey'], 'Authorization': 'Bearer ' + config['publicKey']}
code, body = read(config['url'] + '/rest/v1/moviesv2?select=*&order=id&limit=12', headers)
report['movies_status'] = code
rows = json.loads(body)
if code not in (200, 206) or not isinstance(rows, list):
    raise RuntimeError('Public movie metadata read failed: HTTP ' + str(code))
report['column_names'] = sorted({k for row in rows for k in row})
fields = ['link', 'hosted', 'Downloadurls', 'downloadurls', 'publishedAt', 'published', 'streaming_authorized', 'video_url', 'qualities', 'episodes']
report['samples'] = [{'id': row['id'], 'title': row['title'], 'fields': {k: shape(row[k]) for k in fields if k in row}} for row in rows]
report['required_column_checks'] = {}
for column in ['published', 'streaming_authorized', 'video_url']:
    code, body = read(config['url'] + '/rest/v1/moviesv2?select=' + column + '&limit=0', headers)
    result = json.loads(body)
    report['required_column_checks'][column] = {'status': code, 'error': {k: result.get(k) for k in ['code', 'message']} if isinstance(result, dict) else None}
(OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
