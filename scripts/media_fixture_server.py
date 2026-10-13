"""Original FFmpeg test-pattern media; local HTTPS QA server, never production data."""
import argparse
import hashlib
import json
import ssl
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path('media-fixtures')
BASE = 'https://127.0.0.1:8443'
parser = argparse.ArgumentParser()
parser.add_argument('--prepare', action='store_true')
args = parser.parse_args()
if args.prepare:
    ROOT.mkdir(exist_ok=True)
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-keyout', str(ROOT/'key.pem'), '-out', str(ROOT/'ca.pem'), '-subj', '/CN=FilimeHome local fixture QA', '-addext', 'subjectAltName=IP:127.0.0.1', '-addext', 'basicConstraints=critical,CA:TRUE'], check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '30', '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-b:v', '600k', '-g', '48', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', str(ROOT/'generated.mp4')], check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-i', str(ROOT/'generated.mp4'), '-c', 'copy', '-hls_time', '2', '-hls_list_size', '0', '-hls_playlist_type', 'vod', '-hls_segment_filename', str(ROOT/'segment%03d.ts'), str(ROOT/'generated.m3u8')], check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-i', str(ROOT/'generated.mp4'), '-frames:v', '1', str(ROOT/'poster.jpg')], check=True, capture_output=True)
    print('Generated original MP4, HLS and poster fixtures. No third-party media used.')
    raise SystemExit()

body = (ROOT/'generated.mp4').read_bytes()
movies = []
for name, path in [('MP4', 'generated.mp4'), ('HLS', 'generated.m3u8'), ('Retry', 'retry.mp4'), ('Redirect', 'redirect.mp4'), ('Headers', 'headers.mp4'), ('Denied', 'denied.mp4'), ('Expired', 'generated.mp4'), ('Slow', 'slow.mp4'), ('Interrupted', 'broken.mp4'), ('Invalid', 'html.mp4'), ('Corrupt', 'generated.mp4'), ('Download Only', 'generated.mp4')]:
    row = {'id': name.lower().replace(' ', '-'), 'title': 'Fixture '+name, 'description': 'Locally generated original test-pattern video. QA only.', 'genres': ['Generated QA'], 'type': 'movie', 'poster': BASE+'/poster.jpg', 'image': BASE+'/poster.jpg', 'published': True, 'streaming_authorized': name != 'Download Only', 'offline_authorized': True, 'video_url': BASE+'/'+path, 'download_url': BASE+'/'+path if not path.endswith('m3u8') else '', 'download_size': len(body), 'download_md5': hashlib.md5(body).hexdigest()}
    if name == 'Denied': row.update(streaming_authorized=False, offline_authorized=False)
    if name == 'Expired': row['source_expires_at'] = '2000-01-01T00:00:00Z'
    if name == 'Corrupt': row['download_md5'] = '0'*32
    if name == 'Headers': row['media_headers'] = {'Referer': 'https://fixture.invalid/approved'}
    movies.append(row)
state = {'recover': False, 'download_recover': False}

class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, fmt, *values):
        print(fmt % values, flush=True)
    def send(self, status, data, content_type, start=0, total=None):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Connection', 'close')
        if status == 206: self.send_header('Content-Range', f'bytes {start}-{start+len(data)-1}/{total}')
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(data)
        self.close_connection = True
    def do_HEAD(self): self.do_GET()
    def do_GET(self):
        path = urlsplit(self.path).path.lstrip('/')
        if path == 'movies.json': return self.send(200, json.dumps(movies).encode(), 'application/json')
        if path == 'control/recover': state['recover'] = True; return self.send(200, b'ok', 'text/plain')
        if path == 'control/download-recover': state['download_recover'] = True; return self.send(200, b'ok', 'text/plain')
        if path == 'retry.mp4' and not state['recover']: return self.send(403, b'fixture not yet available', 'text/plain')
        if path == 'headers.mp4' and self.headers.get('Referer') != 'https://fixture.invalid/approved': return self.send(403, b'fixture provider header required', 'text/plain')
        if path == 'denied.mp4': return self.send(403, b'fixture unauthorized', 'text/plain')
        if path == 'html.mp4': return self.send(200, b'<html>This is not media</html>', 'text/html')
        if path == 'redirect.mp4':
            self.send_response(302); self.send_header('Location', BASE+'/generated.mp4'); self.send_header('Content-Length', '0'); self.end_headers(); return
        if path in ['slow.mp4', 'broken.mp4'] and not (path == 'broken.mp4' and state['download_recover']):
            start = int(self.headers.get('Range', 'bytes=0-').split('=')[1].split('-')[0] or '0')
            self.send_response(206 if start else 200); self.send_header('Content-Type', 'video/mp4'); self.send_header('Content-Length', str(len(body)-start)); self.send_header('Accept-Ranges', 'bytes')
            if start: self.send_header('Content-Range', f'bytes {start}-{len(body)-1}/{len(body)}')
            self.end_headers()
            if self.command == 'HEAD': return
            limit = len(body) if path == 'slow.mp4' else len(body)//3
            try:
                for pos in range(start, limit, 32768):
                    self.wfile.write(body[pos:min(pos+32768,limit)]); self.wfile.flush(); time.sleep(0.15)
            except (BrokenPipeError, ConnectionResetError): pass
            self.close_connection = True; return
        file = ROOT/('generated.mp4' if path in ['retry.mp4', 'headers.mp4', 'broken.mp4'] else path)
        if '/' in path or not file.exists() or file.suffix not in ['.mp4', '.m3u8', '.ts', '.jpg']: return self.send(404, b'not found', 'text/plain')
        data = file.read_bytes()
        content_type = {'.mp4': 'video/mp4', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.jpg': 'image/jpeg'}[file.suffix]
        if self.headers.get('Range'):
            bounds = self.headers['Range'].split('=')[1].split('-'); start = int(bounds[0] or '0'); end = int(bounds[1]) if bounds[1] else len(data)-1
            return self.send(206, data[start:end+1], content_type, start, len(data))
        self.send(200, data, content_type)

server = ThreadingHTTPServer(('127.0.0.1',8443),Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(ROOT/'ca.pem',ROOT/'key.pem')
server.socket = context.wrap_socket(server.socket, server_side=True)
print('Local generated-media HTTPS QA server ready', flush=True)
server.serve_forever()
