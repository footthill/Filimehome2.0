"""Read-only website/media evidence for the owner's authorized verification source."""
import hashlib
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

out = Path('backend-audit')
media = json.loads((out / 'approved-media.json').read_text())
report = {'movie_id': media['id'], 'title': media['title'], 'website': [], 'media': []}

def read(url, limit=8_000_000, headers=None):
    request = urllib.request.Request(url, headers={'User-Agent': 'FilimeHome-authorized-functional-check', **(headers or {})})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.status, dict(response.headers), response.read(limit)

_, _, html = read('https://filimehome.com')
for path in re.findall(r'(?:src|href)=["\x27]([^"\x27]+\.js(?:\?[^"\x27]*)?)["\x27]', html.decode()):
    url = urllib.parse.urljoin('https://filimehome.com', path)
    if urllib.parse.urlsplit(url).netloc != 'filimehome.com':
        continue
    status, _, body = read(url)
    source = body.decode()
    urls = re.findall(r'https://(?:wa\.me|api\.whatsapp\.com)/[^\s"\x27`<>]+', source)
    report['website'].append({'asset': url, 'status': status, 'sha256': hashlib.sha256(body).hexdigest(),
        'uses_Downloadurls': 'Downloadurls' in source,
        'uses_existing_resolver': 'filimehome-upload.andrewkubw.workers.dev' in source and '/reba/resolve' in source,
        'subscription_route_present': '/subscription' in source,
        'whatsapp_links': sorted(set(urls))})

for label, url in dict(owner_sample=media['owner_probe_url'], actual_backend_playback=media['playback_url']).items():
    status, headers, body = read(url, 131072, {'Range': 'bytes=0-131071'})
    normalized = {key.lower(): value for key, value in headers.items()}
    assert status in (200, 206), f'{label}: HTTP {status}'
    assert body[4:8] == b'ftyp', f'{label}: response is not an MP4 header'
    probe = subprocess.run(['ffprobe', '-v', 'error', '-probesize', '5000000', '-analyzeduration', '10000000',
        '-show_entries', 'stream=codec_name,codec_type,width,height,sample_rate,channels:format=duration,size',
        '-of', 'json', url], capture_output=True, text=True, timeout=60, check=True)
    info = json.loads(probe.stdout)
    assert any(item.get('codec_type') == 'video' for item in info['streams']), 'No video track'
    assert any(item.get('codec_type') == 'audio' for item in info['streams']), 'No audio track'
    report['media'].append({'source': label, 'status': status, 'host': urllib.parse.urlsplit(url).hostname,
        'content_type': normalized.get('content-type'), 'content_range': normalized.get('content-range'),
        'accept_ranges': normalized.get('accept-ranges'), 'mp4_header': True, 'ffprobe': info})
(out / 'functional-preflight.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
