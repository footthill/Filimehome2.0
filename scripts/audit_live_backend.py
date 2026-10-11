"""Read-only discovery of the deployed site's public Supabase configuration."""
import base64
import hashlib
import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path('backend-audit')
OUT.mkdir(exist_ok=True)
REPORT = {'website': 'https://filimehome.com', 'requests': [], 'limitations': [
    'Anonymous HTTP reads cannot establish whether PostgreSQL RLS is enabled or inspect its policies.',
    'No database writes, authentication signup or playback of unapproved sources are attempted.',
]}

def read(url, headers=None, limit=8_000_000):
    request = urllib.request.Request(url, headers={'User-Agent': 'FilimeHome-owner-backend-audit/1.0', **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(limit + 1)
            if len(body) > limit:
                raise ValueError('Response exceeds audit size limit')
            return response.status, dict(response.headers), body.decode('utf-8', errors='replace'), response.url
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), error.read(100_000).decode('utf-8', errors='replace'), url
    except (OSError, ValueError) as error:
        return 0, {}, type(error).__name__, url

def discover(text):
    text = text.replace('\\/', '/')
    urls = sorted(set(re.findall(r'https://[a-z0-9-]+\.supabase\.co', text)))
    public = []
    rejected = []
    for key in set(re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', text)):
        try:
            payload = json.loads(base64.urlsafe_b64decode(key.split('.')[1] + '==='))
        except (ValueError, json.JSONDecodeError):
            continue
        if payload.get('role') == 'anon' and re.fullmatch(r'[a-z0-9]+', payload.get('ref', '')):
            public.append({'url': 'https://' + payload['ref'] + '.supabase.co', 'publicKey': key, 'kind': 'legacy-anon'})
        elif payload.get('role'):
            rejected.append({'role': payload['role'], 'fingerprint': hashlib.sha256(key.encode()).hexdigest()})
    publishable = set(re.findall(r'sb_publishable_[A-Za-z0-9_-]+', text))
    if len(urls) == 1:
        public += [{'url': urls[0], 'publicKey': key, 'kind': 'publishable'} for key in publishable]
    return urls, public, rejected

status, headers, html, final_url = read(REPORT['website'])
REPORT['website_status'] = status
REPORT['website_final_url'] = final_url
texts = [('website-html', html)] if status == 200 else []
base = urllib.parse.urlparse(final_url)
asset_urls = set()
for path in re.findall(r'(?:src|href)=["\']([^"\']+\.js(?:\?[^"\']*)?)["\']', html):
    url = urllib.parse.urljoin(final_url, path)
    if urllib.parse.urlparse(url).netloc == base.netloc:
        asset_urls.add(url)
for url in sorted(asset_urls)[:25]:
    code, _, text, _ = read(url)
    REPORT['requests'].append({'resource': url, 'status': code})
    if code == 200:
        texts.append((url, text))

original = subprocess.run(['git', 'show', '49d7af13befde88c8250c4b5b516a7eca736d55f:src/lib/supabaseClient.ts'], capture_output=True, text=True, check=True).stdout
texts.append(('original-repository', original))
configurations = {}
REPORT['discovery'] = []
for origin, text in texts:
    urls, public, rejected = discover(text)
    REPORT['discovery'].append({'origin': origin, 'project_urls': urls, 'public_key_count': len(public), 'rejected_keys': rejected,
        'table_names': sorted(set(re.findall(r'\.from\(["\']([a-zA-Z0-9_]+)["\']\)', text)))})
    for config in public:
        fingerprint = hashlib.sha256(config['publicKey'].encode()).hexdigest()
        configurations.setdefault(fingerprint, {**config, 'origins': []})['origins'].append(origin)

REPORT['backends'] = []
for fingerprint, config in configurations.items():
    backend = {'url': config['url'], 'key_kind': config['kind'], 'key_fingerprint': fingerprint, 'origins': config['origins'], 'checks': {}}
    auth_headers = {'apikey': config['publicKey']}
    if config['kind'] == 'legacy-anon':
        auth_headers['Authorization'] = 'Bearer ' + config['publicKey']
    status, response_headers, body, _ = read(config['url'] + '/rest/v1/', auth_headers)
    backend['openapi_status'] = status
    try:
        schema = json.loads(body) if status == 200 else {}
    except json.JSONDecodeError:
        schema = {}
    definitions = schema.get('definitions', {})
    backend['visible_tables'] = sorted(definitions)
    backend['moviesv2_schema'] = definitions.get('moviesv2', {})
    for name, query in [
        ('movies_sample', '/moviesv2?select=*&limit=3'),
        ('published_count', '/moviesv2?select=id&published=eq.true&limit=1'),
        ('unpublished_count', '/moviesv2?select=id&published=eq.false&limit=1'),
        ('profiles_visibility', '/profiles?select=id&limit=0'),
        ('library_visibility', '/user_library?select=user_id&limit=0'),
        ('history_visibility', '/watch_history?select=user_id&limit=0'),
        ('categories', '/categories?select=name&limit=20'),
    ]:
        code, response_headers, body, _ = read(config['url'] + '/rest/v1' + query, {**auth_headers, 'Prefer': 'count=exact'})
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = None
        check = {'status': code, 'content_range': next((v for k, v in response_headers.items() if k.lower() == 'content-range'), None)}
        if isinstance(data, dict):
            check['error'] = {k: data.get(k) for k in ['code', 'message', 'hint']}
        if name == 'movies_sample' and isinstance(data, list):
            check['sample'] = [{k: row.get(k) for k in ['id', 'title', 'type', 'tmdb_type', 'genres', 'release_date', 'publishedAt', 'published', 'streaming_authorized', 'offline_authorized'] if k in row} for row in data]
            check['column_names'] = sorted({k for row in data for k in row})
            check['source_protocols'] = sorted({urllib.parse.urlparse(str(row.get('video_url', ''))).scheme for row in data})
        if name == 'categories' and isinstance(data, list):
            check['sample'] = data
        backend['checks'][name] = check
    REPORT['backends'].append(backend)
    if backend['checks']['movies_sample']['status'] in (200, 206):
        # These are public browser credentials, never service-role/secret keys.
        (OUT / (fingerprint[:12] + '-public-config.json')).write_text(json.dumps(config, indent=2) + '\n')

(OUT / 'report.json').write_text(json.dumps(REPORT, indent=2) + '\n')
print(json.dumps(REPORT, indent=2))
